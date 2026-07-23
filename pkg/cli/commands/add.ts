import { downloadAndInstall } from '../../install-binary.ts'
import { resolvePackage } from '../../resolve.ts'

export async function handleAddCommand(
  specifier: string | number | undefined,
  args: { name?: string; version?: string; 'url-provider'?: string },
  printHelp: () => void,
): Promise<void> {
  if (!specifier || typeof specifier !== 'string') {
    console.error(
      'Error: URL or package name is required. Provide it as --url flag or first argument',
    )
    printHelp()
    Deno.exit(1)
  }

  const isURL = URL.canParse(specifier)

  if (isURL) {
    await downloadAndInstall({
      binary_name: args.name,
      version: args.version,
      files: [{
        url: specifier,
        url_provider: args['url-provider'],
      }],
    })
  } else {
    try {
      const knownPackage = await resolvePackage(specifier)
      await downloadAndInstall(knownPackage)
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : String(error),
      )
      printHelp()
      Deno.exit(1)
    }
  }
}
