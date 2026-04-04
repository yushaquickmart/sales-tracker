'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getVariables, updateVariables, type Variables } from '@/lib/db-queries'

export default function VariablesPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    operational_expense: '0',
    management_cost: '0',
    financial_cost: '0',
    content_cost: '0',
    others: '0',
    dollar_rate: '1',
  })

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
        setForm({
          operational_expense: String(data.operational_expense ?? 0),
          management_cost: String(data.management_cost ?? 0),
          financial_cost: String(data.financial_cost ?? 0),
          content_cost: String(data.content_cost ?? 0),
          others: String((data as any).others ?? 0),
          dollar_rate: String(data.dollar_rate ?? 1),
        })
      }
      setLoading(false)
    })()
  }, [toast])

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const payload: Variables = {
      operational_expense: parseFloat(form.operational_expense) || 0,
      management_cost: parseFloat(form.management_cost) || 0,
      financial_cost: parseFloat(form.financial_cost) || 0,
      content_cost: parseFloat(form.content_cost) || 0,
      others: parseFloat(form.others) || 0,
      dollar_rate: parseFloat(form.dollar_rate) || 1,
    }
    const { error } = await updateVariables(payload)
    setSaving(false)
    if (error) {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Saved',
        description: 'Variables have been updated.',
      })
    }
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Variables</h1>

        <Card className="p-6">
          {loading ? (
            <p className="text-gray-600">Loading variables...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="operational">Operational Expense (BDT)</Label>
                  <Input
                    id="operational"
                    type="number"
                    value={form.operational_expense}
                    onChange={(e) => handleChange('operational_expense', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="management">Management Cost (BDT)</Label>
                  <Input
                    id="management"
                    type="number"
                    value={form.management_cost}
                    onChange={(e) => handleChange('management_cost', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="financial">Financial Cost (BDT)</Label>
                  <Input
                    id="financial"
                    type="number"
                    value={form.financial_cost}
                    onChange={(e) => handleChange('financial_cost', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Content Cost (BDT)</Label>
                  <Input
                    id="content"
                    type="number"
                    value={form.content_cost}
                    onChange={(e) => handleChange('content_cost', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="others">Miscellaneous (BDT)</Label>
                  <Input
                    id="others"
                    type="number"
                    value={form.others}
                    onChange={(e) => handleChange('others', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="dollarRate">Dollar Rate (Tk per $)</Label>
                  <Input
                    id="dollarRate"
                    type="number"
                    value={form.dollar_rate}
                    onChange={(e) => handleChange('dollar_rate', e.target.value)}
                    placeholder="1"
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  )
}

