import { assertEquals, assertRejects } from '@std/assert'
import { downloadToFile } from './fs.ts'

async function withMockFetch(
  response: Response,
  test: (directory: string) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const directory = await Deno.makeTempDir({ prefix: 'ppkg-download-test-' })
  globalThis.fetch = () => Promise.resolve(response)

  try {
    await test(directory)
  } finally {
    globalThis.fetch = originalFetch
    await Deno.remove(directory, { recursive: true })
  }
}

Deno.test('downloadToFile atomically replaces the destination on success', async () => {
  await withMockFetch(new Response('new contents'), async (directory) => {
    const destination = `${directory}/artifact`
    await Deno.writeTextFile(destination, 'old contents')

    await downloadToFile('https://example.test/artifact', destination)

    assertEquals(await Deno.readTextFile(destination), 'new contents')
    assertEquals(
      [...Deno.readDirSync(directory)].map((entry) => entry.name),
      ['artifact'],
    )
  })
})

Deno.test('downloadToFile rejects HTTP errors without changing the destination', async () => {
  await withMockFetch(
    new Response('not found', { status: 404, statusText: 'Not Found' }),
    async (directory) => {
      const destination = `${directory}/artifact`
      await Deno.writeTextFile(destination, 'keep me')

      await assertRejects(
        () => downloadToFile('https://example.test/missing', destination),
        Error,
        'HTTP 404 Not Found',
      )

      assertEquals(await Deno.readTextFile(destination), 'keep me')
    },
  )
})

Deno.test('downloadToFile rejects an empty response body', async () => {
  await withMockFetch(new Response(null), async (directory) => {
    await assertRejects(
      () =>
        downloadToFile('https://example.test/empty', `${directory}/artifact`),
      Error,
      'no response body',
    )
  })
})
