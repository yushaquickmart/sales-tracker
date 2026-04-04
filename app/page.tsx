'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!profile) {
      // Not authenticated -> go to login page instead of hanging on the spinner
      router.replace('/auth/login')
      return
    }

    switch (profile.role) {
      case 'employee':
        router.replace('/employee/dashboard')
        break
      case 'moderator':
        router.replace('/moderator/dashboard')
        break
      case 'admin':
        router.replace('/admin/dashboard')
        break
      default:
        router.replace('/admin/dashboard')
    }
  }, [profile, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
