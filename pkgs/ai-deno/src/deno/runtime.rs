use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;
use deno_core::futures::FutureExt;

use deno_runtime::deno_core::{FastString, JsRuntime, ModuleSpecifier, PollEventLoopOptions, RuntimeOptions, url::{Url}, v8};
use deno_runtime::deno_node::ExtNodeSys;
use deno_runtime::{deno_canvas, deno_console, deno_fetch, deno_ffi, deno_fs, deno_http, deno_io, deno_os, deno_telemetry, deno_tls, deno_url, deno_web, deno_webgpu, deno_webidl, deno_webstorage, runtime};
use deno_runtime::deno_fs::sync::MaybeArc;
use deno_runtime::deno_http::DefaultHttpPropertyExtractor;
use deno_runtime::deno_permissions::PermissionsContainer;
use deno_runtime::deno_web::BlobStore;
use node_resolver::{InNpmPackageChecker, NpmPackageFolderResolver};
use crate::deno::async_bridge::{AsyncBridge, AsyncBridgeExt};
use crate::deno::error::Error;
use crate::deno::module::{Module, ModuleHandle};

pub struct RuntimeInitOptions {
  timeout: Duration
}

impl Default for RuntimeInitOptions {
  fn default() -> Self {
    Self {timeout: Duration::MAX}
  }
}


pub struct Runtime {
  pub tokio: AsyncBridge,
  pub deno_runtime: JsRuntime
}

impl Runtime {
  pub fn new(option: RuntimeInitOptions) -> Result<Self, Error>{

    let tokio = AsyncBridge::new(Default::default())?;
    let runtime = JsRuntime::new(RuntimeOptions {
      extensions: get_all_extensions(),
      ..Default::default()
    });

    Ok(Self { tokio, deno_runtime: runtime })
  }

  pub fn call_module_function(
    &mut self, handle: &ModuleHandle, name: &str, args: &[v8::Local<v8::Value>]
  ) -> Result<v8::Global<v8::Value>, Error> {
    self.block_on(|runtime| async move {
      runtime.call_module_function_async(handle, name, args).await
    })
  }

  pub async fn call_module_function_async(
    &mut self, handle: &ModuleHandle, name: &str, args: &[v8::Local<'static, v8::Value>]
  ) -> Result<v8::Global<v8::Value>, Error> {
    let mut scope = self.deno_runtime.handle_scope();
    let function = handle.get_export_function_by_name(self, name)?;
    let result = self.call_function_by_ref(handle, &function, args)?;
    let result = self.resolve_with_event_loop(result).await?;
    Ok(result)
  }

  fn call_function_by_ref(
    &mut self,
    handle: &ModuleHandle,
    function: &v8::Global<v8::Function>,
    args: &[v8::Local<v8::Value>]
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
      None if scope.has_caught() =>{
        let e = scope.message().ok_or_else(|| Error::Runtime("Unknown error".to_string()))?;

        let filename = e.get_script_resource_name(&mut scope);
        let linenumber = e.get_line_number(&mut scope).unwrap_or_default();
        let filename = if let Some(v) = filename {
          let filename = v.to_rust_string_lossy(&mut scope);
          format!("{filename}:{linenumber}: ")
        } else  {
          let filename = handle.module().filename().to_string_lossy();
          format!("{filename}:{linenumber}: ")
        };

        let msg = e.get(&mut scope).to_rust_string_lossy(&mut scope);
        let s = format!("{filename}{msg}");
        Err(Error::Runtime(s))
      }
      None => Err(Error::Runtime(
        "Unknown error during function execution".to_string()
      ))
    }
  }

  pub fn attach_module(&mut self, module: &mut Module) -> Result<ModuleHandle, Error> {
    self.block_on(|runtime| async move {
      let handle = runtime.attach_module_async(module).await?;
      runtime.await_event_loop(PollEventLoopOptions::default(), None).await?;

      Ok(handle)
    })
  }

  pub async fn attach_module_async(&mut self, module: &mut Module) -> Result<ModuleHandle, Error> {
    let module_specifier = module.specifier();

    let module_id = self.deno_runtime.load_main_es_module_from_code(
      &module_specifier,
      FastString::from(module.contents().to_string()),
    ).await?;

    let mod_load = self.deno_runtime.mod_evaluate(module_id);

    self.with_event_loop_future(mod_load, PollEventLoopOptions::default())
      .await?;

    Ok(ModuleHandle::new(module.clone(), module_id))
  }

  async fn await_event_loop(
    &mut self,
    options: PollEventLoopOptions,
    timeout: Option<Duration>,
  ) -> Result<(), Error> {
    if let Some(timeout) = timeout {
      Ok(tokio::select! {
          r = self.deno_runtime.run_event_loop(options) => r,
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
    deno_core::error::AnyError: From<E>,
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
        println!("Event loop resolved");
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
    let result = self.deno_runtime
      .with_event_loop_future(future, PollEventLoopOptions::default())
      .await?;

    Ok(result)
  }

  // fn cast_value<T, T2>(&mut, self, value: v8::Local<T>) -> Result<T, Error> {
  //   // v8::Local::cast::<value>
  //
  // }

  // fn to_local_value<T>(&mut self, object: &mut v8::Global<T>) -> v8::Local<T> {
  //   let mut scope = self.deno_runtime.handle_scope();
  //   v8::Local::<T>::new(&mut scope, object)
  // }
}

impl AsyncBridgeExt for Runtime {
  fn bridge(&self) -> &AsyncBridge {
    &self.tokio
  }
}


fn get_all_extensions
// <
//   TInNpmPackageChecker: InNpmPackageChecker + 'static,
//   TNpmPackageFolderResolver: NpmPackageFolderResolver + 'static,
//   TExtNodeSys: ExtNodeSys + 'static,
// >
() -> Vec<deno_runtime::deno_core::Extension> {
  let blob_store: Arc<BlobStore> = Arc::new(BlobStore::default());
  let maybe_location: Option<Url> = None;

  // SEE: https://github.com/denoland/deno/blob/main/runtime/worker.rs#L391
  vec![
    deno_telemetry::deno_telemetry::init_ops_and_esm(),
    // Web APIs
    deno_webidl::deno_webidl::init_ops_and_esm(),
    deno_console::deno_console::init_ops_and_esm(),
    deno_url::deno_url::init_ops_and_esm(),
    deno_web::deno_web::init_ops_and_esm::<PermissionsContainer>(
      blob_store,
      maybe_location,
    ),
    deno_webgpu::deno_webgpu::init_ops_and_esm(),
    deno_canvas::deno_canvas::init_ops_and_esm(),
    deno_fetch::deno_fetch::init_ops_and_esm::<PermissionsContainer>(
      deno_fetch::Options {
        // user_agent: "UA".to_string(),
        // root_cert_store_provider: services.root_cert_store_provider.clone(),
        // unsafely_ignore_certificate_errors: options
        //   .unsafely_ignore_certificate_errors
        //   .clone(),
        // file_fetch_handler: Rc::new(deno_fetch::FsFetchHandler),
        // resolver: services.fetch_dns_resolver,
        ..Default::default()
      },
    ),
    // deno_cache::deno_cache::init_ops_and_esm(create_cache),
    // deno_websocket::deno_websocket::init_ops_and_esm::<PermissionsContainer>(
    //   options.bootstrap.user_agent.clone(),
    //   services.root_cert_store_provider.clone(),
    //   options.unsafely_ignore_certificate_errors.clone(),
    // ),
    deno_webstorage::deno_webstorage::init_ops_and_esm(
      // options.origin_storage_dir.clone(),
      None,
    ),
    // deno_crypto::deno_crypto::init_ops_and_esm(options.seed),
    // deno_broadcast_channel::deno_broadcast_channel::init_ops_and_esm(
    //   services.broadcast_channel.clone(),
    // ),
    deno_ffi::deno_ffi::init_ops_and_esm::<PermissionsContainer>(),
    // deno_net::deno_net::init_ops_and_esm::<PermissionsContainer>(
    //   services.root_cert_store_provider.clone(),
    //   options.unsafely_ignore_certificate_errors.clone(),
    // ),
    deno_tls::deno_tls::init_ops_and_esm(),
    // deno_kv::deno_kv::init_ops_and_esm(
    //   MultiBackendDbHandler::remote_or_sqlite::<PermissionsContainer>(
    //     options.origin_storage_dir.clone(),
    //     options.seed,
    //     deno_kv::remote::HttpOptions {
    //       user_agent: options.bootstrap.user_agent.clone(),
    //       root_cert_store_provider: services.root_cert_store_provider.clone(),
    //       unsafely_ignore_certificate_errors: options
    //         .unsafely_ignore_certificate_errors
    //         .clone(),
    //       client_cert_chain_and_key: TlsKeys::Null,
    //       proxy: None,
    //     },
    //   ),
    //   deno_kv::KvConfig::builder().build(),
    // ),
    // deno_cron::deno_cron::init_ops_and_esm(LocalCronHandler::new()),
    // deno_napi::deno_napi::init_ops_and_esm::<PermissionsContainer>(),
    deno_http::deno_http::init_ops_and_esm::<DefaultHttpPropertyExtractor>(
      deno_http::Options::default(),
    ),
    // deno_io::deno_io::init_ops_and_esm(Some(options.stdio)),
    deno_fs::deno_fs::init_ops_and_esm::<PermissionsContainer>(
      MaybeArc::new(deno_fs::RealFs::default()),
    ),
    deno_os::deno_os::init_ops_and_esm(
      deno_os::ExitCode::default()
    ),
    // deno_process::deno_process::init_ops_and_esm(
    //   deno_lib::npm::create_npm_process_state_provider(
    //     deno_resolver::npm::NpmResolver::Managed(
    //       ManagedNpmResolver::new({})
    //     )
    //   ),
    // ),
    // deno_node::deno_node::init_ops_and_esm::<
    //   PermissionsContainer,
    //   TInNpmPackageChecker,
    //   TNpmPackageFolderResolver,
    //   TExtNodeSys,
    // >(services.node_services, services.fs),
    // Ops from this crate
    deno_runtime::ops::runtime::deno_runtime::init_ops_and_esm(ModuleSpecifier::parse("ai-deno://main_module.ts").unwrap().clone()),
    // deno_runtime::ops::worker_host::deno_worker_host::init_ops_and_esm(
    //   options.create_web_worker_cb.clone(),
    //   options.format_js_error_fn.clone(),
    // ),
    deno_runtime::ops::fs_events::deno_fs_events::init_ops_and_esm(),
    deno_runtime::ops::permissions::deno_permissions::init_ops_and_esm(),
    deno_runtime::ops::tty::deno_tty::init_ops_and_esm(),
    deno_runtime::ops::http::deno_http_runtime::init_ops_and_esm(),
    deno_runtime::ops::bootstrap::deno_bootstrap::init_ops_and_esm(
      None
      // if options.startup_snapshot.is_some() {
      //   None
      // } else {
      //   Some(Default::default())
      // },
    ),
    // deno_permissions_worker::init_ops_and_esm(
    //   services.permissions,
    //   enable_testing_features,
    // ),
    runtime::init_ops_and_esm(),
    // NOTE(bartlomieju): this is done, just so that ops from this extension
    // are available and importing them in `99_main.js` doesn't cause an
    // error because they're not defined. Trying to use these ops in non-worker
    // context will cause a panic.
    deno_runtime::ops::web_worker::deno_web_worker::init_ops_and_esm().disable(),
  ]
}