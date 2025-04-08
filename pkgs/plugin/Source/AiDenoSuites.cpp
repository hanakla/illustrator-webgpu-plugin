#include "AiDenoSuites.h"
#include "IllustratorSDK.h"

// Suite externs

extern "C" SPBlocksSuite*        sSPBlocks        = nullptr;
extern "C" AIBlockSuite*         sAIBlock         = nullptr;
extern "C" AIUndoSuite*          sAIUndo          = nullptr;
extern "C" AIUnicodeStringSuite* sAIUnicodeString = nullptr;
extern "C" AILiveEffectSuite*    sAILiveEffect    = nullptr;
extern "C" AIDictionarySuite*    sAIDictionary    = nullptr;
extern "C" AIArtSuite*           sAIArt           = nullptr;
extern "C" AIArtSetSuite*        sAIArtSet        = nullptr;
extern "C" AIRasterizeSuite*     sAIRasterize     = nullptr;
extern "C" AIRasterSuite*        sAIRaster        = nullptr;
extern "C" AIDocumentSuite*      sAIDocument      = nullptr;
extern "C" AIMenuSuite*          sAIMenu          = nullptr;
extern "C" AIPathSuite*          sAIPath          = nullptr;
extern "C" AIPathStyleSuite*     sAIPathStyle     = nullptr;
extern "C" AILayerSuite*         sAILayer         = nullptr;
extern "C" AIPreferenceSuite*    sAIPref          = nullptr;
extern "C" AIMaskSuite*          sAIMask          = nullptr;
extern "C" AIGradientSuite*      sAIGradient      = nullptr;

// Import suites
ImportSuite gImportSuites[] = {
    {kSPBlocksSuite, kSPBlocksSuiteVersion, &sSPBlocks},
    {kAIBlockSuite, kAIBlockSuiteVersion, &sAIBlock},
    {kAIUndoSuite, kAIUndoSuiteVersion, &sAIUndo},
    {kAIUnicodeStringSuite, kAIUnicodeStringVersion, &sAIUnicodeString},
    {kAILiveEffectSuite, kAILiveEffectVersion, &sAILiveEffect},
    {kAIDictionarySuite, kAIDictionarySuiteVersion, &sAIDictionary},
    {kAIArtSuite, kAIArtSuiteVersion, &sAIArt},
    {kAIArtSetSuite, kAIArtSetSuiteVersion, &sAIArtSet},
    {kAIRasterizeSuite, kAIRasterizeSuiteVersion, &sAIRasterize},
    {kAIRasterSuite, kAIRasterSuiteVersion, &sAIRaster},
    {kAIDocumentSuite, kAIDocumentSuiteVersion, &sAIDocument},
    {kAIMenuSuite, kAIMenuSuiteVersion, &sAIMenu},
    {kAIPathSuite, kAIPathSuiteVersion, &sAIPath},
    {kAIPathStyleSuite, kAIPathStyleSuiteVersion, &sAIPathStyle},
    {kAILayerSuite, kAILayerSuiteVersion, &sAILayer},
    {kAIPreferenceSuite, kAIPreferenceSuiteVersion, &sAIPref},
    {kAIMaskSuite, kAIMaskSuiteVersion, &sAIMask},
    {kAIGradientSuite, kAIGradientSuiteVersion, &sAIGradient},
    {NULL, 0, NULL}
};
