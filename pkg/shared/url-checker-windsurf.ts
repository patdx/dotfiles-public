import { ofetch } from 'ofetch'
import type { UrlCheckResult, UrlProvider } from './url-checker.ts'

interface WindsurfUpdateResponse {
  url: string
  windsurfVersion: string
}

export const windsurfStableProvider: UrlProvider = {
  name: 'windsurf-stable',
  check: checkWindsurfStableUrl,
}

export async function checkWindsurfStableUrl(
  url: string,
): Promise<UrlCheckResult | null> {
  try {
    const result = await ofetch<WindsurfUpdateResponse>(url)
    if (!result?.url || !result.windsurfVersion) {
      return null
    }

    return {
      binaryUrl: result.url,
      version: result.windsurfVersion,
      type: 'targz',
      urlType: 'windsurf-stable',
    }
  } catch {
    return null
  }
}
