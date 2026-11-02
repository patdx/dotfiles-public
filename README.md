# dotfiles

This repository contains my preferred settings for new development environments
and some tools to help set them up.

## Table of Contents

- [dotfiles](#dotfiles)
  - [Table of Contents](#table-of-contents)
  - [JSR Packages](#jsr-packages)
    - [Platform Support](#platform-support)
    - [@patdx/update](#patdxupdate)
      - [Usage](#usage)
    - [@patdx/git-json-merge](#patdxgit-json-merge)
      - [Usage](#usage-1)
  - [System](#system)
    - [git](#git)
    - [Software to Install](#software-to-install)
      - [Doing updates on Linux](#doing-updates-on-linux)
    - [Python](#python)
  - [Software Projects](#software-projects)
    - [.editorconfig](#editorconfig)

## JSR Packages

| Package                                                       | Description                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [@patdx/update](https://jsr.io/@patdx/update)                 | Script for performing system updates and managing installed packages   |
| [@patdx/git-json-merge](https://jsr.io/@patdx/git-json-merge) | Git merge driver for automatically resolving JSON/JSONC file conflicts |

### Platform Support

- ✅ Fedora Linux (primary supported/tested platform)
- ✅ Other Linux distributions (should work)
- ✅ macOS (mostly supported/tested)
- ❌ Windows (not supported but would be open to adding support)

### @patdx/update

A script for performing system updates on Linux that:

- Runs system updates
- Updates development tools and AI coding agents (including `pi update --all`)
- Manages installed packages

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

#### Doing updates on Linux

The [@patdx/update](#patdxupdate) package provides a script to perform system
updates on Linux. See the [@patdx/update documentation](#patdxupdate) above for
usage instructions.

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
