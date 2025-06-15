#include <functional>
#include <iostream>
#include <memory>
#include <numeric>
#include <regex>

#include "./AiDenoPlugin.h"
#include "./AiDenoSuites.h"
#include "./consts.h"
#include "./libs/regex.h"
#include "./views/ImgUIEditModal.h"

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
    : Plugin(pluginRef), aiDenoMain(nullptr), isInPreview(false) {
  strncpy(fPluginName, kPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin() {
  csl("Shutting down");
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

ASErr HelloWorldPlugin::Message(char* caller, char* selector, void* message) {
  csl("Message: %s -> %s", caller, selector);
  return Plugin::Message(caller, selector, message);
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

    char title[128];
    suai::str::toAiUnicodeStringUtf8(effectDef["title"].get<std::string>())
        .as_Platform(title, 128);

    effect.title          = title;
    effect.majorVersion   = effectDef["version"]["major"].get<int>();
    effect.minorVersion   = effectDef["version"]["minor"].get<int>();
    effect.prefersAsInput = AIStyleFilterPreferredInputArtType::kInputArtDynamic;
    // effect.prefersAsInput   = AIStyleFilterPreferredInputArtType::kRasterInputArt;
    effect.styleFilterFlags = AIStyleFilterFlags::kPostEffectFilter |
                              AIStyleFilterFlags::kHasScalableParams |
                              AIStyleFilterFlags::kHandlesAdjustColorsMsg;

    csl(" creating menu data");
    AddLiveEffectMenuData menu;
    menu.category =
        suai::str::strdup(ai::UnicodeString("WebGPU Filters", kAIUTF8CharacterEncoding));
    menu.title   = title;
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
  ASErr error = kNoErr;

  csl("**");
  csl("** GO LIVE!! EFFECT!!!");
  csl("**");

  suai::LiveEffect* effect     = new suai::LiveEffect(message->effect);
  std::string       effectName = effect->getName();

  AIArtHandle art = message->art;

  // It is must be 72, if it changed, illustrator will be crash
  int baseDpi = 72;

  // csl("art JSON: %s", suai::art::serialize::ArtToJSON(art).dump(2).c_str());
  // Test calling for checking it works
  // csl("art JSON: %s", suai::art::serialize::ArtToJSON(art).dump(2).c_str());

  PluginParams params;
  error = this->getDictionaryValues(
      message->parameters, &params,
      PluginParams{
          .effectName = "__FAILED_TO_GET_EFFECT_NAME__",
          .params     = json(),
      }
  );
  CHKERR();

  std::string normalizeEffectId = std::regex_replace(
      effectName, std::regex("^" + escapeStringRegexp(EFFECT_PREFIX)), ""
  );

  AIRasterizeSettings settings = suai::createAIRasterSetting(
      {.type               = suai::RasterType::ARGB,
       .antiAlias          = 4,
       .colorConvert       = suai::RasterSettingColorConvert::Standard,
       .preserveSpotColors = true,
       .resolution         = (double)72,
       .options =
           {
               .useMinTiles   = false,
               .useEffectsRes = true,
               .doLayers      = true,
           }}
  );

  try {
    suai::ArtSet* artSet = new suai::ArtSet();
    artSet->AddArt(art);

    AIArtHandle rasterArt;
    error =
        sAIArt->NewArt(AIArtType::kRasterArt, AIPaintOrder::kPlaceAbove, art, &rasterArt);
    CHKERR();

    AIRealRect bounds;
    error = sAIRasterize->ComputeArtBounds(artSet->ToAIArtSet(), &bounds, false);
    CHKERR();

    // get dpi
    int dpi;
    {
      AIRealRect getDpiBounds;
      getDpiBounds.left   = bounds.left * 0.01;
      getDpiBounds.top    = bounds.top * 0.01;
      getDpiBounds.right  = bounds.right * 0.01;
      getDpiBounds.bottom = bounds.bottom * 0.01;

      print_AIRealRect(&getDpiBounds, "bounds (source)");

      error = sAIRasterize->Rasterize(
          artSet->ToAIArtSet(), &settings, &getDpiBounds, AIPaintOrder::kPlaceAbove, art,
          &rasterArt, NULL
      );
      CHKERR();

      AIRealMatrix tmpMatrix;
      error = sAIRaster->GetRasterMatrix(rasterArt, &tmpMatrix);
      CHKERR();

      print_AIRealMatrix(&tmpMatrix, "tmpMatrix");

      dpi   = baseDpi * (1 / tmpMatrix.a);
      error = sAIArt->DisposeArt(rasterArt);
      CHKERR();
    };

    csl("dpi: %d", dpi);

    error =
        sAIArt->NewArt(AIArtType::kRasterArt, AIPaintOrder::kPlaceAbove, art, &rasterArt);
    CHKERR();

    // Rasterizing
    settings.resolution = (double)dpi;
    timeStart("Rasterize");
    error = sAIRasterize->Rasterize(
        artSet->ToAIArtSet(), &settings, &bounds, AIPaintOrder::kPlaceAbove, art,
        &rasterArt, NULL
    );
    timeEnd();
    CHKERR();

    AIRasterRecord sourceRasterRecord;
    sAIRaster->GetRasterInfo(rasterArt, &sourceRasterRecord);
    unsigned char bytes = sourceRasterRecord.bitsPerPixel / 8;

    AIRealMatrix sourceMatrix;
    AIRealRect   rasterBounds;
    sAIRaster->GetRasterBoundingBox(rasterArt, &rasterBounds);
    sAIRaster->GetRasterMatrix(rasterArt, &sourceMatrix);

    float dpiScaledFactor = sourceMatrix.a;

    AISlice artSlice = {0}, workSlice = {0};
    workSlice.top = artSlice.top = sourceRasterRecord.bounds.top;
    workSlice.bottom = artSlice.bottom = sourceRasterRecord.bounds.bottom;
    workSlice.left = artSlice.left = sourceRasterRecord.bounds.left;
    workSlice.right = artSlice.right = sourceRasterRecord.bounds.right;
    workSlice.back = artSlice.back = bytes;

    AITile workTile   = {0};
    workTile.colBytes = bytes;

    uint32 sourceWidth  = artSlice.right - artSlice.left;
    uint32 sourceHeight = artSlice.bottom - artSlice.top;

    size_t dataSize   = sourceWidth * sourceHeight * bytes;
    workTile.data     = new unsigned char[dataSize];
    workTile.rowBytes = sourceWidth * bytes;

    // print_AITile(&workTile, "workTile(before)");

    // to RGBA
    workTile.channelInterleave[0] = 3;
    workTile.channelInterleave[1] = 0;
    workTile.channelInterleave[2] = 1;
    workTile.channelInterleave[3] = 2;
    workTile.bounds               = artSlice;

    error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
    CHKERR();

    csl("LiveEffect Input:");
    csl("  Width: %d, Height: %d", sourceWidth, sourceHeight);
    csl("  DPI: %d (%.5f %.5f)", dpi, sourceMatrix.a, sourceMatrix.d);
    print_AIRealRect(&rasterBounds, "rasterBounds", "  ");
    print_AIArt(art, "art", "  ");
    print_AIRasterRecord(sourceRasterRecord, "rasterArt", "  ");
    print_AITile(&workTile, "workTile(after)");

    // check
    {
      // message->art = rasterArt;
      // return kNoErr;
    }

    const ai::uint32 totalPixels = sourceWidth * sourceHeight;
    const ai::uint32 pixelStride = workTile.colBytes;
    ai::uint8*       pixelData   = static_cast<ai::uint8*>(workTile.data);
    uintptr_t        byteLength  = totalPixels * pixelStride;

    json env(
        {{"dpi", dpi},
         {"baseDpi", baseDpi},
         {"isInPreview",
          isInPreview && this->editingEffectId == (std::string)normalizeEffectId}}
    );

    ai_deno::ImageDataPayload input = ai_deno::ImageDataPayload{
        .width       = sourceWidth,
        .height      = sourceHeight,
        .data_ptr    = (void*)pixelData,
        .byte_length = byteLength,
    };

    ai_deno::GoLiveEffectResult* result = ai_deno::go_live_effect(
        aiDenoMain, params.effectName.c_str(), params.params.dump().c_str(),
        env.dump().c_str(), &input
    );

    csl("LiveEffect Result: %s", result->success ? "true" : "false");
    if (result->success) {
      csl("  Original bytes: %d", byteLength);
      csl("  Result bytes: %d", result->data->byte_length);
      csl("  Source size: %d x %d", sourceWidth, sourceHeight);
      csl("  Result size: %d x %d", result->data->width, result->data->height);
      csl("    dpi: %d (%.3f, input %.3f %.3f)", dpi, dpiScaledFactor, sourceMatrix.a,
          sourceMatrix.d);
      csl("  Source data_ptr: %p", pixelData);
      csl("  Result data_ptr: %p", result->data->data_ptr);
      csl("  Result byte length: %d", result->data->byte_length);
    }

    if (!result->success) {
      // Fill region as blue
      for (int i = 0; i < totalPixels; i++) {
        pixelData[i * pixelStride + 0] = 0;
        pixelData[i * pixelStride + 1] = 0;
        pixelData[i * pixelStride + 2] = 255;
        pixelData[i * pixelStride + 3] = 255;
      }

      error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
      CHKERR();

      message->art = rasterArt;
      return kCantHappenErr;
    }

    if (result->data != nullptr) {
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
        timeStart("Renew artset");

        AIArtHandle newRasterArt;
        error = sAIArt->NewArt(
            AIArtType::kRasterArt, AIPaintOrder::kPlaceAbove, art, &newRasterArt
        );
        CHKERR();

        AIRasterRecord newInfo;
        newInfo.colorSpace         = sourceRasterRecord.colorSpace;
        newInfo.bitsPerPixel       = sourceRasterRecord.bitsPerPixel;
        newInfo.flags              = sourceRasterRecord.flags;
        newInfo.originalColorSpace = sourceRasterRecord.originalColorSpace;
        newInfo.bounds.left        = 0;  // Illustrator specific
        newInfo.bounds.top         = 0;  // Illustrator specific
        newInfo.bounds.right       = result->data->width;
        newInfo.bounds.bottom      = result->data->height;
        newInfo.byteWidth          = 4;

        print_AIRasterRecord(newInfo, "newInfo");

        error = sAIRaster->SetRasterInfo(newRasterArt, &newInfo);
        CHKERR();

        // Positioning new image basis of center of original image
        AIRealMatrix newMatrix;
        error = sAIRaster->GetRasterMatrix(rasterArt, &newMatrix);
        CHKERR();

        AIRealRect artBoundsPts;
        error = sAIArt->GetArtBounds(rasterArt, &artBoundsPts);

        ai::int32 widthPx =
            sourceRasterRecord.bounds.right - sourceRasterRecord.bounds.left;
        ai::int32 heightPx =
            sourceRasterRecord.bounds.bottom - sourceRasterRecord.bounds.top;

        float expandedRatioX = (artBoundsPts.right - artBoundsPts.left) / widthPx;
        float expandedRatioY = (artBoundsPts.bottom - artBoundsPts.top) / heightPx;

        // Centering image
        newMatrix.a = sourceMatrix.a;
        newMatrix.d = sourceMatrix.d;
        newMatrix.tx -= (widthDiff / 2.0) * expandedRatioX;
        newMatrix.ty -= (heightDiff / 2.0) * expandedRatioY;

        // Restore DPI
        csl("DPI: %d, Scale factors: (%.5f %.5f)", dpi, newMatrix.a, newMatrix.d);
        print_AIRealMatrix(&sourceMatrix, "source matrix");
        print_AIRealMatrix(&newMatrix, "new matrix");

        error = sAIRaster->SetRasterMatrix(newRasterArt, &newMatrix);
        CHKERR();

        AISlice newArtSlice = {0}, newWorkSlice = {0};
        newWorkSlice.top = newArtSlice.top = 0;
        newWorkSlice.bottom = newArtSlice.bottom = result->data->height;
        newWorkSlice.left = newArtSlice.left = 0;
        newWorkSlice.right = newArtSlice.right = result->data->width;
        newWorkSlice.back = newArtSlice.back = workTile.colBytes;

        AITile newWorkTile   = {0};
        newWorkTile.data     = result->data->data_ptr;
        newWorkTile.bounds   = newArtSlice;
        newWorkTile.rowBytes = result->data->width * workTile.colBytes;
        newWorkTile.colBytes = workTile.colBytes;

        for (int i = 0; i < kMaxChannels; i++) {
          newWorkTile.channelInterleave[i] = workTile.channelInterleave[i];
        }

        error = sAIRaster->SetRasterTile(
            newRasterArt, &newArtSlice, &newWorkTile, &newWorkSlice
        );
        CHKERR();

        error = sAIArt->DisposeArt(rasterArt);
        CHKERR();

        timeEnd();

        message->art = newRasterArt;

        return error;
      } else {
        error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
        CHKERR();

        message->art = rasterArt;

        return error;
      }

      csl("GoLiveEffect: Completed");
      ai_deno::dispose_go_live_effect_result(result);
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
    std::string effectName  = effect->getName();
    std::string effectTitle = effect->getTitle();

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
        [this, &pluginParams, &currentParams, &error, &message, &nodeTree,
         &modal](json event) {
          csl("onFireEvent: %s state: %s", event.dump().c_str(),
              currentParams.dump().c_str());

          ai_deno::JsonFunctionResult* result = ai_deno::edit_live_effect_fire_event(
              this->aiDenoMain, pluginParams.effectName.c_str(), event.dump().c_str(),
              currentParams.dump().c_str()
          );

          if (!result->success) {
            csl("Failed to fire event");
            ai_deno::dispose_json_function_result(result);
            return;
          }

          {
            json res     = json::parse(result->json);
            bool updated = res["updated"];
            csl("Result: %s", res.dump().c_str());
            ai_deno::dispose_json_function_result(result);

            if (!updated) return;

            currentParams       = res["params"];
            pluginParams.params = currentParams;

            csl("eventCallbackResult: %s", res.dump().c_str());

            nodeTree = res["tree"];
            modal->updateRenderTree(nodeTree);

            csl("updated");

            // Rerender preview
            error = this->putParamsToDictionaly(message->parameters, pluginParams);
            CHKERR();
            error = sAILiveEffect->UpdateParameters(message->context);
            CHKERR();

            csl("paramssss");
          }
        };

    ImGuiModal::OnChangeCallback modalOnChangeCallback =
        [&pluginParams, &isModalOpened, &error, &message, &currentParams, &nodeTree,
         &modal, this](json patch) {
          if (isModalOpened) this->isInPreview = true;
          csl("onChange:", patch.dump().c_str());

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

    modalOnChangeCallback(initialParams);

    PluginPreferences pref = this->getPreferences(&error);
    CHKERR();

    std::tuple<int, int> lastPosition;
    if (pref.windowPosition) {
      auto pos     = std::make_tuple(pref.windowPosition->h, pref.windowPosition->v);
      lastPosition = pos;
    } else {
      auto pos     = std::make_tuple(0, 0);
      lastPosition = pos;
    }

    isModalOpened         = true;
    this->editingEffectId = normalizeEffectId;

    csl("Opening modal: pos (%d, %d); %s", std::get<0>(lastPosition),
        std::get<1>(lastPosition), nodeTree.dump().c_str());
    ModalStatusCode dialogResult = modal->runModal(
        nodeTree, effectTitle, &lastPosition, modalOnChangeCallback,
        modalOnFireEventCallback
    );

    pref.windowPosition    = AIPoint{};
    pref.windowPosition->h = std::get<0>(lastPosition);
    pref.windowPosition->v = std::get<1>(lastPosition);
    this->putPreferences(pref, &error);
    csl("Saving window position: %d, %d(%d, %d)", pref.windowPosition->h,
        pref.windowPosition->v, std::get<0>(lastPosition), std::get<1>(lastPosition));
    CHKERR();

    if (dialogResult == ModalStatusCode::OK) {
      csl("Put params to dictionary");
      error = this->putParamsToDictionaly(message->parameters, pluginParams);
      CHKERR();

      error = sAILiveEffect->UpdateParameters(message->context);
      CHKERR();
    } else if (this->isInPreview) {
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
    cse("Error: %s (code: %s [raw: %d])", ex.what(), stringify_ASErr(error).c_str(),
        error);
  } catch (std::exception& ex) {
    error = kCantHappenErr;
    cse("Error: %s", ex.what());
  } catch (...) { error = kCantHappenErr; }

  this->isInPreview     = false;
  this->editingEffectId = std::nullopt;

  return error;
}

ASErr HelloWorldPlugin::LiveEffectAdjustColors(AILiveEffectAdjustColorsMessage* message) {
  csl("**");
  csl("ADJUSTING COLORS LIVE!! EFFECT!!!");
  csl("**");

  ASErr error = kNoErr;

  // Exposing adjustColorCallback to Deno
  AdjustColorCallbackLambda adjustColorCallback =
      [this, message](const char* color) -> const char* {
    json input = json::parse(color);

    AIColor aiColor;
    aiColor.Init();
    aiColor.kind        = kThreeColor;
    aiColor.c.rgb.red   = (double)input["r"];
    aiColor.c.rgb.green = (double)input["g"];
    aiColor.c.rgb.blue  = (double)input["b"];

    AIBoolean altered = false;
    AIErr     err     = kNoErr;
    message->adjustColorCallback(&aiColor, message->clientData, &err, &altered);

    json res({
        {"r", (double)aiColor.c.rgb.red},
        {"g", (double)aiColor.c.rgb.green},
        {"b", (double)aiColor.c.rgb.blue},
        {"a", input["a"]},
    });

    return strdup(res.dump().c_str());
  };

  PluginParams params;
  error = this->getDictionaryValues(message->parameters, &params, defaultPluginParams);
  CHKERR();

  ai_deno::JsonFunctionResult* result = ai_deno::live_effect_adjust_colors(
      aiDenoMain, params.effectName.c_str(), params.params.dump().c_str(),
      (void*)&adjustColorCallback
  );

  if (!result->success) {
    csl("Failed to adjust colors");
    return kCantHappenErr;
  }

  json res = json::parse(result->json);
  ai_deno::dispose_json_function_result(result);

  if (!res["hasChanged"].get<bool>()) { return error; }

  params.params = res["params"];
  this->putParamsToDictionaly(message->parameters, params);
  message->modifiedSomething = true;

  return error;
}

ASErr HelloWorldPlugin::LiveEffectScaleParameters(
    AILiveEffectScaleParamMessage* message
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
  return kNoErr;

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

  std::string effectName = suai::str::toUtf8StdString(
      suai::dict::getUnicodeString(
          dict, AI_DENO_DICT_EFFECT_NAME,
          suai::str::toAiUnicodeStringUtf8(defaultParams.effectName), &error
      )
  );
  CHKERR();

  std::string paramsJson = suai::str::toUtf8StdString(
      suai::dict::getUnicodeString(
          dict, AI_DENO_DICT_PARAMS,
          suai::str::toAiUnicodeStringUtf8(defaultParams.params.dump()), &error
      )
  );
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

PluginPreferences HelloWorldPlugin::getPreferences(ASErr* err = nullptr) {
  AIErr error = kNoErr;
  if (err == nullptr) err = &error;

  PluginPreferences pref;

  auto pos = suai::pref::getPoint(
      AI_DENO_PREF_PREFIX, AI_DENO_PREF_WINDOW_POSITION, std::nullopt, &error
  );
  CHKERR();
  pref.windowPosition = pos;

  if (pref.windowPosition) {
    csl("Get preferences: %d, %d", pref.windowPosition->h, pref.windowPosition->v);
  } else {
    csl("Get preferences: null");
  }

  return pref;
}

void HelloWorldPlugin::putPreferences(PluginPreferences& pref, ASErr* err = nullptr) {
  AIErr error = kNoErr;
  if (err == nullptr) err = &error;

  if (pref.windowPosition.has_value()) {
    AIPoint* point = &pref.windowPosition.value();
    suai::pref::putPoint(
        AI_DENO_PREF_PREFIX, AI_DENO_PREF_WINDOW_POSITION, point, &error
    );
    CHKERR();
  }
}

void HelloWorldPlugin::StaticHandleDenoAiAlert(
    const ai_deno::JsonFunctionResult* request
) {
  json req = json(request->json);

  if (req.contains("kind") && req["kind"] == "alert") {
    std::string message(req["message"].get<std::string>());
    sAIUser->MessageAlert(suai::str::toAiUnicodeStringUtf8(message));
  } else {
    std::cerr << "Unknown request: " << req.dump() << std::endl;
  }
}
