/**
 * Generate JSON Schema files under repo/ from Valibot schemas.
 */
import { dirname, fromFileUrl, join } from '@std/path'
import { generateCatalogJsonSchemas } from '../shared/schema.ts'

const repoDir = join(
  dirname(fromFileUrl(import.meta.url)),
  '../../repo',
)

const schemas = generateCatalogJsonSchemas()
const packagePath = join(repoDir, 'package.schema.json')
const repoPath = join(repoDir, 'repo.schema.json')

await Deno.writeTextFile(
  packagePath,
  `${JSON.stringify(schemas.package, null, 2)}\n`,
)
await Deno.writeTextFile(
  repoPath,
  `${JSON.stringify(schemas.repo, null, 2)}\n`,
)

console.log(`Wrote ${packagePath}`)
console.log(`Wrote ${repoPath}`)
