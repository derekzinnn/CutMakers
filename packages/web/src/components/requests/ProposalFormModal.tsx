import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import {
  sendRequestProposal,
  updateMyRequestProposal,
  errorMessage,
  PLATFORM_FEE_RATE,
  type RequestProposal,
} from '@/lib/requests'
import { ErrorBox, GhostButton, PrimaryButton, budgetLabel, fmtBRL, labelStyle } from './shared'

interface Props {
  open: boolean
  requestId: string
  requestTitle: string
  budgetMin: number | null
  budgetMax: number | null
  /** Presente = edição da proposta pendente */
  existing?: RequestProposal | null
  onClose: () => void
  onSaved: () => void
}

export function ProposalFormModal({
  open,
  requestId,
  requestTitle,
  budgetMin,
  budgetMax,
  existing,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!existing
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(existing ? String(existing.amount) : '')
    setDays(existing ? String(existing.deliveryDays) : '')
    setMessage(existing?.message ?? '')
    setError(null)
  }, [open, existing])

  const parsedAmount = parseFloat(amount.replace(',', '.'))
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const fee = validAmount ? Math.round(parsedAmount * PLATFORM_FEE_RATE * 100) / 100 : 0
  const net = validAmount ? Math.round((parsedAmount - fee) * 100) / 100 : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const deliveryDays = parseInt(days, 10)
    if (!validAmount) return setError('Informe um valor válido')
    if (!Number.isInteger(deliveryDays) || deliveryDays < 1) return setError('Informe o prazo em dias (mínimo 1)')
    if (message.trim().length < 10) return setError('Explique sua proposta (mín. 10 caracteres)')

    setSaving(true)
    try {
      const payload = { amount: parsedAmount, deliveryDays, message: message.trim() }
      if (isEdit) await updateMyRequestProposal(requestId, payload)
      else await sendRequestProposal(requestId, payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Erro ao enviar a proposta'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose() }}
      title={isEdit ? 'Editar proposta' : 'Enviar proposta'}
      subtitle={requestTitle}
      size="md"
      footer={
        <>
          <GhostButton onClick={onClose} disabled={saving}>Cancelar</GhostButton>
          <PrimaryButton type="submit" form="proposal-form" busy={saving}>
            {isEdit ? 'Salvar proposta' : 'Enviar proposta'}
          </PrimaryButton>
        </>
      }
    >
      <form id="proposal-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Orçamento indicado pelo criador: <strong className="text-white">{budgetLabel(budgetMin, budgetMax)}</strong>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Prazo de entrega (dias)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Ex: 5"
              className="input-field"
            />
          </div>
        </div>

        {/* Preview ao vivo — mesmo padrão do ProposalForm da negociação */}
        <div
          className="space-y-1 rounded-[8px] px-3 py-2.5 text-xs"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Taxa da plataforma (10%)</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{validAmount ? fmtBRL(fee) : '—'}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Você recebe</span>
            <span style={{ color: '#22C55E' }}>{validAmount ? fmtBRL(net) : '—'}</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Mensagem para o criador</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Como você vai conduzir o projeto, experiências parecidas, o que está incluso..."
            className="input-field"
            style={{ height: 'auto', padding: '10px 14px', resize: 'vertical', minHeight: 110 }}
          />
        </div>

        <ErrorBox message={error} />
      </form>
    </Modal>
  )
}
