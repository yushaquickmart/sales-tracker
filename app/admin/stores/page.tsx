'use client'

import { useEffect, useState } from 'react'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { deleteStore, getStores, insertStore, updateStore } from '@/lib/db-queries'
import type { Store } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editNames, setEditNames] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data, error } = await getStores()
      if (error) {
        toast({
          title: 'Failed to load stores',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        setStores((data || []) as Store[])
      }
      setLoading(false)
    })()
  }, [toast])

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeName.trim()) {
      toast({
        title: 'Store name required',
        description: 'Please enter a store name.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    const { data, error } = await insertStore(storeName.trim())
    setCreating(false)

    if (error) {
      toast({
        title: 'Failed to create store',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    if (data) {
      setStores((prev) => [...prev, data as Store])
      setStoreName('')
      toast({
        title: 'Store created',
        description: 'New store has been added.',
      })
    }
  }

  const handleUpdateStore = async (id: string) => {
    const name = (editNames[id] ?? '').trim()
    if (!name) {
      toast({
        title: 'Store name required',
        description: 'Please enter a store name.',
        variant: 'destructive',
      })
      return
    }

    setSavingId(id)
    const { data, error } = await updateStore(id, name)
    setSavingId(null)

    if (error) {
      toast({
        title: 'Failed to update store',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    if (data) {
      setStores((prev) => prev.map((s) => (s.id === id ? (data as Store) : s)))
      toast({
        title: 'Store updated',
        description: 'Store name has been updated.',
      })
    }
  }

  const handleDeleteStore = async (id: string) => {
    setDeletingId(id)
    const { error } = await deleteStore(id)
    setDeletingId(null)

    if (error) {
      toast({
        title: 'Failed to delete store',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    setStores((prev) => prev.filter((s) => s.id !== id))
    toast({
      title: 'Store deleted',
      description: 'Store has been removed.',
    })
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Stores</h1>

        <div className="grid gap-8 md:grid-cols-2 mb-10">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Store</h2>
            <form onSubmit={handleCreateStore} className="space-y-4">
              <div>
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                  id="store-name"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Gulshan Branch"
                  className="mt-1"
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Store'}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Stores</h2>
            {loading ? (
              <p className="text-gray-600">Loading stores...</p>
            ) : stores.length === 0 ? (
              <p className="text-gray-600">No stores found.</p>
            ) : (
              <ul className="space-y-3">
                {stores.map((store) => (
                  <li key={store.id} className="flex items-center gap-3">
                    <Input
                      value={editNames[store.id] ?? store.store_name}
                      onChange={(e) =>
                        setEditNames((prev) => ({ ...prev, [store.id]: e.target.value }))
                      }
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === store.id}
                      onClick={() => handleUpdateStore(store.id)}
                    >
                      {savingId === store.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === store.id}
                      onClick={() => handleDeleteStore(store.id)}
                    >
                      {deletingId === store.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  )
}

