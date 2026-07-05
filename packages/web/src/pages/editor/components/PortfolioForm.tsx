import { useEffect, useRef, useState } from 'react'
import { IconUpload, IconVideo, IconCheck, IconX } from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { useCategories } from '@/hooks/use-categories'

export interface PortfolioItemInput {
  id?: string
  title: string
  description: string
  categoryId: string
  videoUrl: string
  thumbnailUrl: string
  basePrice: string
}

interface Props {
  open: boolean
  initial?: PortfolioItemInput
  onClose: () => void
  onSaved: () => void
}

const empty: PortfolioItemInput = {
  title: '',
  description: '',
  categoryId: '',
  videoUrl: '',
  thumbnailUrl: '',
  basePrice: '',
}

const OTHER_CATEGORY = '__other__'

export function PortfolioForm({ open, initial, onClose, onSaved }: Props) {
  const { categories } = useCategories()
  const [form, setForm] = useState<PortfolioItemInput>(initial ?? empty)
  const [customCategory, setCustomCategory] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!initial?.id
  const isOtherCategory = form.categoryId === OTHER_CATEGORY

  useEffect(() => {
    if (open) {
      setForm(initial ?? empty)
      setCustomCategory('')
      setError(null)
      setUploadProgress(0)
    }
  }, [open, initial])

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // valida tamanho (Cloudinary free: 100MB pra vídeo)
    if (file.size > 100 * 1024 * 1024) {
      setError('Vídeo muito grande. Máximo: 100MB')
      return
    }

    setError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      const result = await uploadFile(file, 'portfolio', 'video', (p) => setUploadProgress(p))
      setForm((f) => ({
        ...f,
        videoUrl: result.secureUrl,
        thumbnailUrl: result.thumbnailUrl ?? f.thumbnailUrl,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.title || form.title.length < 3) {
      setError('Título deve ter ao menos 3 caracteres')
      return
    }
    if (!form.categoryId) {
      setError('Selecione uma categoria')
      return
    }
    if (isOtherCategory && customCategory.trim().length < 2) {
      setError('Informe o nome da categoria (mínimo 2 caracteres)')
      return
    }
    if (!form.videoUrl) {
      setError('Faça o upload do vídeo')
      return
    }
    const price = Number(form.basePrice)
    if (!price || price <= 0) {
      setError('Informe um preço base válido')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        // "Outros" → envia o nome livre; o backend cria/reutiliza a categoria
        ...(isOtherCategory
          ? { categoryName: customCategory.trim() }
          : { categoryId: form.categoryId }),
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl || undefined,
        basePrice: price,
      }

      if (isEditing) {
        await api.patch(`/portfolio/${initial!.id}`, payload)
      } else {
        await api.post('/portfolio', payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar item do portfólio' : 'Adicionar projeto ao portfólio'}
      subtitle={isEditing ? 'Atualize as informações abaixo' : 'Mostre seu melhor trabalho'}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[8px] px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: 'rgba(255,255,255,0.6)',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="portfolio-form"
            disabled={saving || uploading}
            className="rounded-[8px] px-5 py-2 text-sm font-semibold transition-all"
            style={{
              background: '#F4631E',
              color: 'white',
              border: 'none',
              cursor: saving || uploading ? 'not-allowed' : 'pointer',
              opacity: saving || uploading ? 0.6 : 1,
              fontFamily: "'Syne', sans-serif",
            }}
          >
            {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Adicionar ao portfólio'}
          </button>
        </>
      }
    >
      <form id="portfolio-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Upload de vídeo */}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Vídeo do projeto
          </label>
          {!form.videoUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-[10px] py-8 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px dashed rgba(255,255,255,0.15)',
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {uploading ? (
                <>
                  <div className="w-3/4">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{ width: `${uploadProgress}%`, background: '#F4631E' }}
                      />
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Enviando... {uploadProgress}%
                  </span>
                </>
              ) : (
                <>
                  <IconUpload size={28} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <span className="text-sm font-medium text-white">Clique para enviar um vídeo</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    MP4, MOV ou WebM · até 100MB
                  </span>
                </>
              )}
            </button>
          ) : (
            <div
              className="flex items-center gap-3 rounded-[10px] p-3"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              {form.thumbnailUrl ? (
                <img
                  src={form.thumbnailUrl}
                  alt="thumb"
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-20 shrink-0 items-center justify-center rounded"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <IconVideo size={20} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <IconCheck size={14} stroke={2} color="#22C55E" />
                  <span className="text-sm font-medium text-white">Vídeo enviado</span>
                </div>
                <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {form.videoUrl.split('/').pop()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, videoUrl: '', thumbnailUrl: '' }))}
                className="shrink-0 rounded-md p-1"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                <IconX size={14} stroke={1.5} />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            hidden
          />
        </div>

        {/* Título */}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Título
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Reel viral de 30s para influenciadora fitness"
            maxLength={100}
            className="input-field"
            required
          />
        </div>

        {/* Categoria + Preço (lado a lado) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Categoria
            </label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="input-field"
              style={{ paddingLeft: 12 }}
              required
            >
              <option value="" style={{ background: '#162436' }}>
                Selecione...
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} style={{ background: '#162436' }}>
                  {c.name}
                </option>
              ))}
              <option value={OTHER_CATEGORY} style={{ background: '#162436' }}>
                Outros...
              </option>
            </select>
            {isOtherCategory && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Qual categoria?"
                maxLength={40}
                autoFocus
                className="input-field mt-2"
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Preço base (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              placeholder="150.00"
              className="input-field"
              required
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Descrição <span style={{ color: 'rgba(255,255,255,0.4)' }}>(opcional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Conte sobre esse projeto..."
            maxLength={1000}
            rows={3}
            className="input-field"
            style={{ height: 'auto', padding: '10px 14px', resize: 'vertical', minHeight: 80 }}
          />
        </div>

        {error && (
          <p
            className="rounded-[8px] px-3 py-2 text-xs"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#FCA5A5',
            }}
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
