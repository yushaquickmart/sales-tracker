'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Navigation } from './navigation'
import type { UserRole } from '@/lib/types'

interface ProtectedLayoutProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedLayout({ children, allowedRoles }: ProtectedLayoutProps) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.replace('/auth/login')
      return
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      // Redirect users who are authenticated but not authorized for this route
      switch (profile.role) {
        case 'admin':
          router.replace('/admin/dashboard')
          break
        case 'moderator':
          router.replace('/moderator/dashboard')
          break
        case 'employee':
          router.replace('/employee/dashboard')
          break
        default:
          router.replace('/auth/login')
      }
    }
  }, [allowedRoles, loading, profile, router])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-700">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <main>{children}</main>
      </div>
    </>
  )
}
