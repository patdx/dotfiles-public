import { join } from '@std/path'
import { homedir as getHomeDir } from 'node:os'

export const SELF_INSTALL_ARGS = [
  'install',
  '-g',
  '-A',
  '-f',
  '-n',
  'ppkg',
  // Allow freshly published JSR versions (Deno default min age is 24h).
  '--min-dep-age=0',
  'jsr:@patdx/pkg',
] as const

async function denoOnPath(): Promise<boolean> {
  try {
    const output = await new Deno.Command('which', {
      args: ['deno'],
      stdout: 'null',
      stderr: 'null',
    }).output()
    return output.success
  } catch {
    return false
  }
}

export async function runSelfInstall(): Promise<void> {
  if (!await denoOnPath()) {
    console.error('Error: deno is not installed or not on PATH')
    Deno.exit(1)
  }

  console.log(`Running: deno ${SELF_INSTALL_ARGS.join(' ')}`)
  const child = new Deno.Command('deno', {
    args: [...SELF_INSTALL_ARGS],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn()
  const status = await child.status
  if (!status.success) {
    console.error(
      `Error: deno install failed with code ${status.code ?? 1}`,
    )
    Deno.exit(status.code || 1)
  }

  const denoBin = join(getHomeDir() || '', '.deno', 'bin')
  const path = Deno.env.get('PATH') || ''
  if (!path.split(':').includes(denoBin)) {
    console.log(
      `\nAdd Deno's bin directory to your PATH if needed:\n  export PATH="$HOME/.deno/bin:$PATH"`,
    )
  }
  console.log('\nInstalled as: ppkg')
}
