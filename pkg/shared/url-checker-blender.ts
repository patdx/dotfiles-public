import type { UrlCheckResult, UrlProvider } from './url-checker.ts'

const DOWNLOAD_PAGE = 'https://www.blender.org/download/'

/** Resolve the stable Linux archive advertised by Blender, excluding previews. */
export function parseBlenderDownload(
  html: string,
  arch: string,
): UrlCheckResult {
  const platform = arch === 'x86_64'
    ? 'x64'
    : arch === 'aarch64'
    ? 'arm64'
    : null
  if (!platform) throw new Error(`Unsupported Blender architecture: ${arch}`)
  const pattern = new RegExp(
    `https://www\\.blender\\.org/download/release/(Blender[0-9]+\\.[0-9]+)/blender-([0-9]+\\.[0-9]+\\.[0-9]+)-linux-${platform}\\.tar\\.xz/`,
  )
  const match = html.match(pattern)
  if (!match) {
    throw new Error(`No stable Blender Linux ${platform} download found`)
  }
  return {
    binaryUrl: `https://download.blender.org/release/${match[1]}/blender-${
      match[2]
    }-linux-${platform}.tar.xz`,
    version: match[2],
    type: 'tarxz',
    urlType: 'blender-stable',
  }
}

export const blenderProvider: UrlProvider = {
  name: 'blender-stable',
  async check(url) {
    if (url !== DOWNLOAD_PAGE) return null
    if (Deno.build.os !== 'linux') {
      throw new Error('Blender provider supports Linux only')
    }
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Blender download page: HTTP ${response.status}`)
    }
    return parseBlenderDownload(await response.text(), Deno.build.arch)
  },
}
