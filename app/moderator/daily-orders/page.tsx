'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { getOrdersForAllStoresByDate, softDeleteOrder, returnOrder } from '@/lib/db-queries'
import { Order } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { useToast } from '@/hooks/use-toast'

export default function DailyOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())
  const [onlyMyOrders, setOnlyMyOrders] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    // Moderators/admins can view orders across all stores (RLS enforces role visibility)
    getOrdersForAllStoresByDate(selectedDate, 2000)
      .then((result) => {
        setOrders(result.data || [])
      })
      .finally(() => setLoading(false))
  }, [selectedDate])

  const visibleOrders =
    onlyMyOrders && profile?.id
      ? orders.filter((o) => o.created_by === profile.id)
      : orders

  const tableOrders =
    profile?.role === 'admin' && showDeleted
      ? visibleOrders
      : visibleOrders.filter((o: any) => !o.deleted_at)

  const handleDelete = async (orderId: string) => {
    if (!profile?.id) return
    if (!confirm('Delete this order? It will be marked deleted (admin can see for 72 hours).')) return

    setDeletingId(orderId)
    try {
      const { error } = await softDeleteOrder(orderId, profile.id)
      if (error) throw error
      // refresh list
      const refreshed = await getOrdersForAllStoresByDate(selectedDate, 2000)
      if (refreshed.data) setOrders(refreshed.data as any)
      toast({ title: 'Order deleted', description: 'The order is now marked as deleted.' })
    } catch (err: any) {
      toast({
        title: 'Failed to delete order',
        description: err?.message || 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleReturnOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to mark this order as returned? This moves it to the returned orders list.')) return
    
    setUpdatingId(orderId)
    const { error } = await returnOrder(orderId)
    setUpdatingId(null)
    
    if (error) {
      toast({ title: 'Return failed', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Order Returned', description: 'Order moved to returned list.' })
      const refreshed = await getOrdersForAllStoresByDate(selectedDate, 2000)
      if (refreshed.data) setOrders(refreshed.data as any)
    }
  }

  const groupedByProduct = visibleOrders.reduce(
    (acc, order) => {
      const key = order.product_id
      const product = order.product ?? (order as any).products
      if (!acc[key]) {
        acc[key] = {
          product_id: key,
          product,
          quantity: 0,
          totalSell: 0,
          totalBuyCost: 0,
        }
      }
      acc[key].quantity += order.quantity
      acc[key].totalSell += order.total_sell_price
      acc[key].totalBuyCost += order.quantity * (product?.buying_price || 0)
      return acc
    },
    {} as Record<
      string,
      {
        product_id: string
        product: any
        quantity: number
        totalSell: number
        totalBuyCost: number
      }
    >
  )

  const totalSales = visibleOrders.reduce((sum, o) => sum + o.total_sell_price, 0)
  const totalBuyCost = visibleOrders.reduce(
    (sum, o) => sum + o.quantity * (o.product?.buying_price || 0),
    0
  )
  const totalProfit = totalSales - totalBuyCost

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Daily Orders & Packaging List</h1>
          <Link href="/moderator/sales-sheets">
            <Button>Generate Sales Sheet</Button>
          </Link>
        </div>

        <div className="mb-6 flex flex-col md:flex-row md:items-center md:gap-6">
          <div>
            <Label htmlFor="date">Select Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-2 max-w-xs"
            />
          </div>
          <label className="flex items-center gap-2 mt-4 md:mt-6 text-sm text-gray-700">
            <Checkbox
              checked={onlyMyOrders}
              onCheckedChange={(c) => setOnlyMyOrders(c === true)}
            />
            <span>Show only orders I created</span>
          </label>
          {profile?.role === 'admin' && (
            <label className="flex items-center gap-2 mt-4 md:mt-6 text-sm text-gray-700">
              <Checkbox
                checked={showDeleted}
                onCheckedChange={(c) => setShowDeleted(c === true)}
              />
              <span>Show deleted orders (last 72 hours)</span>
            </label>
          )}
        </div>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">
                Total Orders{onlyMyOrders ? ' (My)' : ''}
              </p>
              <p className="text-2xl font-bold text-gray-900">{visibleOrders.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totalSales.toFixed(0)} BDT</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">{totalBuyCost.toFixed(0)} BDT</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfit.toFixed(0)} BDT
              </p>
            </div>
          </div>
        </Card>

        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Packaging List by Product</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : visibleOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders for this date</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Total Sales
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Buy Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.values(groupedByProduct).map((item, idx) => {
                    const profit = item.totalSell - item.totalBuyCost
                    return (
                      <tr key={item.product_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.product?.product_name ?? 'Unknown Product'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.totalSell.toFixed(0)} BDT
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.totalBuyCost.toFixed(0)} BDT
                        </td>
                        <td className={`px-6 py-4 text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {profit.toFixed(0)} BDT
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Individual Orders</h2>
            <p className="text-sm text-gray-600 mt-1">
              View customer details, open an order, or delete it.
            </p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : tableOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders to show</div>
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
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableOrders.map((o: any) => {
                    const isDeleted = Boolean(o.deleted_at); return (
                      <tr key={o.id} className={`hover:bg-gray-50 ${isDeleted ? 'opacity-70' : ''}`}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {o.store?.store_name ?? o.store_id}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.customer_phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.product?.product_name ?? o.product_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{o.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          {Number(o.total_sell_price || 0).toFixed(0)} BDT
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          {isDeleted ? (
                            <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">
                              Deleted {o.deleted_by_name ? `by ${o.deleted_by_name}` : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-semibold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/moderator/orders/${o.id}`}>View</Link>
                            </Button>
                            {(profile?.role === 'moderator' || profile?.role === 'admin') && ( <> <Button size="sm" variant="destructive"
                                disabled={isDeleted || deletingId === o.id}
                                onClick={() => handleDelete(o.id)}
                              >
                                {isDeleted ? 'Deleted' : deletingId === o.id ? 'Deleting…' : 'Delete'}
                              </Button>
                              
                              {!isDeleted && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingId === o.id}
                                  onClick={() => handleReturnOrder(o.id)}
                                >
                                  {updatingId === o.id ? 'Returning...' : 'Mark Returned'}
                                </Button>
                              )}
                            </>
                            )}
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



