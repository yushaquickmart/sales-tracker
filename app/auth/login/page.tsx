'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [boltAvailable, setBoltAvailable] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Bolt) {
      setBoltAvailable(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive',
        })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const role = (profile as { role?: string } | null)?.role
        redirectToDashboard(role)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBoltLogin = async () => {
    setLoading(true)
    try {
      const Bolt = (window as any).Bolt
      if (!Bolt) {
        throw new Error('Bolt is not available')
      }

      const user = await Bolt.authenticate()
      if (user) {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .maybeSingle()

          const role = (profile as { role?: string } | null)?.role
          redirectToDashboard(role)
        }
      }
    } catch (err) {
      toast({
        title: 'Bolt Login Failed',
        description: err instanceof Error ? err.message : 'Failed to authenticate with Bolt',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const redirectToDashboard = (role?: string) => {
    if (role === 'admin') {
      router.push('/admin/dashboard')
    } else if (role === 'moderator') {
      router.push('/moderator/dashboard')
    } else if (role === 'employee') {
      router.push('/employee/dashboard')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Sales Tracker</h1>
          <p className="text-center text-gray-600 mb-8">Sign in to your account</p>

          {boltAvailable ? (
            <Tabs defaultValue="standard" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="standard">Email</TabsTrigger>
                <TabsTrigger value="bolt">Bolt</TabsTrigger>
              </TabsList>

              <TabsContent value="standard" className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="mt-2"
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="bolt" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Sign in with your Bolt account for enhanced security and organization management.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleBoltLogin}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? 'Signing in...' : 'Sign In with Bolt'}
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="mt-2"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-gray-600 mt-6">
            Contact an admin if you need access.
          </p>
        </div>
      </Card>
    </div>
  )
}
