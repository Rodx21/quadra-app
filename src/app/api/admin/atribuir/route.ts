import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function checkAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST { dia_semana, hora_inicio, hora_fim, tecnico_id | null }
// Assigns exactly one coach to a fixed time slot, removing any others.
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { dia_semana: number; hora_inicio: string; hora_fim: string; tecnico_id: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { dia_semana, hora_inicio, hora_fim, tecnico_id } = body

  // All existing horarios for this day+time (any coach)
  const { data: existing } = await supabaseAdmin
    .from('horarios')
    .select('id, tecnico_id')
    .eq('dia_semana', dia_semana)
    .eq('hora_inicio', hora_inicio)

  const rows = existing ?? []
  const targetRow = rows.find(h => h.tecnico_id === tecnico_id)
  const otherRows = rows.filter(h => h.tecnico_id !== tecnico_id)

  // Delete confirmacoes + horarios for coaches being unassigned
  for (const h of otherRows) {
    await supabaseAdmin.from('confirmacoes').delete().eq('horario_id', h.id)
    await supabaseAdmin.from('horarios').delete().eq('id', h.id)
  }

  if (tecnico_id === null) {
    // Unassign all — also delete the target row if it was the coach being removed
    if (targetRow) {
      await supabaseAdmin.from('confirmacoes').delete().eq('horario_id', targetRow.id)
      await supabaseAdmin.from('horarios').delete().eq('id', targetRow.id)
    }
    return NextResponse.json({ ok: true })
  }

  // Create the horario for the assigned coach if it doesn't exist yet
  if (!targetRow) {
    await supabaseAdmin.from('horarios').insert({ tecnico_id, dia_semana, hora_inicio, hora_fim })
  }

  return NextResponse.json({ ok: true })
}
