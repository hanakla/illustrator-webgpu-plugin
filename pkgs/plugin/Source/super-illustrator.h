#pragma once

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
    /** [Internal] */
    bool fillBlackAndIgnoreTransparancy = false;
    /** [Internal] */
    bool raterizeSharedSpace = false;
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
    if (options.fillBlackAndIgnoreTransparancy)
      optionVal |= AIRasterizeOptions::kFillBlackAndIgnoreTransparancy;
    if (options.raterizeSharedSpace)
      optionVal |= AIRasterizeOptions::kRaterizeSharedSpace;

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
      return str::toUtf8StdString(effectTitle);
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
              {AIArtType::kUnknownArt, "Unknown"},
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

    json __getChildrenAsJson(AIArtHandle parentArt, int depth, int maxDepth);

    json __boundingBoxToJson(const AIRealRect& bounds) {
      return {
          {"left", bounds.left},
          {"top", bounds.top},
          {"right", bounds.right},
          {"bottom", bounds.bottom}
      };
    }

    json __boundingBoxToJson(const AIRect& bounds) {
      return {
          {"left", bounds.left},
          {"top", bounds.top},
          {"right", bounds.right},
          {"bottom", bounds.bottom}
      };
    }

    json __colorToJson(const AIColor& color) {
      json colorJson;

      switch (color.kind) {
        case AIColorTag::kGrayColor:
          colorJson = {{"type", "gray"}, {"value", color.c.g.gray}};
          break;
        case AIColorTag::kThreeColor:
          colorJson = {
              {"type", "rgb"},
              {"color", json(
                            {{"red", color.c.rgb.red},
                             {"green", color.c.rgb.green},
                             {"blue", color.c.rgb.blue}}
                        )},

          };
          break;
        case AIColorTag::kFourColor:
          colorJson = {
              {"type", "cmyk"},
              {"color", json(
                            {{"cyan", color.c.f.cyan},
                             {"magenta", color.c.f.magenta},
                             {"yellow", color.c.f.yellow},
                             {"black", color.c.f.black}}
                        )}
          };
          break;
        case AIColorTag::kPattern:
          colorJson = {{"type", "pattern"}};
          break;
        case AIColorTag::kGradient:
          colorJson = {{"type", "gradient"}};
          break;
        case AIColorTag::kNoneColor:
        default:
          colorJson = {{"type", "none"}};
          break;
      }

      return colorJson;
    }

    json __pathInfoToJson(AIPathSegment* segments, ai::int16 segmentCount) {
      json segmentsJson = json::array();

      for (ai::int16 i = 0; i < segmentCount; i++) {
        json segmentJson = {
            {"anchor", {{"x", segments[i].p.h}, {"y", segments[i].p.v}}},
            {"in", nullptr},
            {"out", nullptr},
        };

        // 制御点がアンカーポイントと異なる場合のみ追加
        if (segments[i].in.h != segments[i].p.h || segments[i].in.v != segments[i].p.v) {
          segmentJson["in"] = {{"x", segments[i].in.h}, {"y", segments[i].in.v}};
        }

        if (segments[i].out.h != segments[i].p.h ||
            segments[i].out.v != segments[i].p.v) {
          segmentJson["out"] = {{"x", segments[i].out.h}, {"y", segments[i].out.v}};
        }

        segmentsJson.push_back(segmentJson);
      }

      return {{"segments", segmentsJson}, {"closed", segments[0].corner != 0}};
    }

    json __rasterInfoToJson(const AIRasterRecord& info) {
      return {
          {"width", info.bounds.right - info.bounds.left},
          {"height", info.bounds.bottom - info.bounds.top},
          {"bitsPerPixel", info.bitsPerPixel},
          {"colorSpace", info.colorSpace},
          {"flags", info.flags}
      };
    }

    json __artObjectToJson(AIArtHandle art, int depth, int maxDepth) {
      if (!art || depth > maxDepth) return nullptr;

      AIErr error = kNoErr;
      json  artJson;

      short artType = getArtType(art, &error);
      aisdk::check_ai_error(error);

      auto attrs = getUserAttrs(art, &error);
      aisdk::check_ai_error(error);

      auto [artName, isDefaultName] = getName(art, &error);
      aisdk::check_ai_error(error);

      // バウンディングボックスを取得
      AIRealRect bounds;
      error = sAIArt->GetArtBounds(art, &bounds);

      // 基本情報を設定
      artJson["artTypeCode"] = artType;
      artJson["artType"]     = getTypeName(art);

      artJson["name"]          = artName;
      artJson["isDefaultName"] = isDefaultName != 0;

      artJson["bounds"]     = __boundingBoxToJson(bounds);
      artJson["attributes"] = attrs.toJson();

      if (artType == AIArtType::kPathArt) {
        ai::int16 segmentCount = 0;
        error                  = sAIPath->GetPathSegmentCount(art, &segmentCount);

        if (!error && segmentCount > 0) {
          AIPathSegment* segments = new AIPathSegment[segmentCount];
          error = sAIPath->GetPathSegments(art, 0, segmentCount, segments);

          if (!error) { artJson["pathInfo"] = __pathInfoToJson(segments, segmentCount); }

          delete[] segments;
        }

        AIPathStyle style;
        AIBoolean   outHasAdvFill;
        error = sAIPathStyle->GetPathStyle(art, &style, &outHasAdvFill);  // TODO: false??
        if (!error) {
          // artJson["fillColor"]   = __colorToJson(style.fill.color);
          // artJson["strokeColor"] = __colorToJson(style.stroke.color);
          // artJson["strokeWidth"] = style.strokeWidth;
        }

      } else if (artType == kRasterArt) {
        //        AIRasterRecord info;
        //        error = sAIRaster->GetRasterInfo(art, &info);
        //        aisdk::check_ai_error(error);
        //        artJson["rasterInfo"] = __rasterInfoToJson(info);
      } else if (artType == kTextFrameArt) {
        //        artJson["isTextFrame"] = true;
      }

      AIBoolean hasDictionary  = sAIArt->HasDictionary(art);
      artJson["hasDictionary"] = hasDictionary && !sAIArt->IsDictionaryEmpty(art);

      // タグ（メモ）を取得
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
        AIArtHandle firstChild;
        error = sAIArt->GetArtFirstChild(art, &firstChild);
        aisdk::check_ai_error(error);

        if (firstChild) {
          artJson["children"] = __getChildrenAsJson(art, depth, maxDepth);
        }
      }

      // レイヤーへの参照を取得
      AILayerHandle layer;
      error = sAIArt->GetLayerOfArt(art, &layer);
      if (!error && layer) {
        ai::UnicodeString layerName;
        error = sAILayer->GetLayerTitle(layer, layerName);
        if (!error && !layerName.empty()) {
          artJson["layerName"] = layerName.as_Platform();
        }
      }

      return artJson;
    }

    json __getChildrenAsJson(AIArtHandle parentArt, int depth, int maxDepth) {
      json childrenJson = json::array();

      AIArtHandle childArt;
      AIErr       error = sAIArt->GetArtFirstChild(parentArt, &childArt);

      while (!error && childArt) {
        childrenJson.push_back(__artObjectToJson(childArt, depth + 1, maxDepth));

        AIArtHandle nextArt;
        error    = sAIArt->GetArtSibling(childArt, &nextArt);
        childArt = nextArt;
      }

      return childrenJson;
    }

    json artToJSON(AIArtHandle art, int maxDepth = 100) {
      json jsonObj = __artObjectToJson(art, 0, maxDepth);
      return jsonObj;
    }
  }  // namespace art

  namespace pref {
    // memo: PreferenceExists returns false if preference is not stored in filesystem
    bool isExists(
        const std::string& prefix,
        const std::string& suffix,
        AIErr*             error = nullptr
    ) {
      const char* _prefix = prefix.c_str();
      const char* _suffix = suffix.c_str();

      AIBoolean exists = false;

      AIErr err = sAIPref->PreferenceExists(_prefix, _suffix, &exists);
      if (error != nullptr) *error = err;

      return (bool)exists;
    }

    // bool isExists(const char* prefix, const char* suffix, AIErr* error = nullptr) {
    //   AIBoolean exists = false;
    //   AIErr     err    = sAIPref->PreferenceExists(prefix, suffix, &exists);
    //   if (error != nullptr) *error = err;
    //   return (bool)exists;
    // }

    std::optional<AIPoint> getPoint(
        const std::string&     prefix,
        const std::string&     suffix,
        std::optional<AIPoint> defaultValue,
        AIErr*                 error = nullptr
    ) {
      const char* _p = str::strdup(prefix.c_str());
      const char* _s = str::strdup(suffix.c_str());

      auto point = AIPoint{-1234, -12345};
      sAIPref->GetPointPreference(_p, _s, &point);

      if (point.h == -1234 && point.v == -12345) { return defaultValue; }

      return point;
    }

    void putPoint(
        const std::string& prefix,
        const std::string& suffix,
        AIPoint*           value,
        AIErr*             error = nullptr
    ) {
      const char* _p = prefix.c_str();
      const char* _s = suffix.c_str();

      std::cout << "putPoint: " << _p << " = " << _s << std::endl;

      AIErr err = sAIPref->PutPointPreference(_p, _s, value);
      if (error != nullptr) *error = err;
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
