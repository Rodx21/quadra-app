import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentWeekMonday, getDeadline } from '@/lib/dates'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from('tokens_acesso')
    .select('*, tecnicos(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (tokenError || !tokenData) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  const tecnico = tokenData.tecnicos as { id: string; nome: string }
  const semana = getCurrentWeekMonday()
  const now = new Date()

  // ── Coach's own slots ──
  const { data: horarios } = await supabaseAdmin
    .from('horarios')
    .select('*')
    .eq('tecnico_id', tecnico.id)
    .order('dia_semana')
    .order('hora_inicio')

  if (horarios && horarios.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('confirmacoes')
      .select('horario_id')
      .eq('tecnico_id', tecnico.id)
      .eq('semana', semana)

    const existingIds = new Set(existing?.map(c => c.horario_id) ?? [])
    const toInsert = horarios
      .filter(h => !existingIds.has(h.id))
      .map(h => ({ tecnico_id: tecnico.id, horario_id: h.id, semana, status: 'pendente' }))

    if (toInsert.length > 0) {
      await supabaseAdmin.from('confirmacoes').insert(toInsert)
    }
  }

  const { data: confirmacoes } = await supabaseAdmin
    .from('confirmacoes')
    .select('*, horarios(*)')
    .eq('tecnico_id', tecnico.id)
    .eq('semana', semana)
    .order('horarios(dia_semana)')

  // ── Vacant slots from other coaches ──
  // A slot is vacant if: cancelled OR (pendente past deadline)
  const { data: otherHorarios } = await supabaseAdmin
    .from('horarios')
    .select('*')
    .neq('tecnico_id', tecnico.id)
    .order('dia_semana')
    .order('hora_inicio')

  // Fetch ALL confirmacoes for other coaches' horarios (including possible claims by this coach)
  const otherHorarioIds = (otherHorarios ?? []).map(h => h.id)
  const { data: allOtherConfs } = otherHorarioIds.length > 0
    ? await supabaseAdmin
        .from('confirmacoes')
        .select('horario_id, tecnico_id, status')
        .eq('semana', semana)
        .in('horario_id', otherHorarioIds)
    : { data: [] }

  const confsByHorario = new Map<string, { tecnico_id: string; status: string }[]>()
  ;(allOtherConfs ?? []).forEach(c => {
    if (!confsByHorario.has(c.horario_id)) confsByHorario.set(c.horario_id, [])
    confsByHorario.get(c.horario_id)!.push(c)
  })

  const vagantes = (otherHorarios ?? []).filter(h => {
    const confs = confsByHorario.get(h.id) ?? []
    if (confs.some(c => c.status === 'confirmado')) return false  // Already claimed
    const originalConf = confs.find(c => c.tecnico_id === h.tecnico_id)
    if (originalConf?.status === 'cancelado') return true
    const deadline = getDeadline(semana, h.dia_semana, h.hora_inicio)
    if (now > deadline && (!originalConf || originalConf.status === 'pendente')) return true
    return false
  })

  await supabaseAdmin
    .from('tokens_acesso')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenData.id)
    .is('used_at', null)

  return NextResponse.json({ tecnico, confirmacoes: confirmacoes ?? [], vagantes, semana })
}
