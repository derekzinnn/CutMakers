import { useState } from 'react'
import {
  IconUpload, IconX, IconFile, IconLoader2, IconCheck,
  IconArrowRight, IconArrowLeft, IconSend, IconCalendar,
  IconCurrencyReal, IconCategory, IconAlignLeft, IconPaperclip,
} from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { useCategories } from '@/hooks/use-categories'
import { uploadFile } from '@/lib/upload'
import { createOrder } from '@/lib/orders'

interface Props {
  open: boolean
  onClose: () => void
  editor: { id: string; name: string; avatarUrl?: string | null }
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

const AVATAR_PALETTE = ['#F4631E', '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#EC4899', '#14B8A6']
function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const STEPS = [
  { id: 1, label: 'Briefing', icon: IconAlignLeft },
  { id: 2, label: 'Detalhes', icon: IconCurrencyReal },
  { id: 3, label: 'Arquivos', icon: IconPaperclip },
]

export function NewOrderModal({ open, onClose, editor, defaultCategoryId, defaultBudget, portfolioItemId, onSuccess }: Props) {
  const { categories } = useCategories()
  const [step, setStep] = useState(1)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [budget, setBudget] = useState<string>(defaultBudget ? String(defaultBudget) : '')
  const [deadline, setDeadline] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setStep(1)
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

  function validateStep1() {
    if (title.trim().length < 3) { setError('Título precisa ter ao menos 3 caracteres'); return false }
    if (description.trim().length < 10) { setError('Descrição precisa ter ao menos 10 caracteres'); return false }
    return true
  }

  function validateStep2() {
    if (!categoryId) { setError('Selecione uma categoria'); return false }
    const n = Number(budget)
    if (!Number.isFinite(n) || n <= 0) { setError('Informe um orçamento válido'); return false }
    return true
  }

  function nextStep() {
    setError(null)
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => s + 1)
  }

  function prevStep() {
    setError(null)
    setStep((s) => s - 1)
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return
    const newOnes: PendingFile[] = Array.from(list).map((f) => ({ file: f, progress: 0 }))
    setFiles((prev) => [...prev, ...newOnes])
    for (const pending of newOnes) {
      try {
        const result = await uploadFile(pending.file, 'orders', 'auto', (p) => {
          setFiles((prev) => prev.map((x) => (x.file === pending.file ? { ...x, progress: p } : x)))
        })
        setFiles((prev) =>
          prev.map((x) =>
            x.file === pending.file
              ? { ...x, progress: 100, uploaded: { fileUrl: result.secureUrl, fileName: pending.file.name, fileType: result.resourceType } }
              : x,
          ),
        )
      } catch (e) {
        setFiles((prev) =>
          prev.map((x) => (x.file === pending.file ? { ...x, error: e instanceof Error ? e.message : 'Erro no upload' } : x)),
        )
      }
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!validateStep1() || !validateStep2()) return
    const stillUploading = files.some((f) => !f.uploaded && !f.error)
    if (stillUploading) { setError('Aguarde os uploads terminarem'); return }
    setSubmitting(true)
    try {
      const order = await createOrder({
        editorId: editor.id,
        categoryId,
        portfolioItemId,
        title: title.trim(),
        description: description.trim(),
        budget: Number(budget),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        files: files.filter((f) => f.uploaded).map((f) => f.uploaded!),
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

  const budgetNum = Number(budget)
  const fee = budgetNum > 0 ? Math.round(budgetNum * 0.1 * 100) / 100 : 0
  const net = budgetNum > 0 ? budgetNum - fee : 0
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? ''
  const avatarBg = AVATAR_PALETTE[nameHash(editor.name) % AVATAR_PALETTE.length]

  return (
    <Modal open={open} onClose={handleClose} title="" size="lg">
      <div style={{ margin: '-20px -24px', display: 'flex', flexDirection: 'column', minHeight: 520 }}>

        {/* ── Top bar: editor card + step dots ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Editor mini-card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {editor.avatarUrl ? (
              <img src={editor.avatarUrl} alt={editor.name}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: avatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'white', fontFamily: "'Syne', sans-serif",
              }}>
                {initials(editor.name)}
              </div>
            )}
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 1px', fontFamily: "'DM Sans', sans-serif" }}>
                Proposta para
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, fontFamily: "'Syne', sans-serif" }}>
                {editor.name}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((s, i) => {
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: active ? 'rgba(244,99,30,0.15)' : done ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(244,99,30,0.4)' : done ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: active ? '#F4631E' : done ? '#22C55E' : 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: 'white',
                    }}>
                      {done ? <IconCheck size={10} stroke={2.5} /> : s.id}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      color: active ? '#F4631E' : done ? '#22C55E' : 'rgba(255,255,255,0.4)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step content ── */}
        <div style={{ flex: 1, padding: '28px 28px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* STEP 1 — Briefing */}
          {step === 1 && (
            <>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 4px', fontFamily: "'Syne', sans-serif" }}>
                  Qual é o projeto?
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Dê um nome e descreva o que você precisa em detalhes.
                </p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
                  Título do projeto <span style={{ color: '#F4631E' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Edição de Reels semanais para Instagram"
                  maxLength={100}
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 14, color: 'white',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right' }}>
                  {title.length}/100
                </p>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
                  Briefing completo <span style={{ color: '#F4631E' }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o estilo, referências visuais, tom do conteúdo, formato dos vídeos, frequência de entrega, e qualquer detalhe que o editor precisa saber..."
                  maxLength={5000}
                  rows={7}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13, color: 'white',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    outline: 'none', resize: 'vertical', minHeight: 140, fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right' }}>
                  {description.length}/5000
                </p>
              </div>
            </>
          )}

          {/* STEP 2 — Detalhes */}
          {step === 2 && (
            <>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 4px', fontFamily: "'Syne', sans-serif" }}>
                  Valores e prazo
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Esses valores são sua proposta inicial — o editor pode negociar.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
                    <IconCategory size={13} stroke={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    Categoria <span style={{ color: '#F4631E' }}>*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13, color: 'white',
                      background: '#1E3045', border: '1px solid rgba(255,255,255,0.1)',
                      outline: 'none', fontFamily: "'DM Sans', sans-serif', cursor: 'pointer", boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  >
                    <option value="">Selecione a categoria...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
                    <IconCurrencyReal size={13} stroke={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    Orçamento proposto (R$) <span style={{ color: '#F4631E' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0,00"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 14, color: 'white',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
                    <IconCalendar size={13} stroke={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    Prazo desejado <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13, color: deadline ? 'white' : 'rgba(255,255,255,0.35)',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', colorScheme: 'dark',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              {/* Live fee preview */}
              {budgetNum > 0 && (
                <div style={{
                  borderRadius: 10, padding: '16px 20px',
                  background: 'rgba(244,99,30,0.06)', border: '1px solid rgba(244,99,30,0.18)',
                  display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: 12, alignItems: 'center',
                }}>
                  {[
                    { label: 'Valor total', value: `R$ ${budgetNum.toFixed(2)}`, color: 'white' },
                    null,
                    { label: 'Taxa plataforma (10%)', value: `R$ ${fee.toFixed(2)}`, color: 'rgba(255,255,255,0.5)' },
                    null,
                    { label: 'Editor recebe', value: `R$ ${net.toFixed(2)}`, color: '#22C55E' },
                  ].map((item, i) =>
                    item === null ? (
                      <div key={i} style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)', margin: '0 auto' }} />
                    ) : (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px' }}>{item.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: item.color, margin: 0, fontFamily: "'Syne', sans-serif" }}>{item.value}</p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 3 — Arquivos + Confirmar */}
          {step === 3 && (
            <>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 4px', fontFamily: "'Syne', sans-serif" }}>
                  Arquivos de referência
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Vídeo bruto, briefing, imagens de inspiração. Opcional — você pode enviar depois.
                </p>
              </div>

              {/* Upload zone */}
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '28px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(244,99,30,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'rgba(244,99,30,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconUpload size={20} stroke={1.5} color="#F4631E" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', fontWeight: 500 }}>
                    Clique ou arraste arquivos aqui
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                    Vídeos, imagens, PDFs — até 10 arquivos
                  </p>
                </div>
                <input
                  type="file" multiple className="hidden"
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
                  disabled={files.length >= 10}
                />
              </label>

              {files.length > 0 && (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                  {files.map((f) => (
                    <li key={f.file.name + f.file.lastModified} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <IconFile size={14} stroke={1.5} color="rgba(255,255,255,0.4)" />
                      <span style={{ flex: 1, fontSize: 12, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.file.name}
                      </span>
                      <span style={{
                        fontSize: 11, flexShrink: 0,
                        color: f.error ? '#EF4444' : f.uploaded ? '#22C55E' : 'rgba(255,255,255,0.4)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {f.error
                          ? f.error
                          : f.uploaded
                          ? <><IconCheck size={10} stroke={2.5} /> ok</>
                          : <><IconLoader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> {f.progress}%</>}
                      </span>
                      <button type="button" onClick={() => setFiles((p) => p.filter((x) => x.file !== f.file))}
                        style={{
                          width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                          border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <IconX size={10} stroke={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Summary */}
              <div style={{
                borderRadius: 10, padding: '16px 20px', marginTop: 4,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Syne', sans-serif" }}>
                  Resumo da proposta
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Projeto', value: title },
                    { label: 'Categoria', value: categoryName },
                    { label: 'Orçamento', value: budgetNum > 0 ? `R$ ${budgetNum.toFixed(2)}` : '—' },
                    { label: 'Prazo', value: deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir' },
                    { label: 'Arquivos', value: `${files.filter((f) => f.uploaded).length} arquivo(s)` },
                  ].map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                      <span style={{ fontSize: 12, color: 'white', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer navigation ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.1)',
        }}>
          <button
            type="button"
            onClick={step === 1 ? handleClose : prevStep}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {step > 1 && <IconArrowLeft size={14} stroke={1.5} />}
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 22px',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: '#F4631E', color: 'white', border: 'none',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Próximo
              <IconArrowRight size={14} stroke={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 22px',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                background: '#F4631E', color: 'white', border: 'none',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {submitting ? <IconLoader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <IconSend size={14} stroke={1.5} />}
              {submitting ? 'Enviando...' : 'Enviar proposta'}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  )
}
