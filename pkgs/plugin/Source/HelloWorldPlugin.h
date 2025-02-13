#ifndef __HelloWorldPlugin_h__
#define __HelloWorldPlugin_h__

#include <AIRasterize.h>
#include "Plugin.hpp"
#include "HelloWorldID.h"

#define kMaxEffects 100

struct PluginParams {
    ai::UnicodeString script;
};

Plugin* AllocatePlugin(SPPluginRef pluginRef);
void FixupReload(Plugin* plugin);

class HelloWorldPlugin : public Plugin
{
public:
	HelloWorldPlugin(SPPluginRef pluginRef);
	virtual ~HelloWorldPlugin();
  
	FIXUP_VTABLE_EX(HelloWorldPlugin, Plugin);
  
	ASErr StartupPlugin(SPInterfaceMessage*);
//    ASErr PostStartupPlugin();
	ASErr ShutdownPlugin(SPInterfaceMessage*);
    
private:
    AILiveEffectHandle fLiveEffect;
    AILiveEffectHandle fEffects[kMaxEffects];
    ASInt32 fNumEffects;

    
    ASErr InitMenus(SPInterfaceMessage*);
    ASErr InitLiveEffect(SPInterfaceMessage*);
    ASErr GoLiveEffect(AILiveEffectGoMessage*);
    ASErr EditLiveEffectParameters(AILiveEffectEditParamMessage*);
    
    ASErr getDictionaryValues(const AILiveEffectParameters&, PluginParams&);
    ASErr putParamsToDictionaly(const AILiveEffectParameters&, PluginParams);
};

#endif
