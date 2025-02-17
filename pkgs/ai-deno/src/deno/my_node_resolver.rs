// use std::rc::Rc;
// use deno_resolver::factory::{ResolverFactory, ResolverFactoryOptions};
// use deno_resolver::npm::{ByonmInNpmPackageChecker, ByonmNpmResolver, ByonmNpmResolverCreateOptions, CreateInNpmPkgCheckerOptions, DenoInNpmPackageChecker, ManagedNpmResolver, NpmResolver};
// use deno_resolver::npm::managed::{create_managed_in_npm_pkg_checker, ManagedInNpmPkgCheckerCreateOptions, ManagedNpmResolverCreateOptions};
// use deno_runtime::deno_core::url::Url;
// use deno_runtime::deno_fs;
// use deno_runtime::deno_fs::sync::MaybeArc;
// use deno_runtime::deno_node::NodeResolver;
// use deno_runtime::deno_webgpu::wgpu_core::naga::SwitchValue::Default;
// use node_resolver::{DenoIsBuiltInNodeModuleChecker, NpmPackageFolderResolver, PackageJsonResolver};
// use homedir::my_home;
// use sys_traits::impls::RealSys;
//
// pub type CliSys = sys_traits::impls::RealSys;
//
// pub struct MyNodeResolver {}
// impl MyNodeResolver {
//   pub fn create() -> NodeResolver<
//     DenoInNpmPackageChecker,
//     dyn NpmPackageFolderResolver,
//     CliSys
//   > {
//     let cachedir = match my_home() {
//       Ok(homedir) => homedir.unwrap().join(".ai-deno-cache"),,
//       Err(e) => {
//         panic!("ai-deno: Failed to get home directory: {}", e.to_string());
//       }
//     };
//     let root_node_modules_dir = cachedir.join("node_modules");
//
//     let fs = CliSys::default();
//
//     let in_npm_package_checker = DenoInNpmPackageChecker::new(
//       CreateInNpmPkgCheckerOptions::Managed(ManagedInNpmPkgCheckerCreateOptions{
//         root_cache_dir_url: &Url::from_directory_path(cachedir.as_path().unwrap()).or_else(|e| {
//           Err(format!("ai-deno: Failed to create cache directory"))
//         }).unwrap(),
//         maybe_node_modules_path: None,
//       })
//     );
//
//
//
//     let pjson_resolver =
//       deno_fs::sync::MaybeArc::new(PackageJsonResolver::new(fs.clone(), None));
//
//     let byonm = NpmResolver::Byonm(
//       MaybeArc::new(ByonmNpmResolver::new(ByonmNpmResolverCreateOptions {
//         root_node_modules_dir: root_node_modules_dir.clone(),
//         pkg_json_resolver: pjson_resolver.clone(),
//         sys: fs.clone(),
//       }))
//     );
//
//     // let byonm =NpmResolver::Byonm(
//     //   MaybeArc::new(ManagedNpmResolver::new(ManagedNpmResolverCreateOptions {
//     //     maybe_node_modules_path: None,
//     //     npm_cache_dir: cachedir,
//     //     npm_resolution:  NpmResol
//     //     // root_node_modules_dir: root_node_modules_dir.clone(),
//     //     // pkg_json_resolver: pjson_resolver.clone(),
//     //     sys: fs.clone(),
//     //   }))
//     // );
//
//
//       NodeResolver::new(
//         DenoInNpmPackageChecker::new(CreateInNpmPkgCheckerOptions::Byonm),
//         DenoIsBuiltInNodeModuleChecker {},
//         byonm.clone(),
//         pjson_resolver.clone(),
//         fs.clone(),
//         node_resolver::ConditionsFromResolutionMode::default()
//       )
//
//
//     // NodeResolver::new(
//     //   in_npm_package_checker,
//     //   DenoIsBuiltInNodeModuleChecker{},
//     //   ManagedNpmResolver
//     //   Rc::new(pjson_resolver),
//     //   fs.clone(),
//     //   None,
//     // )
//   }
// }
