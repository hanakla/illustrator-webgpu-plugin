#include <iostream>
#include <memory>
#include <numeric>
#include <regex>
#include <functional>

#include "consts.h"
#include "./libs/regex.h"
#include "HelloWorldPlugin.h"
#include "HelloWorldSuites.h"
#include "./views/ImgUIEditModal.h"

#include "debugHelper.h"

#ifndef CHKERR
#define CHKERR aisdk::check_ai_error(error)
#endif

using json = nlohmann::json;

Plugin *AllocatePlugin(SPPluginRef pluginRef)
{
    return new HelloWorldPlugin(pluginRef);
}

void FixupReload(Plugin *plugin)
{
    HelloWorldPlugin::FixupVTable((HelloWorldPlugin *)plugin);
}

HelloWorldPlugin::HelloWorldPlugin(SPPluginRef pluginRef)
    : Plugin(pluginRef),
      fLiveEffect(nullptr),
      aiDenoMain(nullptr)
{
    strncpy(fPluginName, kHelloWorldPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin()
{
//    delete aiDenoMain;
}

ASErr HelloWorldPlugin::StartupPlugin(SPInterfaceMessage *message)
{
    ASErr error = kNoErr;
    
    csl("ai-deno: current err %d", error);

    try
    {
        csl("ai-deno: Start up");
        error = Plugin::StartupPlugin(message);
        CHKERR;

        csl("ai-deno: Loading live effects");
        aiDenoMain = ai_deno::initialize(&HelloWorldPlugin::StaticHandleDenoAiAlert);
        error = this->InitLiveEffect(message);
        CHKERR;
    }
    catch (std::exception &ex)
    {
        std::cout << "ヷ！死んじゃった……: " << stringify_ASErr(error) << " what:" << ex.what() << std::endl;
    }

    //	sAIUser->MessageAlert(ai::UnicodeString(returns));
    //    free(returns);
    return error;
}

ASErr HelloWorldPlugin::ShutdownPlugin(SPInterfaceMessage *message)
{
    ASErr error = kNoErr;
    //	sAIUser->MessageAlert(ai::UnicodeString("Goodbye from HelloWorld!"));
    error = Plugin::ShutdownPlugin(message);
    return error;
}

ASErr HelloWorldPlugin::InitLiveEffect(SPInterfaceMessage *message)
{
    ASErr error = kNoErr;
    short filterIndex = 0;

    csl("✨️ Init Live Effect");
    ai_deno::FunctionResult *effectResult = ai_deno::get_live_effects(aiDenoMain);
    csl("OKOK");
    if (!effectResult->success)
    {
        csl("Failed to get live effects");
        return kCantHappenErr;
    }

    csl("Received effects");
    csl("Received effects2 %s", effectResult->json);
    json effects = json::parse(effectResult->json);
    // ai_deno::dispose_function_result(effectResult);
    // delete effectResult;

    csl("Received effects: %s", effects.dump(2).c_str());

    std::vector<AILiveEffectData> effectData;
    for (auto &effectDef : effects)
    {
        csl(" Loading deno-ai effect: %s", effectDef.dump().c_str());

        AILiveEffectData effect;
        effect.self = message->d.self;

        std::string name;
        effect.name = string_format_to_char("%s%s",
                                            EFFECT_PREFIX.c_str(),
                                            effectDef["id"].get<std::string>().c_str());

        effect.title = suai::str::strdup(
            suai::str::toAiUnicodeStringUtf8(effectDef["title"].get<std::string>()));
        effect.majorVersion = effectDef["version"]["major"].get<int>();
        effect.minorVersion = effectDef["version"]["minor"].get<int>();
        effect.prefersAsInput = AIStyleFilterPreferredInputArtType::kInputArtDynamic;
        effect.styleFilterFlags = AIStyleFilterFlags::kPostEffectFilter;

        AddLiveEffectMenuData menu;
        menu.category = ai::UnicodeString("Deno Effectors", kAIUTF8CharacterEncoding).as_UTF8().data();
        menu.title = effect.title;
        error = sAILiveEffect->AddLiveEffect(&effect, &this->fEffects[filterIndex]);
        CHKERR;

        error = sAILiveEffect->AddLiveEffectMenuItem(this->fEffects[filterIndex], effect.name, &menu, NULL, NULL);
        CHKERR;

        filterIndex++;
    };

    this->fNumEffects = filterIndex;

    return error;
}

ASErr HelloWorldPlugin::GoLiveEffect(AILiveEffectGoMessage *message)
{
    std::cout << "GO LIVE!! EFFECT!!!" << std::endl;

    ASErr error = kNoErr;

    PluginParams params;
    error = this->getDictionaryValues(
        message->parameters,
        &params,
        PluginParams{
            .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
            .params = json(),
        });

    // clang-format off
    AIRasterizeSettings settings = suai::createAIRasterSetting({
        .type = suai::RasterType::ARGB,
        .antiAlias = 2,
        .colorConvert = suai::RasterSettingColorConvert::Standard,
        .preserveSpotColors = true,
        .options = suai::RasterSettingOption {
            .useMinTiles = true,
            .useEffectsRes= true,
        }
    });
    // clang-format on

    try
    {
        AIArtHandle art = message->art;

        suai::ArtSet *artSet = new suai::ArtSet();
        artSet->AddArt(art);

        AIRealRect bounds;
        error = sAIRasterize->ComputeArtBounds(artSet->ToAIArtSet(), &bounds, false);

        AIArtHandle rasterArt;
        error = sAIArt->NewArt(AIArtType::kRasterArt, AIPaintOrder::kPlaceDefault, art, &rasterArt); // CHKERR;

        // sAIArt->

        error = sAIRasterize->Rasterize(
            artSet->ToAIArtSet(),
            &settings,
            &bounds,
            AIPaintOrder::kPlaceAbove,
            art,
            &rasterArt,
            NULL);
        CHKERR;

        AIRasterRecord info;
        sAIRaster->GetRasterInfo(rasterArt, &info);
        unsigned char bytes = info.bitsPerPixel / 8;

        AIRealRect bbox;
        sAIRaster->GetRasterBoundingBox(rasterArt, &bbox);

        AISlice artSlice = {0}, workSlice = {0};
        workSlice.top = artSlice.top = info.bounds.top;
        workSlice.bottom = artSlice.bottom = info.bounds.bottom;
        workSlice.left = artSlice.left = info.bounds.left;
        workSlice.right = artSlice.right = info.bounds.right;
        workSlice.back = artSlice.back = bytes;

        AITile workTile = {0};
        workTile.colBytes = bytes;

        uint32 width = artSlice.right - artSlice.left;
        uint32 height = artSlice.bottom - artSlice.top;

        size_t dataSize = width * height * bytes;
        workTile.data = new unsigned char[dataSize];
        workTile.rowBytes = width * bytes;

        workTile.channelInterleave[0] = 1;
        workTile.channelInterleave[1] = 2;
        workTile.channelInterleave[2] = 3;
        workTile.channelInterleave[3] = 0;

        workTile.bounds = artSlice;

        error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
        CHKERR;

        const ai::uint32 totalPixels = width * height;
        const ai::uint32 pixelStride = workTile.colBytes;
        ai::uint8 *pixelData = static_cast<ai::uint8 *>(workTile.data);
        uintptr_t byteLength = totalPixels * pixelStride;

        print_AISlice(&artSlice, "artSlice");

        ai_deno::ImageDataPayload input = ai_deno::ImageDataPayload{
            .width = width,
            .height = height,
            .data_ptr = (void *)pixelData,
            .byte_length = byteLength,
        };

        ai_deno::DoLiveEffectResult *result = ai_deno::do_live_effect(
            aiDenoMain,
            params.effectName.c_str(),
            params.params.dump().c_str(),
            &input);

        // ai_deno::ArrayBufferRef *result = ai_deno::execute_deno(
        //     denoRuntimeRef,
        //     denoModuleRef,
        //     &input);

        if (result != nullptr && result->success)
        {
            // clang-format off
            std::cout << "Result: \n "
                << "  width: " << result->data->width << "\n"
                << "  height: " << result->data->height << "\n"
                << "  byte_length: " << result->data->byte_length << "\n"
                << "  data_ptr: " << result->data->data_ptr << "\n"
                << std::endl;
            // clang-format on

            if (pixelData == result->data->data_ptr)
            {
                std::cout << "Effect: Same data pointer" << std::endl;
            }

            workTile.data = result->data->data_ptr;

            error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
        }

        // for (ai::uint32 i = 0; i < totalPixels * pixelStride; i += pixelStride)
        // {
        //     if (i + 3 >= totalPixels * pixelStride)
        //         break;

        //     ai::uint8 *pixel = pixelData + i;
        //     pixel[0] = 255; // Red
        //     pixel[1] = 0;   // Green
        //     pixel[2] = 0;   // Blue
        //     pixel[3] = 255; // Alpha
        // }

        message->art = rasterArt;
    }
    catch (const ai::Error &ex)
    {
        std::cout << (AIErr)ex << ":" << ex.what() << std::endl;
    }
    catch (exception &ex)
    {
        std::cout << "exception: " << ex.what() << std::endl;
    }

    return error;
}

ASErr HelloWorldPlugin::EditLiveEffectParameters(AILiveEffectEditParamMessage *message)
{
    ASErr error = kNoErr;
    std::cout << "EDIT LIVE!! EFFECT!!!" << std::endl;
    suai::LiveEffect *effect = new suai::LiveEffect(message->effect);

    try
    {
        //            // プレビューが表示されたかどうか。
        //            m_previewed = false;
        //            // コールバック関数で使用するため、message を保持する
        //            m_effectMessage = message;
        //            // 処理対象オブジェクトから効果の設定値を取得する。
        //            // 初回処理時は既定値になる。
        //            getDictionaryValues(message->parameters);
        //            // 現時点の設定値を保持する。キャンセル時に復旧するため。
        //            MyParms saved_parms = m_parms;
        //
        //            // オブジェクトに当該効果が複数使われている場合、クラス変数の m_parms は
        //            // プレビューで効果が累積的に適用される際にそれぞれの設定値に置き換えられる。
        //            // このため、編集中の設定値は一時的な構造体に保持する。
        //            m_tmpParms = m_parms;

        std::string effectName = effect->getName();
        CHKERR;

        std::string normalizeEffectId = std::regex_replace(effectName, std::regex("^" + escapeStringRegexp(EFFECT_PREFIX)), "");

        PluginParams paramsDict;
        error = getDictionaryValues(message->parameters, &paramsDict, PluginParams{
                                                                          .effectName = normalizeEffectId,
                                                                          .params = json::object(),
                                                                      });
        CHKERR;

        json initialParams(paramsDict.params);
        json nodeTree;
        ImGuiModal::IModalImpl *modal;

#ifdef MAC_ENV
        modal = ImGuiModal::createModal();
#else
        AIWindowRef hwndParent;
        error = sAIAppContext->GetPlatformAppWindow(&hwndParent);
        CHKERR;
        int dialogResult = myImGuiDialog::runModal((HWND)hwndParent);
#endif

        ImGuiModal::OnChangeCallback modaloOnChangeCallback = [paramsDict, initialParams, &nodeTree, &modal, this](json patch)
        {
            std::cout << "updated param: " << patch.dump() << std::endl;
            json nextParams(initialParams);
            nextParams.merge_patch(patch);

            ai_deno::FunctionResult *result = ai_deno::get_live_effect_view_tree(
                this->aiDenoMain,
                paramsDict.effectName.c_str(),
                nextParams.dump().c_str());

            if (!result->success)
            {
                std::cerr << "Failed to get live effect view tree" << std::endl;
            }
            else
            {
                nodeTree = json::parse(result->json);
                ai_deno::dispose_function_result(result);
                modal->updateRenderTree(nodeTree);

                csl("View tree updated: %s", result->json);
            }
        };

        modaloOnChangeCallback(initialParams);

        ModalStatusCode dialogResult = modal->runModal(nodeTree, modaloOnChangeCallback);

        // dialogResult = 0:close, 1:cancel, 2:OK
        if (dialogResult == 2)
        {
            // m_parms = m_tmpParms;
            //            this->onChangeCallback()();
        }
        //        else if (m_previewed)
        //        {
        ////            if (message->isNewInstance)
        ////            {
        ////                // 初回処理時にキャンセルした場合、効果を削除する。
        ////                // AIDocumentSuite にも Undo という関数があるがうまく機能しない。
        ////                error = sAIUndo->UndoChanges();
        ////                CHKERR;
        ////            }
        ////            else
        ////            {
        ////                // 効果を復旧する
        ////                m_tmpParms = saved_parms;
        ////                this->onChangeCallback();
        ////            }
        //        }
    }
    catch (ai::Error &ex)
    {
        error = ex;
    }
    catch (...)
    {
        error = kCantHappenErr;
    }
    return error;

    //    ASErr error = kNoErr;
    //
    //    AIDictKey key;
    //    PluginParams params;
    //
    //    error = this->getDictionaryValues(message->parameters, params);
    //
    //    ai::UnicodeString out;
    //    error = sAIUser->GetInputFromUser(
    //        ai::UnicodeString("DENODE-NO De-no de-No"),
    //        NULL,
    //        ai::UnicodeString("Script:"),
    //        params.script,
    //        NULL,
    //        &out,
    //        200);
    //
    //    if (!error)
    //    {
    //        params.script = out;
    //        this->putParamsToDictionaly(message->parameters, params);
    //        sAILiveEffect->UpdateParameters(message->context);
    //    }

    return error;
}

ASErr HelloWorldPlugin::getDictionaryValues(const AILiveEffectParameters &dict, PluginParams *params, PluginParams defaultParams)
{
    ASErr error = kNoErr;

    std::string effectName = suai::dict::getString(dict, AI_DENO_DICT_EFFECT_NAME, defaultParams.effectName, &error);
    std::string paramsJson = suai::dict::getString(dict, AI_DENO_DICT_PARAMS, std::string(defaultParams.params.dump()), &error);

    params->effectName = effectName + "";
    params->params = json::parse(paramsJson);

    return error;
}

ASErr HelloWorldPlugin::putParamsToDictionaly(const AILiveEffectParameters &dict, PluginParams params)
{
    ASErr error = kNoErr;

    suai::dict::setString(dict, AI_DENO_DICT_EFFECT_NAME, params.effectName);
    suai::dict::setString(dict, AI_DENO_DICT_PARAMS, params.params.dump());

    return error;
}

void HelloWorldPlugin::StaticHandleDenoAiAlert(const ai_deno::FunctionResult *request)
{
    json req = json(request->json);

    if (req.contains("kind") && req["kind"] == "alert")
    {
        std::string message(req["message"].get<std::string>());
        sAIUser->MessageAlert(suai::str::toAiUnicodeStringUtf8(message));
    }
    else
    {
        std::cerr << "Unknown request: " << req.dump() << std::endl;
    }
}

// void HelloWorldPlugin::HandleDenoAiAlert(ai_deno::FunctionResult *request)
//{
// }

// ASErr HelloWorldPlugin::GoLiveEffect(AILiveEffectGoMessage *message)
//{
//     ASErr error = kNoErr;
//     PluginParams params;
//     this->getDictionaryValues(message->parameters, params);
//
//     try {
//         AIArtHandle art = message->art;
//
//         AIArtSet artSet;
//         error = sAIArtSet->NewArtSet(&artSet); CHKERR;
//         error = sAIArtSet->AddArtToArtSet(artSet, art); CHKERR;
//
//         AIRasterizeSettings settings;
//         settings.type = kRasterizeARGB;
//         settings.resolution = 300.0;
//         settings.antialiasing = 4;
//         settings.options = kRasterizeOptionsNone;
//         settings.preserveSpotColors = false;
//
//         AIRealRect bounds;
//         error = sAIRasterize->ComputeArtBounds(artSet, &bounds, false); CHKERR;
//
//         AIArtHandle rasterArt;
//         AIRasterRecord rasterRecord;
//
//         error = sAIRasterize->Rasterize(artSet, &settings, &bounds,
//                                       kPlaceAbove, art, &rasterArt, NULL); CHKERR;
//         error = sAIRaster->GetRasterInfo(rasterArt, &rasterRecord); CHKERR;
//
//         std::cout << rasterRecord.bounds.top << " "
//             << rasterRecord.bounds.right << " "
//             << rasterRecord.bounds.bottom << " "
//             << rasterRecord.bounds.left << std::endl;
//
//         ai::uint32 width = rasterRecord.bounds.right - rasterRecord.bounds.left;
//         ai::uint32 height = rasterRecord.bounds.bottom - rasterRecord.bounds.top;
//
//         AISlice artSlice = {0, 0, static_cast<ai::int32>(width), static_cast<ai::int32>(height), 0, 4};
//         AISlice workSlice = artSlice;
//
//         // !! THIS IS NOT WORKING (No any appearance changed) !! //
//         AITile workTile;
//         error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice); CHKERR;
//
//         for(ai::uint32 i = 0; i < width * height * 4; i += 4) {
//            static_cast<ai::uint8*>(workTile.data)[i] = 255;     // Red
//            static_cast<ai::uint8*>(workTile.data)[i+1] = 0;     // Green
//            static_cast<ai::uint8*>(workTile.data)[i+2] = 0;     // Blue
//            static_cast<ai::uint8*>(workTile.data)[i+3] = 255;   // Alpha
//         }
//
//         error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
//         delete[] static_cast<ai::uint8*>(workTile.data);
//         message->art = rasterArt;
//         // !! THIS IS NOT WORKING (No any appearance changed) !! //
//
//         sAIArtSet->DisposeArtSet(&artSet);
//     } catch (...) {
//
//     }
//
//     return error;
// }
