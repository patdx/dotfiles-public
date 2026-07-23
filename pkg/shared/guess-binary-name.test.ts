import { assertEquals } from '@std/assert'
import { guessBinaryName } from './guess-binary-name.ts'

Deno.test('guessBinaryName - simple filename', () => {
  const url = 'https://example.com/mycli.zip'
  assertEquals(guessBinaryName(url), 'mycli')
})

Deno.test('guessBinaryName - with platform and arch', () => {
  const urls = [
    'https://example.com/mycli-linux-x64.tar.gz',
    'https://example.com/mycli_linux_amd64.zip',
    'https://example.com/mycli.darwin.arm64.tgz',
    'https://example.com/mycli-windows-x86_64.zip',
  ]

  for (const url of urls) {
    assertEquals(guessBinaryName(url), 'mycli')
  }
})

Deno.test('guessBinaryName - with version numbers', () => {
  const urls = [
    'https://example.com/mycli-v1.2.3-linux-x64.tar.gz',
    'https://example.com/mycli_1.2.3_linux_amd64.zip',
    'https://example.com/mycli-1.2.3.darwin.arm64.tgz',
  ]

  for (const url of urls) {
    assertEquals(guessBinaryName(url), 'mycli')
  }
})

Deno.test('guessBinaryName - GitHub release assets', () => {
  const urls = [
    'https://github.com/org/repo/releases/download/v1.2.3/mycli-linux-x64.tar.gz',
    'https://github.com/org/repo/releases/download/v1.2.3/mycli_1.2.3_linux_amd64.zip',
  ]

  for (const url of urls) {
    assertEquals(guessBinaryName(url), 'mycli')
  }
})

Deno.test('guessBinaryName - invalid URL', () => {
  try {
    guessBinaryName('not-a-url')
    throw new Error('Should have thrown for invalid URL')
  } catch (error) {
    assertEquals(
      error instanceof Error ? error.message : String(error),
      'Invalid URL format',
    )
  }
})

Deno.test('guessBinaryName - complex names', () => {
  const testCases = [
    {
      url:
        'https://example.com/git-credential-manager-2.0.935-linux-x64.tar.gz',
      expected: 'git-credential-manager',
    },
    {
      url: 'https://example.com/visual-studio-code-1.80.0-linux-x64.tar.gz',
      expected: 'visual-studio-code',
    },
  ]

  for (const { url, expected } of testCases) {
    assertEquals(guessBinaryName(url), expected)
  }
})
