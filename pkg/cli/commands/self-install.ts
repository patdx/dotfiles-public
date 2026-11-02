import { printMigrationGuide } from '../../shared/migration.ts'

/** The final JSR release guides users to npm instead of reinstalling itself. */
export async function runSelfInstall(): Promise<void> {
  await printMigrationGuide()
}
