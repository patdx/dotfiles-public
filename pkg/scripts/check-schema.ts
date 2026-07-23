/**
 * Fail if repo/*.schema.json is stale relative to Valibot schemas.
 */
import { join } from '@std/path'
import { generateCatalogJsonSchemas } from '../shared/schema.ts'
import { getRepoDir } from './_repo-dir.ts'

const repoDir = getRepoDir(import.meta.url)

function normalize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const expected = generateCatalogJsonSchemas()
const actualPackage = await Deno.readTextFile(
  join(repoDir, 'package.schema.json'),
)
const actualRepo = await Deno.readTextFile(join(repoDir, 'repo.schema.json'))

let stale = false
if (actualPackage !== normalize(expected.package)) {
  console.error(
    'repo/package.schema.json is stale. Run: deno task gen-schema',
  )
  stale = true
}
if (actualRepo !== normalize(expected.repo)) {
  console.error(
    'repo/repo.schema.json is stale. Run: deno task gen-schema',
  )
  stale = true
}

if (stale) {
  Deno.exit(1)
}

console.log('Catalog JSON Schema is up to date.')
