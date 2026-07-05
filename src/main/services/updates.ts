import { app } from 'electron'
import semver from 'semver'
import type { ReleaseInfo } from '../../shared/types'

const apiUrl = 'https://api.github.com/repos/stream233/TraceMatch/releases/latest'
export const releasePageUrl = 'https://github.com/stream233/TraceMatch/releases/latest'

interface GitHubRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  assets?: { name?: string; browser_download_url?: string }[]
}

export async function checkForUpdates(): Promise<ReleaseInfo> {
  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TraceMatch-Updater' },
    signal: AbortSignal.timeout(6000)
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status}`)
  const release = await response.json() as GitHubRelease
  const currentVersion = app.getVersion()
  const latestVersion = release.tag_name ?? ''
  const pageUrl = release.html_url ?? releasePageUrl
  const assets = release.assets ?? []
  const setup = assets.find((asset) => asset.name?.toLowerCase() === 'tracematchsetup.exe')
    ?? assets.find((asset) => asset.name?.toLowerCase().endsWith('.exe'))
  const cleanCurrent = semver.coerce(currentVersion)
  const cleanLatest = semver.coerce(latestVersion)
  return {
    currentVersion,
    latestVersion,
    name: release.name ?? latestVersion,
    body: release.body ?? '',
    releasePageUrl: pageUrl,
    downloadUrl: setup?.browser_download_url ?? pageUrl,
    hasUpdate: Boolean(cleanCurrent && cleanLatest && semver.gt(cleanLatest, cleanCurrent))
  }
}
