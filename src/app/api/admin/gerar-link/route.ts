import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password')
  return auth === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tecnico_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { tecnico_id } = body
  if (!tecnico_id) {
    return NextResponse.json({ error: 'tecnico_id is required' }, { status: 400 })
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data: token, error } = await supabaseAdmin
    .from('tokens_acesso')
    .insert({ tecnico_id, expires_at: expiresAt.toISOString() })
    .select('token')
    .single()

  if (error || !token) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link = `${appUrl}/entrar?t=${token.token}`

  return NextResponse.json({ link, token: token.token })
}
