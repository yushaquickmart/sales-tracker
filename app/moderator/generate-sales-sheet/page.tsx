 'use client'

import { useState, useEffect } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  getOrdersByStoreAndDate,
  getReturnedOrdersByDate,
  insertSalesSheet,
  insertSalesSheetItems,
  getSalesSheetByStoreAndDate,
  insertOrUpdateExpense,
  getAssignedStoresForProfile,
  getVariables,
  getStoreMonthToDateMetrics,
  insertSalesSheetSnapshot,
  getProducts,
  type Variables,
} from '@/lib/db-queries'
import type { Store } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { getDhakaTodayDateString } from '@/lib/date-utils'

type StoreItemPreview = {
  product_id: string
  quantity_sold: number
  total_sell_value: number
  total_buy_cost: number
  profit: number
  dollar_cost_tk: number
  per_product_dollar: number | string
  // Derived: dollar cost per unit in Tk (for display only)
  dollar_cost_per_unit_tk?: number
  product: {
    id: string
    product_name: string
    buying_price: number
  }
}

type StorePreview = {
  store: Store
  items: StoreItemPreview[]
  totalSales: number
  totalBuyCost: number
  totalReturnedAmount: number
  grossProfit: number
  totalDollarCost: number
  netProfit: number
}

type MonthToDateSummary = {
  currentMonthSalesToDate: number
  lastMonthSalesToSameDate: number
  currentMonthDollarCostToDate: number
  cumulativeNetProfit: number
}

export default function GenerateSalesSheetPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [assignedStores, setAssignedStores] = useState<Store[]>([])
  const [variables, setVariables] = useState<(Variables & { id?: string }) | null>(null)

  const [storePreviews, setStorePreviews] = useState<StorePreview[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [monthToDateSummary, setMonthToDateSummary] = useState<MonthToDateSummary | null>(null)

  // Initialize date in Dhaka timezone
  useEffect(() => {
    setSelectedDate(getDhakaTodayDateString())
  }, [])

  // Load stores assigned to this moderator/admin
  useEffect(() => {
    if (!profile?.id) return
    ;(async () => {
      const { data, error } = await getAssignedStoresForProfile(profile.id)
      if (error) {
        toast({
          title: 'Failed to load stores',
          description: error.message,
          variant: 'destructive',
        })
        setAssignedStores([])
        return
      }
      setAssignedStores(data)
    })()
  }, [profile?.id, toast])

  // Load global expense variables (admin-configured)
  useEffect(() => {
    ;(async () => {
      const { data, error } = await getVariables()
      if (error) {
        toast({
          title: 'Failed to load variables',
          description: error.message,
          variant: 'destructive',
        })
      } else if (data) {
        setVariables(data)
      }
    })()
  }, [toast])

  const recomputeMonthToDateSummary = async (previews: StorePreview[], date: string) => {
    if (!previews.length) {
      setMonthToDateSummary(null)
      return
    }

    try {
      const metrics = await Promise.all(
        previews.map((p) => getStoreMonthToDateMetrics(p.store.id, date))
      )

      const summary = metrics.reduce<MonthToDateSummary>(
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

      setMonthToDateSummary(summary)
    } catch (err: any) {
      toast({
        title: 'Failed to load month-to-date metrics',
        description: err.message || 'Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const generatePreview = async () => {
    if (!assignedStores.length) {
      toast({
        title: 'No stores assigned',
        description: 'You do not have any stores assigned. Please contact an admin.',
        variant: 'destructive',
      })
      return
    }

    if (!selectedDate) {
      toast({
        title: 'Date required',
        description: 'Please select a date.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Always refresh variables so changes from the admin dashboard
      // are reflected immediately in the preview. If for some reason
      // they are missing or fail to load, fall back to zeros so the
      // preview still works.
      let currentVars = variables
      const varsRes = await getVariables()
      if (varsRes.error) {
        toast({
          title: 'Warning',
          description:
            'Failed to load latest variables, using previous values in this preview.',
          variant: 'destructive',
        })
      } else if (varsRes.data) {
        currentVars = varsRes.data
        setVariables(varsRes.data)
      }

      if (!currentVars) {
        currentVars = {
          operational_expense: 0,
          management_cost: 0,
          financial_cost: 0,
          content_cost: 0,
          others: 0,
          dollar_rate: 1,
        }
      }

      const dollarRate = currentVars.dollar_rate || 1

      // Fetch all active products
      const { data: allProducts, error: productsError } = await getProducts()
      if (productsError) throw productsError
      const productsList = allProducts || []

      const previews: StorePreview[] = []

      for (const store of assignedStores) {
        const [{ data: orders }, { data: returnedOrders }] = await Promise.all([
          getOrdersByStoreAndDate(store.id, selectedDate, 1000),
          getReturnedOrdersByDate(selectedDate)
        ])
        
        const storeReturnedOrders = (returnedOrders || []).filter((r: any) => r.store_id === store.id)
        
        let totalReturnedAmount = 0
        storeReturnedOrders.forEach((r: any) => {
          totalReturnedAmount += r.total_sell_price || 0
        })
        
        // Include stores even if they have 0 orders, so we can see all products with 0 sales
        // But maybe we skip if productsList is empty? No, just initialize normally.

        const groupedByProduct = productsList.reduce(
          (acc: any, product: any) => {
            acc[product.id] = {
              product,
              quantity: 0,
              totalSell: 0,
              totalBuyCost: 0,
            }
            return acc
          },
          {} as Record<
            string,
            {
              product: any
              quantity: number
              totalSell: number
              totalBuyCost: number
            }
          >
        )

        if (orders) {
          orders.forEach((order: any) => {
            const key = order.product_id
            const product = order.product ?? (order as any).products
            if (!product) return

            if (!groupedByProduct[key]) {
              groupedByProduct[key] = {
                product,
                quantity: 0,
                totalSell: 0,
                totalBuyCost: 0,
              }
            }
            groupedByProduct[key].quantity += order.quantity
            groupedByProduct[key].totalSell += order.total_sell_price
            groupedByProduct[key].totalBuyCost += order.quantity * (product.buying_price || 0)
          })
        }

        const items: StoreItemPreview[] = Object.entries(groupedByProduct).map(
          ([productId, value]: any) => {
            const quantity_sold = value.quantity
            const total_sell_value = value.totalSell
            const total_buy_cost = value.totalBuyCost
            const profit = total_sell_value - total_buy_cost
            const perProductDollar = 0
            const dollar_cost_tk = quantity_sold * perProductDollar * dollarRate
            const dollar_cost_per_unit_tk =
              quantity_sold > 0 ? dollar_cost_tk / quantity_sold : 0

            return {
              product_id: productId,
              quantity_sold,
              total_sell_value,
              total_buy_cost,
              profit,
              dollar_cost_tk,
              per_product_dollar: perProductDollar,
              dollar_cost_per_unit_tk,
              product: value.product,
            }
          }
        )

        if (!items.length) continue

        const totalSales = items.reduce((sum, i) => sum + i.total_sell_value, 0)
        const totalBuyCost = items.reduce((sum, i) => sum + i.total_buy_cost, 0)
        const grossProfit = totalSales - totalBuyCost
        const totalDollarCost = items.reduce((sum, i) => sum + i.dollar_cost_tk, 0)
        // Per-store net profit is based only on sales, buy cost, and dollar cost.
        // Fixed expenses are global (all stores together) and applied only in the final summary.
        const netProfit = grossProfit - totalDollarCost - totalReturnedAmount

        previews.push({
          store,
          items,
          totalSales,
          totalBuyCost,
          totalReturnedAmount,
          grossProfit,
          totalDollarCost,
          netProfit,
        })
      }

      if (!previews.length) {
        toast({
          title: 'No data',
          description: 'No data found to generate preview.',
          variant: 'destructive',
        })
        setStorePreviews([])
        setShowPreview(false)
        return
      }

      setStorePreviews(previews)
      setShowPreview(true)
      await recomputeMonthToDateSummary(previews, selectedDate)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to generate preview',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePerProductDollarChange = (
    storeId: string,
    productId: string,
    value: string
  ) => {
    const rawValue = value
    const num = parseFloat(value || '0')
    const dollarRate = variables?.dollar_rate || 1

    setStorePreviews((prev) =>
      prev.map((sp) => {
        if (sp.store.id !== storeId) return sp

        const updatedItems = sp.items.map((item) => {
          if (item.product_id !== productId) return item
          const validNum = Number.isNaN(num) ? 0 : num
          const dollar_cost_tk = item.quantity_sold * validNum * dollarRate
          const dollar_cost_per_unit_tk =
            item.quantity_sold > 0 ? dollar_cost_tk / item.quantity_sold : 0
          return {
            ...item,
            per_product_dollar: rawValue,
            dollar_cost_tk,
            dollar_cost_per_unit_tk,
          }
        })

        const totalSales = updatedItems.reduce((sum, i) => sum + i.total_sell_value, 0)
        const totalBuyCost = updatedItems.reduce((sum, i) => sum + i.total_buy_cost, 0)
        const grossProfit = totalSales - totalBuyCost
        const totalDollarCost = updatedItems.reduce((sum, i) => sum + i.dollar_cost_tk, 0)
        const netProfit = grossProfit - totalDollarCost - sp.totalReturnedAmount

        return {
          ...sp,
          items: updatedItems,
          totalSales,
          totalBuyCost,
          grossProfit,
          totalDollarCost,
          netProfit,
        }
      })
    )
  }

  const handleGenerate = async () => {
    if (!profile?.id || !storePreviews.length) return
    if (!selectedDate) return

    setLoading(true)
    try {
      const sheetsCreated: string[] = []

      for (const preview of storePreviews) {
        const existing = await getSalesSheetByStoreAndDate(preview.store.id, selectedDate)
        if (existing.data) {
          toast({
            title: 'Sheet already exists',
            description: `Sales sheet already exists for ${preview.store.store_name} on ${selectedDate}. Skipping this store.`,
            variant: 'destructive',
          })
          continue
        }

        await insertOrUpdateExpense(preview.store.id, selectedDate, {
          operational_expense: variables?.operational_expense ?? 0,
          management_cost: variables?.management_cost ?? 0,
          financial_cost: variables?.financial_cost ?? 0,
          content_cost: variables?.content_cost ?? 0,
        })

        const sheet = await insertSalesSheet({
          store_id: preview.store.id,
          date: selectedDate,
          total_sales: preview.totalSales,
          total_buy_cost: preview.totalBuyCost,
          total_returned_amount: preview.totalReturnedAmount,
          net_profit: preview.netProfit,
          total_dollar_cost: preview.totalDollarCost,
          generated_by: profile.id,
        })

        if (!sheet.data) {
          throw new Error(`Failed to create sales sheet for ${preview.store.store_name}`)
        }
        const sheetId = sheet.data.id

        const itemsToInsert = preview.items.map((item) => ({
          sales_sheet_id: sheetId,
          product_id: item.product_id,
          quantity_sold: item.quantity_sold,
          total_sell_value: item.total_sell_value,
          total_buy_cost: item.total_buy_cost,
          profit: item.profit,
          dollar_cost_tk: item.dollar_cost_tk,
          per_product_dollar: item.per_product_dollar,
        }))

        const { error: itemsError } = await insertSalesSheetItems(itemsToInsert as any)
        if (itemsError) {
          throw itemsError
        }

        // Store a full snapshot of the preview for this store/date,
        // so the saved sales sheet view can be an exact replica.
        const snapshotPayload = {
          date: selectedDate,
          store: preview.store,
          items: preview.items,
          totals: {
            totalSales: preview.totalSales,
            totalBuyCost: preview.totalBuyCost,
            grossProfit: preview.grossProfit,
            totalDollarCost: preview.totalDollarCost,
            netProfit: preview.netProfit,
          },
          combined:
            storePreviews.length > 0
              ? {
                  totalSalesAllStores: allStoresTotalSales,
                  grossProfitAllStores: allStoresGrossProfit,
                  netProfitAllStores: allStoresNetProfit,
                  dollarCostAllStores: allStoresDollarCost,
                  monthToDateSummary: monthToDateSummary,
                }
              : null,
          variables: variables
            ? {
                operational_expense: variables.operational_expense ?? 0,
                management_cost: variables.management_cost ?? 0,
                financial_cost: variables.financial_cost ?? 0,
                content_cost: variables.content_cost ?? 0,
                others: (variables as any).others ?? 0,
                dollar_rate: variables.dollar_rate ?? 1,
              }
            : null,
        }

        await insertSalesSheetSnapshot({
          sales_sheet_id: sheetId,
          store_id: preview.store.id,
          date: selectedDate,
          snapshot: snapshotPayload,
        })

        sheetsCreated.push(sheet.data.id)
      }

      if (!sheetsCreated.length) {
        toast({
          title: 'No sheets created',
          description: 'All sales sheets for this date already exist.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: `Created ${sheetsCreated.length} sales sheet(s) for ${selectedDate}.`,
      })

      router.push('/moderator/sales-report')
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to generate sales sheets',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const hasPreview = showPreview && storePreviews.length > 0

  const allStoresTotalSales = storePreviews.reduce((sum, sp) => sum + sp.totalSales, 0)
  const allStoresGrossProfit = storePreviews.reduce((sum, sp) => sum + sp.grossProfit, 0)
  const allStoresDollarCost = storePreviews.reduce((sum, sp) => sum + sp.totalDollarCost, 0)
  const allStoresNetProfit = storePreviews.reduce((sum, sp) => sum + sp.netProfit, 0)

  const op = variables?.operational_expense ?? 0
  const mgmt = variables?.management_cost ?? 0
  const fin = variables?.financial_cost ?? 0
  const content = variables?.content_cost ?? 0
  const others = (variables as any)?.others ?? 0
  const fixedExpensesTotal = op + mgmt + fin + content + others
  const overallNetAfterFixed = allStoresNetProfit - fixedExpensesTotal

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Generate Sales Sheet</h1>

        <Card className="p-8 mb-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="date">
                Select Date (from 6 PM previous day to 6 PM selected day) *
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2 max-w-xs"
                required
              />
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-4">
                This will generate separate sales sheets for each of your assigned stores for
                orders from yesterday 6 PM to today 6 PM, using the admin-configured variables for
                daily expenses.
              </p>
            </div>

            <Button onClick={generatePreview} disabled={loading} className="mr-2">
              {loading ? 'Generating...' : 'Generate Preview'}
            </Button>
          </div>
        </Card>

        {hasPreview && (
          <div className="space-y-8">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">All Stores Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Sales (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresTotalSales.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gross Profit (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresGrossProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresDollarCost.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fixed Expenses (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fixedExpensesTotal.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Profit After Fixed</p>
                  <p
                    className={`text-lg font-bold ${
                      overallNetAfterFixed >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {overallNetAfterFixed.toFixed(0)} BDT
                  </p>
                </div>
              </div>
            </Card>

            {storePreviews.map((preview) => (
              <Card key={preview.store.id} className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {preview.store.store_name} - {selectedDate}
                </h2>

                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="text-lg font-bold text-gray-900">
                        {preview.totalSales.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Buy Cost</p>
                      <p className="text-lg font-bold text-gray-900">
                        {preview.totalBuyCost.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Dollar Cost (Tk)</p>
                      <p className="text-lg font-bold text-gray-900">
                        {preview.totalDollarCost.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Profit</p>
                      <p
                        className={`text-lg font-bold ${
                          preview.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {preview.netProfit.toFixed(0)} BDT
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto mb-4">
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
                      {preview.items.map((item) => (
                        <tr key={item.product_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.product.product_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.quantity_sold}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.profit.toFixed(0)} BDT
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.dollar_cost_tk.toFixed(0)} BDT
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <Input
                              type="number"
                                value={item.per_product_dollar === '' ? '' : item.per_product_dollar.toString()}
                              onChange={(e) =>
                                handlePerProductDollarChange(
                                  preview.store.id,
                                  item.product_id,
                                  e.target.value
                                )
                              }
                              className="max-w-[120px]"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {(item.dollar_cost_per_unit_tk ?? (item.quantity_sold
                              ? item.dollar_cost_tk / item.quantity_sold
                              : 0)
                            ).toFixed(2)}{' '}
                            BDT
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {preview.items.reduce((sum, i) => sum + i.quantity_sold, 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {preview.grossProfit.toFixed(0)} BDT
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {preview.totalDollarCost.toFixed(0)} BDT
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">-</td>
                        <td className="px-4 py-3 text-sm text-gray-900">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            {/* Combined summary across all stores */}
            <Card className="p-6 bg-yellow-50 border border-yellow-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Combined Summary - All Stores ({selectedDate})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Total Sell (All Stores)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresTotalSales.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Gross Profit (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresGrossProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Profit (Day)</p>
                  <p
                    className={`text-lg font-bold ${
                      allStoresNetProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {allStoresNetProfit.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dollar Cost (Day)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {allStoresDollarCost.toFixed(0)} BDT
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Operational / Management / Financial / Content</p>
                  <p className="text-sm font-medium text-gray-900">
                    Op: {op.toFixed(0)} | Mgmt: {mgmt.toFixed(0)} | Fin: {fin.toFixed(0)} | Content:{' '}
                    {content.toFixed(0)}
                  </p>
                </div>
                {monthToDateSummary && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Sell This Month (All Stores)
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {monthToDateSummary.currentMonthSalesToDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Sell Last Month (Same Date)
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {monthToDateSummary.lastMonthSalesToSameDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        Cumulative Dollar Cost This Month
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {monthToDateSummary.currentMonthDollarCostToDate.toFixed(0)} BDT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Net Profit This Month</p>
                      <p className="text-lg font-bold text-gray-900">
                        {monthToDateSummary.cumulativeNetProfit.toFixed(0)} BDT
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                <Button onClick={handleGenerate} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Sales Sheets'}
                </Button>
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    setShowPreview(false)
                    setStorePreviews([])
                    setMonthToDateSummary(null)
                  }}
                >
                  Back
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedLayout>
  )
}
