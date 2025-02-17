use std::any::Any;
use std::borrow::Cow;
use std::sync::Arc;
use deno_error::JsErrorClass;
use deno_core::{anyhow, extension, op2};
use deno_core::error::JsError;
use deno_runtime::ops::worker_host::{CreateWebWorkerCb, WorkersTable};
use deno_runtime::worker::FormatJsErrorFn;
// use deno_runtime::{deno_core::{serde}};

#[derive(Clone)]
struct CreateWebWorkerCbHolder(Arc<CreateWebWorkerCb>);

#[derive(Clone)]
struct FormatJsErrorFnHolder(Option<Arc<FormatJsErrorFn>>);

extension!(
  deno_worker_host,
  ops = [
    op_create_worker,
    op_host_post_message,
    op_host_recv_ctrl,
    op_host_recv_message,
    op_host_terminate_worker,
  ],
  options = {
    // create_web_worker_cb: Arc<CreateWebWorkerCb>,
    // format_js_error_fn: Option<Arc<FormatJsErrorFn>>,
  },
  state = |state, options| {
    state.put::<WorkersTable>(WorkersTable::default());

    state.put::<CreateWebWorkerCbHolder>(CreateWebWorkerCbHolder(Arc::new(|_| { unimplemented!("web workers are not supported") })));
    state.put::<FormatJsErrorFnHolder>(FormatJsErrorFnHolder(Some(Arc::new(deno_runtime::fmt_errors::format_js_error.clone()))));
  }
);




#[op2(stack_trace)]
#[serde]
fn op_create_worker() -> Result<(), deno_runtime::ops::worker_host::CreateWorkerError> { Ok(()) }

#[op2(stack_trace)]
#[serde]
fn op_host_post_message() -> Result<(), deno_runtime::ops::worker_host::CreateWorkerError> { Ok(()) }

#[op2(stack_trace)]
#[serde]
fn op_host_recv_ctrl() -> Result<(), deno_runtime::ops::worker_host::CreateWorkerError> { Ok(()) }

#[op2(stack_trace)]
#[serde]
fn op_host_recv_message() -> Result<(), deno_runtime::ops::worker_host::CreateWorkerError> { Ok(()) }

#[op2(stack_trace)]
#[serde]
fn op_host_terminate_worker() -> Result<(), deno_runtime::ops::worker_host::CreateWorkerError> { Ok(()) }
