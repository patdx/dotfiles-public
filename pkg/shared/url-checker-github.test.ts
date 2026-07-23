import { assert, assertEquals } from '@std/assert'
import {
  analyzeAssets,
  findViableAsset,
  getPlatformIdentifiers,
} from './url-checker-github.ts'
import type { GithubRelease } from './url-checker-github.ts'

const duckdbAssets: GithubRelease['assets'] = [
  {
    name: 'duckdb_cli-linux-aarch64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_cli-linux-aarch64.zip',
  },
  {
    name: 'duckdb_cli-linux-amd64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_cli-linux-amd64.zip',
  },
  {
    name: 'duckdb_cli-osx-universal.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_cli-osx-universal.zip',
  },
  {
    name: 'duckdb_cli-windows-amd64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_cli-windows-amd64.zip',
  },
  {
    name: 'duckdb_cli-windows-arm64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_cli-windows-arm64.zip',
  },
  {
    name: 'duckdb_python_src.tar.gz',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/duckdb_python_src.tar.gz',
  },
  {
    name: 'libduckdb-linux-aarch64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-linux-aarch64.zip',
  },
  {
    name: 'libduckdb-linux-amd64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-linux-amd64.zip',
  },
  {
    name: 'libduckdb-osx-universal.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-osx-universal.zip',
  },
  {
    name: 'libduckdb-src.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-src.zip',
  },
  {
    name: 'libduckdb-windows-amd64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-windows-amd64.zip',
  },
  {
    name: 'libduckdb-windows-arm64.zip',
    browser_download_url:
      'https://github.com/duckdb/duckdb/releases/download/v0.9.2/libduckdb-windows-arm64.zip',
  },
]

Deno.test('analyzeAssets - Linux AMD64', () => {
  const context = { platform: 'linux', arch: 'x64' }
  const analysis = analyzeAssets(duckdbAssets, context)

  // Check duckdb_cli-linux-amd64.zip analysis
  const cliAsset = analysis.find((a) => a.name === 'duckdb_cli-linux-amd64.zip')
  assertEquals({
    matchingPlatform: cliAsset?.analysis.matchingPlatform,
    matchingArch: cliAsset?.analysis.matchingArch,
    isBinary: cliAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'linux',
    matchingArch: 'amd64',
    isBinary: true,
  })

  // Check libduckdb-linux-amd64.zip analysis
  const libAsset = analysis.find((a) => a.name === 'libduckdb-linux-amd64.zip')
  assertEquals({
    matchingPlatform: libAsset?.analysis.matchingPlatform,
    matchingArch: libAsset?.analysis.matchingArch,
    isBinary: libAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'linux',
    matchingArch: 'amd64',
    isBinary: true,
  })
})

Deno.test('analyzeAssets - Darwin ARM64', () => {
  const context = { platform: 'darwin', arch: 'arm64' }
  const analysis = analyzeAssets(duckdbAssets, context)

  // Check duckdb_cli-osx-universal.zip analysis
  const cliAsset = analysis.find((a) =>
    a.name === 'duckdb_cli-osx-universal.zip'
  )
  assertEquals({
    matchingPlatform: cliAsset?.analysis.matchingPlatform,
    matchingArch: cliAsset?.analysis.matchingArch,
    isBinary: cliAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'osx',
    matchingArch: 'universal',
    isBinary: true,
  })

  // Check libduckdb-osx-universal.zip analysis
  const libAsset = analysis.find((a) =>
    a.name === 'libduckdb-osx-universal.zip'
  )
  assertEquals({
    matchingPlatform: libAsset?.analysis.matchingPlatform,
    matchingArch: libAsset?.analysis.matchingArch,
    isBinary: libAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'osx',
    matchingArch: 'universal',
    isBinary: true,
  })
})

Deno.test('analyzeAssets - Windows ARM64', () => {
  const context = { platform: 'win32', arch: 'arm64' }
  const analysis = analyzeAssets(duckdbAssets, context)

  // Check duckdb_cli-windows-arm64.zip analysis
  const cliAsset = analysis.find((a) =>
    a.name === 'duckdb_cli-windows-arm64.zip'
  )
  assertEquals({
    matchingPlatform: cliAsset?.analysis.matchingPlatform,
    matchingArch: cliAsset?.analysis.matchingArch,
    isBinary: cliAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'windows',
    matchingArch: 'arm64',
    isBinary: true,
  })

  // Check libduckdb-windows-arm64.zip analysis
  const libAsset = analysis.find((a) =>
    a.name === 'libduckdb-windows-arm64.zip'
  )
  assertEquals({
    matchingPlatform: libAsset?.analysis.matchingPlatform,
    matchingArch: libAsset?.analysis.matchingArch,
    isBinary: libAsset?.analysis.isBinary,
  }, {
    matchingPlatform: 'windows',
    matchingArch: 'arm64',
    isBinary: true,
  })
})

Deno.test('analyzeAssets - Source packages', () => {
  const context = { platform: 'linux', arch: 'x64' }
  const analysis = analyzeAssets(duckdbAssets, context)

  // Check source packages are marked as binaries but don't match platform/arch
  const pythonSrc = analysis.find((a) => a.name === 'duckdb_python_src.tar.gz')
  assertEquals({
    matchingPlatform: pythonSrc?.analysis.matchingPlatform,
    matchingArch: pythonSrc?.analysis.matchingArch,
    isBinary: pythonSrc?.analysis.isBinary,
  }, {
    matchingPlatform: undefined,
    matchingArch: undefined,
    isBinary: true,
  })

  const libSrc = analysis.find((a) => a.name === 'libduckdb-src.zip')
  assertEquals({
    matchingPlatform: libSrc?.analysis.matchingPlatform,
    matchingArch: libSrc?.analysis.matchingArch,
    isBinary: libSrc?.analysis.isBinary,
  }, {
    matchingPlatform: undefined,
    matchingArch: undefined,
    isBinary: true,
  })
})

Deno.test('analyzeAssets - Scoring heuristics', () => {
  const context = { platform: 'linux', arch: 'x64' }
  const analysis = analyzeAssets(duckdbAssets, context)

  // CLI should have a higher score than lib
  const cliAsset = analysis.find((a) => a.name === 'duckdb_cli-linux-amd64.zip')
  const libAsset = analysis.find((a) => a.name === 'libduckdb-linux-amd64.zip')
  const srcAsset = analysis.find((a) => a.name === 'libduckdb-src.zip')

  // Ensure all assets were found
  assert(cliAsset, 'CLI asset not found')
  assert(libAsset, 'Lib asset not found')
  assert(srcAsset, 'Source asset not found')

  // CLI should have positive score
  assertEquals(cliAsset.analysis.score > 0, true)
  // Lib should have negative score
  assertEquals(libAsset.analysis.score < 0, true)
  // Source should have lowest score
  assertEquals(srcAsset.analysis.score < libAsset.analysis.score, true)

  // CLI should have higher score than lib
  assertEquals(cliAsset.analysis.score > libAsset.analysis.score, true)
})

Deno.test('analyzeAssets - Additional scoring patterns', () => {
  const testAssets: GithubRelease['assets'] = [
    {
      name: 'app-bin-linux-amd64.zip',
      browser_download_url: 'https://example.com/app-bin-linux-amd64.zip',
    },
    {
      name: 'app-debug-linux-amd64.zip',
      browser_download_url: 'https://example.com/app-debug-linux-amd64.zip',
    },
    {
      name: 'app.exe',
      browser_download_url: 'https://example.com/app.exe',
    },
    {
      name: 'app-dev-symbols.zip',
      browser_download_url: 'https://example.com/app-dev-symbols.zip',
    },
    {
      name: 'libapp-static.zip',
      browser_download_url: 'https://example.com/libapp-static.zip',
    },
  ]

  const context = { platform: 'linux', arch: 'x64' }
  const analysis = analyzeAssets(testAssets, context)

  // Assets should be sorted by score, so we can check order
  assertEquals(
    analysis[0].name,
    'app-bin-linux-amd64.zip',
    'Binary should be highest',
  )
  assertEquals(analysis[1].name, 'app.exe', 'Exe should be second')
  assert(
    analysis.findIndex((a) => a.name === 'app-debug-linux-amd64.zip') >
      analysis.findIndex((a) => a.name === 'app.exe'),
    'Debug should be lower than exe',
  )
  assert(
    analysis.findIndex((a) => a.name === 'app-dev-symbols.zip') >
      analysis.findIndex((a) => a.name === 'app-debug-linux-amd64.zip'),
    'Dev symbols should be lower than debug',
  )
  assert(
    analysis.findIndex((a) => a.name === 'libapp-static.zip') >
      analysis.findIndex((a) => a.name === 'app.exe'),
    'Static lib should be lower than exe',
  )
})

Deno.test('findViableAsset - Multiple viable assets', () => {
  const testAssets: GithubRelease['assets'] = [
    {
      name: 'app-cli-linux-amd64.zip',
      browser_download_url: 'https://example.com/app-cli-linux-amd64.zip',
    },
    {
      name: 'app-bin-linux-amd64.zip',
      browser_download_url: 'https://example.com/app-bin-linux-amd64.zip',
    },
    {
      name: 'app-linux-amd64.zip',
      browser_download_url: 'https://example.com/app-linux-amd64.zip',
    },
  ]

  const context = { platform: 'linux', arch: 'x64' }
  const analysis = analyzeAssets(testAssets, context)

  // Capture console.warn output
  const originalWarn = console.warn
  let warnOutput = ''
  console.warn = (msg: string) => {
    warnOutput = msg
  }

  try {
    const asset = findViableAsset(analysis, context)
    assert(asset, 'Should find a viable asset')
    assertEquals(
      asset.name,
      'app-cli-linux-amd64.zip',
      'Should select highest scored asset',
    )

    // Verify warning was printed
    assert(
      warnOutput.includes(
        'Warning: Found multiple matching assets for your system:',
      ),
    )
    assert(warnOutput.includes('app-cli-linux-amd64.zip'))
    assert(warnOutput.includes('app-bin-linux-amd64.zip'))
    assert(warnOutput.includes('app-linux-amd64.zip'))
    assert(warnOutput.includes('Score:'))
    assert(
      warnOutput.includes(
        'Selecting highest scored asset: app-cli-linux-amd64.zip',
      ),
    )
  } finally {
    // Restore original console.warn
    console.warn = originalWarn
  }
})

Deno.test('getPlatformIdentifiers - Linux x64', () => {
  const context = { platform: 'linux', arch: 'x64' }
  const { platforms, archs } = getPlatformIdentifiers(context)

  assertEquals(platforms, ['linux'], 'Should only include linux platform')
  assertEquals(
    archs,
    ['x64', 'amd64', 'x86_64'],
    'Should include x64 and its aliases amd64 and x86_64',
  )
})

const codexbarAssets: GithubRelease['assets'] = [
  {
    name: 'CodexBarCLI-v0.45.2-linux-musl-x86_64.tar.gz',
    browser_download_url:
      'https://github.com/steipete/CodexBar/releases/download/v0.45.2/CodexBarCLI-v0.45.2-linux-musl-x86_64.tar.gz',
  },
  {
    name: 'CodexBarCLI-v0.45.2-linux-x86_64.tar.gz',
    browser_download_url:
      'https://github.com/steipete/CodexBar/releases/download/v0.45.2/CodexBarCLI-v0.45.2-linux-x86_64.tar.gz',
  },
  {
    name: 'CodexBarCLI-v0.45.2-linux-x86_64.tar.gz.sha256',
    browser_download_url:
      'https://github.com/steipete/CodexBar/releases/download/v0.45.2/CodexBarCLI-v0.45.2-linux-x86_64.tar.gz.sha256',
  },
]

Deno.test('findViableAsset - CodexBar CLI prefers glibc on gnu hosts', () => {
  const context = { platform: 'linux', arch: 'x64', libc: 'gnu' as const }
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    const asset = findViableAsset(
      analyzeAssets(codexbarAssets, context),
      context,
    )
    assertEquals(asset?.name, 'CodexBarCLI-v0.45.2-linux-x86_64.tar.gz')
  } finally {
    console.warn = originalWarn
  }
})

Deno.test('findViableAsset - CodexBar CLI prefers musl on musl hosts', () => {
  const context = { platform: 'linux', arch: 'x64', libc: 'musl' as const }
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    const asset = findViableAsset(
      analyzeAssets(codexbarAssets, context),
      context,
    )
    assertEquals(
      asset?.name,
      'CodexBarCLI-v0.45.2-linux-musl-x86_64.tar.gz',
    )
  } finally {
    console.warn = originalWarn
  }
})
