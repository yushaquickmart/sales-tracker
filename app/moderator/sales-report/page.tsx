'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  getAssignedStoresForProfile,
  getSalesSheetByStoreAndDate,
  getStoreMonthToDateMetrics,
  getDailySalesMetrics,
  getSalesSheetsForStoreInRange,
} from '@/lib/db-queries'
import type { Store } from '@/lib/types'
import html2canvas from 'html2canvas'
import { getDhakaTodayDateString } from '@/lib/date-utils'

type StoreDailySummary = {
  store: Store
  totalSales: number
  totalBuyCost: number
  grossProfit: number
  dollarCost: number
  netProfit: number
}

type StoreMonthToDate = {
  currentMonthSalesToDate: number
  lastMonthSalesToSameDate: number
  currentMonthDollarCostToDate: number
  cumulativeNetProfit: number
}

type ViewMode = 'daily' | 'weekly' | 'monthly'

export default function SalesReportPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState(getDhakaTodayDateString())
  const [loading, setLoading] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [dailySummaries, setDailySummaries] = useState<StoreDailySummary[]>([])
  const [monthToDate, setMonthToDate] = useState<Record<string, StoreMonthToDate>>({})
  const [viewMode, setViewMode] = useState<ViewMode>('daily')

  useEffect(() => {
    if (!profile?.id || !selectedDate) return
    ;(async () => {
      setLoading(true)
      try {
        const { data: assignedStores, error } = await getAssignedStoresForProfile(profile.id)
        if (error) {
          toast({
            title: 'Failed to load stores',
            description: error.message,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }
        setStores(assignedStores)

        const daily: StoreDailySummary[] = []
        const mtd: Record<string, StoreMonthToDate> = {}

        const selected = new Date(selectedDate)
        const formatDate = (d: Date) => d.toISOString().split('T')[0]

        const endDateStr = formatDate(selected)
        let startDateStr = endDateStr

        if (viewMode === 'weekly') {
          const start = new Date(selected)
          start.setDate(start.getDate() - 6) // last 7 days inclusive
          startDateStr = formatDate(start)
        } else if (viewMode === 'monthly') {
          const start = new Date(selected.getFullYear(), selected.getMonth(), 1)
          startDateStr = formatDate(start)
        }

        for (const store of assignedStores) {
          const [mtdMetrics] = await Promise.all([
            getStoreMonthToDateMetrics(store.id, selectedDate),
          ])

          let totalSales = 0
          let totalBuyCost = 0
          let grossProfit = 0
          let dollarCost = 0
          let netProfit = 0

          if (viewMode === 'daily') {
            // Prefer saved daily sheet; otherwise compute from orders/expenses
            const [sheetResult, dailyMetrics] = await Promise.all([
              getSalesSheetByStoreAndDate(store.id, selectedDate),
              getDailySalesMetrics(store.id, selectedDate),
            ])

            if (sheetResult.data) {
              totalSales = Number(sheetResult.data.total_sales || 0)
              totalBuyCost = Number(sheetResult.data.total_buy_cost || 0)
              grossProfit = totalSales - totalBuyCost
              dollarCost = Number(sheetResult.data.total_dollar_cost || 0)
              netProfit = Number(sheetResult.data.net_profit || 0)
            } else {
              totalSales = dailyMetrics.totalSales
              totalBuyCost = dailyMetrics.totalBuyCost
              grossProfit = dailyMetrics.grossProfit
              const expenses = dailyMetrics.expenses || null
              const totalExpenses =
                (expenses?.operational_expense || 0) +
                (expenses?.management_cost || 0) +
                (expenses?.financial_cost || 0) +
                (expenses?.content_cost || 0) +
                ((expenses as any)?.others || 0)
              dollarCost = 0
              netProfit = grossProfit - totalExpenses
            }
          } else {
            // Weekly / Monthly: aggregate from saved sales_sheets in the range
            const { data: sheetsInRange, error: sheetsError } = await getSalesSheetsForStoreInRange(
              store.id,
              startDateStr,
              endDateStr
            )
            if (sheetsError) {
              throw sheetsError
            }

            if (sheetsInRange.length > 0) {
              for (const sheet of sheetsInRange) {
                totalSales += Number(sheet.total_sales || 0)
                totalBuyCost += Number(sheet.total_buy_cost || 0)
                dollarCost += Number(sheet.total_dollar_cost || 0)
                netProfit += Number(sheet.net_profit || 0)
              }
              grossProfit = totalSales - totalBuyCost
            } else {
              totalSales = 0
              totalBuyCost = 0
              grossProfit = 0
              dollarCost = 0
              netProfit = 0
            }
          }

          daily.push({
            store,
            totalSales,
            totalBuyCost,
            grossProfit,
            dollarCost,
            netProfit,
          })
          mtd[store.id] = mtdMetrics
        }

        setDailySummaries(daily)
        setMonthToDate(mtd)
      } catch (err: any) {
        toast({
          title: 'Failed to load report',
          description: err?.message || 'Unexpected error while building report',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [profile?.id, selectedDate, viewMode, toast])

  const combined = useMemo(() => {
    const base = {
      totalSales: 0,
      totalBuyCost: 0,
      grossProfit: 0,
      dollarCost: 0,
      netProfit: 0,
      currentMonthSalesToDate: 0,
      lastMonthSalesToSameDate: 0,
      currentMonthDollarCostToDate: 0,
      cumulativeNetProfit: 0,
    }
    for (const s of dailySummaries) {
      base.totalSales += s.totalSales
      base.totalBuyCost += s.totalBuyCost
      base.grossProfit += s.grossProfit
      base.dollarCost += s.dollarCost
      base.netProfit += s.netProfit
    }
    for (const store of stores) {
      const m = monthToDate[store.id]
      if (!m) continue
      base.currentMonthSalesToDate += m.currentMonthSalesToDate
      base.lastMonthSalesToSameDate += m.lastMonthSalesToSameDate
      base.currentMonthDollarCostToDate += m.currentMonthDollarCostToDate
      base.cumulativeNetProfit += m.cumulativeNetProfit
    }
    return base
  }, [dailySummaries, monthToDate, stores])

  const handleExportPNG = async () => {
    const element = document.getElementById('sales-report-content')
    if (!element) return
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
    })
    const image = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = image
    link.download = `sales-report-${selectedDate || 'day'}.png`
    link.click()
  }

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Sales Report (All Stores)</h1>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="date" className="text-sm text-gray-700">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 max-w-xs"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-700 mb-1">View</span>
              <div className="inline-flex rounded-md shadow-sm border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1 text-sm ${
                    viewMode === 'daily'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('weekly')}
                  className={`px-3 py-1 text-sm border-l ${
                    viewMode === 'weekly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('monthly')}
                  className={`px-3 py-1 text-sm border-l ${
                    viewMode === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <Button onClick={handleExportPNG} disabled={loading}>
              Export PNG
            </Button>
          </div>
        </div>

        <div id="sales-report-content">
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Combined Summary</h2>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : stores.length === 0 ? (
              <p className="text-gray-500">
                No stores assigned to your account. Please contact an admin.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Sales (Day)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {combined.totalSales.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gross Profit (Day)</p>
                  <p
                    className={`text-2xl font-bold ${
                      combined.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {combined.grossProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Profit (Day)</p>
                  <p
                    className={`text-2xl font-bold ${
                      combined.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {combined.netProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost (Day)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {combined.dollarCost.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sales MTD (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combined.currentMonthSalesToDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sales MTD Last Month (Same Date)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combined.lastMonthSalesToSameDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost MTD</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combined.currentMonthDollarCostToDate.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cumulative Net Profit (MTD)</p>
                  <p
                    className={`text-lg font-bold ${
                      combined.cumulativeNetProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {combined.cumulativeNetProfit.toFixed(0)} BDT
                  </p>
                </div>
              </div>
            )}
          </Card>

          {dailySummaries.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Per-Store Daily Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Store
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Total Sales
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Gross Profit
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Dollar Cost
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Net Profit
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Sales MTD
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                        Sales MTD Last Month
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dailySummaries.map((s) => {
                      const m = monthToDate[s.store.id]
                      return (
                        <tr key={s.store.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {s.store.store_name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {s.totalSales.toFixed(0)} BDT
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {s.grossProfit.toFixed(0)} BDT
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {s.dollarCost.toFixed(0)} BDT
                          </td>
                          <td
                            className={`px-4 py-2 text-sm font-semibold ${
                              s.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {s.netProfit.toFixed(0)} BDT
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {m ? m.currentMonthSalesToDate.toFixed(0) : '0'} BDT
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {m ? m.lastMonthSalesToSameDate.toFixed(0) : '0'} BDT
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}

