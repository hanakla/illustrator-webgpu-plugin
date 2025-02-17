#include <iostream>
#include <memory>
#include <numeric>
#include <regex>

#include "consts.h"
#include "HelloWorldPlugin.h"
#include "HelloWorldSuites.h"

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
      aiDenoMain(nullptr),
      denoModuleRef(nullptr),
      denoRuntimeRef(nullptr)
{
    strncpy(fPluginName, kHelloWorldPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin()
{
}

ASErr HelloWorldPlugin::StartupPlugin(SPInterfaceMessage *message)
{
    ASErr error = kNoErr;

    std::cout << "Start up" << std::endl;

    try
    {
        error = Plugin::StartupPlugin(message);
        CHKERR;

        aiDenoMain = ai_deno::initialize();
        error = this->InitLiveEffect(message);
        CHKERR;

        denoRuntimeRef = ai_deno::create_runtime();
        denoModuleRef = ai_deno::create_module(
            "index.ts",
            R"END(
            // import {} from "jsr:@std/fs";
            // import {createCanvas} from "npm:@napi-rs/canvas";

            export const loadPlugins = async () => {
                // const canvas = createCanvas(200, 200);
                // const ctx = canvas.getContext("2d");
                // ctx.fillStyle = "red";
                // ctx.fillRect(0, 0, 200, 200);
                // console.log(canvas.toBuffer());
            }

            console.log(navigator.gpu, Deno.cwd());
            export default (input: Uint8ClampedArray) => {
                console.log("Deno code running", input.byteLength / 4, input);

                // Random color
                for (let i = 0; i < input.length; i += 4) {
                    input[i] = Math.random() * 255;
                    input[i + 1] = Math.random() * 255;
                    input[i + 2] = Math.random() * 255;
                    input[i + 3] = i > 2000 ? 0 : 255;
                }

                // return new Uint8Array(input.length);
            }
        )END");

        // ai_deno::execute_deno(handle, moduleHandle, "", nullptr);
    }
    catch (std::exception &ex)
    {
        std::cout << "ヷ！死んじゃった……: " << ex.what() << std::endl;
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

    std::cout << "Init Live Effect" << std::endl;
    ai_deno::FunctionResult *effectResult = ai_deno::get_live_effects(aiDenoMain);
    if (!effectResult->success)
    {
        std::cout << "Failed to get live effects" << std::endl;
        return kCantHappenErr;
    }

    json effects = json::parse(effectResult->json);
    ai_deno::dispose_function_result(effectResult);
    // delete effectResult;

    std::cout << "Effects: " << effects.dump() << std::endl;

    std::vector<AILiveEffectData> effectData;
    for (auto &effectDef : effects)
    {
        std::cout << "Effect: " << effectDef << std::endl;

        AILiveEffectData effect;
        effect.self = message->d.self;

        std::string name;
        effect.name = string_format_to_char("%s%s",
                                            EFFECT_PREFIX.c_str(),
                                            effectDef["id"].get<std::string>().c_str());
        effect.title = ai::UnicodeString(effectDef["title"].get<std::string>().c_str(), kAIUTF8CharacterEncoding)
                           .as_UTF8()
                           .data();
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
    this->getDictionaryValues(message->parameters, params);

    std::cout << "GET DIC!" << std::endl;

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

        size_t width = artSlice.right - artSlice.left;
        size_t height = artSlice.bottom - artSlice.top;

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
        uintptr_t byteLingth = totalPixels * pixelStride;

        ai_deno::ArrayBufferRef input = ai_deno::ArrayBufferRef{
            .ptr = (void *)pixelData,
            .len = byteLingth,
        };

        ai_deno::ArrayBufferRef *result = ai_deno::execute_deno(
            denoRuntimeRef,
            denoModuleRef,
            &input);

        if (result != nullptr)
        {
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

void HelloWorldPlugin::onChangeCallback()
{
    std::cout << "Change callback" << std::endl;
}

ASErr HelloWorldPlugin::EditLiveEffectParameters(AILiveEffectEditParamMessage *message)
{
    ASErr error = kNoErr;
    std::cout << "EDIT LIVE!! EFFECT!!!" << std::endl;

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

        PluginParams *params;
        getDictionaryValues(message->parameters, *params);

        const char* effectName = NULL;
        error = sAILiveEffect->GetLiveEffectName(message->effect, &effectName);
        CHKERR;

        std::string effectId(effectName);
        effectId = std::regex_replace(effectId, std::regex("^" + std::string(EFFECT_PREFIX)), "");

        ai_deno::FunctionResult *nodeTreeResult = ai_deno::get_live_effect_view_tree(aiDenoMain, effectId.c_str(), params->effectName.c_str());
        if (!nodeTreeResult->success) {
            std::cerr << "Failed to get live effect view tree" << std::endl;
            return kCantHappenErr;
        }

        json nodeTree = json::parse(nodeTreeResult->json);

        std::cout << nodeTree.dump() << std::endl;

        std::function<void(void)> getCallback = std::bind(&HelloWorldPlugin::onChangeCallback, this);

#ifdef MAC_ENV
        int dialogResult = ImgUiEditModal::runModal(nodeTree, getCallback);
#else
        // Illustrator のメインウィンドウのハンドルを取得する。
        // このハンドルを親としてCreateWindowでダイアログを作成しても、
        // メインウィンドウ以外の分離した書類ウィンドウやパレット類に対しては
        // モーダルにならない。この点の対応はmyImGuiDialog側で行なっている。
        AIWindowRef hwndParent;
        error = sAIAppContext->GetPlatformAppWindow(&hwndParent);
        CHKERR;
        int dialogResult = myImGuiDialog::runModal((HWND)hwndParent, &m_tmpParms, getCallback);
#endif
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

ASErr HelloWorldPlugin::getDictionaryValues(const AILiveEffectParameters &dict, PluginParams &params)
{
    ASErr error = kNoErr;

    params.effectName = suai::dict::getString(dict, AI_DENO_DICT_EFFECT_NAME, "");

    std::string paramsJson = suai::dict::getString(dict, AI_DENO_DICT_PARAMS, "{}");
    params.params = json::parse(paramsJson);

    return error;
}

ASErr HelloWorldPlugin::putParamsToDictionaly(const AILiveEffectParameters &dict, PluginParams params)
{
    ASErr error = kNoErr;
    AIDictKey key;

    suai::dict::setString(dict, AI_DENO_DICT_EFFECT_NAME, params.effectName);
    suai::dict::setString(dict, AI_DENO_DICT_PARAMS, params.params.dump());

    return error;
}

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
