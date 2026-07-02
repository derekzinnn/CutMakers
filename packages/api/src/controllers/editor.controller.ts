import { Request, Response } from 'express'
import { z } from 'zod'
import { EditorService } from '../services/editor.service'

const editorService = new EditorService()

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  premium: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(80).optional(),
  bio: z.string().max(500, 'Bio deve ter no máximo 500 caracteres').optional(),
  avatarUrl: z.string().url('URL de avatar inválida').or(z.literal('')).optional(),
  categoryIds: z.array(z.string().uuid('ID de categoria inválido')).max(10).optional(),
})

export class EditorController {
  // GET /api/editors
  listEditors = async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Filtros inválidos',
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const data = await editorService.listEditors({
      category: parsed.data.category,
      search: parsed.data.search,
      premium: parsed.data.premium === 'true' ? true : undefined,
      page: parsed.data.page,
      limit: parsed.data.limit,
    })

    return res.json(data)
  }

  // GET /api/editors/me
  getMyProfile = async (req: Request, res: Response) => {
    const editor = await editorService.getEditorByUserId(req.user!.sub)
    if (!editor) {
      return res.status(404).json({ message: 'Perfil de editor não encontrado' })
    }
    return res.json({ editor })
  }

  // PATCH /api/editors/me
  updateMyProfile = async (req: Request, res: Response) => {
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Dados inválidos',
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    try {
      const editor = await editorService.updateMyProfile(req.user!.sub, parsed.data)
      return res.json({ editor })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar perfil'
      return res.status(400).json({ message: msg })
    }
  }

  // GET /api/editors/:id
  getEditorById = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const editor = await editorService.getEditorByUserId(id)
    if (!editor) {
      return res.status(404).json({ message: 'Editor não encontrado' })
    }
    return res.json({ editor })
  }
}
