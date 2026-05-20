import { useState } from 'react'
import { IconUpload, IconX, IconFile, IconLoader2, IconCheck } from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { useCategories } from '@/hooks/use-categories'
import { uploadFile } from '@/lib/upload'
import { createOrder } from '@/lib/orders'

interface Props {
  open: boolean
  onClose: () => void
  editor: { id: string; name: string }
  defaultCategoryId?: string
  defaultBudget?: number
  portfolioItemId?: string
  onSuccess?: (orderId: string) => void
}

interface PendingFile {
  file: File
  progress: number
  uploaded?: { fileUrl: string; fileName: string; fileType: string }
  error?: string
}

export function NewOrderModal({
  open,
  onClose,
  editor,
  defaultCategoryId,
  defaultBudget,
  portfolioItemId,
  onSuccess,
}: Props) {
  const { categories } = useCategories()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [budget, setBudget] = useState<string>(defaultBudget ? String(defaultBudget) : '')
  const [deadline, setDeadline] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTitle('')
    setDescription('')
    setCategoryId(defaultCategoryId ?? '')
    setBudget(defaultBudget ? String(defaultBudget) : '')
    setDeadline('')
    setFiles([])
    setError(null)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return
    const newOnes: PendingFile[] = Array.from(list).map((f) => ({ file: f, progress: 0 }))
    setFiles((prev) => [...prev, ...newOnes])

    for (const pending of newOnes) {
      try {
        const result = await uploadFile(pending.file, 'orders', 'auto', (p) => {
          setFiles((prev) =>
            prev.map((x) => (x.file === pending.file ? { ...x, progress: p } : x)),
          )
        })
        setFiles((prev) =>
          prev.map((x) =>
            x.file === pending.file
              ? {
                  ...x,
                  progress: 100,
                  uploaded: {
                    fileUrl: result.secureUrl,
                    fileName: pending.file.name,
                    fileType: result.resourceType,
                  },
                }
              : x,
          ),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro no upload'
        setFiles((prev) =>
          prev.map((x) => (x.file === pending.file ? { ...x, error: msg } : x)),
        )
      }
    }
  }

  function removeFile(target: File) {
    setFiles((prev) => prev.filter((x) => x.file !== target))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (title.trim().length < 3) return setError('Título precisa ter ao menos 3 caracteres')
    if (description.trim().length < 10) return setError('Descrição precisa ter ao menos 10 caracteres')
    if (!categoryId) return setError('Selecione uma categoria')

    const budgetNum = Number(budget)
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) return setError('Informe um orçamento válido')

    const stillUploading = files.some((f) => !f.uploaded && !f.error)
    if (stillUploading) return setError('Aguarde os uploads terminarem')

    const uploadedFiles = files.filter((f) => f.uploaded).map((f) => f.uploaded!)

    setSubmitting(true)
    try {
      const order = await createOrder({
        editorId: editor.id,
        categoryId,
        portfolioItemId,
        title: title.trim(),
        description: description.trim(),
        budget: budgetNum,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        files: uploadedFiles,
      })
      onSuccess?.(order.id)
      reset()
      onClose()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const platformFeeEstimate =
    Number(budget) > 0 ? Math.round(Number(budget) * 0.1 * 100) / 100 : 0
  const netForEditor = Number(budget) > 0 ? Number(budget) - platformFeeEstimate : 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo projeto"
      subtitle={`Você está criando um pedido para ${editor.name}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5" id="new-order-form">
        {/* Título */}
        <Field label="Título do projeto" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Edição de Reels semanais"
            maxLength={100}
            className="input-field"
            disabled={submitting}
          />
        </Field>

        {/* Descrição */}
        <Field label="Descrição" required hint="Detalhe o que você precisa: estilo, referências, prazo etc.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o briefing completo do projeto..."
            rows={5}
            maxLength={5000}
            className="w-full rounded-[8px] text-sm text-white placeholder:text-white/40 outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '10px 14px',
              resize: 'vertical',
              minHeight: 100,
            }}
            disabled={submitting}
          />
        </Field>

        {/* Categoria + Orçamento + Prazo */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Categoria" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field"
              disabled={submitting}
            >
              <option value="">Selecione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Orçamento (R$)" required>
            <input
              type="number"
              min={1}
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0,00"
              className="input-field"
              disabled={submitting}
            />
          </Field>

          <Field label="Prazo (opcional)">
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input-field"
              disabled={submitting}
            />
          </Field>
        </div>

        {/* Resumo financeiro */}
        {Number(budget) > 0 && (
          <div
            className="rounded-[8px] px-4 py-3 text-xs"
            style={{
              background: 'rgba(244,99,30,0.06)',
              border: '1px solid rgba(244,99,30,0.15)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            Taxa da plataforma (10%): <strong style={{ color: '#F4631E' }}>R$ {platformFeeEstimate.toFixed(2)}</strong>
            {' · '}
            Editor recebe: <strong style={{ color: '#F4631E' }}>R$ {netForEditor.toFixed(2)}</strong>
          </div>
        )}

        {/* Upload de arquivos */}
        <Field label="Arquivos de referência (opcional)" hint="Vídeo bruto, briefing, imagens de inspiração. Até 10 arquivos.">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] px-4 py-6 text-xs transition-colors"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
          >
            <IconUpload size={20} stroke={1.5} />
            <span>Clique ou arraste arquivos aqui</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
              disabled={submitting || files.length >= 10}
            />
          </label>

          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.file.name + f.file.lastModified}
                  className="flex items-center gap-3 rounded-[8px] px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <IconFile size={14} stroke={1.5} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <span className="flex-1 truncate text-white">{f.file.name}</span>
                  <span
                    className="shrink-0 text-[10px]"
                    style={{
                      color: f.error
                        ? '#EF4444'
                        : f.uploaded
                          ? '#22C55E'
                          : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {f.error
                      ? f.error
                      : f.uploaded
                        ? <span className="flex items-center gap-1"><IconCheck size={10} stroke={2} /> ok</span>
                        : <span className="flex items-center gap-1"><IconLoader2 size={10} className="animate-spin" /> {f.progress}%</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.file)}
                    aria-label="Remover arquivo"
                    className="flex h-5 w-5 items-center justify-center rounded-full transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                  >
                    <IconX size={10} stroke={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        {error && (
          <div
            className="rounded-[8px] px-4 py-3 text-xs"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-[8px] px-4 py-2 text-sm transition-colors"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-[8px] px-5 py-2 text-sm font-semibold transition-all"
            style={{
              background: '#F4631E',
              color: 'white',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              fontFamily: "'Syne', sans-serif",
            }}
          >
            {submitting && <IconLoader2 size={14} className="animate-spin" />}
            {submitting ? 'Criando...' : 'Criar projeto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Field helper ──────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
        {label}
        {required && <span style={{ color: '#F4631E' }}> *</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
