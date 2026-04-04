'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { getReturnedOrdersByDate } from '@/lib/db-queries'
import { Order } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { useToast } from '@/hooks/use-toast'

export default function ReturnedOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    getReturnedOrdersByDate(selectedDate)
      .then((result) => {
        setOrders(result.data || [])
      })
      .catch((err: any) => {
        toast({
          title: 'Failed to load returned orders',
          description: err.message,
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [selectedDate, toast])

  const tableOrders = orders; // No deletes in returned orders view needed

  return (
    <ProtectedLayout allowedRoles={['admin', 'moderator']}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Returned Orders</h1>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
            <div>
              <Label htmlFor="date" className="sr-only">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Returned Orders</h2>
            <p className="text-sm text-gray-600 mt-1">
              View all orders that were returned.
            </p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : tableOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No returned orders for this date</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Store</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Qty</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableOrders.map((o: any) => {
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {o.store?.store_name ?? o.store_name ?? o.store_id}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.customer_phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.product?.product_name ?? o.product_name ?? o.product_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{o.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          {Number(o.total_sell_price || 0).toFixed(0)} BDT
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <div className="flex justify-end gap-2">
                             <Button asChild variant="outline" size="sm">
                              <Link href={`/moderator/orders/${o.id}`}>View</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}
