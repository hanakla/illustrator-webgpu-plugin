use std::path::PathBuf;

use deno_resolver::npm::ByonmNpmResolver;
use deno_semver::package::PackageReq;
use node_resolver::{
    errors::{PackageFolderResolveErrorKind, PackageNotFoundError},
    NpmPackageFolderResolver, UrlOrPathRef,
};
use sys_traits::impls::RealSys;

#[derive(Clone)]
pub struct AiDenoNpmPackageFolderResolver {
    pub byonm: ByonmNpmResolver<RealSys>,
}

impl NpmPackageFolderResolver for AiDenoNpmPackageFolderResolver {
    fn resolve_package_folder_from_package(
        &self,
        specifier: &str,
        referrer: &UrlOrPathRef,
    ) -> Result<PathBuf, node_resolver::errors::PackageFolderResolveError> {
        println!(
            "[ai_deno(rust)] resolve_package_folder_from_package: specifier: {}, referrer: {}",
            specifier,
            referrer.display()
        );
        let request = PackageReq::from_str(specifier).map_err(|_| {
            let e = Box::new(PackageFolderResolveErrorKind::PackageNotFound(
                PackageNotFoundError {
                    package_name: specifier.to_string(),
                    referrer: referrer.display(),
                    referrer_extra: None,
                },
            ));
            node_resolver::errors::PackageFolderResolveError(e)
        })?;

        let p = self
            .byonm
            .resolve_pkg_folder_from_deno_module_req(&request, referrer.url().unwrap());
        match p {
            Ok(p) => Ok(p),
            Err(_) => self
                .byonm
                .resolve_package_folder_from_package(specifier, referrer),
        }
    }
}
