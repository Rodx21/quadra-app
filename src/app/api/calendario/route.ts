import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentWeekMonday } from '@/lib/dates'

export async function GET(req: NextRequest) {
  const semana = req.nextUrl.searchParams.get('semana') ?? getCurrentWeekMonday()

  const [{ data: tecnicos }, { data: horarios }, { data: confirmacoes }] = await Promise.all([
    supabaseAdmin.from('tecnicos').select('id, nome').order('nome'),
    supabaseAdmin.from('horarios').select('*').order('dia_semana').order('hora_inicio'),
    supabaseAdmin.from('confirmacoes').select('tecnico_id, horario_id, status').eq('semana', semana),
  ])

  return NextResponse.json({
    tecnicos: tecnicos ?? [],
    horarios: horarios ?? [],
    confirmacoes: confirmacoes ?? [],
    semana,
  })
}
