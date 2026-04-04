'use client'

import { ProtectedLayout } from '@/components/layout/protected-layout'
import { MetricCard } from '@/components/shared/metric-card'
import { useEffect, useState } from 'react'
import { getAllStoresSalesMetrics, getStoreMonthToDateMetrics } from '@/lib/db-queries'
import { Card } from '@/components/ui/card'
import { getDhakaTodayDateString } from '@/lib/date-utils'

type MonthlySummary = {
  currentMonthSalesToDate: number
  lastMonthSalesToSameDate: number
  currentMonthDollarCostToDate: number
  cumulativeNetProfit: number
}

type StorePerformance = {
  store_id: string
  store_name: string
  totalSales: number
  grossProfit: number
  netProfit: number
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null)
  const [storePerf, setStorePerf] = useState<StorePerformance[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const metricsResult = await getAllStoresSalesMetrics(selectedDate)
        const storesMetrics = metricsResult.data || []
        setMetrics(storesMetrics)

        const monthlyResults = await Promise.all(
          storesMetrics.map((m: any) => getStoreMonthToDateMetrics(m.store_id, selectedDate))
        )

        const monthlyAggregate = monthlyResults.reduce<MonthlySummary>(
          (acc, m) => ({
            currentMonthSalesToDate: acc.currentMonthSalesToDate + m.currentMonthSalesToDate,
            lastMonthSalesToSameDate: acc.lastMonthSalesToSameDate + m.lastMonthSalesToSameDate,
            currentMonthDollarCostToDate:
              acc.currentMonthDollarCostToDate + m.currentMonthDollarCostToDate,
            cumulativeNetProfit: acc.cumulativeNetProfit + m.cumulativeNetProfit,
          }),
          {
            currentMonthSalesToDate: 0,
            lastMonthSalesToSameDate: 0,
            currentMonthDollarCostToDate: 0,
            cumulativeNetProfit: 0,
          }
        )
        setMonthly(monthlyAggregate)

        const perf: StorePerformance[] = storesMetrics.map((m: any) => ({
          store_id: m.store_id,
          store_name: m.store_name,
          totalSales: m.totalSales,
          grossProfit: m.grossProfit,
          netProfit: m.netProfit,
        }))

        perf.sort((a, b) => b.netProfit - a.netProfit)
        setStorePerf(perf)
      } finally {
        setLoading(false)
      }
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
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard label="Total Sales (Day)" value={totalSales} currency />
          <MetricCard label="Total Cost (Day)" value={totalBuyCost} currency />
          <MetricCard label="Gross Profit (Day)" value={totalGrossProfit} currency />
          <MetricCard label="Net Profit (Day)" value={totalNetProfit} currency />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly Comparison</h3>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : !monthly ? (
              <p className="text-gray-500 text-sm">No data available for this period.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cumulative Sell This Month</p>
                  <p className="text-lg font-bold text-gray-900">
                    {monthly.currentMonthSalesToDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    Cumulative Sell Last Month (Same Date)
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {monthly.lastMonthSalesToSameDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cumulative Dollar Cost This Month</p>
                  <p className="text-lg font-bold text-gray-900">
                    {monthly.currentMonthDollarCostToDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cumulative Net Profit This Month</p>
                  <p
                    className={`text-lg font-bold ${
                      monthly.cumulativeNetProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {monthly.cumulativeNetProfit.toFixed(0)} BDT
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Store Performance (Day)</h3>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : storePerf.length === 0 ? (
              <p className="text-gray-500 text-sm">No stores found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Store</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">
                        Sales
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">
                        Gross Profit
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-900">
                        Net Profit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {storePerf.map((s) => (
                      <tr key={s.store_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {s.store_name}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {s.totalSales.toFixed(0)} BDT
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {s.grossProfit.toFixed(0)} BDT
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            s.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {s.netProfit.toFixed(0)} BDT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  )
}
