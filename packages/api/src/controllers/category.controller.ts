import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export class CategoryController {
  // GET /api/categories
  list = async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return res.json({ categories })
  }
}
