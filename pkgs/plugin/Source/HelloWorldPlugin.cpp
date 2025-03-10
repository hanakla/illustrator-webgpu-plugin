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

  ai_deno::JsonFunctionResult* effectResult = ai_deno::get_live_effects(aiDenoMain);
  if (!effectResult->success) {
    csl("Failed to get live effects");
    return kCantHappenErr;
  }

  json effects = json::parse(effectResult->json);
  ai_deno::dispose_json_function_result(effectResult);

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
  csl("Art type: %s", suai::art::getTypeName(message->art).c_str());

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
       .antiAlias          = 4,
       .colorConvert       = suai::RasterSettingColorConvert::Standard,
       .preserveSpotColors = true,
       .resolution         = 72,  // Keep document resolution
       .preserveSpotColors = true,
       .options =
           suai::RasterSettingOption{
               .useMinTiles   = true,
               .useEffectsRes = true,
           }}
  );

  try {
    AIArtHandle art = message->art;

    print_AIArt(art, "art");

    suai::ArtSet* artSet = new suai::ArtSet();
    artSet->AddArt(art);

    AIRealRect bounds;
    error = sAIRasterize->ComputeArtBounds(artSet->ToAIArtSet(), &bounds, false);

    AIArtHandle rasterArt;
    if (suai::art::getArtType(art) == AIArtType::kRasterArt) {
      rasterArt = art;
    } else {
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
    }

    AIRasterRecord info;
    sAIRaster->GetRasterInfo(rasterArt, &info);
    unsigned char bytes = info.bitsPerPixel / 8;

    print_AIRasterRecord(info);

    AIDocumentSetup docSetup;
    error = sAIDocument->GetDocumentSetup(&docSetup);
    CHKERR();

    print_AIDocumentSetup(docSetup);
    // if (error == kNoErr) {
    //     AIReal resolution = docSetup.outputResolution;
    //     // ここで解像度（resolution）を使用できます
    // }

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

    uint32 sourceWidth  = artSlice.right - artSlice.left;
    uint32 sourceHeight = artSlice.bottom - artSlice.top;

    size_t dataSize   = sourceWidth * sourceHeight * bytes;
    workTile.data     = new unsigned char[dataSize];
    workTile.rowBytes = sourceWidth * bytes;

    print_AITile(&workTile, "workTile(before)");

    // to RGBA
    workTile.channelInterleave[0] = 3;
    workTile.channelInterleave[1] = 0;
    workTile.channelInterleave[2] = 1;
    workTile.channelInterleave[3] = 2;

    workTile.bounds = artSlice;

    error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
    CHKERR();

    print_AITile(&workTile, "workTile(after)");

    const ai::uint32 totalPixels = sourceWidth * sourceHeight;
    const ai::uint32 pixelStride = workTile.colBytes;
    ai::uint8*       pixelData   = static_cast<ai::uint8*>(workTile.data);
    uintptr_t        byteLength  = totalPixels * pixelStride;

    ai_deno::ImageDataPayload input = ai_deno::ImageDataPayload{
        .width       = sourceWidth,
        .height      = sourceHeight,
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
      csl("Result: \n "
          "  width: %d\n"
          "  height: %d\n"
          "  byte_length: %d\n"
          "  data_ptr: %p\n"
          "  source_ptr: %p",
          result->data->width,
          result->data->height,
          result->data->byte_length,
          result->data->data_ptr,
          pixelData
      );
      // clang-format on

      csl("Setting pointer");
      workTile.rowBytes = result->data->width * 4;
      workTile.colBytes = 4;
      workTile.data     = result->data->data_ptr;

      auto widthDiff  = result->data->width - sourceWidth;
      auto heightDiff = result->data->height - sourceHeight;

      workTile.channelInterleave[0] = 1;
      workTile.channelInterleave[1] = 2;
      workTile.channelInterleave[2] = 3;
      workTile.channelInterleave[3] = 0;

      if (widthDiff != 0 || heightDiff != 0) {
        csl("Resizing tile");
        csl("  widthDiff: %d, heightDiff: %d", widthDiff, heightDiff);

        // 新しいラスターアートを作成
        AIArtHandle newRasterArt;
        error = sAIArt->NewArt(
            AIArtType::kRasterArt, AIPaintOrder::kPlaceAbove, art, &newRasterArt
        );
        CHKERR();

        // 新しいラスターレコードを設定
        AIRasterRecord newInfo;
        newInfo.colorSpace         = info.colorSpace;
        newInfo.bitsPerPixel       = info.bitsPerPixel;
        newInfo.flags              = info.flags;
        newInfo.originalColorSpace = info.originalColorSpace;

        // 新しいbounds - 左上は常に0,0から始まる
        newInfo.bounds.left   = 0;
        newInfo.bounds.top    = 0;
        newInfo.bounds.right  = result->data->width;
        newInfo.bounds.bottom = result->data->height;

        error = sAIRaster->SetRasterInfo(newRasterArt, &newInfo);
        CHKERR();

        // 元のラスターの変換マトリックスを取得
        AIRealMatrix matrix;
        error = sAIRaster->GetRasterMatrix(rasterArt, &matrix);
        CHKERR();

        // ピクセル単位とポイント単位の関係を調査
        AIRealRect artBoundsPts;
        error = sAIArt->GetArtBounds(rasterArt, &artBoundsPts);

        // ラスターのピクセルサイズ
        ai::int32 widthPx  = info.bounds.right - info.bounds.left;
        ai::int32 heightPx = info.bounds.bottom - info.bounds.top;

        // 実際の変換比率を計算して出力
        float ratioX = (artBoundsPts.right - artBoundsPts.left) / widthPx;
        float ratioY = (artBoundsPts.bottom - artBoundsPts.top) / heightPx;

        // csl("実際の変換比率: X=%.6f, Y=%.6f", ratioX, ratioY);

        // Centering image
        matrix.tx -= (widthDiff / 2.0) * ratioX;
        matrix.ty -= (heightDiff / 2.0) * ratioY;

        error = sAIRaster->SetRasterMatrix(newRasterArt, &matrix);
        CHKERR();

        // 新しいラスターへの画像データ設定用のスライスを準備
        AISlice newArtSlice = {0}, newWorkSlice = {0};
        newWorkSlice.top = newArtSlice.top = 0;
        newWorkSlice.bottom = newArtSlice.bottom = result->data->height;
        newWorkSlice.left = newArtSlice.left = 0;
        newWorkSlice.right = newArtSlice.right = result->data->width;
        newWorkSlice.back = newArtSlice.back = workTile.colBytes;

        // 処理済みのタイルデータを適切に設定
        AITile newWorkTile   = {0};
        newWorkTile.data     = result->data->data_ptr;
        newWorkTile.bounds   = newArtSlice;
        newWorkTile.rowBytes = result->data->width * workTile.colBytes;
        newWorkTile.colBytes = workTile.colBytes;

        // チャンネルインターリーブの設定を複製
        for (int i = 0; i < kMaxChannels; i++) {
          newWorkTile.channelInterleave[i] = workTile.channelInterleave[i];
        }

        // 新しいラスターにデータを設定
        error = sAIRaster->SetRasterTile(
            newRasterArt, &newArtSlice, &newWorkTile, &newWorkSlice
        );
        CHKERR();

        // 元のラスターを削除
        error = sAIArt->DisposeArt(rasterArt);
        CHKERR();

        // 新しいラスターを返す
        message->art = newRasterArt;

        return error;
      } else {
        // サイズ変更がない場合は元のタイルにデータを設定
        error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
        CHKERR();

        message->art = rasterArt;

        return error;
      }
    }
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

    ImGuiModal::OnFireEventCallback modalOnFireEventCallback =
        [this, &pluginParams, &currentParams, &error, &message](json event) {
          csl("onFireEvent: %s", event.dump().c_str());

          ai_deno::JsonFunctionResult* result = ai_deno::edit_live_effect_fire_event(
              this->aiDenoMain, pluginParams.effectName.c_str(), event.dump().c_str()
          );

          if (!result->success) { csl("Failed to fire event"); }

          currentParams       = json::parse(result->json);
          pluginParams.params = currentParams;

          // Rerender preview
          error = this->putParamsToDictionaly(message->parameters, pluginParams);
          CHKERR();
          error = sAILiveEffect->UpdateParameters(message->context);
          CHKERR();
        };

    ImGuiModal::OnChangeCallback modaloOnChangeCallback =
        [&pluginParams, &isModalOpened, &isPreviewed, &error, &message, &currentParams,
         &nodeTree, &modal, this](json patch) {
          if (isModalOpened) isPreviewed = true;
          csl("onChange: {}", patch.dump().c_str());

          currentParams.merge_patch(patch);
          pluginParams.params = currentParams;

          // Normalize params
          {
            ai_deno::JsonFunctionResult* result = ai_deno::edit_live_effect_parameters(
                this->aiDenoMain, pluginParams.effectName.c_str(),
                currentParams.dump().c_str()
            );

            if (!result->success) {
              csl("Failed to normalize live effect parameters: %s",
                  pluginParams.effectName.c_str());
            }

            currentParams = json::parse(result->json);

            ai_deno::dispose_json_function_result(result);
          }

          // rerender tree
          {
            ai_deno::JsonFunctionResult* result = ai_deno::get_live_effect_view_tree(
                this->aiDenoMain, pluginParams.effectName.c_str(),
                currentParams.dump().c_str()
            );

            if (!result->success) {
              std::cerr << "Failed to get live effect view tree" << std::endl;
            } else {
              nodeTree = json::parse(result->json);
              modal->updateRenderTree(nodeTree);
            }

            ai_deno::dispose_json_function_result(result);

            // Rerender preview
            error = this->putParamsToDictionaly(message->parameters, pluginParams);
            CHKERR();
            error = sAILiveEffect->UpdateParameters(message->context);
            CHKERR();
          }
        };

    modaloOnChangeCallback(initialParams);

    isModalOpened = true;
    csl("Opening modal: %s", nodeTree.dump().c_str());
    ModalStatusCode dialogResult =
        modal->runModal(nodeTree, modaloOnChangeCallback, modalOnFireEventCallback);
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

ASErr HelloWorldPlugin::LiveEffectScaleParameters(AILiveEffectScaleParamMessage* message
) {
  std::cout << "SCALING LIVE!! EFFECT!!!" << std::endl;

  ASErr error = kNoErr;

  AILiveEffectHandle     effect     = message->effect;
  AILiveEffectParameters parameters = message->parameters;
  AIReal                 scale      = message->scaleFactor;

  // default
  message->scaledParams = false;

  // Get the current parameters
  PluginParams params;
  error = this->getDictionaryValues(
      parameters, &params,
      PluginParams{
          .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
          .params     = json(),
      }
  );

  // Scale the parameters
  ai_deno::JsonFunctionResult* result = ai_deno::live_effect_scale_parameters(
      aiDenoMain, params.effectName.c_str(), params.params.dump().c_str(), scale
  );

  if (!result->success) {
    csl("Failed to scale live effect parameters");
    return kCantHappenErr;
  }

  json response = json::parse(result->json);

  if (response["hasChanged"].get<bool>()) {
    params.params = response["params"];
    error         = this->putParamsToDictionaly(parameters, params);
    CHKERR();

    message->scaledParams = true;
  }

  ai_deno::dispose_json_function_result(result);

  return error;
}

ASErr HelloWorldPlugin::LiveEffectInterpolate(AILiveEffectInterpParamMessage* message) {
  csl("INTERPOLATING LIVE!! EFFECT!!!");

  double percent = message->percent;

  PluginParams paramsA;
  ASErr        error = this->getDictionaryValues(
      message->startParams, &paramsA,
      PluginParams{
                 .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
                 .params     = json(),
      }
  );
  CHKERR();

  PluginParams paramsB;
  error = this->getDictionaryValues(
      message->endParams, &paramsB,
      PluginParams{
          .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
          .params     = json(),
      }
  );
  CHKERR();

  ai_deno::JsonFunctionResult* result = ai_deno::live_effect_interpolate(
      aiDenoMain, paramsA.effectName.c_str(), paramsA.params.dump().c_str(),
      paramsB.params.dump().c_str(), percent
  );

  if (!result->success) {
    csl("Failed to interpolate live effect parameters");
    return kCantHappenErr;
  }

  json response = json::parse(result->json);

  PluginParams outParams = {
      .effectName = paramsA.effectName,
      .params     = response,
  };

  this->putParamsToDictionaly(message->outParams, outParams);
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

void HelloWorldPlugin::StaticHandleDenoAiAlert(const ai_deno::JsonFunctionResult* request
) {
  json req = json(request->json);

  if (req.contains("kind") && req["kind"] == "alert") {
    std::string message(req["message"].get<std::string>());
    sAIUser->MessageAlert(suai::str::toAiUnicodeStringUtf8(message));
  } else {
    std::cerr << "Unknown request: " << req.dump() << std::endl;
  }
}

// void HelloWorldPlugin::HandleDenoAiAlert(ai_deno::JsonFunctionResult *request)
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
