import { parseArgs } from '@std/cli/parse-args'
import { maybeNotifyPkgUpdate } from './shared/jsr-update-check.ts'
import {
  handleAddCommand,
  handleListCommand,
  handleOutdatedCommand,
  handleRemoveCommand,
  handleRepoCommand,
  handleUpdateCommand,
  printHelp,
  runSelfInstall,
} from './cli/commands/mod.ts'

async function main(inputArgs: string[]): Promise<void> {
  await maybeNotifyPkgUpdate()

  const args = parseArgs(inputArgs, {
    string: ['url', 'url-provider', 'version', 'name'],
    boolean: ['help'],
    alias: {
      h: 'help',
      n: 'name',
    },
  })

  if (args.help) {
    printHelp()
    Deno.exit(0)
  }

  const [command, subcommand, ...rest] = args._

  if (command === 'self-install' || command === 'self-update') {
    await runSelfInstall()
    return
  }

  if (command === 'list') {
    await handleListCommand()
    return
  }

  if (command === 'repo') {
    await handleRepoCommand(
      typeof subcommand === 'string' ? subcommand : undefined,
      rest,
    )
    return
  }

  if (command === 'outdated') {
    await handleOutdatedCommand()
    return
  }

  if (command === 'update') {
    const names = [subcommand, ...rest]
      .filter((value): value is string => typeof value === 'string')
    await handleUpdateCommand(names)
    return
  }

  if (command === 'remove') {
    if (!subcommand || typeof subcommand !== 'string') {
      console.error('Error: Package name is required')
      printHelp()
      Deno.exit(1)
    }
    await handleRemoveCommand(subcommand)
    return
  }

  if (command === 'add') {
    await handleAddCommand(args.url || subcommand, args, printHelp)
    return
  }

  printHelp()
  Deno.exit(1)
}

if (import.meta.main) {
  await main(Deno.args)
}
