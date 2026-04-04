'use client'

import { ProtectedLayout } from '@/components/layout/protected-layout'
import { MetricCard } from '@/components/shared/metric-card'
import { useEffect, useState } from 'react'
import { getAllStoresSalesMetrics, getStores } from '@/lib/db-queries'
import { Card } from '@/components/ui/card'
import { getDhakaTodayDateString } from '@/lib/date-utils'

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())

  useEffect(() => {
    const fetchData = async () => {
      const storesData = await getStores()
      setStores(storesData.data || [])

      const metricsData = await getAllStoresSalesMetrics(selectedDate)
      setMetrics(metricsData.data || [])
      setLoading(false)
    }

    fetchData()
  }, [selectedDate])

  const totalSales = metrics.reduce((sum, m) => sum + m.totalSales, 0)
  const totalBuyCost = metrics.reduce((sum, m) => sum + m.totalBuyCost, 0)
  const totalGrossProfit = metrics.reduce((sum, m) => sum + m.grossProfit, 0)
  const totalNetProfit = metrics.reduce((sum, m) => sum + m.netProfit, 0)

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard label="Total Sales" value={totalSales} currency={true} />
          <MetricCard label="Total Cost" value={totalBuyCost} currency={true} />
          <MetricCard label="Gross Profit" value={totalGrossProfit} currency={true} />
          <MetricCard label="Net Profit" value={totalNetProfit} currency={true} />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Store Breakdown</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Store
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Total Sales
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Buy Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Gross Profit
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Net Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metrics.map((metric) => (
                    <tr key={metric.store_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {metric.store_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {metric.totalSales.toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {metric.totalBuyCost.toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {metric.grossProfit.toFixed(0)} BDT
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${metric.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.netProfit.toFixed(0)} BDT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}
