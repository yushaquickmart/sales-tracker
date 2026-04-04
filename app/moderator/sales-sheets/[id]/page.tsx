 'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import {
  getSalesSheetItems,
  getSalesSheetById,
  getSalesSheetSnapshotBySheetId,
  getVariables,
  type Variables,
} from '@/lib/db-queries'
import { SalesSheetItem, SalesSheetSnapshot } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function SalesSheetDetail() {
  const params = useParams<{ id: string }>()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [items, setItems] = useState<SalesSheetItem[]>([])
  const [sheet, setSheet] = useState<any>(null)
  const [snapshot, setSnapshot] = useState<SalesSheetSnapshot | null>(null)
  const [variables, setVariables] = useState<(Variables & { id?: string }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const [snapshotRes, itemsRes, sheetRes, varsRes] = await Promise.all([
        getSalesSheetSnapshotBySheetId(id),
        getSalesSheetItems(id),
        getSalesSheetById(id),
        getVariables(),
      ])
      if (snapshotRes.data) setSnapshot(snapshotRes.data)
      if (itemsRes.data) setItems(itemsRes.data)
      if (sheetRes.data) setSheet(sheetRes.data)
      if (varsRes.data) setVariables(varsRes.data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleExportPNG = async () => {
    const element = document.getElementById('sales-sheet-content')
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
    })
    const image = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = image
    link.download = `sales-sheet-${sheet?.date}.png`
    link.click()
  }

  const handleExportPDF = async () => {
    const element = document.getElementById('sales-sheet-content')
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`sales-sheet-${sheet?.date}.pdf`)
  }

  if (loading) {
    return (
      <ProtectedLayout allowedRoles={['moderator', 'admin']}>
        <div className="p-8 text-center">Loading...</div>
      </ProtectedLayout>
    )
  }

  // If we have a snapshot (new sheets), prefer it as the source of truth so
  // the saved view is an exact replica of the preview. Otherwise, fall back
  // to recomputing from normalized items.
  const snapshotData: any | null = snapshot?.snapshot ?? null

  let totalSales = 0
  let totalBuyCost = 0
  let grossProfit = 0
  let totalDollarCost = 0
  let netProfit = 0
  let fixedExpenses = 0
  let combinedAllStores:
    | {
        totalSalesAllStores: number
        grossProfitAllStores: number
        netProfitAllStores: number
        dollarCostAllStores: number
        monthToDateSummary: {
          currentMonthSalesToDate: number
          lastMonthSalesToSameDate: number
          currentMonthDollarCostToDate: number
          cumulativeNetProfit: number
        } | null
      }
    | null = null
  let rowItems: Array<{
    productName: string
    quantity: number
    profit: number
    dollarCostTk: number
    perProductDollar: number
    dollarCostPerUnitTk: number
  }> = []

  const dollarRate = variables?.dollar_rate || 1

  if (snapshotData) {
    // From snapshot JSON created at save time
    totalSales = Number(snapshotData.totals?.totalSales || 0)
    totalBuyCost = Number(snapshotData.totals?.totalBuyCost || 0)
    grossProfit = Number(snapshotData.totals?.grossProfit || 0)
    totalDollarCost = Number(snapshotData.totals?.totalDollarCost || 0)
    netProfit = Number(snapshotData.totals?.netProfit || 0)

     const snapVars = snapshotData.variables || null
     const op = Number(snapVars?.operational_expense || 0)
     const mgmt = Number(snapVars?.management_cost || 0)
     const fin = Number(snapVars?.financial_cost || 0)
     const content = Number(snapVars?.content_cost || 0)
     const others = Number(snapVars?.others || 0)
     fixedExpenses = op + mgmt + fin + content + others

     const combinedSnap = snapshotData.combined || null
     if (combinedSnap) {
       combinedAllStores = {
         totalSalesAllStores: Number(combinedSnap.totalSalesAllStores || 0),
         grossProfitAllStores: Number(combinedSnap.grossProfitAllStores || 0),
         netProfitAllStores: Number(combinedSnap.netProfitAllStores || 0),
         dollarCostAllStores: Number(combinedSnap.dollarCostAllStores || 0),
         monthToDateSummary: combinedSnap.monthToDateSummary || null,
       }
     }

    rowItems =
      (snapshotData.items || []).map((item: any) => {
        const quantity = Number(item.quantity_sold || item.quantity || 0)
        const profit = Number(item.profit || 0)
        const dollarCostTk = Number(item.dollar_cost_tk || 0)
        const perProductDollar = Number(item.per_product_dollar || 0)
        const dollarCostPerUnitTk =
          quantity > 0 ? dollarCostTk / quantity : 0

        return {
          productName: item.product?.product_name ?? '',
          quantity,
          profit,
          dollarCostTk,
          perProductDollar,
          dollarCostPerUnitTk,
        }
      }) ?? []
  } else {
    // Legacy fallback from normalized items
    totalSales = items.reduce((sum, i) => sum + i.total_sell_value, 0)
    totalBuyCost = items.reduce((sum, i) => sum + i.total_buy_cost, 0)
    grossProfit = totalSales - totalBuyCost
    const totalProfit = items.reduce((sum, i) => sum + (i.profit || 0), 0)

    const totalDollarCostFromItems = items.reduce(
      (sum, i) => sum + (i.dollar_cost_tk || 0),
      0
    )
    totalDollarCost =
      totalDollarCostFromItems > 0 ? totalDollarCostFromItems : sheet?.total_dollar_cost || 0
    const op = variables?.operational_expense ?? 0
    const mgmt = variables?.management_cost ?? 0
    const fin = variables?.financial_cost ?? 0
    const content = variables?.content_cost ?? 0
    const others = (variables as any)?.others ?? 0
    fixedExpenses = op + mgmt + fin + content + others
    netProfit =
      typeof sheet?.net_profit === 'number'
        ? Number(sheet.net_profit)
        : grossProfit - totalDollarCost - fixedExpenses

    rowItems = items.map((item) => {
      const share = totalProfit > 0 ? (item.profit || 0) / totalProfit : 0
      const fallbackDollarCostTk = share * totalDollarCost
      const hasStoredDollar = item.dollar_cost_tk && item.dollar_cost_tk > 0
      const dollarCostTk = hasStoredDollar ? item.dollar_cost_tk : fallbackDollarCostTk

      const hasStoredPerProductDollar =
        item.per_product_dollar && item.per_product_dollar > 0
      const fallbackPerProductDollar =
        dollarRate > 0 ? dollarCostTk / dollarRate : 0
      const perProductDollar = hasStoredPerProductDollar
        ? item.per_product_dollar
        : fallbackPerProductDollar
      const dollarCostPerUnitTk =
        item.quantity_sold > 0 ? dollarCostTk / item.quantity_sold : 0

      return {
        productName: item.product?.product_name ?? '',
        quantity: item.quantity_sold,
        profit: item.profit,
        dollarCostTk,
        perProductDollar,
        dollarCostPerUnitTk,
      }
    })
  }

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Sales Sheet {snapshotData?.store?.store_name ? `- ${snapshotData.store.store_name}` : ''}
          </h1>
          <div className="flex gap-2">
            <Button onClick={handleExportPNG}>Export PNG</Button>
            <Button onClick={handleExportPDF} variant="outline">
              Export PDF
            </Button>
          </div>
        </div>

        <div id="sales-sheet-content" className="bg-white p-8 rounded-lg shadow">
          <div className="mb-8 text-center border-b border-gray-200 pb-6">
            <h2 className="text-2xl font-bold text-gray-900">Sales &amp; Profit Summary</h2>
            <p className="text-gray-600 mt-2">
              {snapshotData?.store?.store_name ?? 'Store'} &mdash;{' '}
              {snapshotData?.date ?? sheet?.date ?? ''}
            </p>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead className="bg-gray-100">
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
                {rowItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.productName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                    <td className={`px-4 py-3 text-sm font-semibold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.profit.toFixed(0)} BDT
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.dollarCostTk.toFixed(0)} BDT
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.perProductDollar.toFixed(2)} $
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.dollarCostPerUnitTk.toFixed(2)} BDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {combinedAllStores && (
            <Card className="mt-8 p-6 bg-yellow-50 border border-yellow-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Combined Summary - All Stores ({snapshotData?.date ?? sheet?.date ?? ''})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                  <p className="text-sm text-gray-600">Total Sell (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combinedAllStores.totalSalesAllStores.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gross Profit (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combinedAllStores.grossProfitAllStores.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Profit (Day)</p>
                  <p
                    className={`text-lg font-bold ${
                      combinedAllStores.netProfitAllStores >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {combinedAllStores.netProfitAllStores.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {combinedAllStores.dollarCostAllStores.toFixed(0)} BDT
                  </p>
                </div>
                {combinedAllStores.monthToDateSummary && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Sell This Month (All Stores)
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {combinedAllStores.monthToDateSummary.currentMonthSalesToDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Sell Last Month (Same Date)
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {combinedAllStores.monthToDateSummary.lastMonthSalesToSameDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Dollar Cost This Month</p>
                      <p className="text-lg font-bold text-gray-900">
                        {combinedAllStores.monthToDateSummary.currentMonthDollarCostToDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Net Profit This Month
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {combinedAllStores.monthToDateSummary.cumulativeNetProfit.toFixed(0)} BDT
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        <Button asChild variant="outline" className="mt-6">
          <Link href="/moderator/sales-report">Back to All Stores Report</Link>
        </Button>
      </div>
    </ProtectedLayout>
  )
}
