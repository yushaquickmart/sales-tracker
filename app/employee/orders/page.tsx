'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { getOrdersByEmployee } from '@/lib/db-queries'
import { Order } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { formatCurrency } from '@/lib/utils'

export default function OrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())

  useEffect(() => {
    if (!selectedDate || !profile?.id) return
    setLoading(true)
    // Employee can see their own orders across all stores (RLS enforces employee-only visibility)
    getOrdersByEmployee(profile.id, selectedDate, 200)
      .then((result) => {
        setOrders(result.data || [])
      })
      .finally(() => setLoading(false))
  }, [selectedDate, profile?.id])

  const totalSales = orders.reduce((sum, o) => sum + o.total_sell_price, 0)
  const totalBuyCost = orders.reduce(
    (sum, o) => sum + o.quantity * (o.product?.buying_price || 0),
    0
  )

  return (
    <ProtectedLayout allowedRoles={['employee']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Order List</h1>

        <div className="mb-6">
          <Label htmlFor="date">Filter by Date</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 max-w-xs"
          />
        </div>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBuyCost)}</p>
            </div>
          </div>
        </Card>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders found for this date</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => {
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{order.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{order.product?.product_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{order.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(order.selling_price_per_unit || 0)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {formatCurrency(order.total_sell_price || 0)}
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
