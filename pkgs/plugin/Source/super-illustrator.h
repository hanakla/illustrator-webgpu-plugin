#pragma once

#include "AIRasterize.h"
#include "IllustratorSDK.h"

extern "C" AIArtSetSuite*     sAIArtSet;
extern "C" AIDictionarySuite* sAIDictionary;
extern "C" AILiveEffectSuite* sAILiveEffect;

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
  template <typename KeyType, typename ValueType>
  static ValueType mapValue(
      const KeyType&                                key,
      const ValueType&                              defaultValue,
      const std::unordered_map<KeyType, ValueType>& valueMap
  );

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

  class ArtSet {
   private:
    AIArtSet artSet;

   public:
    ArtSet() { sAIArtSet->NewArtSet(&artSet); }

    ~ArtSet() { sAIArtSet->DisposeArtSet(&artSet); }

    AIArtSet ToAIArtSet() { return artSet; }

    void AddArt(AIArtHandle& art) { sAIArtSet->AddArtToArtSet(artSet, art); }
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
           //    {kDashBufferTooShortError, "kDashBufferTooShortError"},
           //    {kNoStrokeParamsError, "kNoStrokeParamsError"},
           //    {kDashArrayTooBigError, "kDashArrayTooBigError"},
           //    {kNoDashError, "kNoDashError"},
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
