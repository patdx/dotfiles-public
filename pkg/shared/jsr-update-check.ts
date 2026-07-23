/**
 * Soft JSR update check for the ppkg CLI.
 *
 * Non-blocking: prints a stderr notice when a newer @patdx/pkg is published.
 * Skips when opted out, stderr is not a TTY, or the TTL cache is fresh.
 */
import { ensureDir, exists } from '@std/fs'
import { dirname, join } from '@std/path'
import { PKG_HOME } from './fs.ts'
import { compareSemver } from './semver.ts'
import { PKG_CLI_VERSION } from './version.ts'

export const JSR_META_URL = 'https://jsr.io/@patdx/pkg/meta.json'
export const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000
export const PKG_UPDATE_CHECK_PATH = join(
  PKG_HOME,
  'cache',
  'pkg-update-check.json',
)

export interface JsrPackageMeta {
  latest?: string
  versions?: Record<string, { yanked?: boolean }>
}

interface UpdateCheckCache {
  checked_at: number
}

function isYanked(
  versions: Record<string, { yanked?: boolean }> | undefined,
  version: string,
): boolean {
  return versions?.[version]?.yanked === true
}

/** Pick the newest non-yanked version from JSR package meta. */
export function pickLatestVersion(meta: JsrPackageMeta): string | null {
  const versions = meta.versions
  if (
    typeof meta.latest === 'string' &&
    meta.latest.length > 0 &&
    !isYanked(versions, meta.latest)
  ) {
    return meta.latest
  }

  if (!versions) return null

  let best: string | null = null
  for (const [version, info] of Object.entries(versions)) {
    if (info?.yanked === true) continue
    if (best === null || compareSemver(version, best) > 0) {
      best = version
    }
  }
  return best
}

export function shouldNotifyUpdate(
  currentVersion: string,
  latestVersion: string,
): boolean {
  return compareSemver(currentVersion, latestVersion) < 0
}

export function formatUpdateNotice(
  currentVersion: string,
  latestVersion: string,
): string {
  return [
    `Update available: @patdx/pkg ${currentVersion} → ${latestVersion}`,
    '  Run: ppkg self-update',
    '  Or:  deno install -g -A -f -n ppkg jsr:@patdx/pkg',
  ].join('\n')
}

async function readCache(
  path: string,
): Promise<UpdateCheckCache | null> {
  try {
    if (!await exists(path)) return null
    const raw = JSON.parse(await Deno.readTextFile(path))
    if (
      !raw || typeof raw !== 'object' ||
      typeof raw.checked_at !== 'number'
    ) {
      return null
    }
    return { checked_at: raw.checked_at }
  } catch {
    return null
  }
}

async function writeCache(
  path: string,
  cache: UpdateCheckCache,
): Promise<void> {
  await ensureDir(dirname(path))
  await Deno.writeTextFile(path, `${JSON.stringify(cache)}\n`)
}

export interface MaybeNotifyPkgUpdateOptions {
  currentVersion?: string
  ttlMs?: number
  cachePath?: string
  metaUrl?: string
  env?: { get(key: string): string | undefined }
  isTerminal?: () => boolean
  now?: () => number
  fetchMeta?: (url: string) => Promise<JsrPackageMeta>
  writeNotice?: (message: string) => void
}

/**
 * If due, fetch JSR meta and print a non-blocking update notice to stderr.
 * Network / parse failures are silent.
 */
export async function maybeNotifyPkgUpdate(
  options: MaybeNotifyPkgUpdateOptions = {},
): Promise<void> {
  const env = options.env ?? Deno.env
  if (env.get('PPKG_NO_UPDATE_CHECK') === '1') return

  const isTerminal = options.isTerminal ?? (() => Deno.stderr.isTerminal())
  if (!isTerminal()) return

  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? UPDATE_CHECK_TTL_MS
  const cachePath = options.cachePath ?? PKG_UPDATE_CHECK_PATH
  const currentVersion = options.currentVersion ?? PKG_CLI_VERSION

  const cached = await readCache(cachePath)
  if (cached && now() - cached.checked_at < ttlMs) return

  try {
    const fetchMeta = options.fetchMeta ?? defaultFetchMeta
    const meta = await fetchMeta(options.metaUrl ?? JSR_META_URL)
    const latest = pickLatestVersion(meta)
    await writeCache(cachePath, { checked_at: now() })

    if (!latest || !shouldNotifyUpdate(currentVersion, latest)) return

    const notice = formatUpdateNotice(currentVersion, latest)
    if (options.writeNotice) {
      options.writeNotice(notice)
    } else {
      console.error(notice)
    }
  } catch {
    // Keep startup quiet on network / parse failures.
  }
}

async function defaultFetchMeta(url: string): Promise<JsrPackageMeta> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return await response.json() as JsrPackageMeta
}
