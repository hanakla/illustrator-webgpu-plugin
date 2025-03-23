set dotenv-load

docs:
  npx serve sdk/docs/references/sdkdocs/html

build ZXP_PATH:
  deno run --env -A ./scripts/package_zxp.ts {{ZXP_PATH}}
