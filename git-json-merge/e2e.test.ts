import { assertEquals } from '@std/assert'
import * as dax from '@david/dax'

const extraEnv = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
}

// $.setInfoLogger((...args: any[]) => {
//   // a more real example might be logging to a file
//   console.log('Logging...')
//   console.log(...args)
// })

// // creates a $ object with the provided starting environment
// const x$ = build$({
//   commandBuilder: new CommandBuilder()
//     .env({
//       GIT_CONFIG_GLOBAL: '/dev/null',
//       GIT_CONFIG_SYSTEM: '/dev/null',
//     }).stdout('piped').stderr('piped'),
// })

// End to end test with actual git repo
Deno.test('end to end git merge driver test', async () => {
  const testDir = await Deno.makeTempDir({ prefix: 'git-json-merge-test-' })

  console.log('Test dir:', testDir)

  const $ = dax.build$({
    commandBuilder: new dax.CommandBuilder().env(extraEnv).cwd(testDir),
  })
  $.setPrintCommand(true)

  try {
    // Initialize git repo
    await $`git init -b main`

    await $`git config user.name "Test User"`
    await $`git config user.email "test@example.com"`

    // Get absolute path to the CLI script
    const cliPath = new URL('./cli.ts', import.meta.url).pathname

    // Configure git merge driver using absolute path to our CLI with all required permissions
    const mergeDriver =
      `deno run --allow-read --allow-write --allow-env ${cliPath} %A %O %B`

    await $`git config merge.merge-json.driver ${mergeDriver}`

    // Create .gitattributes
    await Deno.writeTextFile(
      `${testDir}/.gitattributes`,
      '*.json merge=merge-json\n',
    )

    // Create and commit initial JSON file
    const initialJson = {
      name: 'test',
      version: '1.0.0',
      settings: {
        enabled: true,
      },
    }
    await Deno.writeTextFile(
      `${testDir}/config.json`,
      JSON.stringify(initialJson, null, 2),
    )

    await $`git add .`
    await $`git commit -m "Initial commit"`

    // Create feature branch
    await $`git checkout -b feature`

    // Modify JSON in feature branch
    const featureJson = {
      name: 'test',
      version: '1.0.0',
      settings: {
        enabled: true,
        feature: true,
      },
    }
    await Deno.writeTextFile(
      `${testDir}/config.json`,
      JSON.stringify(featureJson, null, 2),
    )

    await $`git commit -am "Add feature setting"`

    // Go back to main and make a different change
    await $`git checkout main`

    const mainJson = {
      name: 'test',
      version: '2.0.0',
      settings: {
        enabled: true,
      },
    }
    await Deno.writeTextFile(
      `${testDir}/config.json`,
      JSON.stringify(mainJson, null, 2),
    )

    await $`git commit -am "Bump version"`

    // Try to merge feature branch - this should create a conflict
    // but our merge driver should handle it
    await $`GIT_TRACE=1 git merge feature`.env(extraEnv)

    // Read the resulting file
    const finalContent = await Deno.readTextFile(`${testDir}/config.json`)
    const finalJson = JSON.parse(finalContent)

    // Verify the merge was successful
    assertEquals(finalJson, {
      name: 'test',
      version: '2.0.0',
      settings: {
        enabled: true,
        feature: true,
      },
    })
  } finally {
    // Clean up
    await Deno.remove(testDir, { recursive: true })
  }
})
