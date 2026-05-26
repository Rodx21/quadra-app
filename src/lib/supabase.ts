import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Types
export type Tecnico = {
  id: string
  nome: string
  whatsapp: string | null
  created_at: string
}

export type Horario = {
  id: string
  tecnico_id: string
  dia_semana: number // 0=Sun, 1=Mon, ..., 6=Sat
  hora_inicio: string // "HH:MM:SS"
  hora_fim: string
  descricao: string | null
  created_at: string
}

export type TokenAcesso = {
  id: string
  tecnico_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type Confirmacao = {
  id: string
  tecnico_id: string
  horario_id: string
  semana: string // "YYYY-MM-DD" (Monday)
  status: 'pendente' | 'confirmado' | 'cancelado' | 'troca'
  observacao: string | null
  updated_at: string
  created_at: string
}

export type ConfirmacaoComHorario = Confirmacao & {
  horarios: Horario
}

export type TecnicoComConfirmacoes = Tecnico & {
  confirmacoes: ConfirmacaoComHorario[]
}
