/**
 * Generate JSON Schema files under repo/api/schema/v1 from Valibot schemas.
 */
import { dirname, fromFileUrl, join } from '@std/path'
import { generateCatalogJsonSchemas } from '../shared/schema.ts'

const schemaDir = join(
  dirname(fromFileUrl(import.meta.url)),
  '../../repo/api/schema/v1',
)

await Deno.mkdir(schemaDir, { recursive: true })

const schemas = generateCatalogJsonSchemas()
const pkgPath = join(schemaDir, 'pkg.json')
const repoPath = join(schemaDir, 'repo.json')

await Deno.writeTextFile(
  pkgPath,
  `${JSON.stringify(schemas.package, null, 2)}\n`,
)
await Deno.writeTextFile(
  repoPath,
  `${JSON.stringify(schemas.repo, null, 2)}\n`,
)

console.log(`Wrote ${pkgPath}`)
console.log(`Wrote ${repoPath}`)
