export function urlArchiveType(url: string): 'zip' | 'targz' | 'tarxz' {
  const lower = new URL(url).pathname.toLowerCase()
  if (lower.endsWith('.tar.xz')) return 'tarxz'
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    return 'targz'
  }
  return 'zip'
}
