import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  await supabaseAdmin.from('tokens_acesso').delete().eq('tecnico_id', id)
  await supabaseAdmin.from('confirmacoes').delete().eq('tecnico_id', id)
  await supabaseAdmin.from('horarios').delete().eq('tecnico_id', id)
  const { error } = await supabaseAdmin.from('tecnicos').delete().eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to remove coach' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
