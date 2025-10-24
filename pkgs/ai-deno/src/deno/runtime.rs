// The MIT License (MIT)
//
// Copyright (c) 2022 Richard Carson
//
// Modified by Hanakla
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the Software), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, andor sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

use crate::deno::async_bridge::{AsyncBridge, AsyncBridgeExt};
use crate::deno::error::Error;
use crate::deno::module::{Module, ModuleHandle};
use crate::deno::module_loader::npm_package_manager::NpmPackageManager;
use crate::deno::transpiler::transpile;
use crate::deno_println;
use deno_bundle_runtime;
use deno_core::{CompiledWasmModuleStore, ImportAssertionsSupport};
use deno_runtime::{
    deno_broadcast_channel,
    deno_broadcast_channel::InMemoryBroadcastChannel,
    deno_cache, deno_canvas, deno_console, deno_core,
    deno_core::{
        error::AnyError, error::JsError, futures::FutureExt, url::Url, v8, FastString, JsRuntime,
        PollEventLoopOptions, RuntimeOptions,
    },
    deno_cron,
    deno_cron::local::LocalCronHandler,
    deno_crypto, deno_fetch, deno_ffi, deno_fs, deno_http, deno_io, deno_kv,
    deno_kv::dynamic::MultiBackendDbHandler,
    deno_napi, deno_net, deno_node, deno_os,
    deno_permissions::{Permissions, PermissionsContainer},
    deno_process, deno_telemetry, deno_tls,
    deno_tls::rustls::RootCertStore,
    deno_tls::{RootCertStoreProvider, TlsKeys},
    deno_url, deno_web,
    deno_web::BlobStore,
    deno_webgpu, deno_webidl, deno_websocket, deno_webstorage,
    permissions::RuntimePermissionDescriptorParser,
    runtime, BootstrapOptions,
};
use homedir::my_home;
use node_resolver::errors::PackageNotFoundError;
use node_resolver::{InNpmPackageChecker, NpmPackageFolderResolver, UrlOrPath};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;
use sys_traits::impls::RealSys;

use super::module_loader::{self, AiDenoModuleLoader, AiDenoModuleLoaderInit};

pub struct RuntimeInit {
    pub extensions: Vec<deno_runtime::deno_core::Extension>,
    pub package_root_dir: PathBuf,
    pub timeout: Duration,
    /// A set of (extra) module schemas that are allowed to be imported by the runtime.
    /// (Ex. "example:")
    pub allowed_module_schemas: HashSet<String>,
}

impl Default for RuntimeInit {
    fn default() -> Self {
        Self {
            extensions: vec![],
            package_root_dir: my_home().unwrap().unwrap().join(".ai-deno"),
            timeout: Duration::MAX,
            allowed_module_schemas: HashSet::new(),
        }
    }
}

pub struct Runtime {
    tokio: AsyncBridge,
    deno_runtime: JsRuntime,
    // container: RuntimeContainer,
    cwd: PathBuf,
}

impl Runtime {
    pub fn new(option: RuntimeInit) -> Result<Self, Error> {
        let (runtime_options, services) = runtime_options_factory(
            option.package_root_dir.clone(),
            option.allowed_module_schemas,
            option.extensions,
        );
        let bootstrap_options = BootstrapOptions {
            ..Default::default()
        };

        JsRuntime::init_platform(None, true);

        let tokio = AsyncBridge::new(option.timeout)?;
        let mut runtime = JsRuntime::new(runtime_options);

        // Initialize extensions with their arguments
        // SEE: https://github.com/denoland/deno/blob/main/runtime/worker.rs#L1038
        runtime
            .lazy_init_extensions(vec![
                deno_web::deno_web::args::<PermissionsContainer>(
                    services.blob_store.clone(),
                    bootstrap_options.location.clone(),
                ),
                deno_fetch::deno_fetch::args::<PermissionsContainer>(deno_fetch::Options {
                    user_agent: bootstrap_options.user_agent.clone(),
                    ..Default::default()
                }),
                deno_cache::deno_cache::args(None),
                deno_websocket::deno_websocket::args::<PermissionsContainer>(),
                deno_webstorage::deno_webstorage::args(None),
                deno_crypto::deno_crypto::args(None),
                deno_broadcast_channel::deno_broadcast_channel::args(
                    InMemoryBroadcastChannel::default(),
                ),
                deno_ffi::deno_ffi::args::<PermissionsContainer>(None),
                deno_net::deno_net::args::<PermissionsContainer>(None, None),
                deno_kv::deno_kv::args(
                    MultiBackendDbHandler::remote_or_sqlite::<PermissionsContainer>(
                        None,
                        None,
                        deno_kv::remote::HttpOptions {
                            user_agent: bootstrap_options.user_agent.clone(),
                            root_cert_store_provider: None,
                            unsafely_ignore_certificate_errors: None,
                            client_cert_chain_and_key: deno_runtime::deno_tls::TlsKeys::Null,
                            proxy: None,
                        },
                    ),
                    deno_kv::KvConfig::builder().build(),
                ),
                deno_napi::deno_napi::args::<PermissionsContainer>(None),
                deno_http::deno_http::args(deno_http::Options::default()),
                deno_io::deno_io::args(Some(deno_io::Stdio::default())),
                deno_fs::deno_fs::args::<PermissionsContainer>(services.fs.clone()),
                deno_os::deno_os::args(None),
                deno_process::deno_process::args(None),
                deno_node::deno_node::args::<
                    PermissionsContainer,
                    NpmPackageManager,
                    NpmPackageManager,
                    RealSys,
                >(Some(services.node_services.clone()), services.fs.clone()),
                deno_runtime::ops::runtime::deno_runtime::args(Url::parse("file:///").unwrap()),
                deno_runtime::ops::worker_host::deno_worker_host::args(
                    Arc::new(|_| unimplemented!("web workers are not supported")),
                    None,
                ),
                deno_bundle_runtime::deno_bundle_runtime::args(None),
            ])
            .map_err(|e| Error::CoreError(format!("Failed to initialize extensions: {}", e)))?;

        // Put additional state into OpState
        {
            let state = runtime.op_state();
            let mut state = state.borrow_mut();
            state.put::<PermissionsContainer>(services.permissions);
            state.put(deno_runtime::ops::TestingFeaturesEnabled(false));
            state.put(services.feature_checker);
            state.put(RealSys::default());
        }

        if !bootstrap_runtime(&mut runtime, &bootstrap_options).is_ok() {
            return Err(Error::CoreError("Failed to bootstrap runtime".into()));
        }

        let cwd = std::env::current_dir().or_else(|e| {
            Err(Error::Runtime(format!(
                "Failed to get current directory: {}",
                e.to_string()
            )))
        })?;

        Ok(Self {
            tokio,
            deno_runtime: runtime,
            // container:runtime,
            cwd,
        })
    }

    pub fn deno_runtime(&mut self) -> &mut JsRuntime {
        self.deno_runtime.rt_mut()
    }

    pub fn tokio_runtime(&self) -> std::rc::Rc<tokio::runtime::Runtime> {
        self.tokio.tokio_runtime()
    }

    pub fn call_module_function(
        &mut self,
        handle: &mut ModuleHandle,
        name: &str,
        args: &Vec<v8::Local<v8::Value>>,
    ) -> Result<v8::Global<v8::Value>, Error> {
        self.block_on(|runtime| async move {
            let result = runtime
                .call_module_function_async(handle, name, args)
                .await
                .or::<Error>(Err(Error::Runtime("abc".to_string())));
            result
        })
    }

    pub async fn call_module_function_async<'a>(
        &mut self,
        handle: &mut ModuleHandle,
        name: &str,
        args: &Vec<v8::Local<'a, v8::Value>>,
    ) -> Result<v8::Global<v8::Value>, Error> {
        let function = handle.get_export_function_by_name(self, name)?;
        let result = self.call_function_by_ref(handle, &function, args)?;
        let result = self.resolve_with_event_loop(result).await?;
        Ok(result)
    }

    fn call_function_by_ref(
        &mut self,
        handle: &ModuleHandle,
        function: &v8::Global<v8::Function>,
        args: &Vec<v8::Local<v8::Value>>,
    ) -> Result<v8::Global<v8::Value>, Error> {
        let module_namespace = self.deno_runtime.get_module_namespace(handle.module_id());

        let context = self.deno_runtime.main_context();
        let isolate = self.deno_runtime.v8_isolate();
        v8::scope!(handle_scope, isolate);
        let context_local = v8::Local::new(handle_scope, context);
        let mut context_scope = v8::ContextScope::new(handle_scope, context_local);
        v8::tc_scope!(let scope, &mut context_scope);

        let namespace: v8::Local<v8::Value> = if let Ok(module_namespace) = module_namespace {
            v8::Local::<v8::Object>::new(scope, module_namespace).into()
        } else {
            // Create a new object to use as the namespace if none is provided
            //let obj: v8::Local<v8::Value> = v8::Object::new(scope).into();
            let obj: v8::Local<v8::Value> = v8::undefined(scope).into();
            obj
        };

        let function_instance = function.open(scope);
        let result = function_instance.call(scope, namespace, &args);

        match result {
            Some(value) => {
                let value = v8::Global::new(scope, value);
                Ok(value)
            }
            None if scope.has_caught() => {
                let e = scope
                    .message()
                    .ok_or_else(|| Error::Runtime("Unknown error".to_string()))?;

                let filename = e.get_script_resource_name(scope);
                let linenumber = e.get_line_number(scope).unwrap_or_default();
                let filename = if let Some(v) = filename {
                    let filename = v.to_rust_string_lossy(scope);
                    format!("{filename}:{linenumber}: ")
                } else {
                    let filename = handle.module().filename().to_string_lossy();
                    format!("{filename}:{linenumber}: ")
                };

                let msg = e.get(scope).to_rust_string_lossy(scope);
                let s = format!("{filename}{msg}");
                Err(Error::Runtime(s))
            }
            None => Err(Error::Runtime(
                "Unknown error during function execution".to_string(),
            )),
        }
    }

    pub fn load_main_module(&mut self, module: &Module) -> Result<ModuleHandle, Error> {
        self.block_on(move |runtime| async move {
            let handle = runtime.attach_module_async(module, true).await?;
            runtime
                .await_event_loop(PollEventLoopOptions::default(), None)
                .await?;
            Ok(handle)
        })
    }

    pub async fn attach_module_async(
        &mut self,
        module: &Module,
        main: bool,
    ) -> Result<ModuleHandle, Error> {
        self.attach_module_internal(module, main).await
    }

    async fn attach_module_internal(
        &mut self,
        module: &Module,
        main: bool,
    ) -> Result<ModuleHandle, Error> {
        let module_specifier = module.specifier(&self.cwd)?;
        let (code, sourcemap) = transpile(
            FastString::from(module_specifier.clone()),
            FastString::from(module.contents().to_string()),
        )?;

        let js_runtime = self.deno_runtime();

        deno_println!("is main: {}", main);
        let module_id: deno_runtime::deno_core::ModuleId = if main {
            js_runtime
                .load_main_es_module_from_code(&module_specifier, code)
                .await
        } else {
            js_runtime
                .load_side_es_module_from_code(&module_specifier, code)
                .await
        }
        .or_else(|e| {
            return Err(Error::ModuleNotFound(format!(
                "Failed to load module: {} \n For loading: {}",
                e.to_string(),
                module_specifier.to_string(),
            )));
        })?;

        let mod_load = self.deno_runtime().mod_evaluate(module_id);

        match self
            .with_event_loop_future(mod_load, PollEventLoopOptions::default())
            .await
        {
            Ok(_) => Ok(ModuleHandle::new(module.clone(), module_id)),
            Err(e) => {
                return Err(Error::ModuleNotFound(format!(
                    "Failed to evaluate module: {}. reason: {}",
                    module_specifier.to_string(),
                    e.to_string()
                )))
            }
        }
    }

    async fn await_event_loop(
        &mut self,
        options: PollEventLoopOptions,
        timeout: Option<Duration>,
    ) -> Result<(), Error> {
        if let Some(timeout) = timeout {
            Ok(tokio::select! {
                r = self.deno_runtime().run_event_loop(options) => r,
                () = tokio::time::sleep(timeout) => Ok(()),
            }?)
        } else {
            Ok(self.deno_runtime.run_event_loop(options).await?)
        }
    }

    async fn with_event_loop_future<'fut, T, E>(
        &mut self,
        mut fut: impl std::future::Future<Output = Result<T, E>> + Unpin + 'fut,
        poll_options: PollEventLoopOptions,
    ) -> Result<T, Error>
    where
        AnyError: From<E>,
        Error: std::convert::From<E>,
    {
        // Manually implement tokio::select
        std::future::poll_fn(|cx| {
            if let Poll::Ready(t) = fut.poll_unpin(cx) {
                return if let Poll::Ready(Err(e)) =
                    self.deno_runtime.poll_event_loop(cx, poll_options)
                {
                    // Run one more tick to check for errors
                    Poll::Ready(Err(e.into()))
                } else {
                    // No errors - continue
                    Poll::Ready(t.map_err(Into::into))
                };
            }

            if let Poll::Ready(Err(e)) = self.deno_runtime.poll_event_loop(cx, poll_options) {
                // Event loop failed
                return Poll::Ready(Err(e.into()));
            }

            if self
                .deno_runtime
                .poll_event_loop(cx, poll_options)
                .is_ready()
            {
                // Event loop resolved - continue
                deno_println!("Event loop resolved");
            }

            Poll::Pending
        })
        .await
    }

    async fn resolve_with_event_loop(
        &mut self,
        value: v8::Global<v8::Value>,
    ) -> Result<v8::Global<v8::Value>, Error> {
        let future = self.deno_runtime.resolve(value);
        let result = self
            .deno_runtime
            .with_event_loop_future(future, PollEventLoopOptions::default())
            .await?;

        Ok(result)
    }

    // fn cast_value<T, T2>(&mut, self, value: v8::Local<T>) -> Result<T, Error> {
    //   // v8::Local::cast::<value>
    //
    // }

    // pub fn to_local_value<T>(&mut self, scope: &mut v8::HandleScope, object: v8::Global<T>) -> Result<&'static v8::Local<T>, ()> {
    //   Ok(&v8::Local::<T>::new(scope, object))
    // }
}

impl AsyncBridgeExt for Runtime {
    fn bridge(&self) -> &AsyncBridge {
        &self.tokio
    }
}

struct RuntimeServices {
    blob_store: Arc<BlobStore>,
    permissions: PermissionsContainer,
    feature_checker: Arc<deno_runtime::FeatureChecker>,
    fs: Arc<deno_runtime::deno_fs::RealFs>,
    node_services: deno_node::NodeExtInitServices<NpmPackageManager, NpmPackageManager, RealSys>,
}

fn runtime_options_factory(
    package_root_dir: PathBuf,
    allowed_module_schemas: HashSet<String>,
    extra_extensions: Vec<deno_runtime::deno_core::Extension>,
) -> (RuntimeOptions, RuntimeServices) {
    // let fs = RealSys::default();
    // let arcFs = Arc::new(fs.clone());

    // let node_require_loader = Rc::new(RustyRequireLoader(arcFs.clone()));
    // let node_require_loader = Rc::new(RequireLoader {});

    // let node_ext_init = NodeExtInitServices {
    //     node_require_loader: node_require_loader.clone(),
    //     node_resolver: node_resolver.clone(),
    //     pkg_json_resolver: pjson_resolver.clone(),
    //     sys: fs.clone(),
    // };

    // let module_loader = AiDenoModuleLoader {};

    // let extra_extensions = options.extensions;
    // extensions.extend(extra_extensions);

    let module_loader = AiDenoModuleLoader::new(AiDenoModuleLoaderInit {
        package_root_dir: package_root_dir.clone(),
        allowed_module_schemas,
    });
    let (mut extensions, services) = get_all_extensions(&module_loader);
    extensions.extend(extra_extensions);

    let module_loader = Rc::new(module_loader);
    let extension_transpiler = module_loader.extension_transpiler();

    let wasm_store = CompiledWasmModuleStore::default();

    let runtime_options = RuntimeOptions {
        module_loader: Some(module_loader),
        startup_snapshot: None,
        extensions,
        extension_transpiler: Some(extension_transpiler),
        is_main: true,
        compiled_wasm_module_store: Some(wasm_store),
        import_assertions_support: ImportAssertionsSupport::Yes,
        ..Default::default()
    };

    (runtime_options, services)
}

fn get_all_extensions(
    mod_loader: &AiDenoModuleLoader,
) -> (Vec<deno_runtime::deno_core::Extension>, RuntimeServices) {
    // let fs = RealSys::default();
    // let arc_fs = Arc::new(fs.clone());

    let cachedir = match my_home() {
        Ok(homedir) => homedir.unwrap().join(".ai-deno"),
        Err(e) => {
            panic!("ai-deno: Failed to get home directory: {}", e.to_string());
        }
    };

    let blob_store: Arc<BlobStore> = Arc::new(BlobStore::default());
    let fs = Arc::new(deno_runtime::deno_fs::RealFs);
    let maybe_location: Option<Url> = None;
    let kv_storedir = cachedir.join("deno_kv");
    let cache_storage_dir = cachedir.join("deno_cache");
    let user_agent = "Deno-AdobeIllustraor".to_string();

    let permission_desc_parser = Arc::new(RuntimePermissionDescriptorParser::new(RealSys));
    let permissions = PermissionsContainer::new(permission_desc_parser, Permissions::allow_all());

    // Create FeatureChecker with all unstable features enabled
    let feature_checker = Arc::new(deno_runtime::FeatureChecker::default());

    deno_core::extension!(deno_permissions_worker,
      options = {
        permissions: PermissionsContainer,
        enable_testing_features: bool,
        bootstrap_options: BootstrapOptions,
        blob_store: Arc<BlobStore>,
        feature_checker: Arc<deno_runtime::FeatureChecker>,
      },
      state = |state, options| {
        state.put::<PermissionsContainer>(options.permissions);
        state.put(deno_runtime::ops::TestingFeaturesEnabled(options.enable_testing_features));
        state.put(options.bootstrap_options);
        state.put(deno_web::StartTime::default());
        state.put(options.blob_store);
        state.put(options.feature_checker);
        state.put(deno_node::ops::handle_wrap::AsyncId::default());
      },
    );

    // SEE: https://github.com/denoland/deno/blob/main/runtime/worker.rs#L1049
    // NOTE: ordering is important here, keep it in sync with runtime/worker.rs
    let extensions = vec![
        deno_telemetry::deno_telemetry::init(),
        // Web APIs
        deno_webidl::deno_webidl::init(),
        deno_console::deno_console::init(),
        deno_url::deno_url::init(),
        deno_web::deno_web::lazy_init::<PermissionsContainer>(),
        deno_webgpu::deno_webgpu::init(),
        deno_canvas::deno_canvas::init(),
        deno_fetch::deno_fetch::lazy_init::<PermissionsContainer>(),
        deno_cache::deno_cache::lazy_init(),
        deno_websocket::deno_websocket::lazy_init::<PermissionsContainer>(),
        deno_webstorage::deno_webstorage::lazy_init(),
        deno_crypto::deno_crypto::lazy_init(),
        deno_broadcast_channel::deno_broadcast_channel::lazy_init::<InMemoryBroadcastChannel>(),
        deno_ffi::deno_ffi::lazy_init::<PermissionsContainer>(),
        deno_net::deno_net::lazy_init::<PermissionsContainer>(),
        deno_tls::deno_tls::init(),
        deno_kv::deno_kv::lazy_init::<MultiBackendDbHandler>(),
        deno_cron::deno_cron::init(LocalCronHandler::new()),
        deno_napi::deno_napi::lazy_init::<PermissionsContainer>(),
        deno_http::deno_http::lazy_init(),
        deno_io::deno_io::lazy_init(),
        deno_fs::deno_fs::lazy_init::<PermissionsContainer>(),
        deno_os::deno_os::lazy_init(),
        deno_process::deno_process::lazy_init(),
        deno_node::deno_node::lazy_init::<
            PermissionsContainer,
            NpmPackageManager,
            NpmPackageManager,
            RealSys,
        >(),
        // Ops from this crate
        deno_runtime::ops::runtime::deno_runtime::lazy_init(),
        deno_runtime::ops::worker_host::deno_worker_host::lazy_init(),
        deno_runtime::ops::fs_events::deno_fs_events::init(),
        deno_runtime::ops::permissions::deno_permissions::init(),
        deno_runtime::ops::tty::deno_tty::init(),
        deno_runtime::ops::http::deno_http_runtime::init(),
        // deno_bundle_runtime is required by the main runtime extension
        deno_bundle_runtime::deno_bundle_runtime::lazy_init(),
        // Bootstrap extension with ops (provide SnapshotOptions)
        deno_runtime::ops::bootstrap::deno_bootstrap::init(Some(Default::default()), false),
        // Main deno_runtime extension (contains 98_global_scope_shared.js)
        deno_runtime::runtime::init(),
        // Web worker ops (disabled for main worker)
        deno_runtime::ops::web_worker::deno_web_worker::init().disable(),
        // Custom extension to put BootstrapOptions and permissions in state
        deno_permissions_worker::init(
            permissions.clone(),
            false,
            BootstrapOptions::default(),
            blob_store.clone(),
            feature_checker.clone(),
        ),
    ];

    let node_services = deno_node::NodeExtInitServices {
        node_require_loader: std::rc::Rc::new(mod_loader.require_loader.clone())
            as std::rc::Rc<dyn deno_node::NodeRequireLoader>,
        node_resolver: mod_loader.node_resolver.clone(),
        pkg_json_resolver: mod_loader.pkg_json_resolver.clone(),
        sys: RealSys::default(),
    };

    let services = RuntimeServices {
        blob_store,
        permissions,
        feature_checker,
        fs,
        node_services,
    };

    (extensions, services)
}

fn bootstrap_runtime(js_runtime: &mut JsRuntime, options: &BootstrapOptions) -> Result<(), Error> {
    // {
    //     let op_state = js_runtime.op_state();
    //     let mut state = op_state.borrow_mut();
    //     state.put(options.clone());
    // }

    // SEE: https://github.com/denoland/deno/blob/795ecfdca60d22183babdf887f7f66500c3983b3/runtime/worker.rs#L618
    let (
        bootstrap_fn_global,
        dispatch_load_event_fn_global,
        dispatch_beforeunload_event_fn_global,
        dispatch_unload_event_fn_global,
        dispatch_process_beforeexit_event_fn_global,
        dispatch_process_exit_event_fn_global,
    ) = {
        let context = js_runtime.main_context();
        let isolate = js_runtime.v8_isolate();
        v8::scope!(handle_scope, isolate);
        let context_local = v8::Local::new(handle_scope, context);
        let scope = &mut v8::ContextScope::new(handle_scope, context_local);
        let global_obj = context_local.global(scope);
        let bootstrap_str = v8::String::new_external_onebyte_static(scope, b"bootstrap").unwrap();
        let bootstrap_ns: v8::Local<v8::Object> = global_obj
            .get(scope, bootstrap_str.into())
            .unwrap()
            .try_into()
            .unwrap();
        let main_runtime_str =
            v8::String::new_external_onebyte_static(scope, b"mainRuntime").unwrap();
        let bootstrap_fn = bootstrap_ns.get(scope, main_runtime_str.into()).unwrap();
        let bootstrap_fn = v8::Local::<v8::Function>::try_from(bootstrap_fn).unwrap();
        let dispatch_load_event_fn_str =
            v8::String::new_external_onebyte_static(scope, b"dispatchLoadEvent").unwrap();
        let dispatch_load_event_fn = bootstrap_ns
            .get(scope, dispatch_load_event_fn_str.into())
            .unwrap();
        let dispatch_load_event_fn =
            v8::Local::<v8::Function>::try_from(dispatch_load_event_fn).unwrap();
        let dispatch_beforeunload_event_fn_str =
            v8::String::new_external_onebyte_static(scope, b"dispatchBeforeUnloadEvent").unwrap();
        let dispatch_beforeunload_event_fn = bootstrap_ns
            .get(scope, dispatch_beforeunload_event_fn_str.into())
            .unwrap();
        let dispatch_beforeunload_event_fn =
            v8::Local::<v8::Function>::try_from(dispatch_beforeunload_event_fn).unwrap();
        let dispatch_unload_event_fn_str =
            v8::String::new_external_onebyte_static(scope, b"dispatchUnloadEvent").unwrap();
        let dispatch_unload_event_fn = bootstrap_ns
            .get(scope, dispatch_unload_event_fn_str.into())
            .unwrap();
        let dispatch_unload_event_fn =
            v8::Local::<v8::Function>::try_from(dispatch_unload_event_fn).unwrap();
        let dispatch_process_beforeexit_event =
            v8::String::new_external_onebyte_static(scope, b"dispatchProcessBeforeExitEvent")
                .unwrap();
        let dispatch_process_beforeexit_event_fn = bootstrap_ns
            .get(scope, dispatch_process_beforeexit_event.into())
            .unwrap();
        let dispatch_process_beforeexit_event_fn =
            v8::Local::<v8::Function>::try_from(dispatch_process_beforeexit_event_fn).unwrap();
        let dispatch_process_exit_event =
            v8::String::new_external_onebyte_static(scope, b"dispatchProcessExitEvent").unwrap();
        let dispatch_process_exit_event_fn = bootstrap_ns
            .get(scope, dispatch_process_exit_event.into())
            .unwrap();
        let dispatch_process_exit_event_fn =
            v8::Local::<v8::Function>::try_from(dispatch_process_exit_event_fn).unwrap();
        (
            v8::Global::new(scope, bootstrap_fn),
            v8::Global::new(scope, dispatch_load_event_fn),
            v8::Global::new(scope, dispatch_beforeunload_event_fn),
            v8::Global::new(scope, dispatch_unload_event_fn),
            v8::Global::new(scope, dispatch_process_beforeexit_event_fn),
            v8::Global::new(scope, dispatch_process_exit_event_fn),
        )
    };

    let context = js_runtime.main_context();
    let isolate = js_runtime.v8_isolate();
    v8::scope!(handle_scope, isolate);
    let context_local = v8::Local::new(handle_scope, context);
    let mut context_scope = v8::ContextScope::new(handle_scope, context_local);
    v8::tc_scope!(let scope, &mut context_scope);

    let bootstrap_fn = v8::Local::new(scope, bootstrap_fn_global);
    let undefined = v8::undefined(scope);
    let args = options.as_v8(scope);
    bootstrap_fn.call(scope, undefined.into(), &[args]);

    if let Some(exception) = scope.exception() {
        return Err(Error::from(JsError::from_v8_exception(scope, exception)));
    }

    Ok(())
}

pub trait RuntimeTrait {
    fn try_new(options: RuntimeOptions) -> Result<Self, Error>
    where
        Self: Sized;
    fn rt_mut(&mut self) -> &mut JsRuntime;
}
impl RuntimeTrait for JsRuntime {
    fn try_new(options: RuntimeOptions) -> Result<Self, Error>
    where
        Self: Sized,
    {
        match Self::try_new(options) {
            Ok(rt) => Ok(rt),
            Err(e) => Err(Error::Runtime(e.to_string())),
        }
    }
    fn rt_mut(&mut self) -> &mut JsRuntime {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::deno::module::Module;
    use crate::ext::{ai_user_extension, AiExtOptions};

    // Mock C functions for testing
    #[no_mangle]
    pub extern "C" fn ai_deno_alert(_msg: *const std::os::raw::c_char) {
        // No-op for tests
    }

    #[no_mangle]
    pub extern "C" fn ai_deno_get_user_locale() -> *const std::os::raw::c_char {
        // Return a static string pointer for testing
        b"en_US\0".as_ptr() as *const std::os::raw::c_char
    }

    #[test]
    fn test_module_with_top_level_await() {
        let mut runtime = Runtime::new(Default::default()).unwrap();

        let code = r#"
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            await delay(10);

            export function hello() {
                return "world";
            }

            export const value = 42;
        "#;

        let module = Module::from_string("test_async.js", code);
        let mut handle = runtime.load_main_module(&module).unwrap();

        // Check exports are available after top-level await
        let exports = handle.get_module_exports(&mut runtime);
        println!("Exports with top-level await: {:?}", exports);

        assert!(
            exports.is_ok(),
            "Failed to get module exports: {:?}",
            exports.err()
        );
        let exports = exports.unwrap();
        assert!(exports.contains(&"hello".to_string()));
        assert!(exports.contains(&"value".to_string()));
    }

    #[test]
    fn test_multiple_dependencies_with_top_level_await() {
        let mut runtime = Runtime::new(Default::default()).unwrap();

        let code = r#"
            import { z } from "npm:zod@3.24.2";
            import { join } from "jsr:@std/path@1.0.8";
            import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";

            // Simulate async initialization like main.mjs
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            await delay(10);

            export const schema = z.string();

            export function validate(input) {
                return schema.parse(input);
            }

            export function joinPaths(a, b) {
                return join(a, b);
            }

            export function checkEqual(a, b) {
                return isEqual(a, b);
            }
        "#;

        let module = Module::from_string("test_complex.js", code);

        println!("\n=== Testing multiple dependencies with top-level await ===");
        let handle = runtime
            .load_main_module(&module)
            .expect("Failed to load complex module");
        println!(
            "Module loaded successfully, module_id: {:?}",
            handle.module_id()
        );

        let exports = handle.get_module_exports(&mut runtime);
        println!(
            "Exports with multiple deps + top-level await: {:?}",
            exports
        );

        assert!(
            exports.is_ok(),
            "Failed to get module exports: {:?}",
            exports.err()
        );
        let exports = exports.unwrap();
        assert!(exports.contains(&"schema".to_string()), "schema not found");
        assert!(
            exports.contains(&"validate".to_string()),
            "validate not found"
        );
        assert!(
            exports.contains(&"joinPaths".to_string()),
            "joinPaths not found"
        );
        assert!(
            exports.contains(&"checkEqual".to_string()),
            "checkEqual not found"
        );
    }

    #[test]
    fn test_actual_main_mjs_with_load() {
        let mut runtime = Runtime::new(RuntimeInit {
            extensions: vec![ai_user_extension::init(AiExtOptions {})],
            ..Default::default()
        })
        .unwrap();
        let code = include_str!("../js/dist/main.mjs");
        let module = Module::from_string("main.ts", code);

        println!("\n=== Testing load_main_module with actual main.mjs ===");
        let handle = runtime
            .load_main_module(&module)
            .expect("Failed to load module");
        println!(
            "Module loaded successfully, module_id: {:?}",
            handle.module_id()
        );

        let exports = handle.get_module_exports(&mut runtime);
        println!("Exports from load_main_module: {:?}", exports);

        assert!(
            exports.is_ok(),
            "Failed to get module exports: {:?}",
            exports.err()
        );
        let exports = exports.unwrap();
        assert!(
            exports.contains(&"getLiveEffects".to_string()),
            "getLiveEffects not found"
        );
        assert!(
            exports.contains(&"loadEffects".to_string()),
            "loadEffects not found"
        );
    }

    #[test]
    fn test_attach_main_module_vs_load_main_module() {
        let code = r#"
            export function test() {
                return "ok";
            }
        "#;

        println!("\n=== Testing attach_main_module ===");
        let mut runtime1 = Runtime::new(Default::default()).unwrap();
        let module1 = Module::from_string("test1.js", code);
        let mut handle1 = runtime1.attach_main_module(&module1).unwrap();
        let exports1 = handle1.get_module_exports(&mut runtime1);
        println!("attach_main_module exports: {:?}", exports1);

        println!("\n=== Testing load_main_module ===");
        let mut runtime2 = Runtime::new(Default::default()).unwrap();
        let module2 = Module::from_string("test2.js", code);
        let mut handle2 = runtime2.load_main_module(&module2).unwrap();
        let exports2 = handle2.get_module_exports(&mut runtime2);
        println!("load_main_module exports: {:?}", exports2);

        // Both should succeed
        if exports1.is_err() && exports2.is_err() {
            panic!(
                "Both methods failed. attach_main_module: {:?}, load_main_module: {:?}",
                exports1.err(),
                exports2.err()
            );
        }
    }
}
