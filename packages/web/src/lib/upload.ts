import { api } from './api'

export type UploadFolder = 'portfolio' | 'avatars' | 'orders' | 'deliveries'
export type ResourceType = 'image' | 'video' | 'auto'

export interface UploadResult {
  secureUrl: string
  publicId: string
  thumbnailUrl?: string
  resourceType: string
  format: string
  bytes: number
  duration?: number
}

interface SignatureResponse {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
  resourceType: ResourceType
  uploadUrl: string
}

/**
 * Faz upload direto ao Cloudinary usando assinatura do nosso backend.
 * Fluxo: pede assinatura -> POSTa arquivo pro Cloudinary -> retorna URLs.
 *
 * @example
 *   const result = await uploadFile(file, 'portfolio', 'video', (p) => setProgress(p))
 *   console.log(result.secureUrl)
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder,
  resourceType: ResourceType = 'auto',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  // 1. pede assinatura no nosso backend
  const { data: sig } = await api.post<SignatureResponse>('/uploads/signature', {
    folder,
    resourceType,
  })

  // 2. monta FormData e envia direto pro Cloudinary
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.apiKey)
  formData.append('timestamp', sig.timestamp.toString())
  formData.append('signature', sig.signature)
  formData.append('folder', sig.folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', sig.uploadUrl)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText)
        const isVideo = result.resource_type === 'video'
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          // Cloudinary serve thumbnail trocando a extensão por .jpg
          thumbnailUrl: isVideo ? result.secure_url.replace(/\.\w+$/, '.jpg') : undefined,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          duration: result.duration,
        })
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error(err.error?.message ?? 'Falha no upload'))
        } catch {
          reject(new Error(`Upload falhou: ${xhr.statusText}`))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Erro de rede no upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')))

    xhr.send(formData)
  })
}
