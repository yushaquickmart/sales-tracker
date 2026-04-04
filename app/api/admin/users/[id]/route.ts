import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type PatchBody = {
  role?: string
  store_id?: string | null
  store_ids?: string[]
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    let body: PatchBody
    try {
      body = (await req.json()) as PatchBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (body.role !== undefined) updates.role = body.role
    if (body.store_id !== undefined) updates.store_id = body.store_id
    if (body.store_ids !== undefined) updates.store_ids = body.store_ids

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ profile: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
