import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nome } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: tecnico, error } = await supabaseAdmin
    .from('tecnicos')
    .insert({ nome: nome.trim() })
    .select()
    .single()

  if (error || !tecnico) return NextResponse.json({ error: 'Failed to create coach' }, { status: 500 })

  return NextResponse.json({ tecnico })
}
