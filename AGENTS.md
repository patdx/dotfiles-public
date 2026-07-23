# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a dotfiles repository containing three main JSR packages for Linux
development environments:

- `@patdx/pkg` - CLI tool for installing and managing binary packages on Linux
- `@patdx/update` - Script for performing system updates and package management
- `@patdx/git-json-merge` - Git merge driver for automatically resolving JSON
  file conflicts

## Architecture

The repository is structured as a Deno workspace with members at the repo root:

- `pkg/` - Binary package manager (`@patdx/pkg`) with multi-source JSON catalog
  resolver
- `update/` - System update utility (`@patdx/update`)
- `git-json-merge/` - JSON merge driver for Git (`@patdx/git-json-merge`)
- `dotfiles/` - Deprecated; prefer `@patdx/update` and `@patdx/pkg`
- `repo-tools/` - Workspace member (not published); Deno + Wrangler deploy
  config for the catalog (assets from `../repo`)
- `repo/` - Static assets root for `repo.pmil.me` (data only, not a workspace
  member). Catalog JSON is under `api/` so the site root stays free for a
  future HTML site: listing `api/repo.json`, packages `api/pkg/`, schemas
  `api/schema/v1/` (`pkg.json`, `repo.json`)

Each JSR package is a self-contained module with its own `deno.json`
configuration. Deploy tooling lives in `repo-tools/` so it is not published
with the JSON.

## Common Commands

### Development

```bash
# Run tests for all packages
deno task test-all

# Check dependencies for all packages
deno task check-deps-all

# Update lockfile
deno task update-lockfile

# Test publishing (dry run)
deno task test-publish

# Regenerate catalog JSON Schema from Valibot
deno task gen-schema

# Check markdown links
deno task link-check
```

### Package-specific commands

```bash
# pkg package
cd pkg
deno task cli [command]
deno task test

# update package
cd update
deno task start
deno task test

# git-json-merge package
cd git-json-merge
deno task test
deno task test:e2e
```

### Running the tools directly

```bash
# Install a package with pkg
deno run -A --reload jsr:@patdx/pkg add windsurf

# Run system update
deno run -A --reload jsr:@patdx/update

# Use git-json-merge
deno run --allow-read --allow-write jsr:@patdx/git-json-merge %A %O %B
```

## Code Style

- Uses single quotes and no semicolons (configured in root `deno.json`)
- 2-space indentation for most files, 4-space for Markdown
- Follows Deno conventions and JSR publishing standards

## Package Management

Known packages live as JSON under `repo/api/` (`repo.json` listing +
`pkg/<name>.json`; schemas at `schema/v1/pkg.json` and
`schema/v1/repo.json`). Live URLs are under `https://repo.pmil.me/api/...`.
The CLI resolves them from builtin/local/remote sources and only executes
named URL providers shipped in `@patdx/pkg`. Deploy with Deno from
`repo-tools/` (`deno task deploy`).

## Platform Support

- Primary: Fedora Linux
- Secondary: Other Linux distributions and macOS
- Windows: Not supported
