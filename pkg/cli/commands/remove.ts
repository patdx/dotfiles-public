import { removePackage } from '../../shared/fs.ts'

export async function handleRemoveCommand(name: string): Promise<void> {
  const result = await removePackage(name)
  if (!result.success) {
    console.error(result.error)
    Deno.exit(1)
  }
  console.log(`Successfully removed package '${name}'`)
}
