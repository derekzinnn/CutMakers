import { Router } from 'express'
import { CategoryController } from '../controllers/category.controller'

export const categoryRoutes = Router()
const ctrl = new CategoryController()

categoryRoutes.get('/', ctrl.list)
