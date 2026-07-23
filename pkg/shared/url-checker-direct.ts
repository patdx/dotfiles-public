import type { UrlCheckResult, UrlProvider } from './url-checker.ts'
import { urlArchiveType } from './url-archive-type.ts'

export const directProvider: UrlProvider = {
  name: 'direct',
  check: checkDirectUrl,
}

export function checkDirectUrl(url: string): UrlCheckResult | null {
  try {
    new URL(url)
    return {
      binaryUrl: url,
      type: urlArchiveType(url),
      urlType: 'direct',
    }
  } catch {
    return null
  }
}
