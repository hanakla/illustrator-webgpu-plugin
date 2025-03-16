use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

#[repr(C)]
pub struct SafeString {
    inner: CString,
}

impl SafeString {
    pub fn new(s: &str) -> Result<Self, std::ffi::NulError> {
        let cstring = CString::new(s)?;
        Ok(SafeString { inner: cstring })
    }

    pub unsafe fn from_ptr(ptr: *const c_char) -> Option<Self> {
        if ptr.is_null() {
            return None;
        }

        match CStr::from_ptr(ptr).to_owned() {
            inner => Some(SafeString { inner }),
        }
    }

    pub fn as_ptr(self) -> *const SafeString {
        Box::into_raw(Box::new(self))
    }

    pub fn to_string(&self) -> String {
        self.inner.to_string_lossy().into_owned()
    }
}

impl From<SafeString> for String {
    fn from(safe_str: SafeString) -> Self {
        safe_str.to_string()
    }
}

impl From<String> for SafeString {
    fn from(s: String) -> Self {
        SafeString::new(&s).unwrap()
    }
}

#[no_mangle]
pub unsafe extern "C" fn create_safe_string(c_str: *const c_char, len: usize) -> *mut SafeString {
    if c_str.is_null() {
        return ptr::null_mut();
    }

    let slice = std::slice::from_raw_parts(c_str as *const u8, len);
    match std::str::from_utf8(slice) {
        Ok(s) => match SafeString::new(s) {
            Ok(safe_str) => Box::into_raw(Box::new(safe_str)),
            Err(_) => ptr::null_mut(),
        },
        Err(_) => ptr::null_mut(),
    }
}

// #[no_mangle]
// pub extern "C" fn create_safe_string_from_str(s: &str) -> *mut SafeString {
//     match SafeString::new(s) {
//         Ok(safe_str) => Box::into_raw(Box::new(safe_str)),
//         Err(_) => ptr::null_mut(),
//     }
// }

// #[no_mangle]
// pub unsafe extern "C" fn safe_string_as_ptr(safe_str: *const SafeString) -> *const c_char {
//     if safe_str.is_null() {
//         return ptr::null();
//     }

//     (*safe_str).as_ptr()
// }

#[no_mangle]
pub unsafe extern "C" fn free_safe_string(safe_str: *mut SafeString) {
    if !safe_str.is_null() {
        drop(Box::from_raw(safe_str));
    }
}
