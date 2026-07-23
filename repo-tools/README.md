# Package catalog tooling

Deploy config and docs for the declarative JSON catalog in [`../repo/`](../repo/).

Catalog JSON is published under the `/api/` prefix so the site root can host a
future HTML site:

- `../repo/api/repo.json` — package listing → `https://repo.pmil.me/api/repo.json`
- `../repo/api/pkg/<name>.json` — per-package install metadata (snake_case)
- `../repo/api/schema/v1/pkg.json` — package-entry JSON Schema (named `pkg.json`
  so tools do not treat it as an npm manifest)
- `../repo/api/schema/v1/repo.json` — listing JSON Schema

Published as Cloudflare Workers static assets (see `wrangler.json`, assets
directory `../repo`) at `https://repo.pmil.me` via a Custom Domain route
(`routes` + `custom_domain: true`). The `pmil.me` zone must already be on
Cloudflare; deploy creates/updates the DNS record and certificate.

## Deploy (Deno only)

Follows the [Deno Wrangler tutorial](https://docs.deno.com/examples/cloudflare_workers_wrangler_tutorial/)
pattern (`deno add npm:wrangler`, no `package.json` / `node_modules`):

```sh
cd repo-tools
deno task deploy:dry   # validate without uploading
deno task deploy       # deploy to Cloudflare
deno task dev          # local preview
```

`../repo/` must stay static assets only — never put executable code or deploy
config there. Keep catalog edits under `../repo/api/`.
