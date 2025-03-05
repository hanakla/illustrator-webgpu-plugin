#include <functional>
#include <iostream>
#include <memory>
#include <numeric>
#include <regex>

#include "./libs/regex.h"
#include "./views/ImgUIEditModal.h"
#include "HelloWorldPlugin.h"
#include "HelloWorldSuites.h"
#include "consts.h"

#include "debugHelper.h"

using json = nlohmann::json;

Plugin* AllocatePlugin(SPPluginRef pluginRef) {
  return new HelloWorldPlugin(pluginRef);
}

void FixupReload(Plugin* plugin) {
  csl("FixupReload");
  HelloWorldPlugin::FixupVTable((HelloWorldPlugin*)plugin);
}

HelloWorldPlugin::HelloWorldPlugin(SPPluginRef pluginRef)
    : Plugin(pluginRef), fLiveEffect(nullptr), aiDenoMain(nullptr) {
  strncpy(fPluginName, kHelloWorldPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin() {
  csl("Shutting down");
  delete aiDenoMain;
}

ASErr HelloWorldPlugin::StartupPlugin(SPInterfaceMessage* message) {
  ASErr error = kNoErr;

  try {
    csl("Start up");
    error = Plugin::StartupPlugin(message);
    CHKERR();

    // Guards against multiple startup calls to prevent redundant initialization.
    if (!pluginStarted) {
      pluginStarted = true;

      csl("Loading live effects");
      aiDenoMain = ai_deno::initialize(&HelloWorldPlugin::StaticHandleDenoAiAlert);
      error      = this->InitLiveEffect(message);
      CHKERR();
    }
  } catch (ai::Error& ex) {
    error = ex;
    std::cout << "ヷ！死んじゃった……: " << ex.what() << std::endl;
  } catch (std::exception& ex) {
    std::cout << "ヷ！死んじゃった……: " << stringify_ASErr(error) << " what:" << ex.what()
              << std::endl;
  }

  //	sAIUser->MessageAlert(ai::UnicodeString(returns));
  //    free(returns);
  return error;
}

ASErr HelloWorldPlugin::ShutdownPlugin(SPInterfaceMessage* message) {
  ASErr error = kNoErr;
  //	sAIUser->MessageAlert(ai::UnicodeString("Goodbye from HelloWorld!"));
  error = Plugin::ShutdownPlugin(message);
  return error;
}

ASErr HelloWorldPlugin::InitLiveEffect(SPInterfaceMessage* message) {
  ASErr error       = kNoErr;
  short filterIndex = 0;

  csl("✨️ Init Live Effect");
  ai_deno::FunctionResult* effectResult = ai_deno::get_live_effects(aiDenoMain);
  if (!effectResult->success) {
    csl("Failed to get live effects");
    return kCantHappenErr;
  }

  json effects = json::parse(effectResult->json);
  ai_deno::dispose_function_result(effectResult);

  std::vector<AILiveEffectData> effectData;
  for (auto& effectDef : effects) {
    csl(" Loading deno-ai effect: %s", effectDef.dump().c_str());

    csl(" creating effect data");
    AILiveEffectData effect;
    effect.self = message->d.self;

    std::string name;
    effect.name = suai::str::strdup(string_format_to_char(
        "%s%s", EFFECT_PREFIX.c_str(), effectDef["id"].get<std::string>().c_str()
    ));

    // char *title =
    // ai::UnicodeString(effectDef["title"].get<std::string>().c_str(),
    // kAIUTF8CharacterEncoding).as_UTF8().data();
    effect.title = suai::str::strdup(
        suai::str::toAiUnicodeStringUtf8(effectDef["title"].get<std::string>())
    );
    // effect.title = title;
    effect.majorVersion   = effectDef["version"]["major"].get<int>();
    effect.minorVersion   = effectDef["version"]["minor"].get<int>();
    effect.prefersAsInput = AIStyleFilterPreferredInputArtType::kInputArtDynamic;
    // effect.prefersAsInput   = AIStyleFilterPreferredInputArtType::kRasterInputArt;
    effect.styleFilterFlags = AIStyleFilterFlags::kPostEffectFilter;

    csl(" creating menu data");
    AddLiveEffectMenuData menu;
    menu.category =
        suai::str::strdup(ai::UnicodeString("Deno Effectors", kAIUTF8CharacterEncoding));
    menu.title = suai::str::strdup(
        suai::str::toAiUnicodeStringUtf8(effectDef["title"].get<std::string>())
    );
    menu.options = 0;

    csb("title", effect.title);
    error = sAILiveEffect->AddLiveEffect(&effect, &this->fEffects[filterIndex]);
    CHKERR();

    error = sAILiveEffect->AddLiveEffectMenuItem(
        this->fEffects[filterIndex], effect.name, &menu, NULL, NULL
    );
    CHKERR();

    filterIndex++;
  };

  this->fNumEffects = filterIndex;

  return error;
}

// ASErr HelloWorldPlugin::LiveEffectGetInputType(AILiveEffectInputTypeMessage* message) {
//   return kNoErr;
// }

ASErr HelloWorldPlugin::GoLiveEffect(AILiveEffectGoMessage* message) {
  csl("* GO LIVE!! EFFECT!!!");

  auto artType = suai::art::getArtType(message->art);
  csl("Art type: %s", suai::art::getArtTypeName(message->art).c_str());

  ASErr error = kNoErr;

  PluginParams params;
  error = this->getDictionaryValues(
      message->parameters, &params,
      PluginParams{
          .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
          .params     = json(),
      }
  );
  CHKERR();

  //  print_PluginParams(&params);

  AIRasterizeSettings settings = suai::createAIRasterSetting(
      {.type               = suai::RasterType::ARGB,
       .antiAlias          = 2,
       .colorConvert       = suai::RasterSettingColorConvert::Standard,
       .preserveSpotColors = true,
       // .resolution         = 72, // Keep document resolution
       .preserveSpotColors = true,
       .options =
           suai::RasterSettingOption{
               .useMinTiles   = true,
               .useEffectsRes = true,
           }}
  );

  try {
    AIArtHandle art = message->art;

    suai::ArtSet* artSet = new suai::ArtSet();
    artSet->AddArt(art);

    AIRealRect bounds;
    error = sAIRasterize->ComputeArtBounds(artSet->ToAIArtSet(), &bounds, false);

    AIArtHandle rasterArt;
    error = sAIArt->NewArt(
        AIArtType::kRasterArt, AIPaintOrder::kPlaceDefault, art, &rasterArt
    );
    CHKERR();

    timeStart("Rasterize");
    error = sAIRasterize->Rasterize(
        artSet->ToAIArtSet(), &settings, &bounds, AIPaintOrder::kPlaceAbove, art,
        &rasterArt, NULL
    );
    timeEnd();
    CHKERR();

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

    AITile workTile   = {0};
    workTile.colBytes = bytes;

    uint32 width  = artSlice.right - artSlice.left;
    uint32 height = artSlice.bottom - artSlice.top;

    size_t dataSize   = width * height * bytes;
    workTile.data     = new unsigned char[dataSize];
    workTile.rowBytes = width * bytes;

    workTile.channelInterleave[0] = 1;
    workTile.channelInterleave[1] = 2;
    workTile.channelInterleave[2] = 3;
    workTile.channelInterleave[3] = 0;

    workTile.bounds = artSlice;

    error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
    CHKERR();

    const ai::uint32 totalPixels = width * height;
    const ai::uint32 pixelStride = workTile.colBytes;
    ai::uint8*       pixelData   = static_cast<ai::uint8*>(workTile.data);
    uintptr_t        byteLength  = totalPixels * pixelStride;

    print_AITile(&workTile, "workTile");
    print_AISlice(&artSlice, "artSlice");

    ai_deno::ImageDataPayload input = ai_deno::ImageDataPayload{
        .width       = width,
        .height      = height,
        .data_ptr    = (void*)pixelData,
        .byte_length = byteLength,
    };

    ai_deno::DoLiveEffectResult* result = ai_deno::do_live_effect(
        aiDenoMain, params.effectName.c_str(), params.params.dump().c_str(), &input
    );

    csl("Result: %s", result->success ? "true" : "false");
    if (result->success) {
      csl("  Original bytes: %d", byteLength);
      csl("  Result bytes: %d", result->data->byte_length);
    }

    if (result->success && result->data != nullptr) {
      // clang-format off
      std::cout << "Result: \n "
          << "  width: " << result->data->width << "\n"
          << "  height: " << result->data->height << "\n"
          << "  byte_length: " << result->data->byte_length << "\n"
          << "  data_ptr: " << std::hex << (void*)result->data->data_ptr << "\n"
          << "  source_ptr: " << std::hex << (void*)pixelData << std::dec
          << std::endl;
      // clang-format on

      csl("Setting pointer");
      workTile.data = result->data->data_ptr;

      csl("Disposing result");
      // ai_deno::dispose_do_live_effect_result(result);

      if ((void*)pixelData == result->data->data_ptr) {
        std::cout << "Effect: Same data pointer" << std::endl;
      } else {
        std::cout << "Effect: Different data pointer" << std::endl;
      }

      // for (ai::uint32 i = 0; i < totalPixels * pixelStride; i += pixelStride) {
      //   if (i + 3 >= totalPixels * pixelStride) break;

      //   ai::uint8* pixel = pixelData + i;
      //   pixel[0]         = 255;  // Red
      //   pixel[1]         = 0;    // Green
      //   pixel[2]         = 0;    // Blue
      //   pixel[3]         = 255;  // Alpha
      // }

      error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
      CHKERR();

      message->art = rasterArt;

      return error;
    } else {
      std::cerr << "Failed to execute deno" << std::endl;
      error = kCantHappenErr;
    }

    // csl("set rasterArt");
    // message->art = rasterArt;
  } catch (const ai::Error& ex) {
    std::cout << (AIErr)ex << ":" << ex.what() << std::endl;
    throw ex;
  } catch (exception& ex) {
    std::cout << "exception: " << ex.what() << std::endl;
    throw ex;
  }

  return error;
}

ASErr HelloWorldPlugin::EditLiveEffectParameters(AILiveEffectEditParamMessage* message) {
  ASErr error = kNoErr;
  std::cout << "EDIT LIVE!! EFFECT!!!" << std::endl;
  suai::LiveEffect* effect = new suai::LiveEffect(message->effect);

  try {
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
    //            // オブジェクトに当該効果が複数使われている場合、クラス変数の
    //            m_parms は
    //            //
    //            プレビューで効果が累積的に適用される際にそれぞれの設定値に置き換えられる。
    //            // このため、編集中の設定値は一時的な構造体に保持する。
    //            m_tmpParms = m_parms;

    std::string effectName = effect->getName();

    std::string normalizeEffectId = std::regex_replace(
        effectName, std::regex("^" + escapeStringRegexp(EFFECT_PREFIX)), ""
    );

    csl("GetDictionaryValues for %s", normalizeEffectId.c_str());
    PluginParams pluginParams;
    error = getDictionaryValues(
        message->parameters, &pluginParams,
        PluginParams{
            .effectName = normalizeEffectId,
            .params     = json::object(),
        }
    );

    csl(" effectName: %s, params: %s", pluginParams.effectName.c_str(),
        pluginParams.params.dump().c_str());
    CHKERR();

    bool isPreviewed = false;

    json initialParams(pluginParams.params);
    json currentParams(initialParams);
    json nodeTree;

    ImGuiModal::IModalImpl* modal;

    csl("Creating modal");
#ifdef MAC_ENV
    modal = ImGuiModal::createModal();
#else
    AIWindowRef hwndParent;
    error = sAIAppContext->GetPlatformAppWindow(&hwndParent);
    CHKERR();
    int dialogResult = myImGuiDialog::runModal((HWND)hwndParent);
#endif

    bool isModalOpened = true;

    ImGuiModal::OnChangeCallback modaloOnChangeCallback = [&pluginParams, &isModalOpened,
                                                           &isPreviewed, &error, &message,
                                                           &currentParams, &nodeTree,
                                                           &modal, this](json patch) {
      if (isModalOpened) isPreviewed = true;
      csl("onChange: {}", patch.dump().c_str());

      currentParams.merge_patch(patch);
      pluginParams.params = currentParams;

      ai_deno::FunctionResult* result = ai_deno::get_live_effect_view_tree(
          this->aiDenoMain, pluginParams.effectName.c_str(), currentParams.dump().c_str()
      );

      if (!result->success) {
        std::cerr << "Failed to get live effect view tree" << std::endl;
      } else {
        nodeTree = json::parse(result->json);
        modal->updateRenderTree(nodeTree);
      }

      ai_deno::dispose_function_result(result);

      // Rerender preview
      error = this->putParamsToDictionaly(message->parameters, pluginParams);
      CHKERR();
      error = sAILiveEffect->UpdateParameters(message->context);
      CHKERR();
    };

    modaloOnChangeCallback(initialParams);

    isModalOpened = true;
    csl("Opening modal");
    ModalStatusCode dialogResult = modal->runModal(nodeTree, modaloOnChangeCallback);
    csl("Modal closed");

    if (dialogResult == ModalStatusCode::OK) {
      csl("Put params to dictionary");
      error = this->putParamsToDictionaly(message->parameters, pluginParams);
      CHKERR();

      error = sAILiveEffect->UpdateParameters(message->context);
      CHKERR();
    } else if (isPreviewed) {
      if (message->isNewInstance) {
        // Remove effect if canceled in first edit
        error = sAIUndo->UndoChanges();
        CHKERR();
      } else {
        // Revert to original state
        pluginParams.params = initialParams;
        putParamsToDictionaly(message->parameters, pluginParams);
        sAILiveEffect->UpdateParameters(message->context);
      }
    }
  } catch (ai::Error& ex) {
    error = ex;
    csl("Error: %s (code: %s [raw: %d])", ex.what(), stringify_ASErr(error).c_str(),
        error);
  } catch (...) { error = kCantHappenErr; }

  return error;
}

ASErr HelloWorldPlugin::getDictionaryValues(
    const AILiveEffectParameters& dict,
    PluginParams*                 params,
    PluginParams                  defaultParams
) {
  ASErr error = kNoErr;

  std::string effectName = suai::str::toUtf8StdString(suai::dict::getUnicodeString(
      dict, AI_DENO_DICT_EFFECT_NAME,
      suai::str::toAiUnicodeStringUtf8(defaultParams.effectName), &error
  ));
  CHKERR();

  std::string paramsJson = suai::str::toUtf8StdString(suai::dict::getUnicodeString(
      dict, AI_DENO_DICT_PARAMS,
      suai::str::toAiUnicodeStringUtf8(defaultParams.params.dump()), &error
  ));
  CHKERR();

  params->effectName = effectName;
  params->params     = json::parse(paramsJson);

  return error;
}

ASErr HelloWorldPlugin::putParamsToDictionaly(
    const AILiveEffectParameters& dict,
    PluginParams                  params
) {
  ASErr error = kNoErr;

  suai::dict::setUnicodeString(
      dict, AI_DENO_DICT_EFFECT_NAME, suai::str::toAiUnicodeStringUtf8(params.effectName)
  );
  suai::dict::setUnicodeString(
      dict, AI_DENO_DICT_PARAMS, suai::str::toAiUnicodeStringUtf8(params.params.dump())
  );

  return error;
}

void HelloWorldPlugin::StaticHandleDenoAiAlert(const ai_deno::FunctionResult* request) {
  json req = json(request->json);

  if (req.contains("kind") && req["kind"] == "alert") {
    std::string message(req["message"].get<std::string>());
    sAIUser->MessageAlert(suai::str::toAiUnicodeStringUtf8(message));
  } else {
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
//         error = sAIArtSet->NewArtSet(&artSet); CHKERR();
//         error = sAIArtSet->AddArtToArtSet(artSet, art); CHKERR();
//
//         AIRasterizeSettings settings;
//         settings.type = kRasterizeARGB;
//         settings.resolution = 300.0;
//         settings.antialiasing = 4;
//         settings.options = kRasterizeOptionsNone;
//         settings.preserveSpotColors = false;
//
//         AIRealRect bounds;
//         error = sAIRasterize->ComputeArtBounds(artSet, &bounds, false);
//         CHKERR();
//
//         AIArtHandle rasterArt;
//         AIRasterRecord rasterRecord;
//
//         error = sAIRasterize->Rasterize(artSet, &settings, &bounds,
//                                       kPlaceAbove, art, &rasterArt, NULL);
//                                       CHKERR();
//         error = sAIRaster->GetRasterInfo(rasterArt, &rasterRecord); CHKERR();
//
//         std::cout << rasterRecord.bounds.top << " "
//             << rasterRecord.bounds.right << " "
//             << rasterRecord.bounds.bottom << " "
//             << rasterRecord.bounds.left << std::endl;
//
//         ai::uint32 width = rasterRecord.bounds.right -
//         rasterRecord.bounds.left;
//         ai::uint32 height =
//         rasterRecord.bounds.bottom - rasterRecord.bounds.top;
//
//         AISlice artSlice = {0, 0, static_cast<ai::int32>(width),
//         static_cast<ai::int32>(height), 0, 4}; AISlice workSlice = artSlice;
//
//         // !! THIS IS NOT WORKING (No any appearance changed) !! //
//         AITile workTile;
//         error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile,
//         &workSlice); CHKERR();
//
//         for(ai::uint32 i = 0; i < width * height * 4; i += 4) {
//            static_cast<ai::uint8*>(workTile.data)[i] = 255;     // Red
//            static_cast<ai::uint8*>(workTile.data)[i+1] = 0;     // Green
//            static_cast<ai::uint8*>(workTile.data)[i+2] = 0;     // Blue
//            static_cast<ai::uint8*>(workTile.data)[i+3] = 255;   // Alpha
//         }
//
//         error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile,
//         &workSlice); delete[] static_cast<ai::uint8*>(workTile.data);
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
