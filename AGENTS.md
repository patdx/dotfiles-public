# Repository guidance

## Project overview

Dotfiles and Deno utilities for Linux/macOS development environments:

- `update/` — system and development-tool updates (`@patdx/update`).
- `git-json-merge/` — JSON/JSONC merge driver (`@patdx/git-json-merge`).
- `dotfiles/` — deprecated workspace member (`@patdx/dotfiles`).

Each package has its own `deno.json`. Shared workspace configuration and
formatting live in the root `deno.json`.

## Commands

```sh
deno task test-all
deno task check-deps-all
deno task update-lockfile
deno task test-publish
deno task link-check
```

Package-specific commands:

```sh
cd update
deno task start
deno task test

cd ../git-json-merge
deno task test
deno task test:e2e
```

Run published tools directly:

```sh
deno run -A --reload jsr:@patdx/update
deno run --allow-read --allow-write jsr:@patdx/git-json-merge %A %O %B
```

## Code style

- Single quotes, no semicolons, and two-space indentation in code.
- Four-space indentation for Markdown.
- Follow Deno conventions and JSR publishing standards.

## Platform support

Fedora Linux is primary; other Linux distributions and macOS are secondary.
Windows is not supported.
