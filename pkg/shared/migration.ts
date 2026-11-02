import { DELIMITER, join, normalize } from '@std/path'
import { homedir } from 'node:os'

export const NPM_INSTALL_COMMAND = 'npm install -g @patdx/ppkg'

/** Identify a legacy launcher that takes precedence over the npm installation. */
export function isLegacyLauncher(
  path: string,
  denoInstallRoot: string,
): boolean {
  return normalize(path) === normalize(join(denoInstallRoot, 'bin', 'ppkg'))
}

export function migrationMessage(
  launcher?: string,
  denoInstallRoot = join(homedir(), '.deno'),
): string {
  const lines = [
    'ppkg has moved to https://github.com/patdx/ppkg',
    'This is the final Deno/JSR release of @patdx/pkg. New releases use @patdx/ppkg on npm.',
    '',
    'To migrate (requires Node.js >=22.18 and npm):',
    `  ${NPM_INSTALL_COMMAND}`,
    '',
    'After the npm installation succeeds, remove the old Deno launcher:',
    '  deno uninstall -g ppkg',
    '  hash -r',
    '  command -v ppkg',
    '',
    'Your ~/.ppkg configuration, installed packages, and ~/.local/bin links are preserved.',
  ]
  if (launcher && isLegacyLauncher(launcher, denoInstallRoot)) {
    lines.push(
      '',
      `The old Deno launcher currently takes precedence: ${launcher}`,
    )
  }
  lines.push(
    '',
    'If the old CLI still runs, use `type -a ppkg` to inspect your PATH.',
  )
  return lines.join('\n')
}

async function firstLauncher(): Promise<string | undefined> {
  for (const directory of (Deno.env.get('PATH') ?? '').split(DELIMITER)) {
    if (!directory) continue
    const path = join(directory, 'ppkg')
    try {
      const info = await Deno.stat(path)
      if (info.isFile && ((info.mode ?? 0) & 0o111) !== 0) return path
    } catch {
      // Missing or inaccessible PATH entries do not prevent migration guidance.
    }
  }
}

export async function printMigrationGuide(): Promise<void> {
  const root = Deno.env.get('DENO_INSTALL_ROOT') ?? join(homedir(), '.deno')
  console.log(migrationMessage(await firstLauncher(), root))
}

export function maybeNotifyMigration(): void {
  if (
    !Deno.stderr.isTerminal() ||
    Deno.env.get('PPKG_NO_MIGRATION_NOTICE') === '1'
  ) return
  console.error(
    `ppkg has moved to npm. Install with: ${NPM_INSTALL_COMMAND}\nRun ppkg self-update for migration instructions.\n`,
  )
}
