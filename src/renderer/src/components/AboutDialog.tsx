import { ExternalLink, GitBranch, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReleaseInfo } from '../../../shared/types'
import { Modal } from './Modal'

const releasesUrl = 'https://github.com/stream233/TraceMatch/releases/latest'

interface Props { onClose(): void }

export function AboutDialog({ onClose }: Props) {
  const [version, setVersion] = useState('…')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { void window.traceMatch.app.getVersion().then(setVersion) }, [])
  const check = async () => {
    setChecking(true)
    setMessage('正在检查更新…')
    try {
      const result = await window.traceMatch.update.check()
      setRelease(result)
      setMessage(result.hasUpdate ? `发现新版本 ${result.latestVersion}` : '当前已是最新版本。')
    } catch {
      setRelease(null)
      setMessage('GitHub API 访问受限或网络不可用，无法自动检查更新。')
    } finally {
      setChecking(false)
    }
  }
  return (
    <Modal title="关于 TraceMatch" description="药品追溯码到货比对工具" onClose={onClose} width="small"
      footer={<button className="button button--primary" onClick={onClose}>完成</button>}>
      <div className="about-product"><span className="about-product__mark">TM</span><div><strong>TraceMatch</strong><p>V {version}</p></div></div>
      <p className="about-copy">数据和比对结果保存在本机 SQLite 数据库中。应用不上传业务数据，也不连接 ERP 或平台账号。</p>
      <div className="about-actions">
        <button className="button button--secondary" disabled={checking} onClick={() => void check()}><RefreshCcw className={checking ? 'is-spinning' : ''} size={16} />检查更新</button>
        <button className="button button--quiet" onClick={() => void window.traceMatch.app.openExternal(releasesUrl)}><GitBranch size={16} />下载页面<ExternalLink size={13} /></button>
      </div>
      {message ? <div className={`update-message${release?.hasUpdate ? ' has-update' : ''}`}><span>{message}</span>{release?.hasUpdate ? <button onClick={() => void window.traceMatch.app.openExternal(release.downloadUrl)}>打开下载页</button> : null}</div> : null}
    </Modal>
  )
}
