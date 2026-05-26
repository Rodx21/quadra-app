import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentWeekMonday } from '@/lib/dates'

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password')
  return auth === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const semana = req.nextUrl.searchParams.get('semana') ?? getCurrentWeekMonday()

  const { data: tecnicos, error } = await supabaseAdmin
    .from('tecnicos')
    .select('*')
    .order('nome')

  if (error) {
    return NextResponse.json({ error: 'Failed to load coaches' }, { status: 500 })
  }

  const { data: horarios } = await supabaseAdmin
    .from('horarios')
    .select('*')
    .order('dia_semana')
    .order('hora_inicio')

  const { data: confirmacoes } = await supabaseAdmin
    .from('confirmacoes')
    .select('*, horarios(*)')
    .eq('semana', semana)

  const { data: tokens } = await supabaseAdmin
    .from('tokens_acesso')
    .select('tecnico_id, expires_at, used_at')
    .gt('expires_at', new Date().toISOString())

  return NextResponse.json({ tecnicos, horarios, confirmacoes, tokens, semana })
}
