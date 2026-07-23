import type { KnownPackage } from '../shared/types.ts'

export default {
  name: 'codexbar',
  options: {
    binaryName: 'codexbar',
    files: [
      {
        url: 'https://github.com/steipete/CodexBar',
        urlProvider: 'github',
      },
    ],
  },
} satisfies KnownPackage as KnownPackage
