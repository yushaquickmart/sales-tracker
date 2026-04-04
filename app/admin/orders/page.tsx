'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { adminOrdersByDate, returnOrder } from '@/lib/db-queries'
import type { Order } from '@/lib/types'

export default function AdminDailyOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())
  const [showDeleted, setShowDeleted] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOrders = () => {
    if (!selectedDate) return
    setLoading(true)
    adminOrdersByDate(selectedDate, showDeleted)
      .then((res) => {
        if (res.error) throw res.error
        setOrders((res.data || []) as any)
      })
      .catch((err: any) => {
        toast({
          title: 'Failed to load orders',
          description: err?.message || 'Unexpected error',
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
  }, [selectedDate, showDeleted, toast])

  const handleReturnOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to mark this order as returned? This moves it to the returned orders list.')) return
    
    setUpdatingId(orderId)
    const { error } = await returnOrder(orderId)
    setUpdatingId(null)
    
    if (error) {
      toast({ title: 'Return failed', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Order Returned', description: 'Order moved to returned list.' })
      fetchOrders()
    }
  }

  const tableOrders = useMemo(() => {
    if (showDeleted) return orders
    return (orders as any[]).filter((o) => !(o.is_deleted || o.deleted_at))
  }, [orders, showDeleted])

  const groupedByProduct = useMemo(() => {
    return tableOrders.reduce((acc: any, order: any) => {
      const key = order.product_id
      const product = order.product ?? order.products ?? { product_name: order.product_name, buying_price: order.buying_price }
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
    }, {})
  }, [tableOrders])

  const totals = useMemo(() => {
    const totalSales = tableOrders.reduce((sum: number, o: any) => sum + Number(o.total_sell_price || 0), 0)
    const totalBuyCost = tableOrders.reduce((sum: number, o: any) => sum + Number(o.quantity || 0) * Number(o.product?.buying_price || 0), 0)
    return {
      totalSales,
      totalBuyCost,
      grossProfit: totalSales - totalBuyCost,
      totalOrders: tableOrders.length,
    }
  }, [tableOrders])

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Orders (Daily)</h1>
        </div>

        <div className="mb-6 flex flex-col md:flex-row md:items-end md:gap-6 gap-4">
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
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={showDeleted} onCheckedChange={(c) => setShowDeleted(c === true)} />
            <span>Show deleted orders (last 72 hours)</span>
          </label>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{totals.totalOrders}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totals.totalSales.toFixed(0)} BDT</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">{totals.totalBuyCost.toFixed(0)} BDT</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className={`text-2xl font-bold ${totals.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.grossProfit.toFixed(0)} BDT
              </p>
            </div>
          </div>
        </Card>

        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Summary by Product</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : tableOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders for this date</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Qty</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total Sales</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Buy Cost</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.values(groupedByProduct).map((item: any) => {
                    const profit = item.totalSell - item.totalBuyCost
                    return (
                      <tr key={item.product_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.product?.product_name ?? 'Unknown Product'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.totalSell.toFixed(0)} BDT</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.totalBuyCost.toFixed(0)} BDT</td>
                        <td className={`px-6 py-4 text-sm font-semibold text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Creator</th>                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Qty</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableOrders.map((o: any) => {
                    const isDeleted = Boolean(o.is_deleted || o.deleted_at)
                    return (
                      <tr key={o.id} className={`hover:bg-gray-50 ${isDeleted ? 'opacity-70' : ''}`}>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.store?.store_name ?? o.store_name ?? o.store_id}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.customer_phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{o.product?.product_name ?? o.product_name ?? o.product_id}</td>                          <td className="px-6 py-4 text-sm font-medium text-blue-600">
                            {o.created_by_name ? (
                              <Link href={`/admin/users/${o.created_by}`} className="hover:underline">
                                {o.created_by_name}
                              </Link>
                            ) : (
                              '-'
                            )}
                          </td>                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{o.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{Number(o.total_sell_price || 0).toFixed(0)} BDT</td>
                        <td className="px-6 py-4 text-sm text-right">
                          {isDeleted ? (
                            <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">
                              Deleted {o.deleted_by_name ? `by ${o.deleted_by_name}` : ''}
                            </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-semibold">Active</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-right flex gap-2 justify-end">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/moderator/orders/${o.id}`}>View</Link>
                            </Button>
                            {!isDeleted && (
                              <Button 
                                variant="secondary"
                                size="sm"
                                disabled={updatingId === o.id}
                                onClick={() => handleReturnOrder(o.id)}
                              >
                                {updatingId === o.id ? '...' : 'Mark Returned'}
                              </Button>
                            )}
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

