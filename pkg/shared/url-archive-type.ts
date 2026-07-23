export function urlArchiveType(url: string): 'zip' | 'targz' {
  const lower = url.toLowerCase()
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    return 'targz'
  }
  return 'zip'
}
