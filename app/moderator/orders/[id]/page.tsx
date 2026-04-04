'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { adminOrderById, getOrderById, softDeleteOrder } from '@/lib/db-queries'

export default function ModeratorOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    ;(async () => {
      const res = profile?.role === 'admin' ? await adminOrderById(id) : await getOrderById(id)
      if (res.error) throw res.error
      setOrder(res.data)
    })()
      .catch((err: any) => {
        toast({
          title: 'Failed to load order',
          description: err?.message || 'Unexpected error',
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [id, toast])

  const isDeleted = Boolean(order?.is_deleted || order?.deleted_at)
  const isReturned = Boolean(order?.is_returned || order?.returned_at)

  const profit = useMemo(() => {
    const buyingPrice = Number(order?.product?.buying_price ?? order?.buying_price ?? 0)
    const buy = buyingPrice * Number(order?.quantity || 0)
    return Number(order?.total_sell_price || 0) - buy
  }, [order])

  const handleDelete = async () => {
    if (!profile?.id || !order?.id) return
    if (!confirm('Delete this order? It will be marked deleted (admin can see for 72 hours).')) return

    setSaving(true)
    try {
      const res = await softDeleteOrder(order.id, profile.id)
      if (res.error) throw res.error
      setOrder(res.data)
      toast({ title: 'Order deleted', description: 'The order is now marked as deleted.' })
    } catch (err: any) {
      toast({
        title: 'Failed to delete order',
        description: err?.message || 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isReturned ? 'Returned Order Details' : 'Order Details'}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || isDeleted || isReturned || profile?.role === 'admin'}
              title={profile?.role === 'admin' ? 'Admin delete is not enabled here' : undefined}
            >
              {isDeleted ? 'Deleted' : isReturned ? 'Returned' : saving ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="p-6">
            <p className="text-gray-600">Loading…</p>
          </Card>
        ) : !order ? (
          <Card className="p-6">
            <p className="text-gray-600">Order not found.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {isDeleted && (
              <Card className="p-4 border border-red-200 bg-red-50">
                <p className="text-sm font-medium text-red-800">
                  This order is marked as deleted
                  {order.deleted_by_name ? ` by ${order.deleted_by_name}` : ''}
                  {order.deleted_at ? ` at ${new Date(order.deleted_at).toLocaleString()}` : ''}.
                </p>
              </Card>
            )}

            {isReturned && (
              <Card className="p-4 border border-yellow-200 bg-yellow-50">
                <p className="text-sm font-medium text-yellow-800">
                  This order has been returned
                  {order.returned_by_name ? ` by ${order.returned_by_name}` : ''}
                  {order.returned_at ? ` at ${new Date(order.returned_at).toLocaleString()}` : ''}.
                </p>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Customer</h2>
                {order.created_by_name && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Created By</p>
                    <p className="text-sm font-medium text-gray-900 border border-gray-200 bg-gray-50 px-3 py-1 rounded-full mt-1 inline-block">
                      {profile?.role === 'admin' ? (
                        <a href={`/admin/users/${order.created_by}`} className="hover:underline hover:text-blue-600 transition-colors">
                          {order.created_by_name}
                        </a>
                      ) : (
                        order.created_by_name
                      )}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold text-gray-900">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="text-lg font-semibold text-gray-900">{order.customer_phone || '-'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Order</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Store</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {order.store?.store_name ?? order.store_name ?? order.store_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Product</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {order.product?.product_name ?? order.product_name ?? order.product_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quantity</p>
                  <p className="text-lg font-semibold text-gray-900">{order.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Date</p>
                  <p className="text-lg font-semibold text-gray-900">{order.order_date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unit Price</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {Number(order.selling_price_per_unit || 0).toFixed(2)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {Number(order.total_sell_price || 0).toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Profit</p>
                  <p className={`text-lg font-semibold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {profit.toFixed(0)} BDT
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedLayout>
  )
}

