#ifndef __HelloWorldSuites_H__
#define __HelloWorldSuites_H__

#include <AIBlock.h>
#include <AIGradient.h>
#include <AIRasterize.h>
#include <IllustratorSDK.h>
#include "Suites.hpp"

// Suite externs
extern "C" SPBlocksSuite*        sSPBlocks;
extern "C" AIBlockSuite*         sAIBlock;
extern "C" AIUndoSuite*          sAIUndo;
extern "C" AIUnicodeStringSuite* sAIUnicodeString;
extern "C" AILiveEffectSuite*    sAILiveEffect;
extern "C" AIDictionarySuite*    sAIDictionary;
extern "C" AIArtSuite*           sAIArt;
extern "C" AIUserSuite*          sAIUser;
extern "C" AIArtSetSuite*        sAIArtSet;
extern "C" AIRasterizeSuite*     sAIRasterize;
extern "C" AIRasterSuite*        sAIRaster;
extern "C" AIDocumentSuite*      sAIDocument;
extern "C" AIMenuSuite*          sAIMenu;
extern "C" AIPathSuite*          sAIPath;
extern "C" AIPathStyleSuite*     sAIPathStyle;
extern "C" AILayerSuite*         sAILayer;
extern "C" AIPreferenceSuite*    sAIPref;
extern "C" AIMaskSuite*          sAIMask;
extern "C" AIGradientSuite*      sAIGradient;

#endif
