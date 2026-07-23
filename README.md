# dotfiles

This repository contains my preferred settings for new development environments
and some tools to help set them up.

## Table of Contents

- [dotfiles](#dotfiles)
  - [Table of Contents](#table-of-contents)
  - [JSR Packages](#jsr-packages)
    - [Platform Support](#platform-support)
    - [@patdx/pkg](#patdxpkg)
      - [Usage](#usage)
    - [@patdx/update](#patdxupdate)
      - [Usage](#usage-1)
    - [@patdx/git-json-merge](#patdxjson-merge)
      - [Usage](#usage-2)
  - [System](#system)
    - [git](#git)
    - [Software to Install](#software-to-install)
      - [Install Git Credential Manager on Linux](#install-git-credential-manager-on-linux)
      - [Installing Binaries on Linux](#installing-binaries-on-linux)
      - [Doing updates on Linux](#doing-updates-on-linux)
    - [Python](#python)
  - [Software Projects](#software-projects)
    - [.editorconfig](#editorconfig)

## JSR Packages

| Package                                                       | Description                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [@patdx/pkg](https://jsr.io/@patdx/pkg)                       | CLI tool for installing and managing binary packages on Linux          |
| [@patdx/update](https://jsr.io/@patdx/update)                 | Script for performing system updates and managing installed packages   |
| [@patdx/git-json-merge](https://jsr.io/@patdx/git-json-merge) | Git merge driver for automatically resolving JSON/JSONC file conflicts |

### Platform Support

- ✅ Fedora Linux (primary supported/tested platform)
- ✅ Other Linux distributions (should work)
- ✅ macOS (mostly supported/tested)
- ❌ Windows (not supported but would be open to adding support)

### @patdx/pkg

A CLI tool for easily installing and managing binary packages on Linux. It
simplifies the process of:

- Installing zipped binaries to `~/.local/bin`
- Resolving known packages from JSON catalogs (default: `https://repo.pmil.me`)
- Handling GitHub release assets and named URL providers automatically

The package catalog lives in this repo under [`repo/`](./repo/)
(`repo.json` + `package/<name>.json`, schemas at `package.schema.json`
and `repo.schema.json`) and is published at `https://repo.pmil.me/...`
via [`repo-tools/`](./repo-tools/) (Deno + Wrangler). Generated HTML pages live
at `/` and `/package/<name>` (`deno task gen-site`), sharing `/site.css` and
`/site.js`.

#### Usage

Install the CLI once as `ppkg` (requires Deno; ensure `~/.deno/bin` is on
`PATH`):

```sh
deno install -g -A -n ppkg jsr:@patdx/pkg
# or: deno run -A jsr:@patdx/pkg self-install
```

Then:

```sh
# Install a known package
ppkg add windsurf

# Install from a specific URL
ppkg add --url https://github.com/duckdb/duckdb --name duckdb

# List installed packages
ppkg list

# Manage remotes
ppkg repo list
ppkg repo update

# Remove a package
ppkg remove duckdb

# Update the CLI itself
ppkg self-update
```

One-liner alternative without a global install:

```sh
deno run -A --reload jsr:@patdx/pkg add windsurf
```

### @patdx/update

A script for performing system updates on Linux that:

- Runs system updates
- Manages installed packages
- Updates Git Credential Manager automatically

#### Usage

```sh
# Use latest version (recommended)
deno run -A --reload jsr:@patdx/update
```

### @patdx/git-json-merge

A Git merge driver that automatically resolves merge conflicts in JSON files. It
detects indentation automatically and performs three-way merges, making it
easier to handle JSON file conflicts in Git.

#### Usage

First, install via JSR:

```sh
deno add jsr:@patdx/git-json-merge
```

Configure Git globally by adding to `~/.gitconfig`:

```ini
[core]
    attributesfile = ~/.gitattributes
[merge "json"]
    name = custom merge driver for json files
    driver = deno run --allow-read --allow-write jsr:@patdx/git-json-merge %A %O %B
```

Create `~/.gitattributes`:

```ini
*.json merge=json
```

Or for a single project, configure locally:

```sh
git config merge.json.driver "deno run --allow-read --allow-write jsr:@patdx/git-json-merge %A %O %B"
git config merge.json.name "custom merge driver for json files"
```

And add the same `.gitattributes` to your project.

## System

### git

For git I don't have a config file, I just run the following script to update
the global config.

```sh
git config --global init.defaultBranch main
git config --global pull.ff only
git config --global rebase.autoStash true
git config --global core.editor "code --wait"
git config --global --type bool push.autoSetupRemote true
```

### Software to Install

- git
- git-lfs
- VS Code
- [Git Credential Manager](https://github.com/git-ecosystem/git-credential-manager)
  (See next section)

#### Install Git Credential Manager on Linux

While Git Credential Manager does provide a .deb, they sadly don't provide a
.rpm for Fedora users.

I've prepared a simple script to install it on Linux using
[@patdx/pkg](#patdxpkg). Install Deno, then install the CLI (or use the
one-liner):

```sh
deno install -g -A -n ppkg jsr:@patdx/pkg
ppkg add git-credential-manager
# or: deno run -A jsr:@patdx/pkg add git-credential-manager
```

After installation, you may want to configure it to use the freedesktop.org
Secret Service API:

```sh
git config --global credential.credentialStore secretservice
```

#### Installing Binaries on Linux

It can be inconvenient when tools just provide a zipped binary and ask you to
install it. The [@patdx/pkg](#patdxpkg) CLI tool makes this process much easier
by automatically downloading and installing binaries to `~/.local/bin`. See the
[@patdx/pkg documentation](#patdxpkg) above for more usage examples.

#### Doing updates on Linux

The [@patdx/update](#patdxupdate) package provides a script to perform system
updates on Linux, including upgrading your git-credential-manager version. See
the [@patdx/update documentation](#patdxupdate) above for usage instructions.

### Python

~~As I don't use python so much, I think it's nice to use pipx:~~

~~https://pipx.pypa.io/stable/~~

Update: I tried pipx and then I could not install extension
`aider-chat[browser]`. It did not make anything easier.

In order to intall python tool such as aider:

https://aider.chat/docs/install/pipx.html

## Software Projects

### .editorconfig

While I do like indent of 2 spaces, it makes it a pain to do nested lists in
Markdown together with Prettier. Therefore I prefer 4 spaces for Markdown.

```editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
indent_size = 4
```
