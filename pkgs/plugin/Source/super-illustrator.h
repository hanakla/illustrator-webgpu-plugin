#pragma once

#include "IllustratorSDK.h"
#include "AIRasterize.h"

extern "C" AIArtSetSuite *sAIArtSet;
extern "C" AIDictionarySuite *sAIDictionary;

namespace suai
{
    template <typename KeyType, typename ValueType>
    static ValueType mapValue(const KeyType &key, const ValueType &defaultValue, const std::unordered_map<KeyType, ValueType> &valueMap);

    std::string unicodeStringToStdString(const ai::UnicodeString &str);

    enum RasterType
    {
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

    enum RasterSettingColorConvert
    {
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
    struct RasterSettingOption
    {
        bool doLayers = false;
        bool againstBlack = false;
        bool dontAlign = false;
        bool outlineText = false;
        bool hinted = false;
        bool useEffectsRes = false;
        bool useMinTiles = false;
        bool cmykWhiteMatting = false;
        bool spotColorRasterOk = false;
        bool nChannelOk = false;
        /** [Internal] */
        bool fillBlackAndIgnoreTransparancy = false;
        /** [Internal] */
        bool raterizeSharedSpace = false;
    };

    struct RasterSettingsInit
    {
        RasterType type;
        /** The supersampling factor, less than 2 for none, 2 or more for anti-aliasing.  */
        short antiAlias = 0;
        double resolution;
        bool preserveSpotColors;
        RasterSettingColorConvert colorConvert = RasterSettingColorConvert::Standard;
        RasterSettingOption options = RasterSettingOption();
    };

    AIRasterizeSettings createAIRasterSetting(RasterSettingsInit init)
    {
        RasterSettingOption options = init.options;

        AIRasterizeSettings settings;
        settings.antialiasing = init.antiAlias;
        settings.resolution = init.resolution;
        settings.preserveSpotColors = init.preserveSpotColors;
        settings.ccoptions = AIColorConvertOptions::kDefault;

        settings.type = mapValue(
            init.type,
            AIRasterizeType::kRasterizeGrayscale,
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
             {RasterType::ANChannel, AIRasterizeType::kRasterizeANChannel}});

        settings.ccoptions = mapValue(
            init.colorConvert,
            AIColorConvertOptions::kDefault,
            {{RasterSettingColorConvert::Standard, AIColorConvertOptions::kDefault},
             {RasterSettingColorConvert::ForPreview, AIColorConvertOptions::kForPreview},
             {RasterSettingColorConvert::ForExport, AIColorConvertOptions::kForExport}});

        int optionVal = kRasterizeOptionsNone;
        if (options.doLayers)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsDoLayers;
        if (options.againstBlack)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsAgainstBlack;
        if (options.dontAlign)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsDontAlign;
        if (options.outlineText)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsOutlineText;
        if (options.hinted)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsHinted;
        if (options.useEffectsRes)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsUseEffectsRes;
        if (options.useMinTiles)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsUseMinTiles;
        if (options.cmykWhiteMatting)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsCMYKWhiteMatting;
        if (options.spotColorRasterOk)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsSpotColorRasterOk;
        if (options.nChannelOk)
            optionVal |= AIRasterizeOptions::kRasterizeOptionsNChannelOk;
        if (options.fillBlackAndIgnoreTransparancy)
            optionVal |= AIRasterizeOptions::kFillBlackAndIgnoreTransparancy;
        if (options.raterizeSharedSpace)
            optionVal |= AIRasterizeOptions::kRaterizeSharedSpace;

        settings.options = (AIRasterizeOptions)optionVal;

        return settings;
    }

    class ArtSet
    {
    private:
        AIArtSet artSet;

    public:
        ArtSet()
        {
            sAIArtSet->NewArtSet(&artSet);
        }

        ~ArtSet()
        {
            sAIArtSet->DisposeArtSet(&artSet);
        }

        AIArtSet ToAIArtSet()
        {
            return artSet;
        }

        void AddArt(AIArtHandle &art)
        {
            sAIArtSet->AddArtToArtSet(artSet, art);
        }
    };

    namespace dict {
        AIBoolean getBoolean(const AIDictionaryRef &dict, std::string key, AIBoolean defaultValue) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());

            if (sAIDictionary->IsKnown(dict, dictKey)) {
                AIBoolean value;
                sAIDictionary->GetBooleanEntry(dict, dictKey, &value);
                return value;
            } else {
                return defaultValue;
            }
        }

        ai::int32 getInt(const AIDictionaryRef &dict, std::string key, ai::int32 defaultValue) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());

            if (sAIDictionary->IsKnown(dict, dictKey)) {
                ai::int32 value;
                sAIDictionary->GetIntegerEntry(dict, dictKey, &value);
                return value;
            } else {
                return defaultValue;
            }
        }

        std::string getString(const AIDictionaryRef &dict, std::string key, std::string defaultValue) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());

            if (sAIDictionary->IsKnown(dict, dictKey)) {
                const char* string;
                sAIDictionary->GetStringEntry(dict, dictKey, &string);
                
                ai::UnicodeString str(string);
                return unicodeStringToStdString(str);
            } else {
                return defaultValue;
            }
        }

        AIReal getReal(const AIDictionaryRef &dict, std::string key, AIReal defaultValue) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());

            if (sAIDictionary->IsKnown(dict, dictKey)) {
                AIReal value;
                sAIDictionary->GetRealEntry(dict, dictKey, &value);
                return value;
            } else {
                return defaultValue;
            }
        }

        ASErr setBoolean(const AIDictionaryRef &dict, std::string key, AIBoolean value) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetBooleanEntry(dict, dictKey, value);
        }

        ASErr setInt(const AIDictionaryRef &dict, std::string key, ai::int32 value) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetIntegerEntry(dict, dictKey, value);
        }

        ASErr setString(const AIDictionaryRef &dict, std::string key, std::string value) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            ai::UnicodeString unicodeStr(value.c_str(), kAIUTF8CharacterEncoding);
            return sAIDictionary->SetUnicodeStringEntry(dict, dictKey, unicodeStr);
        }

        ASErr setReal(const AIDictionaryRef &dict, std::string key, AIReal value) {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetRealEntry(dict, dictKey, value);
        }
    }


    std::string unicodeStringToStdString(const ai::UnicodeString &str)
    {
        return str.as_UTF8().data();
    }

    template <typename KeyType, typename ValueType>
    static ValueType mapValue(const KeyType &key, const ValueType &defaultValue, const std::unordered_map<KeyType, ValueType> &valueMap)
    {
        auto it = valueMap.find(key);
        if (it != valueMap.end())
        {
            return it->second;
        }
        else
        {
            return defaultValue; // キーが見つからない場合のデフォルト値
        }
    }
}
