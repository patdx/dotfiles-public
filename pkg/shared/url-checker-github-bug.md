For platform `darwin`, `osx` should get matched too. And arch `universal`

```
error: Uncaught (in promise) Error: Could not find a matching release asset for your system:
- Platform(s): darwin
- Architecture(s): arm64

Available assets:

duckdb_cli-linux-aarch64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

duckdb_cli-linux-amd64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

duckdb_cli-osx-universal.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

duckdb_cli-windows-amd64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

duckdb_cli-windows-arm64.zip:
  - Matches platform: no
  - Matches architecture: arm64
  - Is binary: yes

duckdb_python_src.tar.gz:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-linux-aarch64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-linux-amd64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-osx-universal.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-src.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-windows-amd64.zip:
  - Matches platform: no
  - Matches architecture: no
  - Is binary: yes

libduckdb-windows-arm64.zip:
  - Matches platform: no
  - Matches architecture: arm64
  - Is binary: yes
    throw new Error(errorDetails)
          ^
    at Object.checkGithubUrl [as check] (https://jsr.io/@patdx/pkg/0.5.0/shared/url-checker.ts:112:11)
    at eventLoopTick (ext:core/01_core.js:177:7)
    at async checkUrl (https://jsr.io/@patdx/pkg/0.5.0/shared/url-checker.ts:177:20)
    at async downloadAndInstall (https://jsr.io/@patdx/pkg/0.5.0/install-binary.ts:46:57)
    at async main (https://jsr.io/@patdx/pkg/0.5.0/cli.ts:108:7)
    at async https://jsr.io/@patdx/pkg/0.5.0/cli.ts:154:3
```
