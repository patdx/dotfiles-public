import {
  loadConfig,
  normalizeRepoBase,
  saveConfig,
} from '../../shared/repo-config.ts'
import { updateAllRepoCaches } from '../../shared/repo-cache.ts'
import { DEFAULT_REMOTE_REPO } from '../../shared/schema.ts'

function requireRepoUrlArg(
  rest: Array<string | number>,
  subcommand: 'add' | 'remove',
): string {
  const url = rest[0]
  if (!url || typeof url !== 'string') {
    console.error('Error: repo URL is required')
    console.error(`Usage: ppkg repo ${subcommand} <url>`)
    Deno.exit(1)
  }
  return url
}

async function handleRepoList(): Promise<void> {
  const config = await loadConfig()
  console.log('Configured repos:')
  for (const entry of config.repos) {
    console.log(`  ${entry.url}`)
  }
  if (config.repos.length === 0) {
    console.log(`  (default) ${DEFAULT_REMOTE_REPO}`)
  }
}

async function handleRepoAdd(rest: Array<string | number>): Promise<void> {
  const url = requireRepoUrlArg(rest, 'add')
  const config = await loadConfig()
  const normalized = normalizeRepoBase(url)
  if (
    config.repos.some((entry) => normalizeRepoBase(entry.url) === normalized)
  ) {
    console.log(`Repo already configured: ${normalized}`)
    return
  }
  config.repos.push({ url: normalized })
  await saveConfig(config)
  console.log(`Added repo: ${normalized}`)
}

async function handleRepoRemove(rest: Array<string | number>): Promise<void> {
  const url = requireRepoUrlArg(rest, 'remove')
  const config = await loadConfig()
  const normalized = normalizeRepoBase(url)
  const next = config.repos.filter((entry) =>
    normalizeRepoBase(entry.url) !== normalized
  )
  if (next.length === config.repos.length) {
    console.error(`Repo not found: ${normalized}`)
    Deno.exit(1)
  }
  await saveConfig({ repos: next })
  console.log(`Removed repo: ${normalized}`)
}

async function handleRepoUpdate(): Promise<void> {
  const updated = await updateAllRepoCaches()
  if (updated.length === 0) {
    console.log('No repos updated')
  } else {
    console.log('Updated repos:')
    for (const base of updated) {
      console.log(`  ${base}`)
    }
  }
}

export async function handleRepoCommand(
  subcommand: string | undefined,
  rest: Array<string | number>,
): Promise<void> {
  if (subcommand === 'list') {
    await handleRepoList()
    return
  }

  if (subcommand === 'add') {
    await handleRepoAdd(rest)
    return
  }

  if (subcommand === 'remove') {
    await handleRepoRemove(rest)
    return
  }

  if (subcommand === 'update') {
    await handleRepoUpdate()
    return
  }

  console.error('Usage: ppkg repo list|add|remove|update')
  Deno.exit(1)
}
