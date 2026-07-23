A git merge driver that automatically resolves merge conflicts in JSON files. It
detects indentation automatically and performs a three-way merge. This fork adds
support for reading JSONC (JSON with Comments) files, although comments are not
preserved in the output yet. This is a Deno port of
[git-json-merge](https://github.com/jonatanpedersen/git-json-merge), inspired by
[git-po-merge](https://github.com/beck/git-po-merge).

## Install

```sh
deno add jsr:@patdx/git-json-merge
```

### Configure Git

Add to `~/.gitconfig`:

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

### Single project / directory

Update git config:

```sh
git config merge.json.driver "deno run --allow-read --allow-write jsr:@patdx/git-json-merge %A %O %B"
git config merge.json.name "custom merge driver for json files"
```

Add the same `.gitattributes` where desired and commit. Note `.gitattributes` is
only used after committed.

## CLI Usage

Once installed via JSR, you can use the CLI directly:

```sh
deno run --allow-read --allow-write jsr:@patdx/git-json-merge ours.json base.json theirs.json
```

## Programmatic Usage

You can also use the merge functionality in your own code:

```typescript
import { mergeJson, mergeJsonFiles } from 'jsr:@patdx/git-json-merge'

// Merge files
await mergeJsonFiles('ours.json', 'base.json', 'theirs.json')

// Or merge JSON strings
const newJson = mergeJson(oursJson, baseJson, theirsJson)
```

Helpful docs:

- http://git-scm.com/docs/gitattributes#_defining_a_custom_merge_driver
- http://stackoverflow.com/questions/28026767/where-should-i-place-my-global-gitattributes-file

Thanks:

- Original [git-json-merge](https://github.com/jonatanpedersen/git-json-merge)
  by Jonatan Pedersen
- https://gist.github.com/mezis/1605647
- http://stackoverflow.com/questions/16214067/wheres-the-3-way-git-merge-driver-for-po-gettext-files
