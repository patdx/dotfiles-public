/**
 * Fail if repo/api/schema/v1 is stale relative to Valibot schemas.
 */
import { dirname, fromFileUrl, join } from '@std/path'
import { generateCatalogJsonSchemas } from '../shared/schema.ts'

const schemaDir = join(
  dirname(fromFileUrl(import.meta.url)),
  '../../repo/api/schema/v1',
)

function normalize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const expected = generateCatalogJsonSchemas()
const actualPkg = await Deno.readTextFile(join(schemaDir, 'pkg.json'))
const actualRepo = await Deno.readTextFile(join(schemaDir, 'repo.json'))

let stale = false
if (actualPkg !== normalize(expected.package)) {
  console.error(
    'repo/api/schema/v1/pkg.json is stale. Run: deno task gen-schema',
  )
  stale = true
}
if (actualRepo !== normalize(expected.repo)) {
  console.error(
    'repo/api/schema/v1/repo.json is stale. Run: deno task gen-schema',
  )
  stale = true
}

if (stale) {
  Deno.exit(1)
}

console.log('Catalog JSON Schema is up to date.')
