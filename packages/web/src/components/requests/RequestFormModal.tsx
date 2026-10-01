import { useEffect, useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { useCategories } from '@/hooks/use-categories'
import {
  createRequest,
  updateRequest,
  errorMessage,
  type MyRequest,
  type CreatorRequestDetail,
} from '@/lib/requests'
import { ErrorBox, GhostButton, PrimaryButton, labelStyle } from './shared'

type Editable = Pick<
  MyRequest | CreatorRequestDetail,
  'id' | 'title' | 'description' | 'category' | 'budgetMin' | 'budgetMax' | 'deadline' | 'revisionsIncluded' | 'referenceLinks'
>

interface Props {
  open: boolean
  /** Presente = modo edição */
  initial?: Editable
  onClose: () => void
  onSaved: (id: string) => void
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
// Fim do dia local → ISO (o backend exige data futura)
const fromDateInput = (v: string) => new Date(`${v}T23:59:59`).toISOString()
const parseMoney = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function RequestFormModal({ open, initial, onClose, onSaved }: Props) {
  const { categories } = useCategories()
  const isEdit = !!initial

  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [deadline, setDeadline] = useState('')
  const [revisions, setRevisions] = useState('2')
  const [links, setLinks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCategoryId(initial?.category.id ?? '')
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setBudgetMin(initial?.budgetMin != null ? String(initial.budgetMin) : '')
    setBudgetMax(initial?.budgetMax != null ? String(initial.budgetMax) : '')
    setDeadline(toDateInput(initial?.deadline ?? null))
    setRevisions(String(initial?.revisionsIncluded ?? 2))
    setLinks(initial?.referenceLinks ?? [])
    setError(null)
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const min = parseMoney(budgetMin)
    const max = parseMoney(budgetMax)
    if (!isEdit && !categoryId) return setError('Selecione uma categoria')
    if (title.trim().length < 3) return setError('Título muito curto')
    if (description.trim().length < 10) return setError('Descreva melhor o projeto (mín. 10 caracteres)')
    if (min !== undefined && max !== undefined && min > max) {
      return setError('O orçamento mínimo não pode ser maior que o máximo')
    }
    const cleanLinks = links.map((l) => l.trim()).filter(Boolean)

    setSaving(true)
    try {
      if (isEdit && initial) {
        const saved = await updateRequest(initial.id, {
          title: title.trim(),
          description: description.trim(),
          budgetMin: min ?? null,
          budgetMax: max ?? null,
          deadline: deadline ? fromDateInput(deadline) : null,
          referenceLinks: cleanLinks,
        })
        onSaved(saved.id)
      } else {
        const saved = await createRequest({
          categoryId,
          title: title.trim(),
          description: description.trim(),
          budgetMin: min,
          budgetMax: max,
          deadline: deadline ? fromDateInput(deadline) : undefined,
          revisionsIncluded: Number(revisions),
          referenceLinks: cleanLinks,
        })
        onSaved(saved.id)
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Erro ao salvar a solicitação'))
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose() }}
      title={isEdit ? 'Editar solicitação' : 'Nova solicitação'}
      subtitle={isEdit ? 'Editores que já propuseram verão a versão atualizada' : 'Publique seu projeto e receba propostas de editores'}
      size="md"
      footer={
        <>
          <GhostButton onClick={onClose} disabled={saving}>Cancelar</GhostButton>
          <PrimaryButton type="submit" form="request-form" busy={saving}>
            {isEdit ? 'Salvar alterações' : 'Publicar solicitação'}
          </PrimaryButton>
        </>
      }
    >
      <form id="request-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isEdit}
              className="input-field"
              style={{ paddingLeft: 12, opacity: isEdit ? 0.6 : 1 }}
            >
              <option value="" style={{ background: '#162436' }}>Selecione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} style={{ background: '#162436' }}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Prazo (opcional)</label>
            <input
              type="date"
              min={today}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input-field"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Ex: Edição de 4 reels para lançamento de curso"
            className="input-field"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Descrição do projeto</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={5}
            placeholder="Estilo, duração, referências de ritmo, legendas, trilha, formato de entrega..."
            className="input-field"
            style={{ height: 'auto', padding: '10px 14px', resize: 'vertical', minHeight: 110 }}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Editores veem esta descrição completa. Arquivos brutos só são liberados ao editor escolhido após o pagamento.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Orçamento mín.</label>
            <input
              type="text"
              inputMode="decimal"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="R$ 0,00"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Orçamento máx.</label>
            <input
              type="text"
              inputMode="decimal"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="R$ 0,00"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Revisões inclusas</label>
            <input
              type="number"
              min={0}
              max={10}
              value={revisions}
              onChange={(e) => setRevisions(e.target.value)}
              disabled={isEdit}
              className="input-field"
              style={{ opacity: isEdit ? 0.6 : 1 }}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Links de referência (opcional)</label>
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLinks((prev) => prev.map((l, idx) => (idx === i ? e.target.value : l)))}
                  placeholder="https://..."
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remover link"
                  className="flex w-10 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                >
                  <IconX size={14} stroke={1.5} />
                </button>
              </div>
            ))}
            {links.length < 10 && (
              <GhostButton onClick={() => setLinks((prev) => [...prev, ''])}>
                <IconPlus size={13} stroke={2} /> Adicionar link
              </GhostButton>
            )}
          </div>
        </div>

        <ErrorBox message={error} />
      </form>
    </Modal>
  )
}
