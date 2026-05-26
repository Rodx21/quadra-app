import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDeadline, getClaimDeadline } from '@/lib/dates'

type Body = {
  confirmacao_id: string
  status: 'confirmado' | 'cancelado' | 'troca'
  observacao?: string
  token: string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { confirmacao_id, status, observacao, token } = body

  if (!confirmacao_id || !status || !token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validStatuses = ['confirmado', 'cancelado', 'troca']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Validate token
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from('tokens_acesso')
    .select('tecnico_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (tokenError || !tokenData) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  // Ensure the confirmation belongs to this coach and fetch slot info for deadline check
  const { data: confirmacao, error: confError } = await supabaseAdmin
    .from('confirmacoes')
    .select('id, tecnico_id, semana, horarios(dia_semana, hora_inicio, tecnico_id)')
    .eq('id', confirmacao_id)
    .eq('tecnico_id', tokenData.tecnico_id)
    .single()

  if (confError || !confirmacao) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }

  const horario = Array.isArray(confirmacao.horarios) ? confirmacao.horarios[0] : confirmacao.horarios
  if (horario) {
    // Claimed slots (different coach) use the 1h claim deadline; own slots use 24h deadline
    const isClaimed = (horario as { tecnico_id?: string }).tecnico_id !== confirmacao.tecnico_id
    const deadline = isClaimed
      ? getClaimDeadline(confirmacao.semana, horario.dia_semana, horario.hora_inicio)
      : getDeadline(confirmacao.semana, horario.dia_semana, horario.hora_inicio)
    if (Date.now() > deadline.getTime()) {
      return NextResponse.json({ error: 'Deadline passed — this slot is now vacant.' }, { status: 403 })
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('confirmacoes')
    .update({ status, observacao: observacao ?? null })
    .eq('id', confirmacao_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
