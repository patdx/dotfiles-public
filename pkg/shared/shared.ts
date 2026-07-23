import { copy, exists, move } from '@std/fs'
import { join } from '@std/path'
import { homedir as getHomeDir } from 'node:os'
import path from 'node:path'

export const PKG_HOME = path.resolve(getHomeDir(), '.patdx', 'pkg')
export const LOCAL_BIN_DIR = path.join(getHomeDir() || '', '.local', 'bin')
export const DESKTOP_DIR = path.join(
  getHomeDir(),
  '.local',
  'share',
  'applications',
)

const MANAGED_PACKAGE_NAME = /^[A-Za-z0-9._-]+$/

export function assertManagedPackageName(name: string): string {
  if (!MANAGED_PACKAGE_NAME.test(name)) {
    throw new Error(
      `Invalid package name '${name}'. Use only letters, numbers, dots, underscores, and hyphens.`,
    )
  }

  return name
}

export async function ensureBinInPath() {
  const path = Deno.env.get('PATH') || ''
  if (!path.includes(LOCAL_BIN_DIR)) {
    const shell = Deno.env.get('SHELL') || ''
    const isZsh = shell.includes('zsh')
    const shellRcFile = isZsh
      ? join(getHomeDir() || '', '.zshrc')
      : join(getHomeDir() || '', '.bashrc')

    console.log(`Detected shell: ${isZsh ? 'zsh' : 'bash'}`)

    await Deno.writeTextFile(
      shellRcFile,
      `\nexport PATH="$PATH:${LOCAL_BIN_DIR}"\n`,
      { append: true },
    )

    console.log(`Added ${LOCAL_BIN_DIR} to PATH in ${shellRcFile}`)
    console.log(
      `Please restart your terminal or run 'source ${shellRcFile}' to apply the changes.`,
    )
  }
}

export async function downloadToFile(url: string, filePath: string) {
  console.log(`Downloading file from ${url} to ${filePath}`)
  const response = await fetch(url)
  const file = await Deno.open(filePath, { create: true, write: true })
  await response.body?.pipeTo(file.writable)
  console.log(`Downloaded file to ${filePath}`)
}

export async function extractZip(
  zipPath: string,
  dir: string,
): Promise<void> {
  const command = new Deno.Command('unzip', {
    args: ['-o', zipPath, '-d', dir],
  })
  const { success, stdout, stderr, signal } = await command.output()

  if (!success) {
    console.log(stdout)
    console.log(stderr)
    console.error(`Command failed: ${command.toString()}`)
    console.error(`Signal: ${signal}`)
    Deno.exit(1)
  }
}

export async function extractTarGz(
  tarPath: string,
  dir: string,
): Promise<void> {
  const command = new Deno.Command('tar', {
    args: ['-xzvf', tarPath, '-C', dir],
  })
  const { success, stdout, stderr, signal } = await command.output()

  if (!success) {
    console.log(stdout)
    console.log(stderr)
    console.error(`Command failed: ${command.toString()}`)
    console.error(`Signal: ${signal}`)
    Deno.exit(1)
  }
}

export async function printNestedFiles(
  dir: string,
  depth: number = 3,
  currentDepth: number = 0,
): Promise<void> {
  if (currentDepth > depth) return

  for await (const entry of Deno.readDir(dir)) {
    console.log(`${'  '.repeat(currentDepth)}- ${entry.name}`)
    if (entry.isDirectory) {
      await printNestedFiles(
        path.join(dir, entry.name),
        depth,
        currentDepth + 1,
      )
    }
  }
}

export async function getProcessingDir(extractedDir: string): Promise<string> {
  const entries = []
  for await (const entry of Deno.readDir(extractedDir)) {
    entries.push(entry)
  }

  // If there's only one directory, return its path
  if (entries.length === 1 && entries[0].isDirectory) {
    return path.join(extractedDir, entries[0].name)
  }

  // Otherwise, return the original extracted directory
  return extractedDir
}

export class TempDir implements Disposable {
  constructor() {
    this.path = Deno.makeTempDirSync()
  }

  path: string;

  // other methods
  [Symbol.dispose]() {
    console.log(`Removing temporary path ${this.path}`)
    Deno.removeSync(this.path, { recursive: true })
  }
}

export async function tryMove(
  from: string,
  to: string,
  options?: {
    overwrite?: boolean
  },
): Promise<void> {
  console.log(`Moving ${from} to ${to}`)

  let err
  err = await move(from, to, {
    overwrite: options?.overwrite,
  }).catch((err) => err)
  if (!err) {
    return
  }
  // console.log(
  //   `Failed to move ${from} to ${to} due to err ${err}. Trying to copy and delete`,
  // )
  err = await copyAndDelete(from, to, {
    overwrite: options?.overwrite,
  }).catch((err) => err)
  if (err) {
    throw err
  }
}

async function copyAndDelete(
  from: string,
  to: string,
  options?: {
    overwrite?: boolean
  },
) {
  await copy(from, to, {
    overwrite: options?.overwrite,
  })
  await Deno.remove(from, {
    recursive: true,
  })
}

// async function createDesktopShortcut(
//   binaryPath: string,
//   name: string,
//   icon?: string,
// ) {
//   const desktopDir = join(getHomeDir(), 'Desktop')
//   const shortcutPath = join(desktopDir, `${name}.desktop`)

//   const shortcutContent = [
//     '[Desktop Entry]',
//     'Type=Application',
//     'Terminal=false',
//     `Name=${name}`,
//     `Exec=${binaryPath}`,
//     icon ? `Icon=${icon}` : '',
//   ].filter(Boolean).join('\n')

//   await Deno.writeTextFile(shortcutPath, shortcutContent)
//   await Deno.chmod(shortcutPath, 0o755)
// }

export async function listInstalledPackages() {
  const packages: Array<{
    name: string
    version: string
    path: string
  }> = []

  try {
    for await (const entry of Deno.readDir(LOCAL_BIN_DIR)) {
      if (!entry.isSymlink) continue

      const linkPath = join(LOCAL_BIN_DIR, entry.name)
      const realPath = await Deno.readLink(linkPath)

      // Check if it points to our PKG_HOME
      if (!realPath.includes(PKG_HOME)) continue

      // Get version by reading the 'current' symlink
      const pkgPath = join(PKG_HOME, entry.name)
      const currentPath = join(pkgPath, 'current')
      let version = 'unknown'
      try {
        const versionPath = await Deno.readLink(currentPath)
        version = versionPath.split('/').pop() || 'unknown'
      } catch {
        // Ignore errors reading version
      }

      packages.push({
        name: entry.name,
        version,
        path: realPath,
      })
    }
  } catch (error) {
    console.error('Error reading installed packages:', error)
    return []
  }

  return packages
}

export async function removePackage(
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const packageName = assertManagedPackageName(name)
    const localBinPath = join(LOCAL_BIN_DIR, packageName)
    const pkgPath = join(PKG_HOME, packageName)

    // Check if package exists
    if (!await exists(localBinPath) && !await exists(pkgPath)) {
      return {
        success: false,
        error: `Package '${packageName}' is not installed`,
      }
    }

    // Remove symlink from .local/bin if it exists
    if (await exists(localBinPath)) {
      await Deno.remove(localBinPath)
    }

    // Remove package directory from .patdx/pkg if it exists
    if (await exists(pkgPath)) {
      await Deno.remove(pkgPath, { recursive: true })
    }

    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      error: `Failed to remove package '${name}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}
