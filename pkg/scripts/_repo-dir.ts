import { dirname, fromFileUrl, join } from '@std/path'

export function getRepoDir(importMetaUrl: string): string {
  return join(dirname(fromFileUrl(importMetaUrl)), '../../repo')
}
