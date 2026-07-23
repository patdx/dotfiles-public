# @patdx/pkg

CLI for installing binary packages on Linux/macOS from URLs or a declarative
JSON catalog (default remote: `https://repo.pmil.me`).

The published binary name is **`ppkg`** (JSR package remains `@patdx/pkg`).

## Install

```sh
deno install -g -A -n ppkg jsr:@patdx/pkg
# or: deno run -A jsr:@patdx/pkg self-install
```

Ensure `~/.deno/bin` is on your `PATH`. Update later with `ppkg self-update`
(same as force-reinstall from JSR).

Set `PATDX_PKG_NO_UPDATE_CHECK=1` to disable the optional startup notice when a
newer JSR version is available.

## Usage

```sh
ppkg add windsurf
ppkg list
ppkg remove duckdb
ppkg repo list
ppkg repo update
```

One-liner without a global install:

```sh
deno run -A --reload jsr:@patdx/pkg add windsurf
```

## Catalog

Catalog layout (static files at site root):

- `https://repo.pmil.me/repo.json` — package listing
- `https://repo.pmil.me/package/<name>.json` — package manifest
- `https://repo.pmil.me/package.schema.json` /
  `repo.schema.json` — JSON Schema

HTML browse pages: `/` and `/package/<name>` (shared `/site.css`, `/site.js`).
In this monorepo, run `deno task gen-site` after editing `repo/package/*.json`.
