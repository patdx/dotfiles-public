# @patdx/pkg

CLI for installing binary packages on Linux/macOS from URLs or a declarative
JSON catalog (default remote: `https://repo.pmil.me`).

The published binary name is **`ppkg`** (JSR package remains `@patdx/pkg`).

## Install

Pin a published version (see [JSR](https://jsr.io/@patdx/pkg) for the latest):

```sh
deno install -g -A -n ppkg jsr:@patdx/pkg@0.7.1
# or: deno run -A jsr:@patdx/pkg@0.7.1 self-install
```

If Deno rejects the version because it is newer than the
[minimum dependency age](https://docs.deno.com/go/minimum-dependency-age)
(default 24 hours), retry with `--min-dep-age=0`:

```sh
deno install -g -A -n ppkg --min-dep-age=0 jsr:@patdx/pkg@0.7.1
```

Ensure `~/.deno/bin` is on your `PATH`. Update later with `ppkg self-update`
(same as force-reinstall from JSR).

Set `PPKG_NO_UPDATE_CHECK=1` to disable the optional startup notice when a
newer JSR version is available.

## Data layout

- `~/.ppkg/` — installed package versions, `config.json`, and cache
- `~/.local/bin/` — symlinks to the active binaries

Override catalog sources with `PPKG_REPOS` (comma-separated base URLs/paths).

## Usage

```sh
ppkg add windsurf
ppkg list
ppkg outdated
ppkg update
ppkg update caddy
ppkg remove duckdb
ppkg repo list
ppkg repo update
```

`ppkg outdated` checks installed catalog packages against provider-latest
versions (exit code `1` if any are outdated). `ppkg update` upgrades outdated
catalog packages, or only the named ones when given. Packages installed from a
raw URL (not in the catalog) are skipped for now.

One-liner without a global install:

```sh
deno run -A --reload jsr:@patdx/pkg@0.7.1 add windsurf
```

## Catalog

Catalog layout (static files at site root):

- `https://repo.pmil.me/repo.json` — package listing
- `https://repo.pmil.me/package/<name>.json` — package manifest
- `https://repo.pmil.me/package.schema.json` /
  `repo.schema.json` — JSON Schema

HTML browse pages: `/` and `/package/<name>` (shared `/site.css`, `/site.js`).
In this monorepo, run `deno task gen-site` after editing `repo/package/*.json`.
