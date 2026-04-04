'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { getAllSalesSheets, getSalesSheetsByStores, deleteSalesSheetById } from '@/lib/db-queries'
import { SalesSheet } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { useToast } from '@/hooks/use-toast'

export default function SalesSheetsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [sheets, setSheets] = useState<SalesSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [storeIds, setStoreIds] = useState<string[]>([])

  useEffect(() => {
    if (!profile?.id) return
    setLoading(true)

    const ids = (profile.store_ids && profile.store_ids.length > 0)
      ? profile.store_ids
      : (profile.store_id ? [profile.store_id] : [])
    setStoreIds(ids)

    const load = async () => {
      if (profile.role === 'admin') {
        const res = await getAllSalesSheets(200)
        setSheets((res.data || []) as any)
      } else {
        const res = ids.length ? await getSalesSheetsByStores(ids, 200) : { data: [] as any[] }
        setSheets((res.data || []) as any)
      }
      setLoading(false)
    }

    load().catch(() => setLoading(false))
  }, [profile])

  // Group per-store saved sheets into one row per day
  const daily = sheets.reduce<Record<string, { date: string; rows: any[]; totals: any }>>((acc, s: any) => {
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

  const dailyRows = Object.values(daily)
    .map((d) => ({ ...d, storeCount: (d.totals.stores as Set<string>).size }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sales sheet? This cannot be undone.')) {
      return
    }

    const { error } = await deleteSalesSheetById(id)
    if (error) {
      toast({
        title: 'Failed to delete sales sheet',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    setSheets((prev) => prev.filter((s) => s.id !== id))

    toast({
      title: 'Sales sheet deleted',
      description: 'The selected sales sheet has been removed.',
    })
  }

  const handleDeleteDay = async (date: string) => {
    const rowsForDay = sheets.filter((s: any) => s.date === date)
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
      setSheets((prev) => prev.filter((s: any) => s.date !== date))
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

  const totalNetProfit = dailyRows.reduce((sum, d: any) => sum + Number(d.totals.net_profit || 0), 0)
  const totalDollarCost = dailyRows.reduce((sum, d: any) => sum + Number(d.totals.total_dollar_cost || 0), 0)

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Sheets</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/moderator/sales-report">All Stores Report</Link>
            </Button>
            <Button asChild>
              <Link href="/moderator/generate-sales-sheet">Create New Sheet</Link>
            </Button>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Sheets</p>
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
              <p className="text-sm text-gray-600">Avg Profit/Sheet</p>
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Stores
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Total Sales
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Buy Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Dollar Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Net Profit
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyRows.map((d: any) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{d.storeCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{Number(d.totals.total_sales).toFixed(0)} BDT</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {Number(d.totals.total_buy_cost).toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {Number(d.totals.total_dollar_cost).toFixed(0)} BDT
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${Number(d.totals.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(d.totals.net_profit).toFixed(0)} BDT
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/moderator/sales-sheets/day/${d.date}`}>View</Link>
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
