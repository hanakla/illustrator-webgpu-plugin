// // Copyright 2018-2025 the Deno authors. MIT license.
//
// use std::borrow::Cow;
// use std::path::Path;
// use deno_error::JsErrorBox;
//
// #[derive(Debug)]
// struct CliNodeRequireLoader<TGraphContainer: ModuleGraphContainer> {
//   cjs_tracker: Arc<CliCjsTracker>,
//   emitter: Arc<Emitter>,
//   sys: CliSys,
//   graph_container: TGraphContainer,
//   in_npm_pkg_checker: DenoInNpmPackageChecker,
//   npm_registry_permission_checker:
//     Arc<NpmRegistryReadPermissionChecker<CliSys>>,
// }
//
// impl<TGraphContainer: ModuleGraphContainer> NodeRequireLoader
// for CliNodeRequireLoader<TGraphContainer>
// {
//   fn ensure_read_permission<'a>(
//     &self,
//     permissions: &mut dyn deno_runtime::deno_node::NodePermissions,
//     path: &'a Path,
//   ) -> Result<Cow<'a, Path>, JsErrorBox> {
//     if let Ok(url) = deno_path_util::url_from_file_path(path) {
//       // allow reading if it's in the module graph
//       if self.graph_container.graph().get(&url).is_some() {
//         return Ok(Cow::Borrowed(path));
//       }
//     }
//     self
//       .npm_registry_permission_checker
//       .ensure_read_permission(permissions, path)
//       .map_err(JsErrorBox::from_err)
//   }
//
//   fn load_text_file_lossy(
//     &self,
//     path: &Path,
//   ) -> Result<Cow<'static, str>, JsErrorBox> {
//     // todo(dsherret): use the preloaded module from the graph if available?
//     let media_type = MediaType::from_path(path);
//     let text = self
//       .sys
//       .fs_read_to_string_lossy(path)
//       .map_err(JsErrorBox::from_err)?;
//     if media_type.is_emittable() {
//       let specifier = deno_path_util::url_from_file_path(path)
//         .map_err(JsErrorBox::from_err)?;
//       if self.in_npm_pkg_checker.in_npm_package(&specifier) {
//         return Err(JsErrorBox::from_err(StrippingTypesNodeModulesError {
//           specifier,
//         }));
//       }
//       self
//         .emitter
//         .emit_parsed_source_sync(
//           &specifier,
//           media_type,
//           // this is probably not super accurate due to require esm, but probably ok.
//           // If we find this causes a lot of churn in the emit cache then we should
//           // investigate how we can make this better
//           ModuleKind::Cjs,
//           &text.into(),
//         )
//         .map(Cow::Owned)
//         .map_err(JsErrorBox::from_err)
//     } else {
//       Ok(text)
//     }
//   }
//
//   fn is_maybe_cjs(
//     &self,
//     specifier: &ModuleSpecifier,
//   ) -> Result<bool, ClosestPkgJsonError> {
//     let media_type = MediaType::from_specifier(specifier);
//     self.cjs_tracker.is_maybe_cjs(specifier, media_type)
//   }
// }
