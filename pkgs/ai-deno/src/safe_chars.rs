use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::ptr;

#[repr(C)]
pub struct SafeString {
    data: *const c_char,
    len: usize,
}

impl From<&str> for SafeString {
    fn from(s: &str) -> Self {
        let cstring = CString::new(s).unwrap_or_default();
        let len = cstring.as_bytes().len();

        let boxed_data = Box::new(cstring);
        let data_ptr = Box::into_raw(boxed_data) as *const c_char;

        SafeString {
            data: data_ptr,
            len,
        }
    }
}

impl From<String> for SafeString {
    fn from(s: String) -> Self {
        Self::from(s.as_str())
    }
}

impl From<&SafeString> for Option<String> {
    fn from(safe_string: &SafeString) -> Self {
        safe_string.to_string()
    }
}

impl Drop for SafeString {
    fn drop(&mut self) {
        if !self.data.is_null() {
            unsafe {
                let _ = Box::from_raw(self.data as *mut CString);
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn create_safe_string(c_str: *const c_char, size: usize) -> *mut SafeString {
    if c_str.is_null() {
        return ptr::null_mut();
    }

    let safe_string = SafeString::build(c_str);

    Box::into_raw(Box::new(safe_string))
}

#[no_mangle]
pub extern "C" fn free_safe_string(this: *mut SafeString) {
    if !this.is_null() {
        unsafe {
            let _ = Box::from_raw(this);
        }
    }
}

impl SafeString {
    fn build(c_str: *const c_char) -> Self {
        let rust_cstr = unsafe { CStr::from_ptr(c_str) };

        let owned_cstring = CString::new(rust_cstr.to_bytes()).unwrap();
        //  {
        //     Ok(s) => s,
        //     Err(_) => return ptr::null_mut(),
        // };

        let len = owned_cstring.as_bytes().len();

        let boxed_data = Box::new(owned_cstring);
        let data_ptr = Box::into_raw(boxed_data) as *const c_char;

        SafeString {
            data: data_ptr,
            len,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        if self.data.is_null() {
            return None;
        }

        let cstring = unsafe { &*(self.data as *const CString) };
        std::str::from_utf8(cstring.as_bytes()).ok()
    }

    pub fn as_ptr(&self) -> *const SafeString {
        self
    }

    pub fn to_string(&self) -> Option<String> {
        self.as_str().map(String::from)
    }
}
