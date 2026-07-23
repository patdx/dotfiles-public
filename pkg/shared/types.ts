export type {
  FileOptions,
  InstallOptions,
  PackageDocument,
  RepoListing,
  ShortcutOptions,
} from './schema.ts'

export interface UrlCheckResult {
  binaryUrl: string
  version?: string
  type: 'zip' | 'targz'
  urlType: 'github' | 'direct' | string
}

export interface UrlProvider {
  name: string
  check: (url: string) => Promise<UrlCheckResult | null> | UrlCheckResult | null
}
