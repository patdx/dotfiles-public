/**
 * Config + remote catalog cache for @patdx/pkg.
 *
 * Builtin (monorepo) and configured repos share one resolution path: each is a
 * repo base URL/path with catalog JSON at the root (`repo.json`, `package/`,
 * `schema/`).
 */
import { ensureDir, exists } from '@std/fs'
import { dirname, fromFileUrl, join } from '@std/path'
import { createHash } from 'node:crypto'
import { PKG_HOME } from './shared.ts'
import {
  DEFAULT_REMOTE_REPO,
  type PackageDocument,
  parsePackageDocument,
  parseRepoListing,
  type RepoListing,
} from './schema.ts'

export const CONFIG_PATH = join(PKG_HOME, 'config.json')
export const CACHE_DIR = join(PKG_HOME, 'cache', 'repos')

/** Default cache TTL: 1 hour */
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000

/** Keep in sync with pkg/deno.json `version`. */
export const PKG_CLI_VERSION = '0.7.1'

export interface RepoConfigEntry {
  url: string
}

export interface PkgConfig {
  repos: RepoConfigEntry[]
}

/** A catalog source after builtin discovery + config merge. */
export interface RepoSource {
  /** Normalized base URL or filesystem path. */
  base: string
  /** Display / ResolvedPackage.source label. */
  label: string
}

export function getDefaultConfig(): PkgConfig {
  return {
    repos: [{ url: DEFAULT_REMOTE_REPO }],
  }
}

export async function loadConfig(): Promise<PkgConfig> {
  const fromEnv = Deno.env.get('PATDX_PKG_REPOS')
  if (fromEnv?.trim()) {
    return {
      repos: fromEnv.split(',').map((url) => ({ url: url.trim() })).filter((
        entry,
      ) => entry.url.length > 0),
    }
  }

  if (!await exists(CONFIG_PATH)) {
    return getDefaultConfig()
  }

  try {
    const raw = JSON.parse(await Deno.readTextFile(CONFIG_PATH))
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.repos)) {
      return getDefaultConfig()
    }
    const repos = raw.repos
      .filter((entry: unknown): entry is RepoConfigEntry =>
        !!entry && typeof entry === 'object' &&
        typeof (entry as RepoConfigEntry).url === 'string'
      )
      .map((entry: RepoConfigEntry) => ({ url: entry.url }))
    return repos.length > 0 ? { repos } : getDefaultConfig()
  } catch {
    return getDefaultConfig()
  }
}

export async function saveConfig(config: PkgConfig): Promise<void> {
  await ensureDir(PKG_HOME)
  await Deno.writeTextFile(
    CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
  )
}

export function normalizeRepoBase(url: string): string {
  return url.replace(/\/+$/, '')
}

function isHttpBase(base: string): boolean {
  return base.startsWith('http://') || base.startsWith('https://')
}

function isLocalBase(base: string): boolean {
  return base.startsWith('file:') ||
    base.startsWith('/') ||
    base.startsWith('./') ||
    base.startsWith('../') ||
    /^[A-Za-z]:[\\/]/.test(base)
}

function localBaseToPath(base: string): string {
  if (base.startsWith('file:')) {
    return new URL(base).pathname
  }
  return base
}

/**
 * Optional catalog shipped beside the CLI in this monorepo
 * (`pkg/shared` → `../../repo`). Absent after JSR install (https import.meta.url).
 */
export async function discoverBuiltinRepoBase(): Promise<string | null> {
  // Deno.readDir / fromFileUrl only work for file: URLs; JSR serves https:.
  if (!import.meta.url.startsWith('file:')) return null
  const dir = join(dirname(fromFileUrl(import.meta.url)), '../../repo')
  if (!await exists(join(dir, 'repo.json'))) return null
  return normalizeRepoBase(dir)
}

/**
 * Builtin (if present) first, then configured repos; duplicates skipped.
 * `PATDX_PKG_REPOS` is a full override — builtin is omitted so the env list
 * is the complete source of truth.
 */
export async function getRepoSources(
  config?: PkgConfig,
): Promise<RepoSource[]> {
  const fromEnv = Boolean(Deno.env.get('PATDX_PKG_REPOS')?.trim())
  const cfg = config ?? await loadConfig()
  const sources: RepoSource[] = []
  const seen = new Set<string>()

  if (!fromEnv) {
    const builtin = await discoverBuiltinRepoBase()
    if (builtin) {
      seen.add(builtin)
      sources.push({ base: builtin, label: `builtin:${builtin}` })
    }
  }

  for (const entry of cfg.repos) {
    const base = normalizeRepoBase(entry.url)
    if (seen.has(base)) continue
    seen.add(base)
    sources.push({ base, label: base })
  }

  return sources
}

function cacheKeyForRepo(base: string): string {
  return createHash('sha256').update(base).digest('hex').slice(0, 16)
}

function cacheDirForRepo(base: string): string {
  return join(CACHE_DIR, cacheKeyForRepo(base))
}

interface CacheMeta {
  fetched_at: number
  base: string
}

async function writeCacheMeta(dir: string, meta: CacheMeta): Promise<void> {
  await ensureDir(dir)
  await Deno.writeTextFile(join(dir, 'meta.json'), `${JSON.stringify(meta)}\n`)
}

/** Catalog JSON lives at the repo base (static files, no `/api` prefix). */
function catalogPath(base: string, ...parts: string[]): string {
  if (isHttpBase(base)) {
    return [base, ...parts].join('/')
  }
  return join(localBaseToPath(base), ...parts)
}

async function fetchText(url: string): Promise<string> {
  if (isHttpBase(url) || url.startsWith('file:')) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    return await response.text()
  }
  return await Deno.readTextFile(url)
}

async function readCachedText(
  path: string,
  maxAgeMs: number,
): Promise<string | null> {
  try {
    const stat = await Deno.stat(path)
    const age = Date.now() - (stat.mtime?.getTime() ?? 0)
    if (age > maxAgeMs) return null
    return await Deno.readTextFile(path)
  } catch {
    return null
  }
}

async function fetchCatalogDocument<T>(
  base: string,
  cacheRelativePath: string,
  url: string,
  parse: (data: unknown) => T,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const normalized = normalizeRepoBase(base)
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS
  const cacheDir = cacheDirForRepo(normalized)
  const cachePath = join(cacheDir, cacheRelativePath)

  if (!options.force && isHttpBase(normalized)) {
    const cached = await readCachedText(cachePath, ttlMs)
    if (cached) {
      return parse(JSON.parse(cached))
    }
  }

  const text = await fetchText(url)
  const doc = parse(JSON.parse(text))

  if (isHttpBase(normalized)) {
    await ensureDir(dirname(cachePath))
    await Deno.writeTextFile(cachePath, text)
    await writeCacheMeta(cacheDir, {
      fetched_at: Date.now(),
      base: normalized,
    })
  }

  return doc
}

export async function fetchRepoListing(
  base: string,
  options: { force?: boolean; ttlMs?: number; cliVersion?: string } = {},
): Promise<RepoListing> {
  const listing = await fetchCatalogDocument(
    base,
    'repo.json',
    catalogPath(normalizeRepoBase(base), 'repo.json'),
    parseRepoListing,
    options,
  )
  assertMinCliVersion(listing, options.cliVersion)
  return listing
}

function assertMinCliVersion(
  listing: RepoListing,
  cliVersion = PKG_CLI_VERSION,
): void {
  if (!listing.min_cli_version) return
  if (compareSemver(cliVersion, listing.min_cli_version) < 0) {
    throw new Error(
      `This catalog requires @patdx/pkg >= ${listing.min_cli_version} ` +
        `(current ${cliVersion}). Update the CLI and retry.`,
    )
  }
}

/** Compare dotted numeric semver prefixes (major.minor.patch). */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}

export async function fetchPackageDocument(
  base: string,
  name: string,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<PackageDocument> {
  return await fetchCatalogDocument(
    base,
    join('package', `${name}.json`),
    catalogPath(normalizeRepoBase(base), 'package', `${name}.json`),
    parsePackageDocument,
    options,
  )
}

export async function updateAllRepoCaches(): Promise<string[]> {
  const config = await loadConfig()
  const updated: string[] = []
  for (const entry of config.repos) {
    const base = normalizeRepoBase(entry.url)
    if (!isHttpBase(base) && !isLocalBase(base)) {
      continue
    }
    const listing = await fetchRepoListing(base, { force: true })
    await Promise.all(
      listing.packages.map((name) =>
        fetchPackageDocument(base, name, { force: true })
      ),
    )
    updated.push(base)
  }
  return updated
}

export async function listAvailablePackageNames(): Promise<
  Array<{ name: string; source: string }>
> {
  const seen = new Set<string>()
  const result: Array<{ name: string; source: string }> = []

  for (const { base, label } of await getRepoSources()) {
    try {
      const listing = await fetchRepoListing(base)
      for (const name of listing.packages) {
        if (seen.has(name)) continue
        seen.add(name)
        result.push({ name, source: label })
      }
    } catch (error) {
      console.warn(
        `Warning: could not read repo ${label}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return result
}
