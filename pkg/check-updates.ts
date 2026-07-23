/**
 * Check installed catalog packages for available updates.
 */
import type { ResolvedPackage } from './resolve.ts'
import { resolvePackage } from './resolve.ts'
import { checkUrl } from './shared/url-checker.ts'

export type PackageUpdateStatus =
  | 'outdated'
  | 'current'
  | 'skipped'
  | 'error'

export interface InstalledPackageRef {
  name: string
  version: string
}

export interface PackageUpdateCheck {
  name: string
  installed: string
  available?: string
  status: PackageUpdateStatus
  reason?: string
  resolved?: ResolvedPackage
}

export type ResolvePackageFn = (name: string) => Promise<ResolvedPackage>
export type CheckAvailableFn = (pkg: ResolvedPackage) => Promise<string>

export interface CheckUpdatesOptions {
  /** Limit to these package names (must appear in `installed`). */
  names?: string[]
  resolve?: ResolvePackageFn
  checkAvailable?: CheckAvailableFn
}

/** Match install-binary: versions differ by string, not semver. */
export function statusFromVersions(
  installed: string,
  available: string,
): 'outdated' | 'current' {
  return installed === available ? 'current' : 'outdated'
}

export async function defaultCheckAvailable(
  pkg: ResolvedPackage,
): Promise<string> {
  const first = pkg.files[0]
  if (!first) {
    throw new Error(`Package '${pkg.name}' has no files`)
  }
  const result = await checkUrl(first.url, first.url_provider)
  return result.version ?? 'latest'
}

/**
 * Compare installed packages against catalog + URL providers.
 * Non-catalog installs are reported as `skipped`.
 */
export async function checkPackageUpdates(
  installed: InstalledPackageRef[],
  options: CheckUpdatesOptions = {},
): Promise<PackageUpdateCheck[]> {
  const resolve = options.resolve ?? resolvePackage
  const checkAvailable = options.checkAvailable ?? defaultCheckAvailable

  let targets = installed
  if (options.names && options.names.length > 0) {
    const byName = new Map(installed.map((pkg) => [pkg.name, pkg]))
    const missing = options.names.filter((name) => !byName.has(name))
    if (missing.length > 0) {
      throw new Error(
        `Not installed: ${missing.join(', ')}. Install with: ppkg add <name>`,
      )
    }
    targets = options.names.map((name) => byName.get(name)!)
  }

  const results: PackageUpdateCheck[] = []
  for (const pkg of targets) {
    results.push(await checkOne(pkg, resolve, checkAvailable))
  }
  return results
}

async function checkOne(
  pkg: InstalledPackageRef,
  resolve: ResolvePackageFn,
  checkAvailable: CheckAvailableFn,
): Promise<PackageUpdateCheck> {
  let resolved: ResolvedPackage
  try {
    resolved = await resolve(pkg.name)
  } catch (error) {
    return {
      name: pkg.name,
      installed: pkg.version,
      status: 'skipped',
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    const available = await checkAvailable(resolved)
    const status = statusFromVersions(pkg.version, available)
    return {
      name: pkg.name,
      installed: pkg.version,
      available,
      status,
      resolved,
    }
  } catch (error) {
    return {
      name: pkg.name,
      installed: pkg.version,
      status: 'error',
      reason: error instanceof Error ? error.message : String(error),
      resolved,
    }
  }
}
