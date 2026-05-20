/**
 * Erro HTTP padronizado. Lançado pelos services e tratado pelo errorMiddleware.
 *
 * @example
 *   throw new HttpError(404, 'Item não encontrado')
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const NotFound = (msg = 'Não encontrado') => new HttpError(404, msg)
export const Forbidden = (msg = 'Acesso negado') => new HttpError(403, msg)
export const BadRequest = (msg = 'Dados inválidos') => new HttpError(400, msg)
export const Unauthorized = (msg = 'Não autenticado') => new HttpError(401, msg)
