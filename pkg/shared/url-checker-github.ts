import { existsSync } from 'node:fs'
import process from 'node:process'
import { readGithubUrl } from './normalize-github-url.ts'
import type { UrlCheckResult, UrlProvider } from './url-checker.ts'
import { urlArchiveType } from './url-archive-type.ts'

export const githubProvider: UrlProvider = {
  name: 'github',
  check: checkGithubUrl,
}

export interface GithubRelease {
  tag_name: string
  assets: Array<{
    browser_download_url: string
    name: string
  }>
}

interface AssetAnalysis {
  name: string
  url: string
  analysis: {
    matchingPlatform: string | undefined
    matchingArch: string | undefined
    isBinary: boolean
    score: number // Default score for ranking multiple viable options
  }
}

const BINARY_EXTENSIONS = ['.tar.gz', '.tgz', '.zip']
const NON_BINARY_EXTENSIONS = ['.symbols.tar.gz', '-symbols.tar.gz']

function couldBeBinary(url: string): boolean {
  url = url.toLowerCase()
  return BINARY_EXTENSIONS.some((ext) => url.endsWith(ext)) &&
    NON_BINARY_EXTENSIONS.every((ext) => !url.endsWith(ext))
}

export type LinuxLibc = 'musl' | 'gnu'

export interface CheckerContext {
  platform: string
  arch: string
  /** Host libc on Linux. Prefer matching release assets when both musl and gnu ship. */
  libc?: LinuxLibc
}

const MUSL_LOADER_PATHS = [
  '/lib/ld-musl-x86_64.so.1',
  '/lib/ld-musl-aarch64.so.1',
  '/lib/ld-musl-armhf.so.1',
  '/lib/ld-musl-i386.so.1',
]

/** Detect musl (Alpine, etc.) vs gnu/glibc. Defaults to gnu when unsure. */
export function detectLinuxLibc(): LinuxLibc {
  for (const loader of MUSL_LOADER_PATHS) {
    if (existsSync(loader)) return 'musl'
  }
  return 'gnu'
}

function resolveLibc(context: CheckerContext): LinuxLibc | undefined {
  if (context.libc) return context.libc
  if (context.platform === 'linux') return detectLinuxLibc()
  return undefined
}

export function getPlatformIdentifiers(
  context: CheckerContext = { platform: process.platform, arch: process.arch },
): { platforms: string[]; archs: string[] } {
  const platforms: string[] = []
  const archs: string[] = []

  // Add base platform
  platforms.push(context.platform)

  // Add platform aliases
  if (context.platform === 'darwin') {
    platforms.push('macos', 'osx', 'mac')
  } else if (context.platform === 'win32') {
    platforms.push('windows')
  }

  // Add base architecture
  archs.push(context.arch)

  // Add architecture aliases
  if (context.arch === 'x64') {
    archs.push('amd64', 'x86_64')
  } else if (context.arch === 'arm64') {
    archs.push('aarch64')
  }

  // Add universal arch for macOS
  if (context.platform === 'darwin') {
    archs.push('universal')
  }

  return { platforms, archs }
}

export async function fetchGithubRelease(
  repoName: string,
): Promise<GithubRelease | null> {
  const apiUrl = `https://api.github.com/repos/${repoName}/releases/latest`
  const response = await fetch(apiUrl)

  if (!response.ok) return null

  const release: GithubRelease = await response.json()
  return release.assets.length > 0 ? release : null
}

export function analyzeAssets(
  assets: GithubRelease['assets'],
  context: CheckerContext,
): AssetAnalysis[] {
  const { platforms, archs } = getPlatformIdentifiers(context)
  const libc = resolveLibc(context)

  const analyzed = assets.map((asset) => {
    const name = asset.name.toLowerCase()
    const matchingPlatform = platforms.find((platform) =>
      name.includes(platform.toLowerCase())
    )
    const matchingArch = archs.find((arch) => name.includes(arch.toLowerCase()))
    const isBinary = couldBeBinary(name)
    const isMuslAsset = name.includes('musl')

    // Calculate score based on heuristics
    let score = 0

    // Positive patterns
    if (name.includes('cli')) score += 2
    if (
      name.includes('bin') || name.includes('exe') || name.includes('binary')
    ) score += 1

    // Negative patterns
    if (name.includes('lib')) score -= 1
    if (name.includes('src') || name.includes('source')) score -= 3
    if (name.includes('debug') || name.includes('dbg')) score -= 2
    if (name.includes('dev') || name.includes('devel')) score -= 2
    if (
      name.includes('symbols') || name.includes('pdb') || name.includes('dsym')
    ) {
      score -= 2
    }
    if (name.includes('static') || name.includes('shared')) score -= 1

    // Prefer the host libc when both musl and gnu builds ship
    if (libc === 'musl') {
      score += isMuslAsset ? 2 : -2
    } else if (libc === 'gnu' && isMuslAsset) {
      score -= 1
    }

    return {
      name: asset.name,
      url: asset.browser_download_url,
      analysis: {
        matchingPlatform,
        matchingArch,
        isBinary,
        score,
      },
    }
  })

  // Sort by score in descending order (highest to lowest)
  return analyzed.sort((a, b) => b.analysis.score - a.analysis.score)
}

export function generateErrorDetails(
  assetAnalysis: AssetAnalysis[],
  context: CheckerContext,
): string {
  const { platforms, archs } = getPlatformIdentifiers(context)
  const libc = resolveLibc(context)
  return [
    `- Platform(s): ${platforms.join(', ')}`,
    `- Architecture(s): ${archs.join(', ')}`,
    ...(libc ? [`- Libc: ${libc}`] : []),
    `\nAvailable assets:`,
    ...assetAnalysis.map((asset) =>
      [
        `\n${asset.name}:`,
        `  - Matches platform: ${asset.analysis.matchingPlatform || 'no'}`,
        `  - Matches architecture: ${asset.analysis.matchingArch || 'no'}`,
        `  - Is binary: ${asset.analysis.isBinary ? 'yes' : 'no'}`,
        `  - Score: ${asset.analysis.score}`,
      ].join('\n')
    ),
  ].join('\n')
}

export function findViableAsset(
  assetAnalysis: AssetAnalysis[],
  context: CheckerContext,
): AssetAnalysis | null {
  const viableAssets = assetAnalysis.filter((asset) =>
    asset.analysis.matchingPlatform &&
    asset.analysis.matchingArch &&
    asset.analysis.isBinary
  )

  if (viableAssets.length > 1) {
    console.warn(
      [
        `Warning: Found multiple matching assets for your system:`,
        generateErrorDetails(viableAssets, context),
        `\nSelecting highest scored asset: ${viableAssets[0].name}`,
      ].join('\n'),
    )
  }

  return viableAssets[0] || null
}

async function checkGithubUrl(
  url: string,
  context: CheckerContext = { platform: process.platform, arch: process.arch },
): Promise<UrlCheckResult | null> {
  const gitHubUrl = readGithubUrl(url)
  if (!gitHubUrl) {
    return null
  }

  const release = await fetchGithubRelease(gitHubUrl.repoName)
  if (!release) return null

  const assetAnalysis = analyzeAssets(release.assets, context)
  const viableAsset = findViableAsset(assetAnalysis, context)

  if (!viableAsset) {
    throw new Error(
      `Could not find a matching release asset for your system:` + '\n' +
        generateErrorDetails(assetAnalysis, context),
    )
  }

  return {
    binaryUrl: viableAsset.url,
    version: release.tag_name.replace(/^v/, ''),
    type: urlArchiveType(viableAsset.url),
    urlType: 'github',
  }
}
