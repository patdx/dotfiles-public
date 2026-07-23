// Input:
// https://api.github.com/repos/git-ecosystem/git-credential-manager/releases/latest
// https://github.com/git-ecosystem/git-credential-manager
// https://github.com/git-ecosystem/git-credential-manager/blob/main/src/windows/Directory.Build.props
// https://github.com/git-ecosystem/git-credential-manager/blob/4c32c095e49d6eb9fc93fc27422e89e4f640065b/src/windows/Directory.Build.props
// Output:
// git-ecosystem/git-credential-manager

/**
 * returns the repo name and the main repo url from any github url
 */
export function readGithubUrl(
  _url: string,
): { repoName: string; repoUrl: string } | null {
  const url = new URL(_url)

  const isGithubUrl = url.host === 'github.com' || url.host === 'api.github.com'

  if (!isGithubUrl) {
    return null
  }

  const parts = url.pathname.split('/')
  const repoIndex = url.host === 'api.github.com' ? 2 : 1
  const repoName = `${parts[repoIndex]}/${parts[repoIndex + 1]}`
  const repoUrl = `https://github.com/${repoName}`

  return { repoName, repoUrl }
}
