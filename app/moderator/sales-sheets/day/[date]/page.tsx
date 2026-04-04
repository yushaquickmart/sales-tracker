'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getSalesSheetSnapshotsByDateForStores, getSalesSheetsByStores } from '@/lib/db-queries'

export default function SalesSheetDayPage() {
  const params = useParams<{ date: string }>()
  const date = params?.date
  const { profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [sheets, setSheets] = useState<any[]>([])

  const storeIds = useMemo(() => {
    if (!profile) return []
    if (profile.role === 'admin') return [] // admin day-view can be expanded later if needed
    return (profile.store_ids && profile.store_ids.length > 0)
      ? profile.store_ids
      : (profile.store_id ? [profile.store_id] : [])
  }, [profile])

  useEffect(() => {
    if (!profile?.id || !date) return
    setLoading(true)

    ;(async () => {
      try {
        // For moderators we scope to their assigned stores; admins can be supported by fetching all stores if needed.
        if (profile.role === 'admin') {
          // Admin: show message for now; list page already shows all days.
          setSnapshots([])
          setSheets([])
          return
        }

        const [snapRes, sheetRes] = await Promise.all([
          getSalesSheetSnapshotsByDateForStores(date, storeIds),
          getSalesSheetsByStores(storeIds, 500),
        ])

        if (snapRes.error) throw snapRes.error
        if (sheetRes.error) throw sheetRes.error

        setSnapshots(snapRes.data || [])
        // filter the sheets list to this day
        setSheets((sheetRes.data || []).filter((s: any) => s.date === date))
      } catch (err: any) {
        toast({
          title: 'Failed to load saved sheet',
          description: err?.message || 'Unexpected error',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [profile?.id, profile?.role, date, storeIds, toast])

  const perStore = useMemo(() => {
    // Prefer snapshots (richer); fallback to sales_sheets
    if (snapshots.length > 0) {
      return snapshots.map((row: any) => ({
        store_id: row.store_id,
        store_name: row.stores?.store_name ?? row.store_id,
        snapshot: row.snapshot,
      }))
    }
    return sheets.map((s: any) => ({
      store_id: s.store_id,
      store_name: s.stores?.store_name ?? s.store_id,
      sheet: s,
    }))
  }, [snapshots, sheets])

  const totals = useMemo(() => {
    let totalSales = 0
    let totalBuyCost = 0
    let totalDollarCost = 0
    let netProfit = 0

    if (snapshots.length > 0) {
      for (const s of snapshots) {
        const t = s.snapshot?.totals || {}
        totalSales += Number(t.totalSales || 0)
        totalBuyCost += Number(t.totalBuyCost || 0)
        totalDollarCost += Number(t.totalDollarCost || 0)
        netProfit += Number(t.netProfit || 0)
      }
    } else {
      for (const s of sheets) {
        totalSales += Number(s.total_sales || 0)
        totalBuyCost += Number(s.total_buy_cost || 0)
        totalDollarCost += Number(s.total_dollar_cost || 0)
        netProfit += Number(s.net_profit || 0)
      }
    }

    return { totalSales, totalBuyCost, totalDollarCost, netProfit }
  }, [snapshots, sheets])

  const grossProfitAllStores = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.reduce((sum, s: any) => sum + Number(s.snapshot?.totals?.grossProfit || 0), 0)
    }
    return sheets.reduce((sum, s: any) => sum + (Number(s.total_sales || 0) - Number(s.total_buy_cost || 0)), 0)
  }, [snapshots, sheets])

  const combined = useMemo(() => {
    // Combined + variables are duplicated in each snapshot; grab from the first one.
    const firstSnap = snapshots[0]?.snapshot ?? null
    return {
      combined: firstSnap?.combined ?? null,
      variables: firstSnap?.variables ?? null,
    }
  }, [snapshots])

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Saved Sales Sheet — {date}</h1>

        {loading ? (
          <Card className="p-6">
            <p className="text-gray-600">Loading…</p>
          </Card>
        ) : perStore.length === 0 ? (
          <Card className="p-6">
            <p className="text-gray-600">No saved sheets found for this date.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {perStore.map((s: any) => {
              const t = s.snapshot?.totals
              const totalSales = Number(t?.totalSales ?? s.sheet?.total_sales ?? 0)
              const totalBuyCost = Number(t?.totalBuyCost ?? s.sheet?.total_buy_cost ?? 0)
              const totalDollarCost = Number(t?.totalDollarCost ?? s.sheet?.total_dollar_cost ?? 0)
              const netProfit = Number(t?.netProfit ?? s.sheet?.net_profit ?? 0)
              const items: any[] = (s.snapshot?.items ?? []) as any[]
              const totalQty = items.reduce((sum, i) => sum + Number(i.quantity_sold || 0), 0)

              return (
                <Card key={s.store_id} className="p-6">
                  <h2 className="text-xl font-semibold mb-4">{s.store_name}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="text-lg font-bold text-gray-900">{totalSales.toFixed(0)} BDT</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Buy Cost</p>
                      <p className="text-lg font-bold text-gray-900">{totalBuyCost.toFixed(0)} BDT</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Dollar Cost</p>
                      <p className="text-lg font-bold text-gray-900">{totalDollarCost.toFixed(0)} BDT</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Profit</p>
                      <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netProfit.toFixed(0)} BDT
                      </p>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Product Name
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Quantity (pcs)
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Gross Profit (Tk)
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Dollar Cost (Tk)
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Per Product Dollar Cost ($)
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Dollar Cost / Unit (Tk)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((item: any) => {
                            const qty = Number(item.quantity_sold || 0)
                            const dc = Number(item.dollar_cost_tk || 0)
                            const per = Number(item.per_product_dollar || 0)
                            const perUnitTk =
                              item.dollar_cost_per_unit_tk !== undefined
                                ? Number(item.dollar_cost_per_unit_tk || 0)
                                : (qty > 0 ? dc / qty : 0)
                            return (
                              <tr key={item.product_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {item.product?.product_name ?? ''}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {qty}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {Number(item.profit || 0).toFixed(0)} BDT
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {dc.toFixed(0)} BDT
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {per.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {perUnitTk.toFixed(2)} BDT
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{totalQty}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {Number(s.snapshot?.totals?.grossProfit ?? 0).toFixed(0)} BDT
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {totalDollarCost.toFixed(0)} BDT
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">-</td>
                            <td className="px-4 py-3 text-sm text-gray-900">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })}

            {/* Combined summary across all stores (replicates preview bottom summary) */}
            <Card className="p-6 bg-yellow-50 border border-yellow-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Combined Summary - All Stores ({date})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Total Sell (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {totals.totalSales.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gross Profit (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {grossProfitAllStores.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Profit (Day)</p>
                  <p className={`text-lg font-bold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.netProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {totals.totalDollarCost.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Operational / Management / Financial / Content / Misc</p>
                  <p className="text-sm font-medium text-gray-900">
                    Op: {Number(combined.variables?.operational_expense || 0).toFixed(0)} | Mgmt: {Number(combined.variables?.management_cost || 0).toFixed(0)} | Fin: {Number(combined.variables?.financial_cost || 0).toFixed(0)} | Content: {Number(combined.variables?.content_cost || 0).toFixed(0)} | Misc: {Number(combined.variables?.others || 0).toFixed(0)}
                  </p>
                </div>
                {combined.combined?.monthToDateSummary && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Sell This Month (All Stores)</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(combined.combined.monthToDateSummary.currentMonthSalesToDate || 0).toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Sell Last Month (Same Date)</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(combined.combined.monthToDateSummary.lastMonthSalesToSameDate || 0).toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Dollar Cost This Month</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(combined.combined.monthToDateSummary.currentMonthDollarCostToDate || 0).toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Net Profit This Month</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(combined.combined.monthToDateSummary.cumulativeNetProfit || 0).toFixed(0)} BDT
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedLayout>
  )
}

