import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const supabaseAdmin = createSupabaseAdminClient()
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, store_ids')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Convert store_ids array to { profile_id, store_id }[] for compatibility
    const data = (profiles ?? []).flatMap((p: { id: string; store_ids?: string[] }) =>
      (p.store_ids ?? []).map((store_id) => ({ profile_id: p.id, store_id }))
    )
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

type Body =
  | { action: 'add' | 'remove'; profile_id: string; store_id: string }
  | { action: 'sync'; profile_id: string; store_ids: string[] }

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = (await req.json()) as Body
    const { action, profile_id } = body

    if (!profile_id || !action) {
      return NextResponse.json(
        { error: 'Missing or invalid: action, profile_id' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdminClient()

    if (action === 'sync') {
      const store_ids = Array.isArray((body as any).store_ids) ? (body as any).store_ids : []
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ store_ids })
        .eq('id', profile_id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    const store_id = (body as any).store_id
    if (!store_id || !['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing or invalid: action, profile_id, store_id' },
        { status: 400 }
      )
    }

    if (action === 'add') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('store_ids')
        .eq('id', profile_id)
        .single()
      const current = (profile?.store_ids ?? []) as string[]
      if (current.includes(store_id)) return NextResponse.json({ ok: true })
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ store_ids: [...current, store_id] })
        .eq('id', profile_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    // remove
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('store_ids')
      .eq('id', profile_id)
      .single()
    const current = ((profile?.store_ids ?? []) as string[]).filter((id) => id !== store_id)
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ store_ids: current })
      .eq('id', profile_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
