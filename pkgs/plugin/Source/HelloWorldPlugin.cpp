#include "IllustratorSDK.h"
#include "HelloWorldPlugin.h"
#include "HelloWorldSuites.h"
#include "libai_deno.h"

Plugin* AllocatePlugin(SPPluginRef pluginRef)
{
	return new HelloWorldPlugin(pluginRef);
}

void FixupReload(Plugin* plugin)
{
	HelloWorldPlugin::FixupVTable((HelloWorldPlugin*) plugin);
}

HelloWorldPlugin::HelloWorldPlugin(SPPluginRef pluginRef) :
	Plugin(pluginRef)
{
	strncpy(fPluginName, kHelloWorldPluginName, kMaxStringLength);
}

HelloWorldPlugin::~HelloWorldPlugin()
{
}

ASErr HelloWorldPlugin::StartupPlugin( SPInterfaceMessage *message )
{
	ASErr error = kNoErr;
	error = Plugin::StartupPlugin(message);
    char* returns = execute_deno(1);
	sAIUser->MessageAlert(ai::UnicodeString(returns));
    free(returns);
	return error;
}

ASErr HelloWorldPlugin::ShutdownPlugin( SPInterfaceMessage *message )
{
	ASErr error = kNoErr;
	sAIUser->MessageAlert(ai::UnicodeString("Goodbye from HelloWorld!"));
	error = Plugin::ShutdownPlugin(message);
	return error;
}
