import { useParams, useNavigate } from 'react-router-dom'
import { OrderDetail } from '@/components/orders/OrderDetail'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="min-h-screen" style={{ background: '#0D1B2A' }}>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <OrderDetail orderId={id} onBack={() => navigate(-1)} />
      </main>
    </div>
  )
}
