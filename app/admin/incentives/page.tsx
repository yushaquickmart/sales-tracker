'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { getProducts, getProductIncentives, saveProductIncentive, getEmployeeMonthlyIncentives } from '@/lib/db-queries'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getDhakaTodayDateString } from '@/lib/date-utils'

export default function IncentivesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  
  const currentMonth = getDhakaTodayDateString().substring(0, 7) // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [incentives, setIncentives] = useState<Record<string, any>>({})
  const [employeeEarnings, setEmployeeEarnings] = useState<any[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, incRes, earnRes] = await Promise.all([
        getProducts(),
        getProductIncentives(),
        getEmployeeMonthlyIncentives(selectedMonth)
      ])

      if (prodRes.data) setProducts(prodRes.data)
      
      const incMap: Record<string, any> = {}
      if (incRes.data) {
        incRes.data.forEach((inc) => {
          incMap[inc.product_id] = inc
        })
      }
      setIncentives(incMap)

      if (earnRes.data) setEmployeeEarnings(earnRes.data)
    } catch (err: any) {
      toast({
        title: 'Error loading data',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const handleSaveIncentive = async (productId: string) => {
    setSavingId(productId)
    try {
      const inc = incentives[productId] || {
        threshold_price: 0,
        above_incentive: 0,
        below_incentive: 0,
      }

      await saveProductIncentive({
        product_id: productId,
        threshold_price: Number(inc.threshold_price) || 0,
        above_incentive: Number(inc.above_incentive) || 0,
        below_incentive: Number(inc.below_incentive) || 0,
      })

      toast({ title: 'Incentive settings saved' })
    } catch (err: any) {
      toast({
        title: 'Failed to save',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleParamChange = (productId: string, field: string, value: string) => {
    setIncentives((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }))
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Incentives</h1>
          <p className="text-gray-600 mt-2">Manage product-based incentive rates and track cumulative employee earnings.</p>
        </div>

        {loading ? (
          <Card className="p-6">
            <p className="text-gray-500">Loading incentives data...</p>
          </Card>
        ) : (
          <Tabs defaultValue="earnings" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="earnings">Monthly Earnings</TabsTrigger>
              <TabsTrigger value="settings">Product Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="earnings" className="space-y-4">
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h2 className="text-xl font-semibold text-gray-900">Cumulative Employee Incentives</h2>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="month" className="font-medium text-gray-700">Month</Label>
                    <Input
                      id="month"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-48"
                    />
                  </div>
                </div>

                {employeeEarnings.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No earnings generated for {selectedMonth} yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Count</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Incentive</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {employeeEarnings.map((emp) => (
                          <tr key={emp.employee_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {emp.employee_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                              {emp.total_sales}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700 text-right">
                              {Number(emp.total_incentive).toFixed(0)} BDT
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Set Incentive Thresholds</h2>
                
                <div className="space-y-6">
                  {products.map((product) => {
                    const inc = incentives[product.id] || { threshold_price: '', above_incentive: '', below_incentive: '' }
                    const isSaving = savingId === product.id

                    return (
                      <div key={product.id} className="p-4 border rounded-lg bg-gray-50 flex flex-col md:flex-row gap-4 md:items-end">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{product.product_name}</h3>
                          <p className="text-sm text-gray-500">Buying Price: {product.buying_price} BDT</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-[2]">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-600">Threshold Price (BDT)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={inc.threshold_price?.toString() || ''}
                              onChange={(e) => handleParamChange(product.id, 'threshold_price', e.target.value)}
                              placeholder="e.g. 500"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-600">Above Threshold (BDT)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={inc.above_incentive?.toString() || ''}
                              onChange={(e) => handleParamChange(product.id, 'above_incentive', e.target.value)}
                              placeholder="e.g. 50"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-600">Below/At Threshold (BDT)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={inc.below_incentive?.toString() || ''}
                              onChange={(e) => handleParamChange(product.id, 'below_incentive', e.target.value)}
                              placeholder="e.g. 20"
                            />
                          </div>
                        </div>

                        <div className="flex items-center">
                          <Button 
                            onClick={() => handleSaveIncentive(product.id)}
                            disabled={isSaving}
                            className="w-full md:w-auto"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ProtectedLayout>
  )
}