import { assertEquals, assertThrows } from '@std/assert'
import { parseBlenderDownload } from './url-checker-blender.ts'
import { urlArchiveType } from './url-archive-type.ts'

Deno.test('Blender resolves stable official download and version', () => {
  const html =
    '<a href="https://www.blender.org/download/release/Blender5.2/blender-5.2.1-linux-x64.tar.xz/">Download</a>'
  assertEquals(parseBlenderDownload(html, 'x86_64'), {
    binaryUrl:
      'https://download.blender.org/release/Blender5.2/blender-5.2.1-linux-x64.tar.xz',
    version: '5.2.1',
    type: 'tarxz',
    urlType: 'blender-stable',
  })
  assertThrows(() => parseBlenderDownload(html, 'aarch64'))
  assertThrows(() => parseBlenderDownload(html, 'unsupported'))
  assertThrows(() =>
    parseBlenderDownload(
      html.replace('5.2.1-linux', '5.2.1-beta-linux'),
      'x86_64',
    )
  )
})

Deno.test('archive detection handles xz and URL query strings', () => {
  assertEquals(
    urlArchiveType('https://example.com/blender.tar.xz?download=1'),
    'tarxz',
  )
  assertEquals(urlArchiveType('https://example.com/a.tar.gz'), 'targz')
  assertEquals(urlArchiveType('https://example.com/a.zip'), 'zip')
})
