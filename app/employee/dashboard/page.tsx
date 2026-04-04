'use client'

import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { MetricCard } from '@/components/shared/metric-card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { getDailySalesMetrics } from '@/lib/db-queries'
import { getDhakaTodayDateString } from '@/lib/date-utils'
import { formatCurrency } from '@/lib/utils'

export default function EmployeeDashboard() {
  const { profile } = useAuth()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.store_id) {
      const today = getDhakaTodayDateString()
      getDailySalesMetrics(profile.store_id, today).then(setMetrics).finally(() => setLoading(false))
    }
  }, [profile])

  return (
    <ProtectedLayout allowedRoles={['employee']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            label="Today's Sales"
            value={formatCurrency(metrics?.totalSales || 0)}
          />
          <MetricCard
            label="Total Cost"
            value={formatCurrency(metrics?.totalBuyCost || 0)}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="flex gap-4 flex-wrap">
            <Link href="/employee/add-order">
              <Button>Add New Order</Button>
            </Link>
            <Link href="/employee/orders">
              <Button variant="outline">View Orders</Button>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  )
}
