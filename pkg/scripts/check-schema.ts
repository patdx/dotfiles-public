/**
 * Fail if repo/*.schema.json is stale relative to Valibot schemas.
 */
import { dirname, fromFileUrl, join } from '@std/path'
import { generateCatalogJsonSchemas } from '../shared/schema.ts'

const repoDir = join(
  dirname(fromFileUrl(import.meta.url)),
  '../../repo',
)

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
