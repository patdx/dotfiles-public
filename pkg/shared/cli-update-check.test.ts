import { assertEquals } from '@std/assert'
import { join } from '@std/path'
import {
  formatUpdateNotice,
  maybeNotifyCliUpdate,
  pickLatestVersion,
  shouldNotifyUpdate,
  type JsrPackageMeta,
} from './cli-update-check.ts'

Deno.test('pickLatestVersion prefers meta.latest when not yanked', () => {
  const meta: JsrPackageMeta = {
    latest: '0.7.0',
    versions: {
      '0.6.0': {},
      '0.7.0': {},
      '0.8.0': { yanked: true },
    },
  }
  assertEquals(pickLatestVersion(meta), '0.7.0')
})

Deno.test('pickLatestVersion skips yanked latest and picks max non-yanked', () => {
  const meta: JsrPackageMeta = {
    latest: '0.8.0',
    versions: {
      '0.6.0': {},
      '0.7.0': {},
      '0.8.0': { yanked: true },
    },
  }
  assertEquals(pickLatestVersion(meta), '0.7.0')
})

Deno.test('pickLatestVersion returns null when all yanked or empty', () => {
  assertEquals(pickLatestVersion({ versions: { '1.0.0': { yanked: true } } }), null)
  assertEquals(pickLatestVersion({}), null)
})

Deno.test('shouldNotifyUpdate compares dotted semver', () => {
  assertEquals(shouldNotifyUpdate('0.7.0', '0.8.0'), true)
  assertEquals(shouldNotifyUpdate('0.7.0', '0.7.0'), false)
  assertEquals(shouldNotifyUpdate('0.8.0', '0.7.0'), false)
  assertEquals(shouldNotifyUpdate('0.7.0', '0.7.1'), true)
})

Deno.test('formatUpdateNotice brands ppkg self-update', () => {
  const notice = formatUpdateNotice('0.7.0', '0.8.0')
  assertEquals(
    notice.includes('Update available: @patdx/pkg 0.7.0 → 0.8.0'),
    true,
  )
  assertEquals(notice.includes('ppkg self-update'), true)
  assertEquals(
    notice.includes('deno install -g -A -f -n ppkg jsr:@patdx/pkg'),
    true,
  )
})

Deno.test('maybeNotifyCliUpdate skips when env opt-out is set', async () => {
  let fetched = false
  let notices = 0
  await maybeNotifyCliUpdate({
    env: { get: (key) => key === 'PPKG_NO_UPDATE_CHECK' ? '1' : undefined },
    isTerminal: () => true,
    fetchMeta: async () => {
      fetched = true
      return { latest: '9.0.0', versions: { '9.0.0': {} } }
    },
    writeNotice: () => {
      notices++
    },
  })
  assertEquals(fetched, false)
  assertEquals(notices, 0)
})

Deno.test('maybeNotifyCliUpdate skips when stderr is not a TTY', async () => {
  let fetched = false
  await maybeNotifyCliUpdate({
    env: { get: () => undefined },
    isTerminal: () => false,
    fetchMeta: async () => {
      fetched = true
      return { latest: '9.0.0', versions: { '9.0.0': {} } }
    },
    writeNotice: () => {},
  })
  assertEquals(fetched, false)
})

Deno.test('maybeNotifyCliUpdate notifies when behind and writes cache', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'pkg-update-check-' })
  const cachePath = join(tempDir, 'cli-update-check.json')
  const notices: string[] = []

  try {
    await maybeNotifyCliUpdate({
      currentVersion: '0.7.0',
      cachePath,
      ttlMs: 24 * 60 * 60 * 1000,
      now: () => 1_000_000,
      env: { get: () => undefined },
      isTerminal: () => true,
      fetchMeta: async () => ({
        latest: '0.8.0',
        versions: { '0.7.0': {}, '0.8.0': {} },
      }),
      writeNotice: (message) => notices.push(message),
    })

    assertEquals(notices.length, 1)
    assertEquals(notices[0].includes('0.7.0 → 0.8.0'), true)

    const cache = JSON.parse(await Deno.readTextFile(cachePath))
    assertEquals(cache.checked_at, 1_000_000)

    // Within TTL: no second fetch / notice
    let fetchedAgain = false
    await maybeNotifyCliUpdate({
      currentVersion: '0.7.0',
      cachePath,
      ttlMs: 24 * 60 * 60 * 1000,
      now: () => 1_000_000 + 60_000,
      env: { get: () => undefined },
      isTerminal: () => true,
      fetchMeta: async () => {
        fetchedAgain = true
        return { latest: '0.9.0', versions: { '0.9.0': {} } }
      },
      writeNotice: (message) => notices.push(message),
    })
    assertEquals(fetchedAgain, false)
    assertEquals(notices.length, 1)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('maybeNotifyCliUpdate stays quiet when already latest', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'pkg-update-check-' })
  const cachePath = join(tempDir, 'cli-update-check.json')
  let notices = 0

  try {
    await maybeNotifyCliUpdate({
      currentVersion: '0.8.0',
      cachePath,
      now: () => 1,
      env: { get: () => undefined },
      isTerminal: () => true,
      fetchMeta: async () => ({
        latest: '0.8.0',
        versions: { '0.8.0': {} },
      }),
      writeNotice: () => {
        notices++
      },
    })
    assertEquals(notices, 0)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('maybeNotifyCliUpdate swallows fetch failures', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'pkg-update-check-' })
  const cachePath = join(tempDir, 'cli-update-check.json')
  let notices = 0

  try {
    await maybeNotifyCliUpdate({
      currentVersion: '0.7.0',
      cachePath,
      now: () => 1,
      env: { get: () => undefined },
      isTerminal: () => true,
      fetchMeta: async () => {
        throw new Error('network down')
      },
      writeNotice: () => {
        notices++
      },
    })
    assertEquals(notices, 0)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
