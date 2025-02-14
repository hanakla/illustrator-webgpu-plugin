#include "IllustratorSDK.h"
#include <AIRasterize.h>
#include "HelloWorldSuites.h"

// Suite externs
extern "C"
{
    SPBlocksSuite*          sSPBlocks = NULL;
    AIBlockSuite*           sAIBlock = NULL;
    AIUnicodeStringSuite*   sAIUnicodeString = NULL;
    AILiveEffectSuite*      sAILiveEffect = NULL;
    AIDictionarySuite*      sAIDictionary = NULL;
    AIArtSuite*             sAIArt = NULL;
    AIArtSetSuite*          sAIArtSet = NULL;
    AIRasterizeSuite*       sAIRasterize = NULL;
    AIRasterSuite*          sAIRaster = NULL;
    AIDocumentSuite*        sAIDocument = NULL;
}

// Import suites
ImportSuite gImportSuites[] =
{
    { kSPBlocksSuite, kSPBlocksSuiteVersion, &sSPBlocks },
    { kAIBlockSuite, kAIBlockSuiteVersion, &sAIBlock },
    { kAIUnicodeStringSuite, kAIUnicodeStringVersion, &sAIUnicodeString },
    { kAILiveEffectSuite, kAILiveEffectVersion, &sAILiveEffect },
    { kAIDictionarySuite, kAIDictionarySuiteVersion, &sAIDictionary },
    { kAIArtSuite, kAIArtSuiteVersion, &sAIArt },
    { kAIArtSetSuite, kAIArtSetSuiteVersion, &sAIArtSet },
    { kAIRasterizeSuite, kAIRasterizeSuiteVersion, &sAIRasterize },
    { kAIRasterSuite, kAIRasterSuiteVersion, &sAIRaster },
    { kAIDocumentSuite, kAIDocumentSuiteVersion, &sAIDocument },
    { nil, 0, nil }
};
