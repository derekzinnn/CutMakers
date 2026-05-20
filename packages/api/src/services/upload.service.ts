import { cloudinary } from '../lib/cloudinary'
import { BadRequest } from '../lib/errors'

/**
 * Folders permitidas no Cloudinary. Restringir aqui evita que o frontend
 * peça assinaturas para folders arbitrárias.
 */
const ALLOWED_FOLDERS = ['portfolio', 'avatars', 'orders', 'deliveries'] as const
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number]

const ALLOWED_RESOURCE_TYPES = ['image', 'video', 'auto'] as const
type ResourceType = (typeof ALLOWED_RESOURCE_TYPES)[number]

export interface SignatureParams {
  folder: AllowedFolder
  resourceType?: ResourceType
}

export interface SignatureResponse {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
  resourceType: ResourceType
  uploadUrl: string
}

export class UploadService {
  /**
   * Gera uma assinatura assinada para o frontend fazer upload DIRETO ao Cloudinary.
   * Fluxo:
   *   1. Frontend pede assinatura -> recebe {signature, timestamp, ...}
   *   2. Frontend monta FormData e POSTa para `uploadUrl`
   *   3. Cloudinary valida assinatura e aceita o upload
   *   4. Frontend recebe { secure_url, public_id, ... } e manda pro nosso backend
   *
   * Sem isso, o vídeo passaria pelo nosso servidor — lento, caro e fácil de timeoutar.
   */
  generateSignature(params: SignatureParams): SignatureResponse {
    if (!ALLOWED_FOLDERS.includes(params.folder)) {
      throw BadRequest(`Folder inválida. Permitidas: ${ALLOWED_FOLDERS.join(', ')}`)
    }

    const resourceType = params.resourceType ?? 'auto'
    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
      throw BadRequest(`Tipo inválido. Permitidos: ${ALLOWED_RESOURCE_TYPES.join(', ')}`)
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      throw BadRequest('Cloudinary não configurado no servidor')
    }

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `cutmakers/${params.folder}`

    // A ordem dos params NÃO importa — o Cloudinary SDK ordena alfabeticamente
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret)

    return {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    }
  }

  /**
   * Remove um asset do Cloudinary pelo public_id (usado quando o usuário
   * deleta um PortfolioItem — vamos limpar o arquivo lá também).
   */
  async destroy(publicId: string, resourceType: 'image' | 'video' = 'video') {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    } catch (err) {
      console.warn('[cloudinary] falha ao remover asset', publicId, err)
    }
  }
}
