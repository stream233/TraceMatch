import { RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { APPLICATION_EXPIRY_DATE } from '../../../shared/availability'
import { Modal } from './Modal'

export function VersionExpiredDialog() {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')

  const checkForUpdates = async () => {
    setChecking(true)
    setMessage('正在检查更新…')
    try {
      const release = await window.traceMatch.update.check()
      if (!release.hasUpdate) {
        setMessage('暂未发现可用更新，请稍后重试。')
        return
      }
      setMessage(`发现新版本 ${release.latestVersion}，已打开下载页面。`)
      await window.traceMatch.app.openExternal(release.downloadUrl)
    } catch {
      setMessage('检查更新失败，请检查网络后重试。')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="app-shell app-shell--expired">
      <Modal title="当前版本不可用" description={`本版本的使用期限已于 ${APPLICATION_EXPIRY_DATE} 结束。`} width="small" dismissible={false} onClose={() => undefined}
        footer={<><button className="button button--secondary" type="button" disabled={checking} onClick={() => void checkForUpdates()}><RefreshCcw className={checking ? 'is-spinning' : ''} size={16} />检查更新</button><button className="button button--primary" type="button" onClick={() => void window.traceMatch.app.quit()}>确定</button></>}>
        <p className="expiry-notice">请升级至最新版本后继续使用。</p>
        {message ? <p className="expiry-status" role="status">{message}</p> : null}
      </Modal>
    </div>
  )
}
