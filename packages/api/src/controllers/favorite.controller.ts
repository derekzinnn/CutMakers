import { Request, Response, NextFunction } from 'express'
import { favoriteService } from '../services/favorite.service'

export class FavoriteController {
  toggle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await favoriteService.toggle(req.user!.sub, req.params.editorUserId as string)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const editors = await favoriteService.listForUser(req.user!.sub)
      res.json({ editors })
    } catch (err) {
      next(err)
    }
  }

  listIds = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ids = await favoriteService.listFavoritedUserIds(req.user!.sub)
      res.json({ editorUserIds: ids })
    } catch (err) {
      next(err)
    }
  }
}

export const favoriteController = new FavoriteController()
