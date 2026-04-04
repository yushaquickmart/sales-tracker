'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Session } from '@supabase/supabase-js'
import { createClient } from './supabase-client'
import { Profile } from './types'

function isRefreshTokenError(err: { message?: string } | null): boolean {
  if (!err?.message) return false
  const msg = err.message.toLowerCase()
  return msg.includes('refresh token') || msg.includes('refresh_token') || msg.includes('invalid session')
}

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  isBoltUser: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: false,
  signOut: async () => {},
  isBoltUser: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBoltUser, setIsBoltUser] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!mounted) return

      if (error && isRefreshTokenError(error)) {
        await supabase.auth.signOut()
        setSession(null)
        setProfile(null)
        setIsBoltUser(false)
        setLoading(false)
        router.replace('/auth/login')
        return
      }

      if (user) {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (mounted) setSession(s)
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (mounted) {
          setProfile(data)
          setIsBoltUser((s?.user?.user_metadata?.auth_provider === 'bolt') || false)
        }
      } else {
        setSession(null)
        setProfile(null)
      }
      if (mounted) setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSession(session)
      if (session) {
        ;(async () => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
          if (mounted) {
            setProfile(data)
            setIsBoltUser(session.user.user_metadata?.auth_provider === 'bolt' || false)
          }
          if (mounted) setLoading(false)
        })()
      } else {
        if (mounted) {
          setProfile(null)
          setIsBoltUser(false)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setIsBoltUser(false)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, isBoltUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
