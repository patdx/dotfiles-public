import type { UrlCheckResult, UrlProvider } from './types.ts'

export const directProvider: UrlProvider = {
  name: 'direct',
  check: checkDirectUrl,
}

export function checkDirectUrl(url: string): UrlCheckResult | null {
  try {
    new URL(url)
    return {
      binaryUrl: url,
      type: url.toLowerCase().endsWith('.tar.gz') ||
          url.toLowerCase().endsWith('.tgz')
        ? 'targz'
        : 'zip',
      urlType: 'direct',
    }
  } catch {
    return null
  }
}
