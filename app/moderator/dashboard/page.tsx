'use client'

import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { MetricCard } from '@/components/shared/metric-card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { getAllStoresSalesMetrics } from '@/lib/db-queries'
import { getDhakaTodayDateString } from '@/lib/date-utils'

export default function ModeratorDashboard() {
  const { profile } = useAuth()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    const today = getDhakaTodayDateString()
    // Moderators see combined metrics across all stores (orders visibility is role-based)
    getAllStoresSalesMetrics(today)
      .then((res) => {
        const rows = res.data || []
        const combined = rows.reduce(
          (acc, r: any) => ({
            totalSales: acc.totalSales + (r.totalSales || 0),
            totalBuyCost: acc.totalBuyCost + (r.totalBuyCost || 0),
            grossProfit: acc.grossProfit + (r.grossProfit || 0),
            netProfit: acc.netProfit + (r.netProfit || 0),
          }),
          { totalSales: 0, totalBuyCost: 0, grossProfit: 0, netProfit: 0 }
        )
        setMetrics(combined)
      })
      .finally(() => setLoading(false))
  }, [profile])

  return (
    <ProtectedLayout allowedRoles={['moderator', 'admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            label="Today's Sales"
            value={metrics?.totalSales || 0}
            currency={true}
          />
          <MetricCard
            label="Total Cost"
            value={metrics?.totalBuyCost || 0}
            currency={true}
          />
          <MetricCard label="Gross Profit" value={metrics?.grossProfit || 0} currency={true} />
          <MetricCard label="Net Profit" value={metrics?.netProfit || 0} currency={true} />
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="flex gap-4 flex-wrap">
            <Link href="/moderator/daily-orders">
              <Button>Daily Orders</Button>
            </Link>
            <Link href="/moderator/sales-sheets">
              <Button variant="outline">View Sales Sheets</Button>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  )
}
