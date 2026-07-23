# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dotfiles repository containing three main JSR packages for Linux development environments:

- `@patdx/pkg` - CLI tool for installing and managing binary packages on Linux
- `@patdx/update` - Script for performing system updates and package management
- `@patdx/git-json-merge` - Git merge driver for automatically resolving JSON file conflicts

## Architecture

The repository is structured as a Deno workspace with four packages in the `packages/` directory:

- `packages/pkg/` - Binary package manager with extensible repository system
- `packages/update/` - System update utility 
- `packages/git-json-merge/` - JSON merge driver for Git
- `packages/dotfiles/` - Configuration and setup utilities

Each package is a self-contained JSR module with its own `deno.json` configuration.

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

# Check markdown links
deno task link-check
```

### Package-specific commands
```bash
# pkg package
cd packages/pkg
deno task cli [command]
deno task test

# update package  
cd packages/update
deno task start
deno task test

# git-json-merge package
cd packages/git-json-merge
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

The `pkg` package maintains a repository of known packages in `packages/pkg/repo/` with TypeScript modules defining installation metadata for each supported binary.

## Platform Support

- Primary: Fedora Linux
- Secondary: Other Linux distributions and macOS
- Windows: Not supported