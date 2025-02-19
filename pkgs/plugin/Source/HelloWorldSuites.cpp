#include "IllustratorSDK.h"
#include <AIRasterize.h>
#include "HelloWorldSuites.h"

// Suite externs
extern "C"
{
    SPBlocksSuite *sSPBlocks = nullptr;
    AIBlockSuite *sAIBlock = nullptr;
    AIUnicodeStringSuite *sAIUnicodeString = nullptr;
    AILiveEffectSuite *sAILiveEffect = nullptr;
    AIDictionarySuite *sAIDictionary = nullptr;
    AIArtSuite *sAIArt = nullptr;
    AIArtSetSuite *sAIArtSet = nullptr;
    AIRasterizeSuite *sAIRasterize = nullptr;
    AIRasterSuite *sAIRaster = nullptr;
    AIDocumentSuite *sAIDocument = nullptr;
}

// Import suites
ImportSuite gImportSuites[] =
    {
        {kSPBlocksSuite, kSPBlocksSuiteVersion, &sSPBlocks},
        {kAIBlockSuite, kAIBlockSuiteVersion, &sAIBlock},
        {kAIUnicodeStringSuite, kAIUnicodeStringVersion, &sAIUnicodeString},
        {kAILiveEffectSuite, kAILiveEffectVersion, &sAILiveEffect},
        {kAIDictionarySuite, kAIDictionarySuiteVersion, &sAIDictionary},
        {kAIArtSuite, kAIArtSuiteVersion, &sAIArt},
        {kAIArtSetSuite, kAIArtSetSuiteVersion, &sAIArtSet},
        {kAIRasterizeSuite, kAIRasterizeSuiteVersion, &sAIRasterize},
        {kAIRasterSuite, kAIRasterSuiteVersion, &sAIRaster},
        {kAIDocumentSuite, kAIDocumentSuiteVersion, &sAIDocument},
        {nil, 0, nil}};
