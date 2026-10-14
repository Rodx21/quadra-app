-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Technicians
CREATE TABLE tecnicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly schedule slots
CREATE TABLE horarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnico_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Magic link access tokens (expire in 7 days)
CREATE TABLE tokens_acesso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnico_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly confirmations per technician per slot
CREATE TABLE confirmacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnico_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE,
  horario_id UUID REFERENCES horarios(id) ON DELETE CASCADE,
  semana DATE NOT NULL, -- Monday of the week
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'troca')),
  observacao TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (horario_id, semana)
);

-- Auto-update updated_at on confirmacoes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER confirmacoes_updated_at
  BEFORE UPDATE ON confirmacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmacoes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by server-side API routes)
-- anon role has no access (all operations go through API routes with service key)

-- Sample data (optional - remove for production)
INSERT INTO tecnicos (nome, whatsapp) VALUES
  ('Coach A', '+353871234567'),
  ('Coach B', '+353872345678'),
  ('Coach C', '+353873456789');
