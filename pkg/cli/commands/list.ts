import { listInstalledPackages } from '../../shared/fs.ts'
import { listAvailablePackageNames } from '../../shared/repo-cache.ts'

export async function handleListCommand(): Promise<void> {
  const [packages, availablePackages] = await Promise.all([
    listInstalledPackages(),
    listAvailablePackageNames(),
  ])

  console.log('Installed packages:')
  if (packages.length === 0) {
    console.log('  No packages installed')
  } else {
    for (const pkg of packages) {
      console.log(`  ${pkg.name} (${pkg.version})`)
    }
  }

  console.log('\nAvailable packages:')
  if (availablePackages.length === 0) {
    console.log('  No packages available')
  } else {
    for (const pkg of availablePackages) {
      console.log(`  ${pkg.name}`)
    }
  }
}
