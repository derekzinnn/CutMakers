import { z } from 'zod'

/**
 * URL http(s) absoluta. `z.string().url()` sozinho aceita qualquer esquema
 * reconhecido pelo WHATWG URL parser — inclusive `javascript:`, `data:` e
 * `vbscript:`, que um `<a href>` no front executa ao clicar. Usar em qualquer
 * campo que vira link clicável sem passar por sanitização própria.
 */
export const httpUrl = (label = 'URL') =>
  z
    .string()
    .url(`${label} inválida`)
    .refine((val) => {
      try {
        const protocol = new URL(val).protocol
        return protocol === 'http:' || protocol === 'https:'
      } catch {
        return false
      }
    }, `${label} deve ser um link http(s)`)

/**
 * Mesma regra de httpUrl, mas exige que o arquivo tenha vindo do nosso Cloudinary
 * (upload assinado — ver upload.service.ts). Campos de vídeo/thumbnail/avatar
 * preenchidos pelo FRONT depois de um upload nunca deveriam apontar para outro
 * lugar: um link arbitrário aceito aqui vira uma forma de hospedar phishing com
 * a cara da CutMakers, e contraria a regra do projeto de upload só por Cloudinary.
 */
export const cloudinaryUrl = (label = 'URL') =>
  httpUrl(label).refine((val) => {
    try {
      return new URL(val).hostname === 'res.cloudinary.com'
    } catch {
      return false
    }
  }, `${label} deve vir de um upload da CutMakers`)
