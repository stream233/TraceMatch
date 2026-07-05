import { useState } from 'react'
import type { AcceptanceOrder } from '../../../shared/types'
import { Modal } from './Modal'

const generateOrderNumber = () => {
  const now = new Date()
  const digits = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .join('')
  return `YS${digits}${String(now.getMilliseconds()).padStart(3, '0').slice(0, 2)}`
}

interface Props {
  onClose(): void
  onCreate(input: Omit<AcceptanceOrder, 'id' | 'createdAt'>): Promise<unknown>
}

export function CreateOrderDialog({ onClose, onCreate }: Props) {
  const [orderNumber, setOrderNumber] = useState(generateOrderNumber)
  const [supplier, setSupplier] = useState('')
  const [operator, setOperator] = useState('211')
  const [remark, setRemark] = useState('')
  const submit = async () => {
    if (!orderNumber.trim() || !operator.trim()) return
    const created = await onCreate({ orderNumber: orderNumber.trim(), supplier: supplier.trim(), operator: operator.trim(), remark: remark.trim() })
    if (created) onClose()
  }

  return (
    <Modal title="新建验收单" description="先建立本次到货验收，再导入平台和扫码数据。" onClose={onClose}
      footer={<><button className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" onClick={() => void submit()} disabled={!orderNumber.trim() || !operator.trim()}>创建验收单</button></>}>
      <div className="form-grid">
        <label className="field field--wide"><span>验收单号 <b>*</b></span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} autoFocus /></label>
        <label className="field"><span>供应商</span><input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="可在导入后自动识别" /></label>
        <label className="field"><span>操作员 <b>*</b></span><input value={operator} onChange={(event) => setOperator(event.target.value)} /></label>
        <label className="field field--wide"><span>备注</span><textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} placeholder="选填" /></label>
      </div>
    </Modal>
  )
}
