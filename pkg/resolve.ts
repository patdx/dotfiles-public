/**
 * Resolve a package name across configured repos (and optional builtin).
 */
import type { InstallOptions } from './shared/types.ts'
import {
  fetchPackageDocument,
  fetchRepoListing,
  getRepoSources,
} from './shared/repo-cache.ts'
import { installOptionsFromDocument } from './shared/schema.ts'

export interface ResolvedPackage extends InstallOptions {
  name: string
  source: string
}

export async function resolvePackage(name: string): Promise<ResolvedPackage> {
  const errors: string[] = []

  for (const { base, label } of await getRepoSources()) {
    try {
      const listing = await fetchRepoListing(base)
      if (!listing.packages.includes(name)) {
        continue
      }
      const doc = await fetchPackageDocument(base, name)
      return {
        name: doc.name,
        source: label,
        ...installOptionsFromDocument(doc),
      }
    } catch (error) {
      errors.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const detail = errors.length > 0 ? `\n${errors.join('\n')}` : ''
  throw new Error(`Unknown package '${name}'${detail}`)
}
