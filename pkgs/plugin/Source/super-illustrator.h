#pragma once

#include "IllustratorSDK.h"
#include "AIRasterize.h"

extern "C" AIArtSetSuite *sAIArtSet;
extern "C" AIDictionarySuite *sAIDictionary;
extern "C" AILiveEffectSuite *sAILiveEffect;

namespace suai
{
    template <typename KeyType, typename ValueType>
    static ValueType mapValue(const KeyType &key, const ValueType &defaultValue, const std::unordered_map<KeyType, ValueType> &valueMap);

    std::string charToUnicodeStringUTF8(const char *str);
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

    class LiveEffect
    {
    private:
        AILiveEffectHandle effectHandle;

    public:
        LiveEffect(AILiveEffectHandle effectHandle) : effectHandle(effectHandle) {}

        std::string getName()
        {
            const char *effectName = NULL;
            sAILiveEffect->GetLiveEffectName(effectHandle, &effectName);
            return charToUnicodeStringUTF8(effectName);
        }

        std::string getTitle()
        {
            const char *effectTitle = NULL;
            sAILiveEffect->GetLiveEffectTitle(effectHandle, &effectTitle);
            return charToUnicodeStringUTF8(effectTitle);
        }
    };

    namespace dict
    {
        AIDictKey getKey(std::string name)
        {
            const char *_k = name.c_str();
            AIDictKey key = sAIDictionary->Key(_k);
            return key;
        }

        bool isKnown(const AILiveEffectParameters &dict, AIDictKey key)
        {
            return sAIDictionary->IsKnown(dict, key);
        }

        bool isKnown(const AILiveEffectParameters &dict, std::string name)
        {
            AIDictKey key = dict::getKey(name);
            return sAIDictionary->IsKnown(dict, key);
        }

        AIBoolean getBoolean(const AILiveEffectParameters &dict, const std::string &key, const AIBoolean &defaultValue, ASErr *error = nullptr)
        {
            AIDictKey dictKey = dict::getKey(key);

            ASErr err = kNoErr;
            if (dict::isKnown(dict, key))
            {
                AIBoolean value;
                err = sAIDictionary->GetBooleanEntry(dict, dictKey, &value);
                if (error != nullptr)
                    *error = err;
                return value;
            }
            else
            {
                return defaultValue;
            }
        }

        ai::int32 getInt(const AILiveEffectParameters &dict, const std::string &key, const ai::int32 &defaultValue, ASErr *error = nullptr)
        {
            ASErr err = kNoErr;
            AIDictKey dictKey = dict::getKey(key);

            if (dict::isKnown(dict, key))
            {
                ai::int32 value;
                err = sAIDictionary->GetIntegerEntry(dict, dictKey, &value);
                if (error != nullptr)
                    *error = err;
                return value;
            }
            else
            {
                return defaultValue;
            }
        }

        std::string getString(const AILiveEffectParameters &dict, const std::string &key, const std::string &defaultValue, ASErr *error = nullptr)
        {
            *error = kNoErr;
            AIDictKey dictKey = dict::getKey(key);

            if (dict::isKnown(dict, key))
            {
                const char *string;
                *error = sAIDictionary->GetStringEntry(dict, dictKey, &string);

                ai::UnicodeString str(string);

                return unicodeStringToStdString(str);
            }

            return defaultValue;
        }

        AIReal getReal(const AILiveEffectParameters &dict, std::string key, AIReal defaultValue)
        {
            const char *_k = key.c_str();
            AIDictKey dictKey = sAIDictionary->Key(_k);

            if (sAIDictionary->IsKnown(dict, dictKey))
            {
                AIReal value;
                sAIDictionary->GetRealEntry(dict, dictKey, &value);
                return value;
            }
            else
            {
                return defaultValue;
            }
        }

        ASErr setBoolean(const AILiveEffectParameters &dict, std::string key, AIBoolean value)
        {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetBooleanEntry(dict, dictKey, value);
        }

        ASErr setInt(const AILiveEffectParameters &dict, std::string key, ai::int32 value)
        {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetIntegerEntry(dict, dictKey, value);
        }

        ASErr setString(const AILiveEffectParameters &dict, std::string key, std::string value)
        {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            ai::UnicodeString unicodeStr(value.c_str(), kAIUTF8CharacterEncoding);
            return sAIDictionary->SetUnicodeStringEntry(dict, dictKey, unicodeStr);
        }

        ASErr setReal(const AILiveEffectParameters &dict, std::string key, AIReal value)
        {
            AIDictKey dictKey = sAIDictionary->Key(key.c_str());
            return sAIDictionary->SetRealEntry(dict, dictKey, value);
        }
    }

    namespace str {
        char* strdup(const std::string &str) {
            char *ptr = strdup(str.c_str());
            return ptr;
        }
        
        char* strdup(const ai::UnicodeString &str) {
            char *ptr = strdup(str.as_UTF8().data());
            return ptr;
        }

        ai::UnicodeString toAiUnicodeStringUtf8(const std::string &str) {
            return ai::UnicodeString(str.c_str(), kAIUTF8CharacterEncoding);
        }
    
        ai::UnicodeString toAiUnicodeStringUtf8(const char *str) {
            if (str == nullptr) return ai::UnicodeString();
            return ai::UnicodeString(str, kAIUTF8CharacterEncoding);
        }
    }

    ai::UnicodeString charToUnicodeString(const char *str)
    {
        if (str == nullptr)
            return ai::UnicodeString();
        return ai::UnicodeString(str, kAIUTF8CharacterEncoding);
    }

    std::string charToUnicodeStringUTF8(const char *str)
    {
        if (str == nullptr)
            return "";
        return ai::UnicodeString(str, kAIUTF8CharacterEncoding).as_UTF8();
    }

    std::string unicodeStringToStdString(const ai::UnicodeString &str)
    {
        return str.as_UTF8().data();
    }

    template <typename KeyType, typename ValueType>
    static ValueType mapValue(const KeyType &key, const ValueType &defaultValue, const std::unordered_map<KeyType, ValueType> &valueMap)
    {
        try
        {
            return valueMap.at(key);
        }
        catch (const std::out_of_range &)
        {
            return defaultValue;
        }
    }
}
