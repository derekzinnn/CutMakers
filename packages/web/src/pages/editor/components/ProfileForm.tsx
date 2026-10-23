import { useEffect, useRef, useState } from 'react'
import { IconCamera, IconCheck } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { useCategories } from '@/hooks/use-categories'
import type { EditorMe } from '@/hooks/use-editor-me'

interface Props {
  editor: EditorMe | null
  userName: string // fallback se editor for null (perfil ainda não criado)
  onSaved: () => void
}

export function ProfileForm({ editor, userName, onSaved }: Props) {
  const { categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(editor?.name ?? userName)
  const [bio, setBio] = useState(editor?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(editor?.avatarUrl ?? null)
  const [categoryIds, setCategoryIds] = useState<string[]>(
    editor?.profile.categories.map((c) => c.id) ?? [],
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (editor) {
      setName(editor.name)
      setBio(editor.bio ?? '')
      setAvatarUrl(editor.avatarUrl)
      setCategoryIds(editor.profile.categories.map((c) => c.id))
    }
  }, [editor])

  function toggleCategory(id: string) {
    setCategoryIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    )
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo: 5MB')
      return
    }

    setError(null)
    setUploading(true)
    try {
      const result = await uploadFile(file, 'avatars', 'image')
      setAvatarUrl(result.secureUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      await api.patch('/editors/me', {
        name,
        bio,
        avatarUrl: avatarUrl ?? '',
        categoryIds,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onSaved()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-2xl font-bold text-white"
          style={{ background: 'var(--brand)' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm transition-colors"
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              color: 'white',
              cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            <IconCamera size={14} stroke={1.5} />
            {uploading ? 'Enviando...' : avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              className="ml-2 text-xs"
              style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Remover
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} hidden />
        </div>
      </div>

      {/* Nome */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          Nome
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          maxLength={80}
          required
        />
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conte sobre seu trabalho, experiência, estilo..."
          maxLength={500}
          rows={4}
          className="input-field"
          style={{ height: 'auto', padding: '12px 14px', resize: 'vertical', minHeight: 100 }}
        />
        <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          {bio.length}/500
        </p>
      </div>

      {/* Categorias */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          Categorias que você atende
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = categoryIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand-soft)' : 'var(--surface-subtle)',
                  color: active ? 'var(--brand)' : 'var(--foreground)',
                  border: `1px solid ${active ? 'var(--brand-border)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p
          className="rounded-[8px] px-3 py-2 text-xs"
          style={{
            background: 'var(--destructive-soft)',
            border: '1px solid var(--destructive-border)',
            color: 'var(--destructive)',
          }}
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-xs"
          style={{
            background: 'var(--success-soft)',
            border: '1px solid var(--success-border)',
            color: '#86EFAC',
          }}
        >
          <IconCheck size={14} stroke={2} /> Perfil atualizado com sucesso
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[8px] px-5 py-2.5 text-sm font-semibold transition-all"
          style={{
            background: 'var(--brand)',
            color: 'white',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            fontFamily: "var(--font-heading)",
          }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
