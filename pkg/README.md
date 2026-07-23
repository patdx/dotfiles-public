# @patdx/pkg

CLI for installing binary packages on Linux/macOS from URLs or a declarative
JSON catalog (default remote: `https://repo.pmil.me`).

Catalog layout (static files at site root):

- `https://repo.pmil.me/repo.json` — package listing
- `https://repo.pmil.me/package/<name>.json` — package manifest
- `https://repo.pmil.me/package.schema.json` /
  `repo.schema.json` — JSON Schema

HTML browse pages: `/` and `/package/<name>` (shared `/site.css`, `/site.js`).
In this monorepo, run `deno task gen-site` after editing `repo/package/*.json`.
