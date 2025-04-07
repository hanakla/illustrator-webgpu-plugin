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
use crate::deno::ext::bootstrap::bootstrap_deno;
use crate::deno::ext::worker::deno_worker_host;
use crate::deno::module::{Module, ModuleHandle};
use crate::deno::module_loader::npm_package_manager::NpmPackageManager;
use crate::deno::transpiler::transpile;
use crate::deno_println;
use deno_error::JsErrorBox;
use deno_runtime::{
    deno_broadcast_channel,
    deno_broadcast_channel::InMemoryBroadcastChannel,
    deno_cache, deno_canvas, deno_console, deno_core,
    deno_core::{
        error::AnyError, error::JsError, futures::FutureExt, url::Url, v8, FastString, JsRuntime,
        ModuleSpecifier, PollEventLoopOptions, RuntimeOptions,
    },
    deno_cron,
    deno_cron::local::LocalCronHandler,
    deno_crypto, deno_fetch, deno_ffi, deno_fs,
    deno_fs::sync::MaybeArc,
    deno_http,
    deno_http::DefaultHttpPropertyExtractor,
    deno_io,
    deno_io::{Stdio, StdioPipe},
    deno_kv,
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
        let runtime_options = runtime_options_factory(
            option.package_root_dir.clone(),
            option.allowed_module_schemas,
            option.extensions,
        );
        let bootstrap_options = BootstrapOptions {
            ..Default::default()
        };

        let tokio = AsyncBridge::new(option.timeout)?;
        let mut runtime = JsRuntime::new(runtime_options);
        // deno_runtime::worker::MainWorker::bootstrap_from_options(runtime_options,
        //
        // );

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

        let mut scope = self.deno_runtime.handle_scope();
        let mut scope = v8::TryCatch::new(&mut scope);

        let namespace: v8::Local<v8::Value> = if let Ok(module_namespace) = module_namespace {
            v8::Local::<v8::Object>::new(&mut scope, module_namespace).into()
        } else {
            // Create a new object to use as the namespace if none is provided
            //let obj: v8::Local<v8::Value> = v8::Object::new(&mut scope).into();
            let obj: v8::Local<v8::Value> = v8::undefined(&mut scope).into();
            obj
        };

        let function_instance = function.open(&mut scope);
        let result = function_instance.call(&mut scope, namespace, &args);

        match result {
            Some(value) => {
                let value = v8::Global::new(&mut scope, value);
                Ok(value)
            }
            None if scope.has_caught() => {
                let e = scope
                    .message()
                    .ok_or_else(|| Error::Runtime("Unknown error".to_string()))?;

                let filename = e.get_script_resource_name(&mut scope);
                let linenumber = e.get_line_number(&mut scope).unwrap_or_default();
                let filename = if let Some(v) = filename {
                    let filename = v.to_rust_string_lossy(&mut scope);
                    format!("{filename}:{linenumber}: ")
                } else {
                    let filename = handle.module().filename().to_string_lossy();
                    format!("{filename}:{linenumber}: ")
                };

                let msg = e.get(&mut scope).to_rust_string_lossy(&mut scope);
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
            let handle = runtime.attach_module_async(module, true).await;
            runtime
                .await_event_loop(PollEventLoopOptions::default(), None)
                .await?;
            handle
        })
    }

    pub fn attach_module(&mut self, module: &Module) -> Result<ModuleHandle, Error> {
        self.block_on(move |runtime| async move {
            let handle = runtime.attach_module_async(module, false).await;
            runtime
                .await_event_loop(PollEventLoopOptions::default(), None)
                .await?;
            handle
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

fn runtime_options_factory(
    package_root_dir: PathBuf,
    allowed_module_schemas: HashSet<String>,
    extra_extensions: Vec<deno_runtime::deno_core::Extension>,
) -> RuntimeOptions {
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
    let mut extensions = get_all_extensions(&module_loader);
    extensions.extend(extra_extensions);

    let module_loader = Rc::new(module_loader);
    let extension_transpiler = module_loader.extension_transpiler();

    let runtime_options = RuntimeOptions {
        module_loader: Some(module_loader),
        // module_loader: deno_module_loader::RustyLoader::new(LoaderOptions {
        //     cache_provider: (),
        //     fs_whitelist: (),
        //     source_map_cache: (),
        //     node_resolver: (),
        //     import_provider: (),
        //     schema_whlist: (),
        //     cwd: (),
        // }),
        startup_snapshot: None,
        extensions,
        extension_transpiler: Some(extension_transpiler),
        is_main: true,
        ..Default::default()
    };

    // let services = deno_runtime::worker::WorkerServiceOptions {
    //   node_services: node_ext_init,
    //   fs:Arc<deno_fs::RealFs::default()>,
    // };

    runtime_options
}

fn get_all_extensions(mod_loader: &AiDenoModuleLoader) -> Vec<deno_runtime::deno_core::Extension> {
    // let fs = RealSys::default();
    // let arc_fs = Arc::new(fs.clone());

    let cachedir = match my_home() {
        Ok(homedir) => homedir.unwrap().join(".ai-deno"),
        Err(e) => {
            panic!("ai-deno: Failed to get home directory: {}", e.to_string());
        }
    };

    let blob_store: Arc<BlobStore> = Arc::new(BlobStore::default());
    let maybe_location: Option<Url> = None;
    let kv_storedir = cachedir.join("deno_kv");
    let cache_storage_dir = cachedir.join("deno_cache");
    let user_agent = "Deno-AdobeIllustraor".to_string();

    let permission_desc_parser = Arc::new(RuntimePermissionDescriptorParser::new(RealSys));
    let permissions = PermissionsContainer::new(permission_desc_parser, Permissions::allow_all());

    deno_core::extension!(deno_permissions_worker,
      options = {
        permissions: PermissionsContainer,
        enable_testing_features: bool,
      },
      state = |state, options| {
        state.put::<PermissionsContainer>(options.permissions);
        state.put(deno_runtime::ops::TestingFeaturesEnabled(options.enable_testing_features));
      },
    );

    // SEE: https://github.com/denoland/deno/blob/main/runtime/worker.rs#L391
    vec![
        bootstrap_deno::init_ops_and_esm(BootstrapOptions::default()),
        deno_telemetry::deno_telemetry::init_ops_and_esm(),
        // Web APIs
        deno_webidl::deno_webidl::init_ops_and_esm(),
        deno_console::deno_console::init_ops_and_esm(),
        deno_url::deno_url::init_ops_and_esm(),
        deno_web::deno_web::init_ops_and_esm::<PermissionsContainer>(blob_store, maybe_location),
        deno_webgpu::deno_webgpu::init_ops_and_esm(),
        deno_canvas::deno_canvas::init_ops_and_esm(),
        deno_fetch::deno_fetch::init_ops_and_esm::<PermissionsContainer>(deno_fetch::Options {
            user_agent: user_agent.clone(),
            root_cert_store_provider: None, // services.root_cert_store_provider.clone(),
            unsafely_ignore_certificate_errors: None, // options.unsafely_ignore_certificate_errors.clone(),
            file_fetch_handler: Rc::new(deno_fetch::FsFetchHandler),
            resolver: deno_fetch::dns::Resolver::gai(), //services.fetch_dns_resolver,
            proxy: None,
            client_builder_hook: None,
            request_builder_hook: None,
            client_cert_chain_and_key: deno_tls::TlsKeys::Null,
            // ..Default::default()
        }),
        deno_cache::deno_cache::init_ops_and_esm(None),
        deno_websocket::deno_websocket::init_ops_and_esm::<PermissionsContainer>(
            user_agent.clone(),
            Some(Arc::new(EmptyCertStoreProvider::new())),
            None,
        ),
        deno_webstorage::deno_webstorage::init_ops_and_esm(
            // options.origin_storage_dir.clone(),
            None,
        ),
        deno_crypto::deno_crypto::init_ops_and_esm(Some(1)),
        deno_broadcast_channel::deno_broadcast_channel::init_ops_and_esm(
            // services.broadcast_channel.clone(),
            InMemoryBroadcastChannel::default(),
        ),
        deno_ffi::deno_ffi::init_ops_and_esm::<PermissionsContainer>(),
        deno_net::deno_net::init_ops_and_esm::<PermissionsContainer>(
            Some(Arc::new(EmptyCertStoreProvider::new())),
            None,
        ),
        deno_tls::deno_tls::init_ops_and_esm(),
        deno_kv::deno_kv::init_ops_and_esm(
            MultiBackendDbHandler::remote_or_sqlite::<PermissionsContainer>(
                Some(kv_storedir.clone()),
                None,
                deno_kv::remote::HttpOptions {
                    user_agent: user_agent.clone(),
                    root_cert_store_provider: None,
                    unsafely_ignore_certificate_errors: None,
                    client_cert_chain_and_key: TlsKeys::Null,
                    proxy: None,
                },
            ),
            deno_kv::KvConfig::builder().build(),
        ),
        deno_cron::deno_cron::init_ops_and_esm(LocalCronHandler::new()),
        deno_napi::deno_napi::init_ops_and_esm::<PermissionsContainer>(),
        deno_http::deno_http::init_ops_and_esm::<DefaultHttpPropertyExtractor>(
            deno_http::Options::default(),
        ),
        deno_io::deno_io::init_ops_and_esm(Some(Stdio {
            stdin: StdioPipe::inherit(),
            stdout: StdioPipe::inherit(),
            stderr: StdioPipe::inherit(),
        })),
        deno_fs::deno_fs::init_ops_and_esm::<PermissionsContainer>(MaybeArc::new(
            deno_fs::RealFs::default(),
        )),
        deno_os::deno_os::init_ops_and_esm(deno_os::ExitCode::default()),
        deno_process::deno_process::init_ops_and_esm(
            None, // services.npm_process_state_provider,
        ),
        deno_node::deno_node::init_ops_and_esm::<
            PermissionsContainer,
            NpmPackageManager,
            NpmPackageManager,
            RealSys,
        >(
            Some(mod_loader.init_services()),
            MaybeArc::new(deno_fs::RealFs::default()),
        ),
        // Ops from this crate
        deno_runtime::ops::runtime::deno_runtime::init_ops_and_esm(
            ModuleSpecifier::parse("ai-deno://main_module.ts")
                .unwrap()
                .clone(),
        ),
        deno_worker_host::init_ops_and_esm(),
        // deno_runtime::ops::worker_host::deno_worker_host::init_ops_and_esm(
        //     Arc::new(|_| unimplemented!("web workers are not supported")),
        //     Some(Arc::new(deno_runtime::fmt_errors::format_js_error.clone())),
        // ),
        deno_runtime::ops::fs_events::deno_fs_events::init_ops_and_esm(),
        deno_runtime::ops::permissions::deno_permissions::init_ops_and_esm(),
        deno_runtime::ops::tty::deno_tty::init_ops_and_esm(),
        deno_runtime::ops::http::deno_http_runtime::init_ops_and_esm(),
        deno_runtime::ops::bootstrap::deno_bootstrap::init_ops_and_esm(
            // if options.startup_snapshot.is_some() {
            //     None
            // } else {
            Some(Default::default()), // },
        ),
        deno_permissions_worker::init_ops_and_esm(permissions, false),
        runtime::init_ops_and_esm(),
        // NOTE(bartlomieju): this is done, just so that ops from this extension
        // are available and importing them in `99_main.js` doesn't cause an
        // error because they're not defined. Trying to use these ops in non-worker
        // context will cause a panic.
        deno_runtime::ops::web_worker::deno_web_worker::init_ops_and_esm().disable(),
    ]
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
        let scope = &mut js_runtime.handle_scope();
        let context_local = v8::Local::new(scope, context);
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

    let scope = &mut js_runtime.handle_scope();
    let scope = &mut v8::TryCatch::new(scope);

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

struct EmptyCertStoreProvider(RootCertStore);

impl EmptyCertStoreProvider {
    fn new() -> Self {
        Self(RootCertStore::empty())
    }
}

impl RootCertStoreProvider for EmptyCertStoreProvider {
    fn get_or_try_init(&self) -> Result<&RootCertStore, JsErrorBox> {
        Ok(&self.0)
    }
}
