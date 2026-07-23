import { assertEquals, assertThrows } from '@std/assert'
import {
  assertSupportedDocumentVersion,
  installOptionsFromDocument,
  parsePackageDocument,
  parseRepoListing,
} from './schema.ts'

Deno.test('parsePackageDocument accepts snake_case catalog entries', () => {
  const doc = parsePackageDocument({
    $schema: 'https://repo.pmil.me/api/schema/v1/pkg.json',
    version: 1,
    name: 'codexbar',
    binary_name: 'codexbar',
    files: [{
      url: 'https://github.com/steipete/CodexBar',
      url_provider: 'github',
    }],
  })

  assertEquals(doc.name, 'codexbar')
  assertEquals(doc.files[0].url_provider, 'github')
  assertEquals(installOptionsFromDocument(doc).binary_name, 'codexbar')
})

Deno.test('parseRepoListing accepts packages + min_cli_version', () => {
  const listing = parseRepoListing({
    version: 1,
    packages: ['caddy', 'duckdb'],
    min_cli_version: '0.6.0',
  })
  assertEquals(listing.packages, ['caddy', 'duckdb'])
})

Deno.test('assertSupportedDocumentVersion rejects future versions', () => {
  assertThrows(
    () => assertSupportedDocumentVersion({ version: 99 }, 'package'),
    Error,
    'Unsupported package document version 99',
  )
})
