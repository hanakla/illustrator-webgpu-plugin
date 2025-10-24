use deno_runtime::deno_core::v8;
use deno_runtime::deno_core::v8::HandleScope;
use crate::deno::error::Error;
use std::pin::Pin;

pub trait ToV8String {
  fn to_v8_string<'a>(
    &self,
    scope: &'a mut HandleScope<'a>,
  ) -> Result<v8::Local<'a, v8::String>, Error>;
}

impl ToV8String for str {
  fn to_v8_string<'a>(
    &self,
    scope: &'a mut HandleScope<'a>,
  ) -> Result<v8::Local<'a, v8::String>, Error> {
    let pinned = unsafe { Pin::new_unchecked(scope) };
    let pinned_ref = v8::PinnedRef::from(pinned);
    v8::String::new(&pinned_ref, self).ok_or(Error::V8Encoding(self.to_string()))
  }
}

pub trait ToDefinedValue<T> {
  fn if_defined(&self) -> Option<T>;
}

impl<'a> ToDefinedValue<v8::Local<'a, v8::Value>> for Option<v8::Local<'a, v8::Value>> {
  fn if_defined(&self) -> Option<v8::Local<'a, v8::Value>> {
    self.filter(|v| !v.is_undefined())
  }
}
