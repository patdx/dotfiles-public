/**
 * Config loading and repo source resolution for @patdx/pkg.
 */
import { ensureDir, exists } from '@std/fs'
import { dirname, fromFileUrl, join } from '@std/path'
import { PKG_HOME } from './fs.ts'
import { DEFAULT_REMOTE_REPO } from './schema.ts'

const CONFIG_PATH = join(PKG_HOME, 'config.json')

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

function getDefaultConfig(): PkgConfig {
  return {
    repos: [{ url: DEFAULT_REMOTE_REPO }],
  }
}

export async function loadConfig(): Promise<PkgConfig> {
  const fromEnv = Deno.env.get('PPKG_REPOS')
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

/**
 * Optional catalog shipped beside the CLI in this monorepo
 * (`pkg/shared` → `../../repo`). Absent after JSR install (https import.meta.url).
 */
async function discoverBuiltinRepoBase(): Promise<string | null> {
  // Deno.readDir / fromFileUrl only work for file: URLs; JSR serves https:.
  if (!import.meta.url.startsWith('file:')) return null
  const dir = join(dirname(fromFileUrl(import.meta.url)), '../../repo')
  if (!await exists(join(dir, 'repo.json'))) return null
  return normalizeRepoBase(dir)
}

/**
 * Builtin (if present) first, then configured repos; duplicates skipped.
 * `PPKG_REPOS` is a full override — builtin is omitted so the env list
 * is the complete source of truth.
 */
export async function getRepoSources(
  config?: PkgConfig,
): Promise<RepoSource[]> {
  const fromEnv = Boolean(Deno.env.get('PPKG_REPOS')?.trim())
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
