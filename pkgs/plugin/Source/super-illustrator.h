#pragma once

#include <optional>
#include "AIGradient.h"
#include "AIRasterize.h"
#include "IllustratorSDK.h"

extern "C" AIArtSetSuite*     sAIArtSet;
extern "C" AIDictionarySuite* sAIDictionary;
extern "C" AILiveEffectSuite* sAILiveEffect;
extern "C" AIArtSuite*        sAIArt;
extern "C" AIPathSuite*       sAIPath;
extern "C" AIPathStyleSuite*  sAIPathStyle;
extern "C" AILayerSuite*      sAILayer;
extern "C" AIPreferenceSuite* sAIPref;
extern "C" AIRasterSuite*     sAIRaster;
extern "C" AIMaskSuite*       sAIMask;
extern "C" AIGradientSuite*   sAIGradient;

#ifndef CHKERR
#define CHKERR(...)                                                         \
  try {                                                                     \
    aisdk::check_ai_error(error);                                           \
  } catch (ai::Error & ex) {                                                \
    char msg[5] = {0};                                                      \
    std::memcpy(msg, &error, 4);                                            \
    std::cerr << "Error at " << __FILE__ << ":" << __LINE__                 \
              << " \n Reason: " << ex.what() << " \n Code: " << msg << " (" \
              << suai::getErrorName(error) << ")"                           \
              << " [raw: " << error << "]" << std::endl;                    \
    throw ex;                                                               \
  } catch (std::exception & ex) {                                           \
    std::cerr << "Error at " << __FILE__ << ":" << __LINE__                 \
              << " \n Reason: " << ex.what() << std::endl;                  \
    throw ex;                                                               \
  }
#endif

namespace suai {
  // Headers
  template <typename KeyType, typename ValueType>
  static ValueType mapValue(
      const KeyType&                                key,
      const ValueType&                              defaultValue,
      const std::unordered_map<KeyType, ValueType>& valueMap
  );

  std::string getErrorName(ASErr& err);

  namespace str {
    char* strdup(const std::string& str) {
      char* ptr = ::strdup(str.c_str());
      return ptr;
    }

    char* strdup(const ai::UnicodeString& str) {
      char* ptr = ::strdup(str.as_UTF8().data());
      return ptr;
    }

    std::string toUtf8StdString(const char* str) {
      if (str == nullptr) return "";
      return std::string(str);
    }

    std::string toUtf8StdString(const ai::UnicodeString& str) {
      return str.as_UTF8().data();
    }

    ai::UnicodeString toAiUnicodeStringUtf8(const std::string& str) {
      return ai::UnicodeString(str.c_str(), kAIUTF8CharacterEncoding);
    }

    ai::UnicodeString toAiUnicodeStringUtf8(const char* str) {
      if (str == nullptr) return ai::UnicodeString();
      return ai::UnicodeString(str, kAIUTF8CharacterEncoding);
    }
  }  // namespace str

  enum RasterType {
    RGB,
    CMYK,
    Grayscale,
    Bitmap,
    ARGB,
    ACMYK,
    AGrayscale,
    ABitmap,
    Separation,
    ASeparation,
    NChannel,
    ANChannel
  };

  enum RasterSettingColorConvert {
    /** Do standard conversion, without black preservation.  */
    Standard,
    /** Use conversion options appropriate to creating an image
        for screen display. */
    ForPreview,
    /** Use conversion options appropriate to creating an image
        for print or export. */
    ForExport,
  };

  /** @see {AIRasterizeOptions} */
  struct RasterSettingOption {
    bool doLayers          = false;
    bool againstBlack      = false;
    bool dontAlign         = false;
    bool outlineText       = false;
    bool hinted            = false;
    bool useEffectsRes     = false;
    bool useMinTiles       = false;
    bool cmykWhiteMatting  = false;
    bool spotColorRasterOk = false;
    bool nChannelOk        = false;
    // /** [Internal] */
    // bool fillBlackAndIgnoreTransparancy = false;
    // /** [Internal] */
    // bool raterizeSharedSpace = false;
  };

  struct RasterRecord {
   public:
    ai::int16 flags;
    AIRect    bounds;
    ai::int32 byteWidth;
    ai::int16 colorSpace;
    ai::int16 bitsPerPixel;
    ai::int16 originalColorSpace;

    static RasterRecord from(const AIRasterRecord& record) {
      RasterRecord newRecord;
      newRecord.flags              = record.flags;
      newRecord.bounds             = record.bounds;
      newRecord.byteWidth          = record.byteWidth;
      newRecord.colorSpace         = record.colorSpace;
      newRecord.bitsPerPixel       = record.bitsPerPixel;
      newRecord.originalColorSpace = record.originalColorSpace;
      return newRecord;
    };

    //    json toJson() {
    //      json flagsJson = {
    //          {"maskImageType", (bool)(flags & AIRasterFlags::kRasterMaskImageType)},
    //          {"invertBits", (bool)(flags & AIRasterFlags::kRasterInvertBits)},
    //          {"graySubtractive", (bool)(flags &
    //          AIRasterFlags::kRasterGraySubtractive)},
    //          {"createdInSharedSpace",
    //           (bool)(flags & AIRasterFlags::kRasterCreatedInSharedSpace)},
    //          {"createInSingleBuffer",
    //           (bool)(flags & AIRasterFlags::kRasterCreateInSingleBuffer)}
    //      };
    //
    //      json colorSpaceName = getRasterColorSpaceName(colorSpace);
    //
    //      json record = {
    //          {"flags", flagsJson},           {"bounds", bounds.toJson()},
    //          {"byteWidth", byteWidth},       {"colorSpace", colorSpaceName},
    //          {"bitsPerPixel", bitsPerPixel}, {"originalColorSpace", originalColorSpace}
    //      };
    //
    //      return record;
    //    }
  };

  //  std::string
  //  getRasterColorSpaceName(AIRasterColorSpace colorSpace) {
  //    return mapValue(
  //        colorSpace, "Invalid",
  //        {{kColorSpaceHasAlpha, "ColorSpaceHasAlpha"},
  //         {kGrayColorSpace, "Gray"},
  //         {kRGBColorSpace, "RGB"},
  //         {kCMYKColorSpace, "CMYK"},
  //         {kLabColorSpace, "Lab"},
  //         {kSeparationColorSpace, "Separation"},
  //         {kNChannelColorSpace, "NChannel"},
  //         {kIndexedColorSpace, "Indexed"},
  //         {kAlphaGrayColorSpace, "AlphaGray"},
  //         {kAlphaRGBColorSpace, "AlphaRGB"},
  //         {kAlphaCMYKColorSpace, "AlphaCMYK"},
  //         {kAlphaLabColorSpace, "AlphaLab"},
  //         {kAlphaSeparationColorSpace, "AlphaSeparation"},
  //         {kAlphaNChannelColorSpace, "AlphaNChannel"},
  //         {kAlphaIndexedColorSpace, "AlphaIndexed"},
  //         {kInvalidColorSpace, "Invalid"}}
  //    );
  //  }

  struct RasterSettingsInit {
    RasterType type;
    /** The supersampling factor, less than 2 for none, 2 or more for
     * anti-aliasing.  */
    short                     antiAlias = 0;
    double                    resolution;
    bool                      preserveSpotColors;
    RasterSettingColorConvert colorConvert = RasterSettingColorConvert::Standard;
    RasterSettingOption       options      = RasterSettingOption();
  };

  struct ArtUserAttrs {
    bool selected                    = false;
    bool locked                      = false;
    bool hidden                      = false;
    bool fullySelected               = false;
    bool expanded                    = false;
    bool targeted                    = false;
    bool isClipMask                  = false;
    bool isTextWrap                  = false;
    bool selectedTopLevelGroups      = false;
    bool selectedLeaves              = false;
    bool selectedTopLevelWithPaint   = false;
    bool hasSimpleStyle              = false;
    bool hasActiveStyle              = false;
    bool partOfCompound              = false;
    bool matchDictionaryArt          = false;
    bool matchArtInGraphs            = false;
    bool matchArtInResultGroups      = false;
    bool matchTextPaths              = false;
    bool styleIsDirty                = false;
    bool matchArtNotIntoPluginGroups = false;
    bool matchArtInCharts            = false;
    bool matchArtIntoRepeats         = false;

    json toJson() {
      json userAttrs = {
          {"selected", selected},
          {"locked", locked},
          {"hidden", hidden},
          {"fullySelected", fullySelected},
          {"expanded", expanded},
          {"targeted", targeted},
          {"isClipMask", isClipMask},
          {"isTextWrap", isTextWrap},
          {"selectedTopLevelGroups", selectedTopLevelGroups},
          {"selectedLeaves", selectedLeaves},
          {"selectedTopLevelWithPaint", selectedTopLevelWithPaint},
          {"hasSimpleStyle", hasSimpleStyle},
          {"hasActiveStyle", hasActiveStyle},
          {"partOfCompound", partOfCompound},
          {"matchDictionaryArt", matchDictionaryArt},
          {"matchArtInGraphs", matchArtInGraphs},
          {"matchArtInResultGroups", matchArtInResultGroups},
          {"matchTextPaths", matchTextPaths},
          {"styleIsDirty", styleIsDirty},
          {"matchArtNotIntoPluginGroups", matchArtNotIntoPluginGroups},
          {"matchArtInCharts", matchArtInCharts},
          {"matchArtIntoRepeats", matchArtIntoRepeats}
      };

      return userAttrs;
    }

    json toJSONOnlyFlagged() {
      json attrs    = toJson();
      json filtered = json::object();

      for (auto& [key, value] : attrs.items()) {
        if (value == true) { filtered[key] = true; }
      }

      return filtered;
    }
  };

  AIRasterizeSettings createAIRasterSetting(RasterSettingsInit init) {
    RasterSettingOption options = init.options;

    AIRasterizeSettings settings;
    settings.antialiasing       = init.antiAlias;
    settings.resolution         = init.resolution;
    settings.preserveSpotColors = init.preserveSpotColors;
    settings.ccoptions          = AIColorConvertOptions::kDefault;

    settings.type = mapValue(
        init.type, AIRasterizeType::kRasterizeGrayscale,
        {{RasterType::RGB, AIRasterizeType::kRasterizeRGB},
         {RasterType::CMYK, AIRasterizeType::kRasterizeCMYK},
         {RasterType::Grayscale, AIRasterizeType::kRasterizeGrayscale},
         {RasterType::Bitmap, AIRasterizeType::kRasterizeBitmap},
         {RasterType::ARGB, AIRasterizeType::kRasterizeARGB},
         {RasterType::ACMYK, AIRasterizeType::kRasterizeACMYK},
         {RasterType::AGrayscale, AIRasterizeType::kRasterizeAGrayscale},
         {RasterType::ABitmap, AIRasterizeType::kRasterizeABitmap},
         {RasterType::Separation, AIRasterizeType::kRasterizeSeparation},
         {RasterType::ASeparation, AIRasterizeType::kRasterizeASeparation},
         {RasterType::NChannel, AIRasterizeType::kRasterizeNChannel},
         {RasterType::ANChannel, AIRasterizeType::kRasterizeANChannel}}
    );

    settings.ccoptions = mapValue(
        init.colorConvert, AIColorConvertOptions::kDefault,
        {{RasterSettingColorConvert::Standard, AIColorConvertOptions::kDefault},
         {RasterSettingColorConvert::ForPreview, AIColorConvertOptions::kForPreview},
         {RasterSettingColorConvert::ForExport, AIColorConvertOptions::kForExport}}
    );

    int optionVal = kRasterizeOptionsNone;
    if (options.doLayers) optionVal |= AIRasterizeOptions::kRasterizeOptionsDoLayers;
    if (options.againstBlack)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsAgainstBlack;
    if (options.dontAlign) optionVal |= AIRasterizeOptions::kRasterizeOptionsDontAlign;
    if (options.outlineText)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsOutlineText;
    if (options.hinted) optionVal |= AIRasterizeOptions::kRasterizeOptionsHinted;
    if (options.useEffectsRes)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsUseEffectsRes;
    if (options.useMinTiles)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsUseMinTiles;
    if (options.cmykWhiteMatting)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsCMYKWhiteMatting;
    if (options.spotColorRasterOk)
      optionVal |= AIRasterizeOptions::kRasterizeOptionsSpotColorRasterOk;
    if (options.nChannelOk) optionVal |= AIRasterizeOptions::kRasterizeOptionsNChannelOk;
    // if (options.fillBlackAndIgnoreTransparancy)
    //   optionVal |= AIRasterizeOptions::kFillBlackAndIgnoreTransparancy;
    // if (options.raterizeSharedSpace)
    //   optionVal |= AIRasterizeOptions::kRaterizeSharedSpace;

    settings.options = (AIRasterizeOptions)optionVal;

    return settings;
  }

  AIRasterRecord* createAIRasterInfo(RasterRecord info) {
    AIRasterRecord* rasterInfo;
    rasterInfo->flags              = info.flags;
    rasterInfo->bounds             = info.bounds;
    rasterInfo->byteWidth          = info.byteWidth;
    rasterInfo->colorSpace         = info.colorSpace;
    rasterInfo->bitsPerPixel       = info.bitsPerPixel;
    rasterInfo->originalColorSpace = info.originalColorSpace;
    return rasterInfo;
  }

  class ArtSet {
   private:
    AIArtSet artSet;

   public:
    static ArtSet* fromArtSet(AIArtSet artSet) {
      ArtSet* instance = new ArtSet();
      instance->artSet = artSet;
      return instance;
    }

    ArtSet() { sAIArtSet->NewArtSet(&artSet); }

    ~ArtSet() { sAIArtSet->DisposeArtSet(&artSet); }

    AIArtSet ToAIArtSet() { return artSet; }

    void AddArt(AIArtHandle& art) { sAIArtSet->AddArtToArtSet(artSet, art); }

    std::size_t size() {
      std::size_t count;
      sAIArtSet->CountArtSet(artSet, &count);
      return count;
    }

    std::vector<AIArtHandle> GetAllArts() {
      std::vector<AIArtHandle> arts;
      size_t                   count;
      sAIArtSet->CountArtSet(artSet, &count);

      for (size_t i = 0; i < count; i++) {
        AIArtHandle art;
        sAIArtSet->NextInArtSet(artSet, nullptr, &art);
        arts.push_back(art);
      }

      return arts;
    }
  };

  class LiveEffect {
   private:
    AILiveEffectHandle effectHandle;

   public:
    LiveEffect(AILiveEffectHandle effectHandle) : effectHandle(effectHandle) {}

    std::string getName() {
      const char* effectName = NULL;
      sAILiveEffect->GetLiveEffectName(effectHandle, &effectName);
      return str::toUtf8StdString(effectName);
    }

    std::string getTitle() {
      const char* effectTitle = NULL;
      sAILiveEffect->GetLiveEffectTitle(effectHandle, &effectTitle);

      ai::UnicodeString title =
          ai::UnicodeString(effectTitle, kAIPlatformCharacterEncoding);

      return title.as_UTF8().data();
    }
  };

  namespace art {
    short getArtType(AIArtHandle art, AIErr* error = nullptr) {
      short type;

      AIErr err = sAIArt->GetArtType(art, &type);
      if (error != nullptr) *error = err;

      return type;
    }

    std::tuple<std::string, bool> getName(AIArtHandle art, AIErr* error = nullptr) {
      ai::UnicodeString name;
      ASBoolean         isDefaultName;

      AIErr err = sAIArt->GetArtName(art, name, &isDefaultName);
      if (error != nullptr) *error = err;

      return {str::toUtf8StdString(name), isDefaultName == 1};
    }

    std::string getTypeName(AIArtHandle art, AIErr* error = nullptr) {
      short type = getArtType(art, error);

      return mapValue(
          type, string_format("Unknown(%d)", type),
          {
              {AIArtType::kAnyArt, "Any"},
              {AIArtType::kUnknownArt, string_format("Unknown(%d)", type)},
              {AIArtType::kGroupArt, "Group"},
              {AIArtType::kPathArt, "Path"},
              {AIArtType::kCompoundPathArt, "CompoundPath"},
              {AIArtType::kTextArtUnsupported, "TextUnsupported"},
              {AIArtType::kTextPathArtUnsupported, "TextPathUnsupported"},
              {AIArtType::kTextRunArtUnsupported, "TextRunUnsupported"},
              {AIArtType::kPlacedArt, "Placed"},
              {AIArtType::kMysteryPathArt, "MysteryPath"},
              {AIArtType::kRasterArt, "Raster"},
              {AIArtType::kPluginArt, "Plugin"},
              {AIArtType::kMeshArt, "Mesh"},
              {AIArtType::kTextFrameArt, "TextFrame"},
              {AIArtType::kSymbolArt, "Symbol"},
              {AIArtType::kForeignArt, "Foreign"},
              {AIArtType::kLegacyTextArt, "LegacyText"},
              {AIArtType::kChartArt, "Chart"},
              {AIArtType::kRadialRepeatArt, "RadialRepeat"},
              {AIArtType::kGridRepeatArt, "GridRepeat"},
              {AIArtType::kSymmetryArt, "Symmetry"},
              {AIArtType::kConcentricRepeatArt, "ConcentricRepeat"},

          }
      );
    }

    ArtUserAttrs getUserAttrs(AIArtHandle art, AIErr* error = nullptr) {
      ai::int32 attrs;

      AIErr err = sAIArt->GetArtUserAttr(
          art,
          AIArtUserAttr::kArtSelected | AIArtUserAttr::kArtLocked |
              AIArtUserAttr::kArtHidden | AIArtUserAttr::kArtFullySelected |
              AIArtUserAttr::kArtExpanded | AIArtUserAttr::kArtTargeted |
              AIArtUserAttr::kArtIsClipMask | AIArtUserAttr::kArtIsTextWrap |
              AIArtUserAttr::kArtSelectedTopLevelGroups |
              AIArtUserAttr::kArtSelectedLeaves |
              AIArtUserAttr::kArtSelectedTopLevelWithPaint |
              AIArtUserAttr::kArtHasSimpleStyle | AIArtUserAttr::kArtHasActiveStyle |
              AIArtUserAttr::kArtPartOfCompound | AIArtUserAttr::kMatchDictionaryArt |
              AIArtUserAttr::kMatchArtInGraphs | AIArtUserAttr::kMatchArtInResultGroups |
              AIArtUserAttr::kMatchTextPaths | AIArtUserAttr::kArtStyleIsDirty |
              AIArtUserAttr::kMatchArtNotIntoPluginGroups |
              AIArtUserAttr::kMatchArtInCharts | AIArtUserAttr::kMatchArtIntoRepeats,
          &attrs
      );

      if (error != nullptr) *error = err;

      ArtUserAttrs userAttrs{
          .selected               = !!(attrs & AIArtUserAttr::kArtSelected),
          .locked                 = !!(attrs & AIArtUserAttr::kArtLocked),
          .hidden                 = !!(attrs & AIArtUserAttr::kArtHidden),
          .fullySelected          = !!(attrs & AIArtUserAttr::kArtFullySelected),
          .expanded               = !!(attrs & AIArtUserAttr::kArtExpanded),
          .targeted               = !!(attrs & AIArtUserAttr::kArtTargeted),
          .isClipMask             = !!(attrs & AIArtUserAttr::kArtIsClipMask),
          .isTextWrap             = !!(attrs & AIArtUserAttr::kArtIsTextWrap),
          .selectedTopLevelGroups = !!(attrs & AIArtUserAttr::kArtSelectedTopLevelGroups),
          .selectedLeaves         = !!(attrs & AIArtUserAttr::kArtSelectedLeaves),
          .selectedTopLevelWithPaint =
              !!(attrs & AIArtUserAttr::kArtSelectedTopLevelWithPaint),
          .hasSimpleStyle         = !!(attrs & AIArtUserAttr::kArtHasSimpleStyle),
          .hasActiveStyle         = !!(attrs & AIArtUserAttr::kArtHasActiveStyle),
          .partOfCompound         = !!(attrs & AIArtUserAttr::kArtPartOfCompound),
          .matchDictionaryArt     = !!(attrs & AIArtUserAttr::kMatchDictionaryArt),
          .matchArtInGraphs       = !!(attrs & AIArtUserAttr::kMatchArtInGraphs),
          .matchArtInResultGroups = !!(attrs & AIArtUserAttr::kMatchArtInResultGroups),
          .matchTextPaths         = !!(attrs & AIArtUserAttr::kMatchTextPaths),
          .styleIsDirty           = !!(attrs & AIArtUserAttr::kArtStyleIsDirty),
          .matchArtNotIntoPluginGroups =
              !!(attrs & AIArtUserAttr::kMatchArtNotIntoPluginGroups),
          .matchArtInCharts    = !!(attrs & AIArtUserAttr::kMatchArtInCharts),
          .matchArtIntoRepeats = !!(attrs & AIArtUserAttr::kMatchArtIntoRepeats),
      };  // namespace art

      return userAttrs;
    }  // namespace suai

    bool getUserAttr(AIArtHandle art, AIArtUserAttr whichAttr) {
      ai::int32 attr;
      sAIArt->GetArtUserAttr(art, whichAttr, &attr);
      return attr;
    }

    std::string
    preinsertionFlightCheck(AIArtHandle art, AIPaintOrder paintOrder, AIArtHandle prep) {
      AIErr error = sAIArt->PreinsertionFlightCheck(art, paintOrder, prep);
      return suai::getErrorName(error);
    }

    namespace deserialize {
      void _AssertTypeName(const json& obj, const std::string& typeName) {
        if (!obj["__typename"].is_string()) {
          throw std::invalid_argument("Missing __typename");
        }

        if (obj["__typename"] != typeName) {
          throw std::invalid_argument(
              "Incorrect type, expected: " + typeName +
              ", actual: " + obj["__typename"].get<std::string>()
          );
        }
      }

      AIRealRect toAIRealRect(const json& j) {
        _AssertTypeName(j, "AIRealRect");
        return AIRealRect(j["left"], j["top"], j["right"], j["bottom"]);
      }

      AIRealPoint toAIRealPoint(const json& j) {
        _AssertTypeName(j, "AIRealPoint");
        return AIRealPoint{j["x"], j["y"]};
      }

      AIRealMatrix toAIRealMatrix(const json& j) {
        _AssertTypeName(j, "AIRealMatrix");
        return AIRealMatrix{j["a"], j["b"], j["c"], j["d"], j["tx"], j["ty"]};
      }

      AIGradientStyle toAIGradientStyle(const json& gradient);

      AIColor toAIColor(const json& j) {
        _AssertTypeName(j, "AIColor");

        AIColor color;
        color.Init();

        if (j["type"] == "gray") {
          color.kind     = AIColorTag::kGrayColor;
          color.c.g.gray = j["color"]["gray"];
        } else if (j["type"] == "rgb") {
          color.kind        = AIColorTag::kThreeColor;
          color.c.rgb.red   = j["color"]["red"];
          color.c.rgb.green = j["color"]["green"];
          color.c.rgb.blue  = j["color"]["blue"];
        } else if (j["type"] == "cmyk") {
          color.kind        = AIColorTag::kFourColor;
          color.c.f.cyan    = j["color"]["cyan"];
          color.c.f.magenta = j["color"]["magenta"];
          color.c.f.yellow  = j["color"]["yellow"];
          color.c.f.black   = j["color"]["black"];
        } else if (j["type"] == "pattern") {
          color.kind = AIColorTag::kPattern;
          std::cout << "suai::art::desrialice: Pattern color not supported yet"
                    << std::endl;
        } else if (j["type"] == "gradient") {
          color.kind = AIColorTag::kGradient;
          color.c.b  = toAIGradientStyle(j["gradient"]);
        } else {
          color.kind = AIColorTag::kNoneColor;
        }

        return color;
      }

      AIGradientStyle toAIGradientStyle(const json& gradient) {
        _AssertTypeName(gradient, "AIGradientStyle");

        AIGradientStyle style;
        style.gradientOrigin = toAIRealPoint(gradient["origin"]);
        style.matrix         = toAIRealMatrix(gradient["matrix"]);
        style.gradientAngle  = gradient["angle"];
        style.gradientLength = gradient["length"];
        style.hiliteAngle    = gradient["hilite"];
        style.hiliteLength   = gradient["hiliteLength"];

        ai::int16 stopCount = gradient["stops"].size();
        sAIGradient->NewGradient(&style.gradient);
        AIGradientStop stop;

        for (ai::int16 i = 0; i < stopCount; i++) {
          json stopJson  = gradient["stops"][i];
          stop.color     = toAIColor(stopJson["color"]);
          stop.midPoint  = stopJson["midPoint"];
          stop.rampPoint = stopJson["rampPoint"];
          stop.opacity   = stopJson["opacity"];
          sAIGradient->InsertGradientStop(style.gradient, i, &stop);
        }

        return style;
      }

      AIDashStyle toAIDashStyle(const json& dash) {
        _AssertTypeName(dash, "AIDashStyle");

        if (!dash["array"].is_array() || dash["array"].size() != 6) {
          throw std::invalid_argument("Invalid dash array");
        }

        AIDashStyle style;
        style.length = dash["length"];
        style.offset = dash["offset"];

        float array[6] = {};
        for (int i = 0; i < 6; i++) {
          style.array[i] = (float)dash["array"][i];
        }

        return style;
      }

      AIStrokeStyle toAIStrokeStyle(const json& j) {
        _AssertTypeName(j, "AIStrokeStyle");

        AIStrokeStyle style;
        style.color = toAIColor(j["color"]);
        style.width = j["width"];
        style.join  = mapValue(
            j["join"], AILineJoin::kAIMiterJoin,
            {
                {"miter", AILineJoin::kAIMiterJoin},
                {"round", AILineJoin::kAIRoundJoin},
                {"bevel", AILineJoin::kAIBevelJoin},
            }
        );
        style.cap = mapValue<std::string, AILineCap>(
            j["cap"], AILineCap::kAIButtCap,
            {
                {"butt", AILineCap::kAIButtCap},
                {"round", AILineCap::kAIRoundCap},
                {"projecting", AILineCap::kAIProjectingCap},
            }
        );
        style.dash       = toAIDashStyle(j["dash"]);
        style.miterLimit = j["miterLimit"];
        style.overprint  = j["overprint"];

        return style;
      }

      AIFillStyle toAIFillStyle(const json& j) {
        _AssertTypeName(j, "AIFillStyle");

        AIFillStyle style;
        style.color     = toAIColor(j["color"]);
        style.overprint = j["overprint"];

        return style;
      }

      AIRealBezier toAIRealBezier(const json& j) {
        _AssertTypeName(j, "AIRealBezier");

        AIRealBezier bezier;
        bezier.p0 = toAIRealPoint(j["p0"]);
        bezier.p1 = toAIRealPoint(j["p1"]);
        bezier.p2 = toAIRealPoint(j["p2"]);
        bezier.p3 = toAIRealPoint(j["p3"]);

        return bezier;
      }

      AIPathSegment toAIPathSegmentList(const json& j) {
        _AssertTypeName(j, "AIPathSegmentList");

        AIPathSegment segment;
        segment.p      = toAIRealPoint(j["p"]);
        segment.in     = toAIRealPoint(j["in"]);
        segment.out    = toAIRealPoint(j["out"]);
        segment.corner = j["corner"];

        return segment;
      }

      AIPathStyle toAIPathStyle(const json& j) {
        _AssertTypeName(j, "AIPathStyle");

        AIPathStyle style;
        style.fill        = toAIFillStyle(j["fill"]);
        style.fillPaint   = (bool)j["fillPaint"];
        style.stroke      = toAIStrokeStyle(j["stroke"]);
        style.strokePaint = (bool)j["strokePaint"];
        style.clip        = (bool)j["clip"];
        style.evenodd     = (bool)j["evenOdd"];
        style.lockClip    = (bool)j["lockClip"];
        style.resolution  = j["resolution"];

        return style;
      }

      AIArtHandle toAIArtHandle(const json& j) {
        _AssertTypeName(j, "AIArtHandle");

        AIArtHandle art;
        short       artType = j["artTypeCode"];
        sAIArt->NewArt(artType, AIPaintOrder::kPlaceAbove, NULL, &art);

        if (!j["isDefaultName"]) {
          sAIArt->SetArtName(art, str::toAiUnicodeStringUtf8(j["name"]));
        }

        if (artType == AIArtType::kUnknownArt) { return art; }

        // Apply user attributes
        {
          json      attrs     = j["attributes"];
          ai::int32 attrValue = 0;

          // Ignoring
          // if (attrs["selected"]) {　attrValue |= AIArtUserAttr::kArtSelected; }

          if (attrs["locked"]) { attrValue |= AIArtUserAttr::kArtLocked; }
          if (attrs["hidden"]) { attrValue |= AIArtUserAttr::kArtHidden; }
          // if (attrs["fullySelected"]) { attrValue |= AIArtUserAttr::kArtFullySelected;
          // }
          if (attrs["expanded"]) { attrValue |= AIArtUserAttr::kArtExpanded; }
          // if (attrs["targeted"]) { attrValue |= AIArtUserAttr::kArtTargeted; }
          if (attrs["isClipMask"]) { attrValue |= AIArtUserAttr::kArtIsClipMask; }
          if (attrs["isTextWrap"]) { attrValue |= AIArtUserAttr::kArtIsTextWrap; }
          // if (attrs["selectedTopLevelGroups"]) { attrValue |=
          // AIArtUserAttr::kArtSelectedTopLevelGroups; } if (attrs["selectedLeaves"]) {
          // attrValue |= AIArtUserAttr::kArtSelectedLeaves; } if
          // (attrs["selectedTopLevelWithPaint"]) { attrValue |=
          // AIArtUserAttr::kArtSelectedTopLevelWithPaint; }
          if (attrs["hasSimpleStyle"]) { attrValue |= AIArtUserAttr::kArtHasSimpleStyle; }
          if (attrs["hasActiveStyle"]) { attrValue |= AIArtUserAttr::kArtHasActiveStyle; }
          if (attrs["partOfCompound"]) { attrValue |= AIArtUserAttr::kArtPartOfCompound; }
          // if (attrs["matchDictionaryArt"]) { attrValue |=
          // AIArtUserAttr::kMatchDictionaryArt; } if (attrs["matchArtInGraphs"]) {
          // attrValue |= AIArtUserAttr::kMatchArtInGraphs; } if
          // (attrs["matchArtInResultGroups"]) { attrValue |=
          // AIArtUserAttr::kMatchArtInResultGroups; } if (attrs["matchTextPaths"]) {
          // attrValue |= AIArtUserAttr::kMatchTextPaths; } if (attrs["styleIsDirty"]) {
          // attrValue |= AIArtUserAttr::kArtStyleIsDirty; } if
          // (attrs["matchArtNotIntoPluginGroups"]) { attrValue |=
          // AIArtUserAttr::kMatchArtNotIntoPluginGroups; } if (attrs["matchArtInCharts"])
          // { attrValue |= AIArtUserAttr::kMatchArtInCharts; } if
          // (attrs["matchArtIntoRepeats"]) { attrValue |=
          // AIArtUserAttr::kMatchArtIntoRepeats; }

          sAIArt->SetArtUserAttr(
              art,
              AIArtUserAttr::kArtLocked | AIArtUserAttr::kArtHidden |
                  AIArtUserAttr::kArtExpanded | AIArtUserAttr::kArtIsClipMask |
                  AIArtUserAttr::kArtIsTextWrap | AIArtUserAttr::kArtHasSimpleStyle |
                  AIArtUserAttr::kArtHasActiveStyle | AIArtUserAttr::kArtPartOfCompound,
              attrValue
          );
        }

        if (artType == AIArtType::kPathArt) {
          //   pjb  sAIPathStyle->SetPathStyle(art, toAIPathStyle(j["style"]));

          // Create paths
          { toAIPathSegmentList(j["path"]["segments"]); }
        }

        //
        // TODO
        //

        return art;
      }
    }  // namespace deserialize

    namespace serialize {

      // json __getChildrenAsJson(AIArtHandle parentArt, int depth, int maxDepth);

      json AIRectOrRealRectToJSON(const AIRealRect& bounds) {
        return {
            {"__typename", "AIRealRect"},
            {"left", bounds.left},
            {"top", bounds.top},
            {"right", bounds.right},
            {"bottom", bounds.bottom}
        };
      }

      json AIRectOrRealRectToJSON(const AIRect& bounds) {
        return {
            {"__typename", "AIRect"},
            {"left", bounds.left},
            {"top", bounds.top},
            {"right", bounds.right},
            {"bottom", bounds.bottom}
        };
      }

      json AIPointToJSON(const AIRealPoint& point) {
        return {{"__typename", "AIRealPoint"}, {"x", point.h}, {"y", point.v}};
      }

      json AIPointToJSON(const AIPoint& point) {
        return {{"__typename", "AIPoint"}, {"x", point.h}, {"y", point.v}};
      }

      json AIMatrixToJSON(const AIRealMatrix& matrix) {
        return {
            {"__typename", "AIRealMatrix"},
            {"a", matrix.a},
            {"b", matrix.b},
            {"c", matrix.c},
            {"d", matrix.d},
            {"tx", matrix.tx},
            {"ty", matrix.ty}
        };
      }

      json AIGradientStyleToJSON(const AIGradientStyle& style);

      json AIColorToJSON(const AIColor& color) {
        switch (color.kind) {
          case AIColorTag::kGrayColor:
            return {{"type", "gray"}, {"color", {"gray", color.c.g.gray}}};
          case AIColorTag::kThreeColor:
            return {
                {"type", "rgb"},
                {"color",
                 {{"red", color.c.rgb.red},
                  {"green", color.c.rgb.green},
                  {"blue", color.c.rgb.blue}}},

            };
          case AIColorTag::kFourColor:
            return {
                {"type", "cmyk"},
                {"color", json(
                              {{"cyan", color.c.f.cyan},
                               {"magenta", color.c.f.magenta},
                               {"yellow", color.c.f.yellow},
                               {"black", color.c.f.black}}
                          )}
            };
          case AIColorTag::kPattern:
            return {{"type", "pattern"}};
          case AIColorTag::kGradient:
            return {{"type", "gradient"}, {"gradient", AIGradientStyleToJSON(color.c.b)}};
          case AIColorTag::kNoneColor:
          default:
            return {{"type", "none"}};
        }
      }

      json AIGradientStyleToJSON(const AIGradientStyle& style) {
        AIErr error;

        ai::int16 stopCount = 0;
        error = sAIGradient->GetGradientStopCount(style.gradient, &stopCount);
        aisdk::check_ai_error(error);

        json           stopsJson = json::array();
        AIGradientStop stop;

        for (ai::int16 i = 0; i < stopCount; i++) {
          error = sAIGradient->GetNthGradientStop(style.gradient, i, &stop);
          aisdk::check_ai_error(error);

          stopsJson.push_back(json(
              {{"__typename", "AIGradientStop"},
               {"color", AIColorToJSON(stop.color)},
               {"midPoint", stop.midPoint},
               {"rampPoint", stop.rampPoint},
               {"opacity", stop.opacity}}
          ));
        }

        ai::int16 type = 0;
        error          = sAIGradient->GetGradientType(style.gradient, &type);
        aisdk::check_ai_error(error);

        std::string typeName = mapValue<int, std::string>(
            (int)type, "LinearGradient",
            {{(int)kRadialGradient, "RadialGradient"},
             {(int)kLinearGradient, "LinearGradient"}}
        );

        return {
            {"__typename", "AIGradientStyle"},
            {"type", typeName},
            {"origin", AIPointToJSON(style.gradientOrigin)},
            {"matrix", AIMatrixToJSON(style.matrix)},
            {"angle", style.gradientAngle},
            {"length", style.gradientLength},
            {"hilite", style.hiliteAngle},
            {"hiliteLength", style.hiliteLength},
            {"stops", stopsJson}
        };
      }

      json AIDashStyleToJSON(const AIDashStyle& dash) {
        std::vector<float> dashArrayVec = std::vector<float>(/*dash.array*/);

        return {
            {"__typename", "AIDashStyle"},
            {"length", dash.length},
            {"offset", dash.offset},
            {"array", dash.array}
        };
      }

      json AIStrokeStyleToJSON(const AIStrokeStyle& stroke) {
        json strokeJson = {
            {"__typename", "AIStrokeStyle"},
            {"color", AIColorToJSON(stroke.color)},
            {"width", stroke.width},
            {"join", stroke.join == AILineJoin::kAIMiterJoin   ? "miter"
                     : stroke.join == AILineJoin::kAIRoundJoin ? "round"
                     : stroke.join == AILineJoin::kAIBevelJoin ? "bevel"
                                                               : "bevel"},
            {"cap", stroke.cap == AILineCap::kAIButtCap         ? "butt"
                    : stroke.cap == AILineCap::kAIRoundCap      ? "round"
                    : stroke.cap == AILineCap::kAIProjectingCap ? "projecting"
                                                                : "projecting"},
            {"dash", AIDashStyleToJSON(stroke.dash)},
            {"miterLimit", stroke.miterLimit},
            {"overprint", stroke.overprint},
        };

        return strokeJson;
      }

      json AIFillStyleToJSON(const AIFillStyle& fill) {
        json fillJson = {
            {"__typename", "AIFillStyle"},
            {"color", AIColorToJSON(fill.color)},
            {"overprint", fill.overprint},
        };

        return fillJson;
      }

      json AIRealBezierToJSON(const AIRealBezier& bezier) {
        return {
            {"__typename", "AIRealBezier"},
            {"p0", AIPointToJSON(bezier.p0)},
            {"p1", AIPointToJSON(bezier.p1)},
            {"p2", AIPointToJSON(bezier.p2)},
            {"p3", AIPointToJSON(bezier.p3)}
        };
      }

      json AIPathSegmentsToJSON(AIArtHandle& path) {
        AIErr error;

        ai::int16 segmentCount = 0;
        error                  = sAIPath->GetPathSegmentCount(path, &segmentCount);
        aisdk::check_ai_error(error);

        AIPathSegment segments[segmentCount];
        error = sAIPath->GetPathSegments(path, 0, segmentCount, segments);
        aisdk::check_ai_error(error);

        std::vector<int> selectedSegments;

        json segmentsJson = json::array();
        for (ai::int16 i = 0; i < segmentCount; i++) {
          AIPathSegment segment = segments[i];

          AIRealBezier bezier;

          error = sAIPath->GetPathBezier(path, i, &bezier);
          aisdk::check_ai_error(error);

          ai::int16 selectFlags = false;
          error                 = sAIPath->GetPathSegmentSelected(path, i, &selectFlags);
          aisdk::check_ai_error(error);
          bool isSelected =
              selectFlags != AIPathSegementSelectionState::kSegmentNotSelected;

          if (isSelected) { selectedSegments.push_back(i); }

          segmentsJson.push_back(json(
              {{"__typename", "AIPathSegment"},
               {"p", AIPointToJSON(segment.p)},
               {"in", AIPointToJSON(segment.in)},
               {"out", AIPointToJSON(segment.out)},
               {"corner", (bool)segment.corner},
               {"bezier", AIRealBezierToJSON(bezier)},
               {"isSelected", isSelected}}
          ));
        }

        AIBoolean isClosed = false;
        error              = sAIPath->GetPathClosed(path, &isClosed);
        aisdk::check_ai_error(error);

        AIBoolean isClip = false;
        error            = sAIPath->GetPathIsClip(path, &isClip);
        aisdk::check_ai_error(error);

        AIBoolean isGuide = false;
        sAIPath->GetPathGuide(path, &isGuide);
        aisdk::check_ai_error(error);

        AIReal length = 0;
        error         = sAIPath->GetPathLength(path, &length, 0);
        aisdk::check_ai_error(error);

        AIBoolean allSelected = false;
        error                 = sAIPath->GetPathAllSegmentsSelected(path, &allSelected);
        aisdk::check_ai_error(error);

        // error =

        return {
            {"__typename", "AIPathSegmentList"},
            {"segments", segmentsJson},
            {"length", length},
            {"selectedSegments", selectedSegments},
            {"allSelected", (bool)allSelected},
            {"isClosed", (bool)isClosed},
            {"isClip", (bool)isClip},
            {"isGuide", (bool)isGuide}
        };
      }

      json AIRasterRecordToJson(const AIRasterRecord& info) {
        return {
            {"__typename", "AIRasterRecord"},
            {"width", info.bounds.right - info.bounds.left},
            {"height", info.bounds.bottom - info.bounds.top},
            {"bitsPerPixel", info.bitsPerPixel},
            {"colorSpace", info.colorSpace},
            {"flags", info.flags}
        };
      }

      json AIPathStyleToJSON(const AIPathStyle& style) {
        return {
            {"__typename", "AIPathStyle"},
            {"fill", AIFillStyleToJSON(style.fill)},
            {"fillPaint", (bool)style.fillPaint},
            {"stroke", AIStrokeStyleToJSON(style.stroke)},
            {"strokePaint", (bool)style.strokePaint},
            {"clip", (bool)style.clip},
            {"evenodd", (bool)style.evenodd},
            {"lockClip", (bool)style.lockClip},
            {"resolution", (double)style.resolution},
        };
      }

      std::optional<json> ArtObjectToJson(AIArtHandle art, int depth, int maxDepth) {
        if (!art || depth > maxDepth) return std::nullopt;

        AIErr error   = kNoErr;
        json  artJson = json({{
            "__typename",
            "AIArtHandle",
        }});

        short artType = getArtType(art, &error);
        aisdk::check_ai_error(error);

        auto attrs = getUserAttrs(art, &error);
        aisdk::check_ai_error(error);

        auto [artName, isDefaultName] = getName(art, &error);
        aisdk::check_ai_error(error);

        // 基本情報を設定
        artJson["artTypeCode"] = artType;
        artJson["artTypeName"] = getTypeName(art);

        artJson["name"]          = artName;
        artJson["isDefaultName"] = isDefaultName != 0;

        if (artType == AIArtType::kUnknownArt) { return artJson; }

        // Bounding box
        AIRealRect bounds;
        error = sAIArt->GetArtBounds(art, &bounds);
        aisdk::check_ai_error(error);
        artJson["bounds"] = AIRectOrRealRectToJSON(bounds);

        // Matrix
        // AIRealMatrix matrix;
        // error = sAIArt->GetArtTransformBounds();

        // Attributes
        artJson["attributes"] = attrs.toJson();

        if (artType == AIArtType::kPathArt) {
          AIPathStyle style;
          AIBoolean   outHasAdvFill;
          error = sAIPathStyle->GetPathStyle(art, &style, &outHasAdvFill);
          aisdk::check_ai_error(error);

          artJson["style"]         = AIPathStyleToJSON(style);
          artJson["outHasAdvFill"] = (bool)outHasAdvFill;
          artJson["path"]          = AIPathSegmentsToJSON(art);
        } else if (artType == kRasterArt) {
          AIRasterRecord info;
          error = sAIRaster->GetRasterInfo(art, &info);
          aisdk::check_ai_error(error);
          artJson["rasterInfo"] = AIRasterRecordToJson(info);
        } else if (artType == kTextFrameArt) {
          artJson["isTextFrame"] = true;
        }

        AIBoolean hasDictionary  = sAIArt->HasDictionary(art);
        artJson["hasDictionary"] = hasDictionary && !sAIArt->IsDictionaryEmpty(art);

        // Get Note
        AIBoolean hasNote = sAIArt->HasNote(art);
        artJson["note"]   = json::value_t::null;

        if (hasNote) {
          ai::UnicodeString note;
          error = sAIArt->GetNote(art, note);
          aisdk::check_ai_error(error);

          artJson["note"] = note.as_Platform();
        }

        if ((artType == kGroupArt || artType == kCompoundPathArt ||
             artType == kTextFrameArt || artType == kSymbolArt) &&
            depth < maxDepth) {
          AIArtHandle children;
          error = sAIArt->GetArtFirstChild(art, &children);
          aisdk::check_ai_error(error);

          std::vector<json> childrenJson;

          while (children) {
            childrenJson.push_back(ArtObjectToJson(children, depth + 1, maxDepth));
            error = sAIArt->GetArtSibling(children, &children);
            aisdk::check_ai_error(error);
          }

          artJson["children"] = childrenJson;
        }

        // Get Mask
        AIMaskRef maskRef = NULL;
        error             = sAIMask->GetMask(art, &maskRef);
        aisdk::check_ai_error(error);

        std::optional<AIArtHandle> maskArt = sAIMask->GetArt(maskRef);

        artJson["mask"] = json::value_t::null;
        if (maskArt) {
          artJson["mask"] = ArtObjectToJson(maskArt.value(), depth + 1, maxDepth);
        }

        return artJson;
      }

      json ArtToJSON(AIArtHandle art, int maxDepth = 100) {
        json jsonObj = ArtObjectToJson(art, 0, maxDepth);
        return jsonObj;
      }
    }  // namespace serialize
  }  // namespace art

  namespace pref {
    static std::unordered_map<std::string, AIPoint> prefPointCache;

    inline std::string
    makeCacheKey(const std::string& prefix, const std::string& suffix) {
      return prefix + ":" + suffix;
    }

    // memo: PreferenceExists returns false if preference is not stored in filesystem
    bool isExists(
        const std::string& prefix,
        const std::string& suffix,
        AIErr*             error = nullptr
    ) {
      std::string key = makeCacheKey(prefix, suffix);
      if (prefPointCache.find(key) != prefPointCache.end()) { return true; }

      const char* _prefix = prefix.c_str();
      const char* _suffix = suffix.c_str();

      AIBoolean exists = false;

      AIErr err = sAIPref->PreferenceExists(_prefix, _suffix, &exists);
      if (error != nullptr) *error = err;

      return (bool)exists;
    }

    std::optional<AIPoint> getPoint(
        const std::string&     prefix,
        const std::string&     suffix,
        std::optional<AIPoint> defaultValue,
        AIErr*                 error = nullptr
    ) {
      std::string key     = makeCacheKey(prefix, suffix);
      auto        cacheIt = prefPointCache.find(key);
      if (cacheIt != prefPointCache.end()) {
        std::cout << "Cache hit: " << key << ":" << cacheIt->second.h << ", "
                  << cacheIt->second.v << std::endl;
        return cacheIt->second;
      }

      auto  point = AIPoint{-1234, -12345};
      AIErr err   = sAIPref->GetPointPreference(prefix.data(), suffix.data(), &point);
      if (error != nullptr) *error = err;

      if (point.h == -1234 && point.v == -12345) { return defaultValue; }

      // キャッシュに保存
      prefPointCache[key] = point;
      return point;
    }

    void putPoint(
        const std::string& prefix,
        const std::string& suffix,
        AIPoint*           value,
        AIErr*             error = nullptr
    ) {
      AIErr err = sAIPref->PutPointPreference(prefix.data(), suffix.data(), value);
      if (error != nullptr) *error = err;

      std::string key     = makeCacheKey(prefix, suffix);
      prefPointCache[key] = *value;
    }
  }  // namespace pref

  namespace dict {
    AIDictKey getKey(std::string name) {
      const char* _k  = name.c_str();
      AIDictKey   key = sAIDictionary->Key(_k);
      return key;
    }

    bool isKnown(const AILiveEffectParameters& dict, AIDictKey key) {
      return sAIDictionary->IsKnown(dict, key);
    }

    bool isKnown(const AILiveEffectParameters& dict, std::string name) {
      AIDictKey key = dict::getKey(name);
      return sAIDictionary->IsKnown(dict, key);
    }

    AIBoolean getBoolean(
        const AILiveEffectParameters& dict,
        const std::string&            key,
        const AIBoolean&              defaultValue,
        ASErr*                        error = nullptr
    ) {
      AIDictKey dictKey = dict::getKey(key);

      ASErr err = kNoErr;
      if (dict::isKnown(dict, key)) {
        AIBoolean value;
        err = sAIDictionary->GetBooleanEntry(dict, dictKey, &value);
        if (error != nullptr) *error = err;
        return value;
      } else {
        return defaultValue;
      }
    }

    ai::int32 getInt(
        const AILiveEffectParameters& dict,
        const std::string&            key,
        const ai::int32&              defaultValue,
        ASErr*                        error = nullptr
    ) {
      ASErr     err     = kNoErr;
      AIDictKey dictKey = dict::getKey(key);

      if (dict::isKnown(dict, key)) {
        ai::int32 value;
        err = sAIDictionary->GetIntegerEntry(dict, dictKey, &value);
        if (error != nullptr) *error = err;
        return value;
      } else {
        return defaultValue;
      }
    }

    ai::UnicodeString getUnicodeString(
        const AILiveEffectParameters& dict,
        const std::string&            key,
        const ai::UnicodeString&      defaultValue,
        ASErr*                        error = nullptr
    ) {
      *error = kNoErr;

      AIDictKey dictKey = dict::getKey(key);
      if (dict::isKnown(dict, key)) {
        ai::UnicodeString value;

        ASErr e = sAIDictionary->GetUnicodeStringEntry(dict, dictKey, value);
        if (error != nullptr) *error = e;

        return value;
      }

      return defaultValue;
    }

    AIReal
    getReal(const AILiveEffectParameters& dict, std::string key, AIReal defaultValue) {
      const char* _k      = key.c_str();
      AIDictKey   dictKey = sAIDictionary->Key(_k);

      if (sAIDictionary->IsKnown(dict, dictKey)) {
        AIReal value;
        sAIDictionary->GetRealEntry(dict, dictKey, &value);
        return value;
      } else {
        return defaultValue;
      }
    }

    ASErr
    setBoolean(const AILiveEffectParameters& dict, std::string key, AIBoolean value) {
      AIDictKey dictKey = sAIDictionary->Key(key.c_str());
      return sAIDictionary->SetBooleanEntry(dict, dictKey, value);
    }

    ASErr setInt(const AILiveEffectParameters& dict, std::string key, ai::int32 value) {
      AIDictKey dictKey = sAIDictionary->Key(key.c_str());
      return sAIDictionary->SetIntegerEntry(dict, dictKey, value);
    }

    ASErr setUnicodeString(
        const AILiveEffectParameters& dict,
        std::string                   key,
        ai::UnicodeString             value
    ) {
      AIDictKey dictKey = dict::getKey(key);
      return sAIDictionary->SetUnicodeStringEntry(dict, dictKey, value);
    }

    ASErr setReal(const AILiveEffectParameters& dict, std::string key, AIReal value) {
      AIDictKey dictKey = sAIDictionary->Key(key.c_str());
      return sAIDictionary->SetRealEntry(dict, dictKey, value);
    }
  }  // namespace dict

  std::string getErrorName(ASErr& err) {
    if (err == kNoErr) {
      return "kNoErr";
    } else {
      char errStr[5] = {0};
      std::memcpy(errStr, &err, 4);

      return mapValue(
          err, string_format("unknown (%s)", errStr),
          {{kNoErr, "kNoErr"},
           {100, "unexpected dictionary value type (undocumented)"},
           {kOutOfMemoryErr, "kOutOfMemoryErr"},
           {kBadParameterErr, "kBadParameterErr"},
           {kNotImplementedErr, "kNotImplementedErr"},
           {kCanceledErr, "kCanceledErr"},
           {kCantHappenErr, "kCantHappenErr"},
           {kNoDocumentErr, "kNoDocumentErr"},
           {kSelectorClashErr, "kSelectorClashErr"},
           //    {kDashBufferTooShortError, "kDashBufferTooShortError"},let scope = &mut
           //    deno_runtime.handle_scope(); {kNoStrokeParamsError,
           //    "kNoStrokeParamsError"}, {kDashArrayTooBigError,
           //    "kDashArrayTooBigError"}, {kNoDashError, "kNoDashError"},
           {kUnknownArtTypeErr, "kUnknownArtTypeErr"},
           {kUnknownPaintOrderTypeErr, "kUnknownPaintOrderTypeErr"},
           {kUntouchableArtObjectErr, "kUntouchableArtObjectErr"},
           {kTooDeepNestingErr, "kTooDeepNestingErr"},
           {kUntouchableLayerErr, "kUntouchableLayerErr"},
           {kInvalidArtTypeForDestErr, "kInvalidArtTypeForDestErr"},
           {kAIArtHandleOutOfScopeErr, "kAIArtHandleOutOfScopeErr"},
           {kStdExceptionCaughtError, "kStdExceptionCaughtError"},
           {kEndOfRangeErr, "kEndOfRangeErr"},
           {kStyleNotInCurrentDocument, "kStyleNotInCurrentDocument"},
           {kStyleTypeNotCompatible, "kStyleTypeNotCompatible"},
           //    {kAIATEInvalidBounds, "kAIATEInvalidBounds"},
           {kDstBufferTooShortErr, "kDstBufferTooShortErr"},
           {kCantCopyErr, "kCantCopyErr"},
           {kNameInvalidForSpotColorErr, "kNameInvalidForSpotColorErr"},
           {kColorConversionErr, "kColorConversionErr"},
           //    {kAIInvalidControlBarRef, "kAIInvalidControlBarRef"},
           {kDataFilterErr, "kDataFilterErr"},
           {kNoSuchKey, "kNoSuchKey"},
           {kAIDocumentScaleOutOfRangeErr, "kAIDocumentScaleOutOfRangeErr"},
           //    {kCantCreateNewDocumentErr, "kCantCreateNewDocumentErr"},
           //    {kAIInvalidNegativeSpacingErr, "kAIInvalidNegativeSpacingErr"},
           //    {kAICantFitArtboardsErr, "kAICantFitArtboardsErr"},
           //    {kUnknownDrawArtErr, "kUnknownDrawArtErr"},
           //    {KUnknownDrawArtOutputTypeErr, "KUnknownDrawArtOutputTypeErr"},
           //    {kBadDrawArtPreviewMatrixErr, "kBadDrawArtPreviewMatrixErr"},
           //    {kDrawArtInterruptedErr, "kDrawArtInterruptedErr"},
           {kNoSuchEntry, "kNoSuchEntry"},
           {kUnknownFormatErr, "kUnknownFormatErr"},
           {kInvalidFormatErr, "kInvalidFormatErr"},
           {kBadResolutionErr, "kBadResolutionErr"},
           {kEmptySelectionError, "kEmptySelectionError"},
           {kOptimizedNetworkSaveFailedErr, "kOptimizedNetworkSaveFailedErr"},
           //    {kAIFOConversionErr, "kAIFOConversionErr"},
           {kFolderNotFoundErr, "kFolderNotFoundErr"},
           {kCantImportCompFont, "kCantImportCompFont"},
           {kGlyphNotDefinedErr, "kGlyphNotDefinedErr"},
           //    {kFXGWarningNotFoundErr, "kFXGWarningNotFoundErr"},
           //    {kFormatErr, "kFormatErr"},
           //    {kAIHTMLUnsupportedTypeError, "kAIHTMLUnsupportedTypeError"},
           //    {kAIHTMLHBufferOverflowError, "kAIHTMLHBufferOverflowError"},
           //    {kAIImageOptErr, "kAIImageOptErr"},
           //    {kCantIsolateFromCurrentModeErr,
           //    "kCantIsolateFromCurrentModeErr"},
           {kCantDeleteLastLayerErr, "kCantDeleteLastLayerErr"},
           //    {kAIFlattenHasLinkErr, "kAIFlattenHasLinkErr"},
           //    {kAIFlattenTooManySpotsErr, "kAIFlattenTooManySpotsErr"},
           {kTooManyMenuItemsErr, "kTooManyMenuItemsErr"},
           {kNameSpaceErr, "kNameSpaceErr"},
           {kNameClashErr, "kNameClashErr"},
           {kUninitializedDataErr, "kUninitializedDataErr"},
           {kCantDoThatNowErr, "kCantDoThatNowErr"},
           //    {kAIInvalidPanelRef, "kAIInvalidPanelRef"},
           {kTooManySegmentsErr, "kTooManySegmentsErr"},
           {kTooManyDashComponents, "kTooManyDashComponents"},
           {kCantImportStyles, "kCantImportStyles"},
           {kUnknownPluginGroupErr, "kUnknownPluginGroupErr"},
           {kAttachedPluginGroupErr, "kAttachedPluginGroupErr"},
           {kTooMuchDataPluginGroupErr, "kTooMuchDataPluginGroupErr"},
           {kRefusePluginGroupReply, "kRefusePluginGroupReply"},
           {kCheckPluginGroupReply, "kCheckPluginGroupReply"},
           {kWantsAfterMsgPluginGroupReply, "kWantsAfterMsgPluginGroupReply"},
           {kDidSymbolReplacement, "kDidSymbolReplacement"},
           {kMarkValidPluginGroupReply, "kMarkValidPluginGroupReply"},
           {kDontCarePluginGroupReply, "kDontCarePluginGroupReply"},
           {kDestroyPluginGroupReply, "kDestroyPluginGroupReply"},
           {kCustomHitPluginGroupReply, "kCustomHitPluginGroupReply"},
           {kSkipEditGroupReply, "kSkipEditGroupReply"},
           {kIterationCanQuitReply, "kIterationCanQuitReply"},
           {kAIRasterizeTooWideErr, "kAIRasterizeTooWideErr"},
           //    {kNoSegmentsError, "kNoSegmentsError"},
           //    {kArtworkTooComplexErr, "kArtworkTooComplexErr"},
           //    {kCannotParseStringError, "kCannotParseStringError"},
           {kStringPoolErr, "kStringPoolErr"},
           //    {kXMLIDCollisionErr, "kXMLIDCollisionErr"},
           //    {kXMLIDChangedErr, "kXMLIDChangedErr"},
           //    {kNoSVGFilterErr, "kNoSVGFilterErr"},
           //    {kSVGFilterRedefErr, "kSVGFilterRedefErr"},
           //    {kSwatchDoesNotExistErr, "kSwatchDoesNotExistErr"},
           //    {kNoActiveSwatchError, "kNoActiveSwatchError"},
           {kCantDeleteSwatchErr, "kCantDeleteSwatchErr"},
           {kInvalidSwatchTypeForDest, "kInvalidSwatchTypeForDest"},
           {kTooManySwatchGroupsErr, "kTooManySwatchGroupsErr"},
           {kTooManySwatchesInGrpErr, "kTooManySwatchesInGrpErr"},
           //    {kSymbolNotInCurrentDocument, "kSymbolNotInCurrentDocument"},
           //    {kCircularSymbolDefinitionErr, "kCircularSymbolDefinitionErr"},
           //    {kNoGraphsInSymbolDefErr, "kNoGraphsInSymbolDefErr"},
           //    {kNoLinkedImagesInSymbolDefErr,
           //    "kNoLinkedImagesInSymbolDefErr"},
           //    {kNoPerspectiveInSymbolDefErr, "kNoPerspectiveInSymbolDefErr"},
           //    {kInvalidSymbolDefErr, "kInvalidSymbolDefErr"},
           //    {kCantDeleteSymbolUsedInLiveEffectsErr,
           //     "kCantDeleteSymbolUsedInLiveEffectsErr"},
           //    {kNotEnoughSpace, "kNotEnoughSpace"},
           //    {kBadTagTypeErr, "kBadTagTypeErr"},
           //    {kBadTagNameErr, "kBadTagNameErr"},
           //    {kBadTagDataErr, "kBadTagDataErr"},
           //    {kTagNotFoundErr, "kTagNotFoundErr"},
           {kAcceptAlternateSelectionToolReply, "kAcceptAlternateSelectionToolReply"},
           {kToolCantTrackCursorErr, "kToolCantTrackCursorErr"},
           {kNameNotFoundErr, "kNameNotFoundErr"},
           {kNameInUseErr, "kNameInUseErr"},
           {kInvalidNameErr, "kInvalidNameErr"},
           {kNameTooLongErr, "kNameTooLongErr"},
           {kUndoRedoErr, "kUndoRedoErr"},
           {kAIInvalidArtBoundsErr, "kAIInvalidArtBoundsErr"},
           {kAIResourcePermissionErr, "kAIResourcePermissionErr"},
           //    {kUIDBadSyntax, "kUIDBadSyntax"},
           //    {kUIDNotUnique, "kUIDNotUnique"},
           //    {kUIDNotFound, "kUIDNotFound"},
           //    {kFailureErr, "kFailureErr"},
           {kUnknownUnitsErr, "kUnknownUnitsErr"},
           {kApplicationNotFoundErr, "kApplicationNotFoundErr"},
           {kObjectNotLinkedErr, "kObjectNotLinkedErr"},
           {kWorkspaceNameTooLongErr, "kWorkspaceNameTooLongErr"},
           {kAIXMLIndexSizeErr, "kAIXMLIndexSizeErr"},
           {kAIXMLDOMStringSizeErr, "kAIXMLDOMStringSizeErr"},
           {kAIXMLHierarchyRequestErr, "kAIXMLHierarchyRequestErr"},
           {kAIXMLWrongDocumentErr, "kAIXMLWrongDocumentErr"},
           {kAIXMLInvalidCharacterErr, "kAIXMLInvalidCharacterErr"},
           {kAIXMLNoDataAllowedErr, "kAIXMLNoDataAllowedErr"},
           {kAIXMLNoModifyAllowedErr, "kAIXMLNoModifyAllowedErr"},
           {kAIXMLNotFoundErr, "kAIXMLNotFoundErr"},
           {kAIXMLNotSupportedErr, "kAIXMLNotSupportedErr"},
           {kAIXMLInUseAttributeErr, "kAIXMLInUseAttributeErr"},
           //    {kErrUnknowInteractionLevel, "kErrUnknowInteractionLevel"},
           //    {kAICantDeleteLastArtboardErr, "kAICantDeleteLastArtboardErr"},
           //    {kAIExceededMaxArtboardLimitErr,
           //    "kAIExceededMaxArtboardLimitErr"},
           {kColorSpaceBadIndex, "kColorSpaceBadIndex"},
           {kColorSpaceInvalid, "kColorSpaceInvalid"},
           //    {kAICopyScopeAlreadyInitialized,
           //    "kAICopyScopeAlreadyInitialized"},
           {kUnicodeStringBadIndex, "kUnicodeStringBadIndex"},
           {kUnicodeStringLengthError, "kUnicodeStringLengthError"},
           {kUnicodeStringMalformedError, "kUnicodeStringMalformedError"},
           {kSPUnimplementedError, "kSPUnimplementedError"},
           {kSPUserCanceledError, "kSPUserCanceledError"},
           {kSPCantAcquirePluginError, "kSPCantAcquirePluginError"},
           {kSPCantReleasePluginError, "kSPCantReleasePluginError"},
           {kSPPluginAlreadyReleasedError, "kSPPluginAlreadyReleasedError"},
           {kSPWrongArchitectureError, "kSPWrongArchitectureError"},
           {kSPAdapterAlreadyExistsError, "kSPAdapterAlreadyExistsError"},
           {kSPBadAdapterListIteratorError, "kSPBadAdapterListIteratorError"},
           {kSPBadParameterError, "kSPBadParameterError"},
           {kSPCantChangeBlockDebugNowError, "kSPCantChangeBlockDebugNowError"},
           {kSPBlockDebugNotEnabledError, "kSPBlockDebugNotEnabledError"},
           {kSPOutOfMemoryError, "kSPOutOfMemoryError"},
           {kSPBlockSizeOutOfRangeError, "kSPBlockSizeOutOfRangeError"},
           {kSPPluginCachesFlushResponse, "kSPPluginCachesFlushResponse"},
           {kSPTroubleAddingFilesError, "kSPTroubleAddingFilesError"},
           {kSPBadFileListIteratorError, "kSPBadFileListIteratorError"},
           {kSPTroubleInitializingError, "kSPTroubleInitializingError"},
           {kHostCanceledStartupPluginsError, "kHostCanceledStartupPluginsError"},
           {kSPNotASweetPeaPluginError, "kSPNotASweetPeaPluginError"},
           {kSPAlreadyInSPCallerError, "kSPAlreadyInSPCallerError"},
           {kSPUnknownAdapterError, "kSPUnknownAdapterError"},
           {kSPBadPluginListIteratorError, "kSPBadPluginListIteratorError"},
           {kSPBadPluginHost, "kSPBadPluginHost"},
           {kSPCantAddHostPluginError, "kSPCantAddHostPluginError"},
           {kSPPluginNotFound, "kSPPluginNotFound"},
           {kSPCorruptPiPLError, "kSPCorruptPiPLError"},
           {kSPBadPropertyListIteratorError, "kSPBadPropertyListIteratorError"},
           {kSPSuiteNotFoundError, "kSPSuiteNotFoundError"},
           {kSPSuiteAlreadyExistsError, "kSPSuiteAlreadyExistsError"},
           {kSPSuiteAlreadyReleasedError, "kSPSuiteAlreadyReleasedError"},
           {kSPBadSuiteListIteratorError, "kSPBadSuiteListIteratorError"},
           {kSPBadSuiteInternalVersionError, "kSPBadSuiteInternalVersionError"}}
      );
    }
  }

  ai::UnicodeString charToUnicodeString(const char* str) {
    if (str == nullptr) return ai::UnicodeString();
    return ai::UnicodeString(str, kAIUTF8CharacterEncoding);
  }

  template <typename KeyType, typename ValueType>
  static ValueType mapValue(
      const KeyType&                                key,
      const ValueType&                              defaultValue,
      const std::unordered_map<KeyType, ValueType>& valueMap
  ) {
    try {
      return valueMap.at(key);
    } catch (const std::out_of_range&) { return defaultValue; }
  }  // namespace suai
}  // namespace suai
