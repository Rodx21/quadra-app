import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentWeekMonday, getDeadline, getClaimDeadline } from '@/lib/dates'

export async function POST(req: NextRequest) {
  const { token, horario_id } = await req.json()

  const { data: tokenData } = await supabaseAdmin
    .from('tokens_acesso')
    .select('*, tecnicos(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!tokenData) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const tecnico = tokenData.tecnicos as { id: string; nome: string }
  const semana = getCurrentWeekMonday()

  const { data: horario } = await supabaseAdmin
    .from('horarios')
    .select('*')
    .eq('id', horario_id)
    .single()

  if (!horario) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })

  if (horario.tecnico_id === tecnico.id) {
    return NextResponse.json({ error: 'This is already your slot' }, { status: 400 })
  }

  const claimDeadline = getClaimDeadline(semana, horario.dia_semana, horario.hora_inicio)
  if (Date.now() > claimDeadline.getTime()) {
    return NextResponse.json({ error: 'Claim window has closed — this slot is lost.' }, { status: 403 })
  }

  // Fetch all confirmacoes for this horario this week
  const { data: confs } = await supabaseAdmin
    .from('confirmacoes')
    .select('tecnico_id, status')
    .eq('horario_id', horario_id)
    .eq('semana', semana)

  if (confs?.some(c => c.status === 'confirmado')) {
    return NextResponse.json({ error: 'Slot already claimed' }, { status: 409 })
  }

  const originalConf = confs?.find(c => c.tecnico_id === horario.tecnico_id)
  const isExpired = Date.now() > getDeadline(semana, horario.dia_semana, horario.hora_inicio).getTime()
  const isVacant = originalConf?.status === 'cancelado' ||
    (isExpired && (!originalConf || originalConf.status === 'pendente'))

  if (!isVacant) {
    return NextResponse.json({ error: 'Slot is not vacant yet' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('confirmacoes')
    .insert({ tecnico_id: tecnico.id, horario_id, semana, status: 'confirmado' })

  if (error) return NextResponse.json({ error: 'Failed to claim slot' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
