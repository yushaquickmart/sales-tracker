import { createClient } from './supabase-client'
import type { Profile, UserRole } from './types'

const supabase = createClient()

export type ProfileStore = {
  profile_id: string
  store_id: string
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, store_id, store_ids, created_at')
    .order('created_at', { ascending: false })

  return { data: (data || []) as Profile[], error }
}

export async function adminCreateUserWithProfile(input: {
  email: string
  password: string
  name: string
  role: UserRole
  store_ids: string[]
}) {
  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const text = await res.text()
  let payload: { user: unknown; profile: Profile | null } | { error: string }
  try {
    payload = text ? (JSON.parse(text) as any) : ({ error: 'Empty response from server' } as any)
  } catch {
    payload = { error: text || 'Failed to parse server response' }
  }

  if (!res.ok) {
    return { data: null as Profile | null, error: new Error('error' in payload ? payload.error : 'Request failed') }
  }

  if ('error' in payload) {
    return { data: null as Profile | null, error: new Error(payload.error) }
  }

  return { data: payload.profile, error: null as Error | null }
}

export async function createProfile(
  id: string,
  name: string,
  role: UserRole,
  storeId: string | null
) {
  // Cast to avoid strict PostgREST generics inferring `never` in some build envs
  const { data, error } = await (supabase as any)
    .from('profiles')
    .insert([{ id, name, role, store_id: storeId }])
    .select()
    .maybeSingle()

  if (error) {
    return { data: null as Profile | null, error }
  }

  // If a primary store is provided, also create a mapping in profile_stores.
  if (storeId) {
    await (supabase as any)
      .from('profile_stores')
      .insert([{ profile_id: id, store_id: storeId }])
      .select()
  }

  return { data: data as Profile | null, error: null }
}

export async function updateUserRoleAndStore(
  id: string,
  role: UserRole,
  storeId: string | null,
  storeIds?: string[]
) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      store_id: storeId,
      ...(storeIds !== undefined && { store_ids: storeIds }),
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: null as Profile | null, error: new Error(json.error || 'Failed to update user') }
  }
  return { data: json.profile as Profile, error: null }
}

export async function listProfileStores() {
  const { data, error } = await supabase
    .from('profile_stores')
    .select('profile_id, store_id')

  return { data: (data || []) as ProfileStore[], error }
}

/** Fetches profile_stores via API (service role) - bypasses RLS, use for admin page */
export async function adminListProfileStores() {
  const res = await fetch('/api/admin/profile-stores')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: [] as ProfileStore[], error: new Error(json.error || 'Failed to load store assignments') }
  }
  return { data: (json.data ?? []) as ProfileStore[], error: null }
}

export async function addProfileStore(profileId: string, storeId: string) {
  const res = await fetch('/api/admin/profile-stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', profile_id: profileId, store_id: storeId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: null as ProfileStore | null, error: new Error(json.error || 'Failed to add store') }
  }
  return { data: { profile_id: profileId, store_id: storeId } as ProfileStore, error: null }
}

export async function removeProfileStore(profileId: string, storeId: string) {
  const res = await fetch('/api/admin/profile-stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', profile_id: profileId, store_id: storeId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: new Error(json.error || 'Failed to remove store') }
  }
  return { error: null }
}

/** Sync all store assignments for a profile (replace with new set) */
export async function syncProfileStores(profileId: string, storeIds: string[]) {
  const res = await fetch('/api/admin/profile-stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', profile_id: profileId, store_ids: storeIds }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: new Error(json.error || 'Failed to sync stores') }
  }
  return { error: null }
}

export async function deleteUser(userId: string) {
  const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: new Error(json.error || 'Failed to delete user') }
  }
  return { error: null }
}


