/**
 * Compare dotted numeric semver prefixes (major.minor.patch).
 */
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
