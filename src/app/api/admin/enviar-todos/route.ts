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

  const { data: tecnicos, error } = await supabaseAdmin
    .from('tecnicos')
    .select('id, nome, whatsapp')

  if (error || !tecnicos) {
    return NextResponse.json({ error: 'Failed to load coaches' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const results = []

  for (const tecnico of tecnicos) {
    // Reuse existing active token if one exists
    const { data: existing } = await supabaseAdmin
      .from('tokens_acesso')
      .select('token')
      .eq('tecnico_id', tecnico.id)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .single()

    let tokenValue: string
    if (existing) {
      tokenValue = existing.token
    } else {
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 10)
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('tokens_acesso')
        .insert({ tecnico_id: tecnico.id, expires_at: expiresAt.toISOString() })
        .select('token')
        .single()

      if (tokenError || !tokenData) {
        results.push({ tecnico_id: tecnico.id, nome: tecnico.nome, error: 'Failed to generate token' })
        continue
      }
      tokenValue = tokenData.token
    }

    const link = `${appUrl}/entrar?t=${tokenValue}`

    // TODO: Send via Twilio WhatsApp
    // Example using Twilio:
    // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    // await client.messages.create({
    //   from: 'whatsapp:+14155238886',
    //   to: `whatsapp:${tecnico.whatsapp}`,
    //   body: `Olá ${tecnico.nome}! Confirma os teus horários desta semana: ${link}`
    // })

    results.push({ tecnico_id: tecnico.id, nome: tecnico.nome, link, whatsapp: tecnico.whatsapp })
  }

  return NextResponse.json({ results })
}
