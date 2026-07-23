/**
 * Bump @patdx/pkg version everywhere it is pinned / duplicated.
 *
 * Usage (from repo root or pkg/):
 *   deno task bump-version patch
 *   deno task bump-version minor
 *   deno task bump-version major
 *   deno task bump-version 0.7.1
 *   deno task bump-version patch --dry-run
 *   deno task bump-version patch --no-min-cli
 *   deno task bump-version patch --no-site
 *
 * Updates:
 *   - pkg/deno.json (canonical JSR version)
 *   - pkg/shared/repo-cache.ts (PKG_CLI_VERSION)
 *   - README.md, pkg/README.md, AGENTS.md (jsr:@patdx/pkg@…)
 *   - repo/repo.json min_cli_version (unless --no-min-cli)
 *   - regenerated site HTML via gen-site (unless --no-site)
 */
import { dirname, fromFileUrl, join } from '@std/path'

const scriptDir = dirname(fromFileUrl(import.meta.url))
const pkgDir = join(scriptDir, '..')
const repoRoot = join(pkgDir, '..')

const DENO_JSON = join(pkgDir, 'deno.json')
const REPO_CACHE = join(pkgDir, 'shared/repo-cache.ts')
const REPO_JSON = join(repoRoot, 'repo/repo.json')
const DOC_FILES = [
  join(repoRoot, 'README.md'),
  join(pkgDir, 'README.md'),
  join(repoRoot, 'AGENTS.md'),
]

type BumpKind = 'major' | 'minor' | 'patch'

function parseArgs(args: string[]) {
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positional = args.filter((a) => !a.startsWith('--'))
  const target = positional[0]
  if (!target) {
    console.error(
      'Usage: bump-version <patch|minor|major|x.y.z> [--dry-run] [--no-min-cli] [--no-site]',
    )
    Deno.exit(1)
  }
  return {
    target,
    dryRun: flags.has('--dry-run'),
    noMinCli: flags.has('--no-min-cli'),
    noSite: flags.has('--no-site'),
  }
}

function parseSemver(version: string): [number, number, number] {
  const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) {
    throw new Error(`Invalid semver (expected x.y.z): ${version}`)
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function bumpSemver(version: string, kind: BumpKind): string {
  const [major, minor, patch] = parseSemver(version)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function resolveNextVersion(current: string, target: string): string {
  if (target === 'major' || target === 'minor' || target === 'patch') {
    return bumpSemver(current, target)
  }
  parseSemver(target) // validate
  return target
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Deno.readTextFile(path)) as T
}

async function writeText(path: string, content: string, dryRun: boolean) {
  if (dryRun) {
    console.log(`  would write ${path}`)
    return
  }
  await Deno.writeTextFile(path, content)
  console.log(`  wrote ${path}`)
}

function replaceAll(
  content: string,
  from: string,
  to: string,
): { next: string; count: number } {
  if (!content.includes(from)) return { next: content, count: 0 }
  const parts = content.split(from)
  return { next: parts.join(to), count: parts.length - 1 }
}

const { target, dryRun, noMinCli, noSite } = parseArgs(Deno.args)

const denoJson = await readJson<{ version: string }>(DENO_JSON)
const current = denoJson.version
const next = resolveNextVersion(current, target)

if (current === next) {
  console.error(`Version is already ${current}`)
  Deno.exit(1)
}

console.log(
  `${dryRun ? '[dry-run] ' : ''}Bumping @patdx/pkg ${current} → ${next}`,
)

denoJson.version = next
await writeText(
  DENO_JSON,
  `${JSON.stringify(denoJson, null, 2)}\n`,
  dryRun,
)

{
  const src = await Deno.readTextFile(REPO_CACHE)
  const needle = `export const PKG_CLI_VERSION = '${current}'`
  const replacement = `export const PKG_CLI_VERSION = '${next}'`
  if (!src.includes(needle)) {
    console.error(
      `Could not find PKG_CLI_VERSION = '${current}' in ${REPO_CACHE}`,
    )
    Deno.exit(1)
  }
  await writeText(REPO_CACHE, src.replace(needle, replacement), dryRun)
}

const pinFrom = `jsr:@patdx/pkg@${current}`
const pinTo = `jsr:@patdx/pkg@${next}`
for (const path of DOC_FILES) {
  const src = await Deno.readTextFile(path)
  const { next: updated, count } = replaceAll(src, pinFrom, pinTo)
  if (count === 0) {
    console.warn(`  no ${pinFrom} pins in ${path}`)
    continue
  }
  console.log(`  ${path}: ${count} pin(s)`)
  await writeText(path, updated, dryRun)
}

if (!noMinCli) {
  const repoJson = await readJson<{
    min_cli_version?: string
    [key: string]: unknown
  }>(REPO_JSON)
  const prevMin = repoJson.min_cli_version
  repoJson.min_cli_version = next
  console.log(
    `  repo.json min_cli_version: ${prevMin ?? '(none)'} → ${next}`,
  )
  await writeText(
    REPO_JSON,
    `${JSON.stringify(repoJson, null, 2)}\n`,
    dryRun,
  )
}

if (!noSite) {
  if (dryRun) {
    console.log('  would run: deno task gen-site')
  } else {
    console.log('  running gen-site…')
    const cmd = new Deno.Command('deno', {
      args: ['task', 'gen-site'],
      cwd: repoRoot,
      stdin: 'null',
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const status = await cmd.output()
    if (!status.success) {
      console.error('gen-site failed')
      Deno.exit(status.code || 1)
    }
  }
}

console.log(dryRun ? 'Dry run complete.' : `Done. @patdx/pkg is now ${next}`)
