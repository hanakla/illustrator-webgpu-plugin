#include <iostream>
#include <memory>
#include <numeric>
#include <IllustratorSDK.h>
#include "SDKErrors.h"


#include "HelloWorldPlugin.h"
#include "HelloWorldSuites.h"
#include "libai_deno.h"

#ifndef CHKERR
#define CHKERR aisdk::check_ai_error(error)
#endif



Plugin* AllocatePlugin(SPPluginRef pluginRef)
{
	return new HelloWorldPlugin(pluginRef);
}

void FixupReload(Plugin* plugin)
{
	HelloWorldPlugin::FixupVTable((HelloWorldPlugin*) plugin);
}

HelloWorldPlugin::HelloWorldPlugin(SPPluginRef pluginRef) :
	Plugin(pluginRef),
    fLiveEffect(NULL)
{
	strncpy(fPluginName, kHelloWorldPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin()
{
}

ASErr HelloWorldPlugin::StartupPlugin( SPInterfaceMessage *message )
{
	ASErr error = kNoErr;
    
    try {
        error = Plugin::StartupPlugin(message); CHKERR;
        error = this->InitLiveEffect(message); CHKERR;
    } catch (ai::Error &ex) {
        error = ex;
    } catch (...) {
        error = kCantHappenErr;
    }

    try {
        uint32_t handle = ai_deno::create_runtime();
        ai_deno::execute_deno(handle, R"END(
              console.log("Deno code running", new Uint8Array(10000));
        //        console.log(navigator.gpu);
        //
        //        async function initWebGPU() {
        //            if (!navigator.gpu) {
        //                console.error("WebGPU is not supported on this browser.");
        //                return;
        //            }
        //
        //            const adapter = await navigator.gpu.requestAdapter();
        //            if (!adapter) {
        //                console.error("Failed to get GPU adapter.");
        //                return;
        //            }
        //
        //            const device = await adapter.requestDevice();
        //            const canvas = document.createElement("canvas");
        //            document.body.appendChild(canvas);
        //            const context = canvas.getContext("webgpu")!;
        //
        //            canvas.width = window.innerWidth;
        //            canvas.height = window.innerHeight;
        //
        //            const format = navigator.gpu.getPreferredCanvasFormat();
        //            context.configure({ device, format });
        //
        //            const shaderCode = `
        //                @vertex
        //                fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
        //                    var positions = array<vec2<f32>, 6>(
        //                        vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
        //                        vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
        //                    );
        //                    return vec4<f32>(positions[index], 0.0, 1.0);
        //                }
        //
        //                @fragment
        //                fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
        //                    let uv = fragCoord.xy / vec2<f32>(${canvas.width}.0, ${canvas.height}.0);
        //                    return vec4<f32>(uv, 0.5, 1.0);
        //                }
        //            `;
        //
        //            const shaderModule = device.createShaderModule({ code: shaderCode });
        //            const pipeline = device.createRenderPipeline({
        //                layout: "auto",
        //                vertex: { module: shaderModule, entryPoint: "vs" },
        //                fragment: {
        //                    module: shaderModule, entryPoint: "fs",
        //                    targets: [{ format }]
        //                },
        //                primitive: { topology: "triangle-list" }
        //            });
        //    
        //            console.log('ok');
        //
        //            function frame() {
        //                const commandEncoder = device.createCommandEncoder();
        //                const textureView = context.getCurrentTexture().createView();
        //                const renderPass = commandEncoder.beginRenderPass({
        //                    colorAttachments: [{ view: textureView, loadOp: "clear", storeOp: "store" }]
        //                });
        //                renderPass.setPipeline(pipeline);
        //                renderPass.draw(6);
        //                renderPass.end();
        //                device.queue.submit([commandEncoder.finish()]);
        ////                requestAnimationFrame(frame);
        //            }
        //
        //            frame();
        //        }
        //
        //        initWebGPU();
        )END");
    } catch (...) {
        std::cout << "ヷ！死んじゃった……" << std::endl;
    }


//	sAIUser->MessageAlert(ai::UnicodeString(returns));
//    free(returns);
	return error;
}

ASErr HelloWorldPlugin::ShutdownPlugin( SPInterfaceMessage *message )
{
	ASErr error = kNoErr;
//	sAIUser->MessageAlert(ai::UnicodeString("Goodbye from HelloWorld!"));
	error = Plugin::ShutdownPlugin(message);
	return error;
}

ASErr HelloWorldPlugin::InitLiveEffect(SPInterfaceMessage *message)
{
    ASErr error = kNoErr;
    short filterIndex = 0;
    
    AILiveEffectData effect;
    effect.self = message->d.self;
    effect.name = "la.hanak.illustrator-deno";
    effect.title = ai::UnicodeString("Deno Effector", kAIUTF8CharacterEncoding).as_UTF8().data();
    effect.majorVersion = 1;
    effect.minorVersion = 0;
    effect.prefersAsInput = AIStyleFilterPreferredInputArtType::kInputArtDynamic;
    effect.styleFilterFlags = AIStyleFilterFlags::kPostEffectFilter;
    
    AddLiveEffectMenuData menu;
    menu.category = ai::UnicodeString("Deno Effectors", kAIUTF8CharacterEncoding).as_UTF8().data();
    menu.title = ai::UnicodeString("Effect", kAIUTF8CharacterEncoding).as_UTF8().data();
    
    error = sAILiveEffect->AddLiveEffect(&effect, &this->fEffects[filterIndex]); CHKERR;
    error = sAILiveEffect->AddLiveEffectMenuItem(this->fEffects[filterIndex], effect.name, &menu, NULL, NULL);
    
    this->fNumEffects = filterIndex;
    
    return error;
}

ASErr HelloWorldPlugin::GoLiveEffect(AILiveEffectGoMessage *message)
{
    std::cout << "GO LIVE!! EFFECT!!!" << std::endl;
    
    ASErr error = kNoErr;
    PluginParams params;
    this->getDictionaryValues(message->parameters, params);

    std::cout << "GET DICK!" << std::endl;
    
    AIRasterizeSettings settings;
    settings.type = AIRasterizeType::kRasterizeARGB;
//    settings.resolution = 300.0;
    settings.antialiasing = 2;
    settings.options = (AIRasterizeOptions)(
        AIRasterizeOptions::kRasterizeOptionsUseMinTiles
        | AIRasterizeOptions::kRasterizeOptionsUseEffectsRes
    );
    settings.preserveSpotColors = true;

    
    try {
        AIArtHandle art = message->art;

        AIArtSet artSet;
        error = sAIArtSet->NewArtSet(&artSet); CHKERR;
        error = sAIArtSet->AddArtToArtSet(artSet, art); CHKERR;
       
        AIRealRect bounds;
        error = sAIRasterize->ComputeArtBounds(artSet, &bounds, false); CHKERR;

        AIArtHandle rasterArt;
        error = sAIArt->NewArt(AIArtType::kRasterArt, AIPaintOrder::kPlaceDefault, art, &rasterArt); //CHKERR;
        
        error = sAIRasterize->Rasterize(
            artSet,
            &settings,
            &bounds,
            AIPaintOrder::kPlaceAbove,
            art,
            &rasterArt,
            NULL
        ); CHKERR;
        
        AIRasterRecord rasterRecord;
        error = sAIRaster->GetRasterInfo(rasterArt, &rasterRecord); CHKERR;
        
        std::cout << rasterRecord.bounds.top << " "
                      << rasterRecord.bounds.right << " "
                      << rasterRecord.bounds.bottom << " "
                      << rasterRecord.bounds.left << std::endl;
        std::cout << "Color space: " << rasterRecord.colorSpace << std::endl;

        ai::uint32 width = rasterRecord.bounds.right - rasterRecord.bounds.left;
        ai::uint32 height = rasterRecord.bounds.bottom - rasterRecord.bounds.top;
        
        AISlice artSlice = {
            0, 0,
            static_cast<ai::int32>(width),
            static_cast<ai::int32>(height),
            0,
            4
        };
        
        AISlice workSlice;
        AITile workTile;
//        workTile.Init();
//        workTile.channelInterleave[0] = 0;
//        workTile.channelInterleave[1] = 1;
//        workTile.channelInterleave[2] = 2;
//        workTile.channelInterleave[3] = 3;

        std::cout << "GetRasterTile" << std::endl;
        error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice); CHKERR;

        const ai::uint32 totalPixels = width * height;
        const ai::uint32 pixelStride = workTile.colBytes;
        ai::uint8* pixelData = static_cast<ai::uint8*>(workTile.data);
        
        
        std::cout << "Set PIXELS" << std::endl;

        // ピクセルデータの設定
        for(ai::uint32 i = 0; i < totalPixels * pixelStride; i += pixelStride) {
            if (i + 3 >= totalPixels * pixelStride) break;
            
            ai::uint8* pixel = pixelData + i;
            pixel[0] = 255;  // Red
            pixel[1] = 0;    // Green
            pixel[2] = 0;    // Blue
            pixel[3] = 255;  // Alpha
        }
        

        error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice); CHKERR;

        message->art = rasterArt;
        sAIArtSet->DisposeArtSet(&artSet);
        
        std::cout << "Art Type:" << error << std::endl;
    } catch (const ai::Error& ex) {
        std::cout << (AIErr)ex << ":" << ex.what() << std::endl;
    }
    
    return error;
}

ASErr HelloWorldPlugin::EditLiveEffectParameters(AILiveEffectEditParamMessage *message)
{
    std::cout << "EDIT LIVE!! EFFECT!!!" << std::endl;
    ASErr error = kNoErr;
    
    AIDictKey key;
    PluginParams params;
    
    error = this->getDictionaryValues(message->parameters, params);
    
    ai::UnicodeString out;
    error = sAIUser->GetInputFromUser(
        ai::UnicodeString("DENODE-NO De-no de-No"),
        NULL,
        ai::UnicodeString("Script:"),
        params.script,
        NULL,
        &out,
        200
    );
    
    if (!error) {
        params.script = out;
        this->putParamsToDictionaly(message->parameters, params);
        sAILiveEffect->UpdateParameters(message->context);
    }
    
    return error;
}

ASErr HelloWorldPlugin::getDictionaryValues(const AILiveEffectParameters &dict, PluginParams &params)
{
    ASErr error = kNoErr;
    AIReal tempval;
    
    AIDictKey key = sAIDictionary->Key("AiDeno.main-script");
    if (sAIDictionary->IsKnown(dict, key)) {
        error = sAIDictionary->GetUnicodeStringEntry(dict, key, params.script);
    } else {
        params.script = ai::UnicodeString("", kAIUTF8CharacterEncoding);
    }
    
    return error;
}

ASErr HelloWorldPlugin::putParamsToDictionaly(const AILiveEffectParameters &dict, PluginParams params)
{
    ASErr error = kNoErr;
    AIDictKey key;
    
    key = sAIDictionary->Key("AiDeno.main-script");
    sAIDictionary->SetUnicodeStringEntry(dict, key, params.script);
    
    return error;
}


//ASErr HelloWorldPlugin::GoLiveEffect(AILiveEffectGoMessage *message)
//{
//    ASErr error = kNoErr;
//    PluginParams params;
//    this->getDictionaryValues(message->parameters, params);
//    
//    try {
//        AIArtHandle art = message->art;
//   
//        AIArtSet artSet;
//        error = sAIArtSet->NewArtSet(&artSet); CHKERR;
//        error = sAIArtSet->AddArtToArtSet(artSet, art); CHKERR;
//
//        AIRasterizeSettings settings;
//        settings.type = kRasterizeARGB;
//        settings.resolution = 300.0;
//        settings.antialiasing = 4;
//        settings.options = kRasterizeOptionsNone;
//        settings.preserveSpotColors = false;
//       
//        AIRealRect bounds;
//        error = sAIRasterize->ComputeArtBounds(artSet, &bounds, false); CHKERR;
//
//        AIArtHandle rasterArt;
//        AIRasterRecord rasterRecord;
//       
//        error = sAIRasterize->Rasterize(artSet, &settings, &bounds,
//                                      kPlaceAbove, art, &rasterArt, NULL); CHKERR;
//        error = sAIRaster->GetRasterInfo(rasterArt, &rasterRecord); CHKERR;
//        
//        std::cout << rasterRecord.bounds.top << " "
//            << rasterRecord.bounds.right << " "
//            << rasterRecord.bounds.bottom << " "
//            << rasterRecord.bounds.left << std::endl;
//
//        ai::uint32 width = rasterRecord.bounds.right - rasterRecord.bounds.left;
//        ai::uint32 height = rasterRecord.bounds.bottom - rasterRecord.bounds.top;
//        
//        AISlice artSlice = {0, 0, static_cast<ai::int32>(width), static_cast<ai::int32>(height), 0, 4};
//        AISlice workSlice = artSlice;
//        
//        // !! THIS IS NOT WORKING (No any appearance changed) !! //
//        AITile workTile;
//        error = sAIRaster->GetRasterTile(rasterArt, &artSlice, &workTile, &workSlice); CHKERR;
//        
//        for(ai::uint32 i = 0; i < width * height * 4; i += 4) {
//           static_cast<ai::uint8*>(workTile.data)[i] = 255;     // Red
//           static_cast<ai::uint8*>(workTile.data)[i+1] = 0;     // Green
//           static_cast<ai::uint8*>(workTile.data)[i+2] = 0;     // Blue
//           static_cast<ai::uint8*>(workTile.data)[i+3] = 255;   // Alpha
//        }
//
//        error = sAIRaster->SetRasterTile(rasterArt, &artSlice, &workTile, &workSlice);
//        delete[] static_cast<ai::uint8*>(workTile.data);
//        message->art = rasterArt;
//        // !! THIS IS NOT WORKING (No any appearance changed) !! //
//        
//        sAIArtSet->DisposeArtSet(&artSet);
//    } catch (...) {
//        
//    }
//    
//    return error;
//}
