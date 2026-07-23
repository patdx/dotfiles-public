import { basename } from '@std/path'

export function guessBinaryName(url: string): string {
  try {
    const urlObj = new URL(url)
    return basename(urlObj.pathname)
      // Remove common archive extensions first
      .replace(/\.(tar\.gz|tgz|zip)$/i, '')
      // Remove platform and architecture info
      .replace(/[-_.]?(linux|windows|darwin|x64|x86_64|amd64|arm64).*$/i, '')
      // Remove version numbers with more specific patterns
      .replace(/[-_.]v\d+(\.\d+)*([-.]\w+)?$/i, '') // v1.2.3 style
      .replace(/[-_.]\d+(\.\d+)*([-.]\w+)?$/i, '') // 1.2.3 style
      // Clean up any remaining dots, dashes or underscores at the end
      .replace(/[-_.]$/g, '')
  } catch {
    throw new Error('Invalid URL format')
  }
}
