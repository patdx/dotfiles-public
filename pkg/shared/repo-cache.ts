/**
 * Higher-level catalog operations for @patdx/pkg.
 */
import { getRepoSources, loadConfig, normalizeRepoBase } from './repo-config.ts'
import {
  fetchPackageDocument,
  fetchRepoListing,
  isHttpBase,
  isLocalBase,
} from './repo-fetch.ts'

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
