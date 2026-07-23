/**
 * Install arbitrary zipped binaries on Linux
 * @module
 */

import { ensureDir, exists } from '@std/fs'
import { basename, isAbsolute, join } from '@std/path'
import createDesktopShortcut from 'create-desktop-shortcuts'
import {
  assertManagedPackageName,
  DESKTOP_DIR,
  downloadToFile,
  ensureBinInPath,
  extractTarGz,
  extractZip,
  getProcessingDir,
  LOCAL_BIN_DIR,
  PKG_HOME,
  TempDir,
  tryMove,
} from './shared/fs.ts'
import { checkUrl } from './shared/url-checker.ts'
import { guessBinaryName } from './shared/guess-binary-name.ts'
import type {
  FileOptions,
  InstallOptions,
  ShortcutOptions,
} from './shared/schema.ts'

/**
 * Download and extract a single file entry into the version directory.
 *
 * Download and extract are kept together in one function so that the TempDir
 * disposable stays scoped to a single iteration. Splitting them into separate
 * download/extract steps required passing the disposable between functions,
 * which leaked temp directories if the download step failed partway through.
 */
async function downloadAndExtractFile(
  fileOptions: FileOptions,
  installVersionDir: string,
): Promise<void> {
  if (fileOptions.type === 'raw') {
    const filename = fileOptions.filename || basename(fileOptions.url)
    const targetPath = join(installVersionDir, filename)

    console.log(`Downloading ${fileOptions.url} to ${targetPath}`)
    await downloadToFile(fileOptions.url, targetPath)

    if (fileOptions.executable) {
      console.log(`Making ${targetPath} executable`)
      await Deno.chmod(targetPath, 0o755)
    }
    return
  }

  using tempDir = new TempDir()

  const resolvedFile = await checkUrl(
    fileOptions.url,
    fileOptions.url_provider,
  )
  const fileType = fileOptions.type ?? resolvedFile.type
  const downloadFilename = `download.${fileType === 'targz' ? 'tar.gz' : 'zip'}`

  await downloadToFile(
    resolvedFile.binaryUrl,
    join(tempDir.path, downloadFilename),
  )

  const downloadPath = join(tempDir.path, downloadFilename)
  const extractDir = join(tempDir.path, 'extracted')
  await Deno.mkdir(extractDir, { recursive: true })

  if (fileType === 'targz') {
    await extractTarGz(downloadPath, extractDir)
  } else {
    await extractZip(downloadPath, extractDir)
  }

  const processingDir = await getProcessingDir(extractDir)
  console.log(`Processing directory: ${processingDir}`)

  await tryMove(processingDir, installVersionDir, { overwrite: true })
}

async function linkCurrentVersion(
  binaryName: string,
  installVersionDir: string,
  installCurrentDir: string,
): Promise<string> {
  console.log(`Linking ${installCurrentDir} to ${installVersionDir}`)
  if (await exists(installCurrentDir)) {
    await Deno.remove(installCurrentDir, { recursive: true })
  }
  await Deno.symlink(installVersionDir, installCurrentDir)

  await ensureDir(LOCAL_BIN_DIR)
  const localBinPath = join(LOCAL_BIN_DIR, binaryName)
  const binaryPath = join(installCurrentDir, binaryName)

  console.log(`Linking ${localBinPath} to ${binaryPath}`)
  if (await exists(localBinPath)) {
    await Deno.remove(localBinPath)
  }

  if (await exists(binaryPath)) {
    await Deno.symlink(binaryPath, localBinPath)
  }

  await ensureBinInPath()
  return localBinPath
}

function createShortcut(
  shortcut: ShortcutOptions | undefined,
  binaryName: string,
  localBinPath: string,
  installVersionDir: string,
): void {
  if (!shortcut) return

  const icon = shortcut.icon
    ? (isAbsolute(shortcut.icon)
      ? shortcut.icon
      : join(installVersionDir, shortcut.icon))
    : undefined

  const success = createDesktopShortcut({
    linux: {
      filePath: localBinPath,
      outputPath: DESKTOP_DIR,
      name: shortcut.name || basename(binaryName),
      icon,
    },
  })

  console.log(`Shortcut created: ${success}`)
}

export async function downloadAndInstall(install: InstallOptions) {
  const {
    files = [],
    binary_name: providedBinaryName,
    version = 'latest',
    shortcut,
    post_install_message,
  } = install

  if (files.length === 0) {
    throw new Error('No files specified for download')
  }

  const firstFile = files[0]
  const { binaryUrl, version: detectedVersion } = await checkUrl(
    firstFile.url,
    firstFile.url_provider,
  )

  const binaryName = assertManagedPackageName(
    providedBinaryName ?? guessBinaryName(binaryUrl),
  )
  const finalVersion = version === 'latest'
    ? (detectedVersion ?? 'latest')
    : version

  const installDir = join(PKG_HOME, binaryName)
  const installVersionDir = join(installDir, finalVersion)
  const installCurrentDir = join(installDir, 'current')

  if (await exists(installCurrentDir)) {
    try {
      const currentTarget = await Deno.readLink(installCurrentDir)
      const currentVersion = currentTarget.split('/').pop()
      if (currentVersion === finalVersion) {
        console.log(
          `${binaryName} ${finalVersion} is already installed and is the current version`,
        )
        return
      }
    } catch (error: unknown) {
      console.warn(
        `Could not read current version symlink: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  if (await exists(installVersionDir)) {
    console.log(`${binaryName} ${finalVersion} is already downloaded`)
  } else {
    await Deno.mkdir(installDir, { recursive: true })
    await Deno.mkdir(installVersionDir, { recursive: true })
    for (const fileOptions of files) {
      await downloadAndExtractFile(fileOptions, installVersionDir)
    }
  }

  const localBinPath = await linkCurrentVersion(
    binaryName,
    installVersionDir,
    installCurrentDir,
  )

  createShortcut(shortcut, binaryName, localBinPath, installVersionDir)

  if (post_install_message) {
    console.log('')
    console.log(post_install_message)
    console.log('')
  }

  console.log(
    `${binaryName} version ${finalVersion} has been installed to ${installVersionDir}`,
  )
  console.log(`Binary available at: ${localBinPath}`)
}
