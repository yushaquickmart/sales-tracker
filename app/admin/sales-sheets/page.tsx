'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { deleteSalesSheetById, getAllSalesSheets } from '@/lib/db-queries'
import { SalesSheet } from '@/lib/types'

export default function AdminSalesSheetsPage() {
  const { toast } = useToast()
  const [sheets, setSheets] = useState<SalesSheet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      const res = await getAllSalesSheets(500)
      if (res.error) throw res.error
      setSheets((res.data || []) as any)
    })()
      .catch((err: any) => {
        toast({
          title: 'Failed to load sales sheets',
          description: err?.message || 'Unexpected error',
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [toast])

  const dailyRows = useMemo(() => {
    // Group per-store saved sheets into one row per day
    const daily = (sheets as any[]).reduce<
      Record<
        string,
        {
          date: string
          rows: any[]
          totals: {
            total_sales: number
            total_buy_cost: number
            total_dollar_cost: number
            net_profit: number
            stores: Set<string>
          }
        }
      >
    >((acc, s: any) => {
      const d = s.date
      if (!acc[d]) {
        acc[d] = {
          date: d,
          rows: [],
          totals: {
            total_sales: 0,
            total_buy_cost: 0,
            total_dollar_cost: 0,
            net_profit: 0,
            stores: new Set<string>(),
          },
        }
      }
      acc[d].rows.push(s)
      acc[d].totals.total_sales += Number(s.total_sales || 0)
      acc[d].totals.total_buy_cost += Number(s.total_buy_cost || 0)
      acc[d].totals.total_dollar_cost += Number(s.total_dollar_cost || 0)
      acc[d].totals.net_profit += Number(s.net_profit || 0)
      acc[d].totals.stores.add(s.store_id)
      return acc
    }, {})

    return Object.values(daily)
      .map((d) => ({ ...d, storeCount: (d.totals.stores as Set<string>).size }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [sheets])

  const totalNetProfit = useMemo(
    () => dailyRows.reduce((sum, d: any) => sum + Number(d.totals.net_profit || 0), 0),
    [dailyRows]
  )
  const totalDollarCost = useMemo(
    () => dailyRows.reduce((sum, d: any) => sum + Number(d.totals.total_dollar_cost || 0), 0),
    [dailyRows]
  )

  const handleDeleteDay = async (date: string) => {
    const rowsForDay = (sheets as any[]).filter((s: any) => s.date === date)
    if (rowsForDay.length === 0) return

    if (
      !confirm(
        `Delete the saved sales sheet for ${date}?\n\nThis will delete ${rowsForDay.length} store sheet(s) saved on that day.`
      )
    ) {
      return
    }

    setLoading(true)
    try {
      for (const row of rowsForDay) {
        const { error } = await deleteSalesSheetById((row as any).id)
        if (error) throw error
      }
      setSheets((prev) => (prev as any[]).filter((s: any) => s.date !== date) as any)
      toast({
        title: 'Sales sheet deleted',
        description: `Deleted saved sheets for ${date}.`,
      })
    } catch (err: any) {
      toast({
        title: 'Failed to delete sales sheet',
        description: err?.message || 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Sheets (Daily)</h1>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Days</p>
              <p className="text-2xl font-bold text-gray-900">{dailyRows.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Net Profit</p>
              <p className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalNetProfit.toFixed(0)} BDT
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Dollar Cost</p>
              <p className="text-2xl font-bold text-gray-900">{totalDollarCost.toFixed(0)} BDT</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Profit/Day</p>
              <p className="text-2xl font-bold text-gray-900">
                {dailyRows.length > 0 ? (totalNetProfit / dailyRows.length).toFixed(0) : 0} BDT
              </p>
            </div>
          </div>
        </Card>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : dailyRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No sales sheets created yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Stores</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total Sales</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Buy Cost</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Dollar Cost</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Net Profit</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyRows.map((d: any) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{d.storeCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {Number(d.totals.total_sales).toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {Number(d.totals.total_buy_cost).toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {Number(d.totals.total_dollar_cost).toFixed(0)} BDT
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold ${
                          Number(d.totals.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Number(d.totals.net_profit).toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/sales-sheets/day/${d.date}`}>View</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteDay(d.date)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
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

