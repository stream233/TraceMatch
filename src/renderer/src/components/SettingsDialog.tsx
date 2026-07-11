import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { Modal } from './Modal'

interface Props {
  settings: AppSettings
  onClose(): void
  onSave(settings: AppSettings): Promise<boolean>
}

export function SettingsDialog({ settings, onClose, onSave }: Props) {
  const [pinAbnormalResults, setPinAbnormalResults] = useState(settings.pinAbnormalResults)
  const [defaultOperator, setDefaultOperator] = useState(settings.defaultOperator)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const normalizedOperator = defaultOperator.trim()
    if (!normalizedOperator) return
    setSaving(true)
    try {
      if (await onSave({ pinAbnormalResults, defaultOperator: normalizedOperator })) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="设置" description="调整新建验收单和结果表的默认行为。" onClose={onClose} width="small"
      footer={<><button className="button button--ghost" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={saving || !defaultOperator.trim()} onClick={() => void save()}>{saving ? '保存中…' : '保存设置'}</button></>}>
      <div className="settings-form">
        <label className="field">
          <span>默认操作员 <b>*</b></span>
          <input value={defaultOperator} onChange={(event) => setDefaultOperator(event.target.value)} maxLength={60} autoFocus />
        </label>
        <label className="settings-option">
          <span className="settings-option__copy">
            <strong>比对异常结果置顶</strong>
            <small>开启后，未到货、多到货和重复扫码记录会优先显示。</small>
          </span>
          <span className="switch">
            <input type="checkbox" checked={pinAbnormalResults} onChange={(event) => setPinAbnormalResults(event.target.checked)} />
            <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
          </span>
        </label>
      </div>
    </Modal>
  )
}
