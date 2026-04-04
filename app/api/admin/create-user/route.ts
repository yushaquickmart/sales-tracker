import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import type { UserRole } from '@/lib/types'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type CreateUserBody = {
  email: string
  password: string
  name: string
  role: UserRole
  store_ids?: string[]
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'moderator' || value === 'employee'
}

async function requireAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: false as const, status: 500, error: 'Missing Supabase env vars' }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set({ name, value, ...(options as any) })
        } catch {
          // ignore
        }
      },
      remove: (name, options) => {
        try {
          cookieStore.set({ name, value: '', ...(options as any) })
        } catch {
          // ignore
        }
      },
    },
  })

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return { ok: false as const, status: 401, error: 'Unauthorized' }

  const supabaseAdmin = createSupabaseAdminClient()
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr) return { ok: false as const, status: 500, error: profErr.message }
  if ((profile as any)?.role !== 'admin') return { ok: false as const, status: 403, error: 'Forbidden' }

  return { ok: true as const }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const supabaseAdmin = createSupabaseAdminClient()

    let body: CreateUserBody
    try {
      body = (await req.json()) as CreateUserBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const email = body?.email?.trim()
    const password = body?.password
    const name = body?.name?.trim()
    const role = body?.role
    const store_ids = Array.isArray(body?.store_ids) ? body.store_ids.filter(Boolean) : []

    if (!email || !password || !name || !isUserRole(role)) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: email, password, name, role' },
        { status: 400 }
      )
    }

    // Create Auth user
    const { data: created, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })

    if (createAuthError || !created?.user) {
      return NextResponse.json(
        { error: createAuthError?.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    const userId = created.user.id
    const primaryStoreId = store_ids[0] ?? null

    // Create matching profile row with store_ids array
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: userId,
          name,
          role,
          store_id: primaryStoreId,
          store_ids: store_ids,
        },
      ])
      .select('id, name, role, store_id, store_ids, created_at')
      .maybeSingle()

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ user: created.user, profile })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected server error while creating user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

