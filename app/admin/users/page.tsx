'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedLayout } from '@/components/layout/protected-layout'
import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  adminCreateUserWithProfile,
  listProfiles,
  updateUserRoleAndStore,
  adminListProfileStores,
  deleteUser,
  type ProfileStore,
} from '@/lib/admin-users'
import { getStores } from '@/lib/db-queries'
import type { Profile, Store, UserRole } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Save } from 'lucide-react'

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingAuthUser, setCreatingAuthUser] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('employee')
  const [formStoreIds, setFormStoreIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // Map of profileId -> Set of storeIds (saved state from server)
  const [profileStoreMap, setProfileStoreMap] = useState<Record<string, Set<string>>>({})
  // Editable copies - updated when user changes role/checkboxes, persisted on Save
  const [editingRoleMap, setEditingRoleMap] = useState<Record<string, UserRole>>({})
  const [editingStoreMap, setEditingStoreMap] = useState<Record<string, Set<string>>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { signOut, profile, loading: authLoading } = useAuth()

  // Default to first store when creating employee/moderator and none selected
  useEffect(() => {
    if (
      (formRole === 'employee' || formRole === 'moderator') &&
      formStoreIds.size === 0 &&
      stores.length > 0
    ) {
      setFormStoreIds(new Set([stores[0].id]))
    }
  }, [formRole, stores, formStoreIds.size])

  // Fetch user list and related data only after auth is ready (avoids unauthenticated request on refresh)
  useEffect(() => {
    if (authLoading || !profile) return
    ;(async () => {
      setLoading(true)
      const [profilesRes, storesRes, profileStoresRes] = await Promise.all([
        listProfiles(),
        getStores(),
        adminListProfileStores(),
      ])
      if (profilesRes.error) {
        const msg = profilesRes.error.message?.toLowerCase() ?? ''
        if (msg.includes('refresh token') || msg.includes('refresh_token') || msg.includes('invalid session')) {
          await signOut()
          router.replace('/auth/login')
          return
        }
        toast({
          title: 'Failed to load users',
          description: profilesRes.error.message,
          variant: 'destructive',
        })
      } else {
        const profs = profilesRes.data || []
        setProfiles(profs)
        setEditingRoleMap(Object.fromEntries(profs.map((p) => [p.id, p.role])))
      }

      if (storesRes.error) {
        toast({
          title: 'Failed to load stores',
          description: storesRes.error.message,
          variant: 'destructive',
        })
      } else {
        setStores((storesRes.data || []) as Store[])
      }

      if (profileStoresRes.error) {
        toast({
          title: 'Failed to load store assignments',
          description: profileStoresRes.error.message,
          variant: 'destructive',
        })
      } else {
        const map: Record<string, Set<string>> = {}
        ;(profileStoresRes.data || ([] as ProfileStore[])).forEach((row) => {
          if (!map[row.profile_id]) {
            map[row.profile_id] = new Set<string>()
          }
          map[row.profile_id].add(row.store_id)
        })
        setProfileStoreMap(map)
        setEditingStoreMap(
          Object.fromEntries(
            Object.entries(map).map(([k, v]) => [k, new Set(v)])
          )
        )
      }
      setLoading(false)
    })()
  }, [authLoading, profile, toast])

  const handleCreateAuthUserWithProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formEmail || !formPassword || !formName) {
      toast({
        title: 'Missing fields',
        description: 'Email, password, and name are required.',
        variant: 'destructive',
      })
      return
    }

    if (
      (formRole === 'employee' || formRole === 'moderator') &&
      formStoreIds.size === 0
    ) {
      toast({
        title: 'Store required',
        description: 'Employee and moderator must be assigned at least one store.',
        variant: 'destructive',
      })
      return
    }

    setCreatingAuthUser(true)
    const { data, error } = await adminCreateUserWithProfile({
      email: formEmail,
      password: formPassword,
      name: formName,
      role: formRole,
      store_ids: Array.from(formStoreIds),
    })
    setCreatingAuthUser(false)

    if (error) {
      toast({
        title: 'Failed to create user',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    if (data) {
      setProfiles((prev) => [data, ...prev])
      if (formStoreIds.size > 0) {
        const storeSet = new Set(formStoreIds)
        setProfileStoreMap((prev) => ({ ...prev, [data.id]: storeSet }))
        setEditingStoreMap((prev) => ({ ...prev, [data.id]: new Set(storeSet) }))
      }
      setEditingRoleMap((prev) => ({ ...prev, [data.id]: data.role }))
      setFormEmail('')
      setFormPassword('')
      setFormName('')
      setFormRole('employee')
      setFormStoreIds(stores.length > 0 ? new Set([stores[0].id]) : new Set())
      toast({
        title: 'User created',
        description: 'Auth user + profile created successfully.',
      })
    }
  }

  const handleSaveUser = async (user: Profile) => {
    const id = user.id
    const newRole = editingRoleMap[id] ?? user.role
    const newStoreIds = Array.from(editingStoreMap[id] ?? profileStoreMap[id] ?? [])

    if (
      (newRole === 'employee' || newRole === 'moderator') &&
      newStoreIds.length === 0
    ) {
      toast({
        title: 'Store required',
        description: 'Employee and moderator must have at least one store.',
        variant: 'destructive',
      })
      return
    }

    setSavingUserId(id)
    const primaryStoreId = newStoreIds[0] ?? null
    const { data: updatedProfile, error } = await updateUserRoleAndStore(
      id,
      newRole,
      primaryStoreId,
      newStoreIds
    )
    if (error) {
      setSavingUserId(null)
      toast({
        title: 'Failed to update user',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    if (updatedProfile) setProfiles((prev) => prev.map((p) => (p.id === id ? updatedProfile : p)))
    setProfileStoreMap((prev) => {
      const next = { ...prev }
      next[id] = new Set(newStoreIds)
      return next
    })
    setSavingUserId(null)
    toast({
      title: 'Changes saved',
      description: `${user.name}'s role and store access have been updated.`,
    })
  }

  const hasUnsavedChanges = (user: Profile) => {
    const id = user.id
    const savedRole = user.role
    const savedStores = profileStoreMap[id] ?? new Set<string>()
    const editingRole = editingRoleMap[id] ?? savedRole
    const editingStores = editingStoreMap[id] ?? savedStores
    if (editingRole !== savedRole) return true
    if (editingStores.size !== savedStores.size) return true
    let changed = false
    editingStores.forEach((s) => {
      if (!savedStores.has(s)) changed = true
    })
    return changed
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    setDeleting(true)
    const { error } = await deleteUser(userToDelete.id)
    setDeleting(false)
    if (error) {
      toast({
        title: 'Failed to delete user',
        description: error.message,
        variant: 'destructive',
      })
      return
    }
    setProfiles((prev) => prev.filter((p) => p.id !== userToDelete.id))
    setProfileStoreMap((prev) => {
      const next = { ...prev }
      delete next[userToDelete.id]
      return next
    })
    setUserToDelete(null)
    toast({
      title: 'User deleted',
      description: `${userToDelete.name} has been removed.`,
    })
  }

  const handleStoreToggle = (profileId: string, storeId: string, checked: boolean) => {
    setEditingStoreMap((prev) => {
      const next = { ...prev }
      const set = new Set(next[profileId] ?? [])
      if (checked) set.add(storeId)
      else set.delete(storeId)
      next[profileId] = set
      return next
    })
  }

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Users Management</h1>

        <div className="grid gap-8 md:grid-cols-2 mb-10">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Create Employee/Moderator Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create a Supabase Auth user (email/password) and automatically create the matching{' '}
              <code>profiles</code> row.
            </p>
            <form onSubmit={handleCreateAuthUserWithProfile} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Set a password"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="User name"
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Role</Label>
                  <Select
                    value={formRole}
                    onValueChange={(val) => setFormRole(val as UserRole)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Stores {(formRole === 'employee' || formRole === 'moderator') && '*'}</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {stores.map((store) => {
                      const checked = formStoreIds.has(store.id)
                      return (
                        <label
                          key={store.id}
                          className="inline-flex items-center gap-1 text-sm border rounded px-2 py-1"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              setFormStoreIds((prev) => {
                                const next = new Set(prev)
                                if (c === true) next.add(store.id)
                                else next.delete(store.id)
                                return next
                              })
                            }
                          />
                          <span>{store.store_name}</span>
                        </label>
                      )
                    })}
                  </div>
                  {(formRole === 'employee' || formRole === 'moderator') &&
                    stores.length === 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        Create a store first to assign employees.
                      </p>
                    )}
                </div>
              </div>
              <Button
                type="submit"
                disabled={
                  creatingAuthUser ||
                  ((formRole === 'employee' || formRole === 'moderator') &&
                    (stores.length === 0 || formStoreIds.size === 0))
                }
              >
                {creatingAuthUser ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-1">Existing Users</h2>
            <p className="text-sm text-gray-600 mb-4">
              Change role or check/uncheck stores, then click Save to apply changes.
            </p>
            {loading ? (
              <p className="text-gray-600">Loading users...</p>
            ) : profiles.length === 0 ? (
              <p className="text-gray-600">No user profiles found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Role</th>
                      <th className="text-left py-2">Stores</th>
                      <th className="text-right py-2 w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{user.name}</td>
                        <td className="py-2 pr-4">
                          {user.role === 'admin' ? (
                            <span className="text-sm text-gray-900">Admin (locked)</span>
                          ) : (
                            <Select
                              value={editingRoleMap[user.id] ?? user.role}
                              onValueChange={(val) =>
                                setEditingRoleMap((prev) => ({
                                  ...prev,
                                  [user.id]: val as UserRole,
                                }))
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            {stores.map((store) => {
                              const storeSet =
                                editingStoreMap[user.id] ?? profileStoreMap[user.id] ?? new Set<string>()
                              const assigned = storeSet.has(store.id)
                              return (
                                <label
                                  key={store.id}
                                  className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1"
                                >
                                  <Checkbox
                                    checked={assigned}
                                    onCheckedChange={(checked) =>
                                      handleStoreToggle(user.id, store.id, checked === true)
                                    }
                                  />
                                  <span>{store.store_name}</span>
                                </label>
                              )
                            })}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {user.role !== 'admin' && hasUnsavedChanges(user) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => handleSaveUser(user)}
                                disabled={savingUserId === user.id}
                              >
                                <Save className="h-3.5 w-3.5" />
                                {savingUserId === user.id ? 'Saving...' : 'Save'}
                              </Button>
                            )}
                            {user.role !== 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setUserToDelete(user)}
                                aria-label={`Delete ${user.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This will
                remove their account and profile permanently. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  handleDeleteUser()
                }}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedLayout>
  )
}

