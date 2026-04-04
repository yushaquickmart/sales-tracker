import { Card } from '@/components/ui/card'

interface MetricCardProps {
  label: string
  value: number | string
  currency?: boolean
  change?: number
}

export function MetricCard({ label, value, currency = false, change }: MetricCardProps) {
  const formatted =
    currency && typeof value === 'number'
      ? new Intl.NumberFormat('bn-BD', {
          style: 'currency',
          currency: 'BDT',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      : typeof value === 'number'
        ? new Intl.NumberFormat('bn-BD').format(value)
        : value

  return (
    <Card className="p-6">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{formatted}</p>
      {change !== undefined && (
        <p className={`text-sm mt-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change}%
        </p>
      )}
    </Card>
  )
}
