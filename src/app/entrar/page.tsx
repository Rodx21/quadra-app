'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { formatTime, getWeekRangeShort, getWeekDays, isSlotExpired, isSlotLost, formatDeadline } from '@/lib/dates'
import type { Confirmacao, Horario, Tecnico } from '@/lib/supabase'

type ConfirmacaoComHorario = Confirmacao & { horarios: Horario }
type ModalMode = { id: string; type: 'cancelado' | 'troca' } | null

const DAY_SHORT: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

function statusBadge(status: string) {
  if (status === 'confirmado') return <span className="badge bg"><span className="bd-dot" />Going</span>
  if (status === 'cancelado') return <span className="badge br"><span className="bd-dot" />Not going</span>
  if (status === 'troca') return <span className="badge ba"><span className="bd-dot" />Wants swap</span>
  return null
}

function cardClass(status: string) {
  if (status === 'confirmado') return 'scard confirmed'
  if (status === 'cancelado') return 'scard cancelled'
  if (status === 'troca') return 'scard swap'
  return 'scard'
}

function CourtSchedulerContent() {
  const params = useSearchParams()
  const token = params.get('t')

  const [coach, setCoach] = useState<Tecnico | null>(null)
  const [slots, setSlots] = useState<ConfirmacaoComHorario[]>([])
  const [vagantes, setVagantes] = useState<Horario[]>([])
  const [week, setWeek] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalMode>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!token) { setError('Invalid link — missing token.'); setLoading(false); return }
    const res = await fetch(`/api/tecnico?t=${token}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Invalid or expired link.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setCoach(data.tecnico)
    setSlots(data.confirmacoes ?? [])
    setVagantes(data.vagantes ?? [])
    setWeek(data.semana)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function respond(confirmacao_id: string, status: 'confirmado' | 'cancelado' | 'troca', observacao = '') {
    setSaving(confirmacao_id)
    const res = await fetch('/api/tecnico/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmacao_id, status, token, observacao }),
    })
    if (res.ok) {
      setSlots((prev) => prev.map((c) => c.id === confirmacao_id ? { ...c, status, observacao } : c))
    } else {
      alert('Failed to save. Please try again.')
    }
    setSaving(null)
    setModal(null)
    setNote('')
  }

  async function claimSlot(horario_id: string) {
    setSaving(horario_id)
    const res = await fetch('/api/tecnico/reclamar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, horario_id }),
    })
    if (res.ok) {
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to claim slot.')
    }
    setSaving(null)
  }

  function openModal(id: string, type: 'cancelado' | 'troca') {
    setModal({ id, type })
    setNote('')
  }

  function confirmModal() {
    if (!modal) return
    respond(modal.id, modal.type, note)
  }

  const byDay = week
    ? getWeekDays(week).map(day => ({
        ...day,
        pending: slots.filter(s => s.horarios.dia_semana === day.diaSemana && s.status === 'pendente')
          .sort((a, b) => a.horarios.hora_inicio.localeCompare(b.horarios.hora_inicio)),
        responded: slots.filter(s => s.horarios.dia_semana === day.diaSemana && s.status !== 'pendente')
          .sort((a, b) => a.horarios.hora_inicio.localeCompare(b.horarios.hora_inicio)),
      })).filter(d => d.pending.length + d.responded.length > 0)
    : []

  if (loading) {
    return (
      <div className="mw" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--gray)', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mw" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div style={{ background: 'white', borderRadius: 'var(--r)', padding: '40px 28px', textAlign: 'center', boxShadow: '0 8px 40px rgba(9,30,82,.12)', maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: 22, fontWeight: 800, color: 'var(--blue-dark)', marginBottom: 8 }}>
            Invalid link
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.5 }}>{error}</div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 8 }}>Ask the admin for a new link.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mw">
      <div className="mh">
        <div className="mhi">
          <div className="cr">
            <div className="cli">SV</div>
            <div>
              <div className="cname">St. Vincent&apos;s</div>
              <div className="csub2">Basketball Club · Dublin</div>
            </div>
          </div>
          <div className="gr">
            Hey, <span>{coach?.nome}!</span>
          </div>
          <div className="gs">
            Week of {week ? getWeekRangeShort(week) : ''} &middot; {slots.length} slot{slots.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="mc">
        {slots.length === 0 ? (
          <div className="empty">No slots assigned this week.</div>
        ) : byDay.map((day, di) => (
          <div key={day.diaSemana} style={{ marginTop: di > 0 ? 28 : 0 }}>
            <div className="slbl2">{day.label} · {day.dayNum} {day.monthShort}</div>

            {day.pending.map((c, i) => {
              const expired = isSlotExpired(week, c.horarios.dia_semana, c.horarios.hora_inicio)
              const deadline = formatDeadline(week, c.horarios.dia_semana, c.horarios.hora_inicio)
              return (
                <div key={c.id} className={`${cardClass(c.status)} an a${Math.min(i + 1, 6) as 1|2|3|4|5|6}`}
                  style={expired ? { borderColor: 'var(--red-border)', opacity: .75 } : undefined}>
                  <div className="stb">{formatTime(c.horarios.hora_inicio)} – {formatTime(c.horarios.hora_fim)}</div>
                  {c.horarios.descricao && <div className="sg">{c.horarios.descricao}</div>}
                  {expired ? (
                    <div style={{ marginTop: 14, background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-text)' }}>⏰ Deadline passed</div>
                      <div style={{ fontSize: 11, color: 'var(--red-text)', marginTop: 4, opacity: .8 }}>This slot is now vacant and may be given to another coach.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8, marginBottom: 2 }}>
                        Confirm by <strong style={{ color: 'var(--text)' }}>{deadline}</strong>
                      </div>
                      <div className="btrio">
                        <button className="tb tgo" disabled={saving === c.id} onClick={() => respond(c.id, 'confirmado')}>
                          <span className="em">✅</span>
                          I&apos;ll be there
                        </button>
                        <button className="tb tno" disabled={saving === c.id} onClick={() => openModal(c.id, 'cancelado')}>
                          <span className="em">❌</span>
                          Not going
                        </button>
                        <button className="tb tswap" disabled={saving === c.id} onClick={() => openModal(c.id, 'troca')}>
                          <span className="em">🔄</span>
                          Swap
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {day.responded.map((c) => (
              <div key={c.id} className="smini">
                <div>
                  <div className="sml-d">{formatTime(c.horarios.hora_inicio)} – {formatTime(c.horarios.hora_fim)}</div>
                  <div className="sml-t">{c.horarios.descricao ?? ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {statusBadge(c.status)}
                  {c.status === 'confirmado' && (
                    <button
                      disabled={saving === c.id}
                      onClick={() => openModal(c.id, 'cancelado')}
                      style={{
                        background: 'none', border: '1.5px solid var(--red-border)',
                        borderRadius: 8, padding: '4px 10px',
                        fontSize: 11, fontWeight: 700, color: 'var(--red-text)',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {vagantes.length > 0 && (
          <div style={{ marginTop: slots.length > 0 ? 36 : 0 }}>
            <div className="slbl2" style={{ color: '#2e7d32' }}>Available slots</div>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 12, marginTop: -6 }}>
              Claim a vacant slot before the 1-hour deadline.
            </div>
            {vagantes
              .sort((a, b) => a.dia_semana !== b.dia_semana ? a.dia_semana - b.dia_semana : a.hora_inicio.localeCompare(b.hora_inicio))
              .map(h => {
                const lost = week ? isSlotLost(week, h.dia_semana, h.hora_inicio) : false
                return (
                  <div key={h.id} className="smini" style={lost
                    ? { borderColor: 'var(--red-border)', background: 'var(--red-bg)' }
                    : { borderColor: 'var(--green-border)', background: 'var(--green-bg)' }
                  }>
                    <div>
                      <div className="sml-d" style={{ color: lost ? 'var(--red-text)' : 'var(--green-text)' }}>
                        {DAY_SHORT[h.dia_semana]}
                      </div>
                      <div className="sml-t" style={{ color: lost ? 'var(--red-text)' : 'var(--green-text)' }}>
                        {formatTime(h.hora_inicio)} – {formatTime(h.hora_fim)}
                      </div>
                    </div>
                    {lost ? (
                      <span className="badge badge-lost"><span className="bd-dot" />Forfeited</span>
                    ) : (
                      <button
                        disabled={saving === h.id}
                        onClick={() => claimSlot(h.id)}
                        style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-barlow-condensed)', textTransform: 'uppercase', letterSpacing: '.04em' }}
                      >
                        {saving === h.id ? 'Claiming…' : 'Claim'}
                      </button>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}
      </div>

      <div className={`mo${modal ? ' open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
        <div className="ms">
          <div className="mt-modal">
            {modal?.type === 'cancelado' ? 'Not going' : 'Request a swap'}
          </div>
          <div className="msub">
            {modal?.type === 'cancelado'
              ? 'Add a note for the admin (optional).'
              : 'Describe when you could swap to — the admin will get in touch.'}
          </div>
          <textarea
            className="mta"
            placeholder={modal?.type === 'cancelado' ? 'Reason (optional)...' : 'e.g. Available Saturday 10am instead...'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mr-modal">
            <button className="mb-modal" onClick={() => setModal(null)}>Cancel</button>
            {modal?.type === 'cancelado' ? (
              <button className="mkno" onClick={confirmModal} disabled={saving !== null}>
                {saving ? 'Saving...' : 'Confirm — Not going'}
              </button>
            ) : (
              <button className="mkswap" onClick={confirmModal} disabled={saving !== null}>
                {saving ? 'Saving...' : 'Request swap'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CourtSchedulerPage() {
  return (
    <Suspense fallback={
      <div className="mw" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--gray)', fontSize: 14 }}>Loading...</div>
      </div>
    }>
      <CourtSchedulerContent />
    </Suspense>
  )
}
