import { assertEquals } from '@std/assert'
import { readGithubUrl } from './normalize-github-url.ts'

Deno.test('readGithubUrl test - API URL', () => {
  const url =
    'https://api.github.com/repos/git-ecosystem/git-credential-manager/releases/latest'
  const expected = {
    repoName: 'git-ecosystem/git-credential-manager',
    repoUrl: 'https://github.com/git-ecosystem/git-credential-manager',
  }
  assertEquals(readGithubUrl(url), expected)
})

Deno.test('readGithubUrl test - Repo URL', () => {
  const url = 'https://github.com/git-ecosystem/git-credential-manager'
  const expected = {
    repoName: 'git-ecosystem/git-credential-manager',
    repoUrl: 'https://github.com/git-ecosystem/git-credential-manager',
  }
  assertEquals(readGithubUrl(url), expected)
})

Deno.test('readGithubUrl test - Blob URL', () => {
  const url =
    'https://github.com/git-ecosystem/git-credential-manager/blob/main/src/windows/Directory.Build.props'
  const expected = {
    repoName: 'git-ecosystem/git-credential-manager',
    repoUrl: 'https://github.com/git-ecosystem/git-credential-manager',
  }
  assertEquals(readGithubUrl(url), expected)
})

Deno.test('readGithubUrl test - Commit Blob URL', () => {
  const url =
    'https://github.com/git-ecosystem/git-credential-manager/blob/4c32c095e49d6eb9fc93fc27422e89e4f640065b/src/windows/Directory.Build.props'
  const expected = {
    repoName: 'git-ecosystem/git-credential-manager',
    repoUrl: 'https://github.com/git-ecosystem/git-credential-manager',
  }
  assertEquals(readGithubUrl(url), expected)
})
