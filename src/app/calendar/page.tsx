'use client'

import { useState, useEffect } from 'react'
import { getWeekDays, getWeekRangeShort, getMondayByOffset, formatTime, getTodayISO, isSlotExpired, isSlotLost } from '@/lib/dates'

type Tecnico = { id: string; nome: string }
type Horario = { id: string; tecnico_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; descricao: string | null }
type Confirmacao = { tecnico_id: string; horario_id: string; status: string }

const AVATAR_COLORS = ['#1340A6', '#2e7d32', '#6a1b9a', '#c62828', '#f57f17', '#00838f']

const NAV_BTN: React.CSSProperties = {
  width: 38, height: 38,
  background: 'rgba(255,255,255,.1)',
  border: 'none', borderRadius: 10,
  color: 'white', fontSize: 22,
  cursor: 'pointer', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background .15s',
}

function calStatusClass(status?: string) {
  if (status === 'confirmado') return 'cs-confirmed'
  if (status === 'cancelado') return 'cs-vacant'
  if (status === 'troca') return 'cs-swap'
  return 'cs-pending'
}

function calStatusLabel(status?: string) {
  if (status === 'confirmado') return '✓'
  if (status === 'cancelado') return '—'
  if (status === 'troca') return '⇄'
  return '?'
}

type BlockStyle = { bg: string; border: string; accent: string; text: string }

function statusBlockStyle(status?: string, expired?: boolean, lost?: boolean): BlockStyle {
  const vacant = status === 'cancelado' || (expired && (!status || status === 'pendente'))
  if (vacant && lost)          return { bg: 'var(--red-bg)',    border: 'var(--red-border)',   accent: '#c62828', text: 'var(--red-text)' }
  if (vacant)                  return { bg: '#f0f2f7',          border: '#d0d4e0',             accent: '#b0b8c8', text: 'var(--gray)' }
  if (status === 'confirmado') return { bg: 'var(--green-bg)',  border: 'var(--green-border)', accent: '#2e7d32', text: 'var(--green-text)' }
  if (status === 'troca')      return { bg: '#e8eeff',          border: '#90caf9',             accent: 'var(--blue)', text: 'var(--blue)' }
  return                               { bg: 'var(--amber-bg)', border: 'var(--amber-border)', accent: '#f57f17', text: 'var(--amber-text)' }
}

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const week = getMondayByOffset(weekOffset)
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [confirmacoes, setConfirmacoes] = useState<Confirmacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?semana=${week}`)
      .then(r => r.json())
      .then(data => {
        setTecnicos(data.tecnicos ?? [])
        setHorarios(data.horarios ?? [])
        setConfirmacoes(data.confirmacoes ?? [])
        setLoading(false)
      })
  }, [week])

  const weekDays = getWeekDays(week)
  const todayISO = getTodayISO()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--off-white)' }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--blue-deeper)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div className="sl-logo">SV</div>
            <div>
              <div className="club-txt">St. Vincent&apos;s Basketball Club</div>
              <div className="sub-txt">Court Schedule · Dublin</div>
            </div>
          </div>

          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 20 }}>
            <button style={NAV_BTN} onClick={() => setWeekOffset(o => o - 1)}>&#8249;</button>
            <div style={{
              fontFamily: 'var(--font-barlow-condensed)',
              fontSize: 17, fontWeight: 700,
              color: 'rgba(255,255,255,.85)',
              flex: 1, textAlign: 'center',
            }}>
              {getWeekRangeShort(week)}
            </div>
            <button style={NAV_BTN} onClick={() => setWeekOffset(o => o + 1)}>&#8250;</button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.15)',
                  borderRadius: 8, padding: '6px 14px',
                  color: 'rgba(255,255,255,.6)', fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-barlow-condensed)', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '.07em',
                }}
              >
                This week
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e8eaf0', padding: '10px 24px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            Status
          </span>
          {[
            { cls: 'cs-confirmed', lbl: '✓', txt: 'Confirmed' },
            { cls: 'cs-pending',   lbl: '?', txt: 'Pending'   },
            { cls: 'cs-cancelled', lbl: '✗', txt: 'Not going' },
            { cls: 'cs-swap',      lbl: '⇄', txt: 'Wants swap'},
          ].map(({ cls, lbl, txt }) => (
            <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text)' }}>
              <span className={`cal-cs ${cls}`} style={{ fontSize: 10 }}>{lbl}</span> {txt}
            </span>
          ))}

          <span style={{ width: 1, height: 16, background: '#e8eaf0', margin: '0 4px' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            Coaches
          </span>
          {tecnicos.map((t, i) => (
            <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
              {t.nome}
            </span>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="cal-page-content">
        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <div className="cal-wrap">
            <div className="cal">
              {weekDays.map(({ label, diaSemana, dateISO, dayNum, monthShort }) => {
                const dayHorarios = horarios.filter(h => h.dia_semana === diaSemana)

                // Group by start time → one block per time slot
                const timeMap = new Map<string, Horario[]>()
                dayHorarios.forEach(h => {
                  if (!timeMap.has(h.hora_inicio)) timeMap.set(h.hora_inicio, [])
                  timeMap.get(h.hora_inicio)!.push(h)
                })

                const isToday = dateISO === todayISO

                return (
                  <div key={diaSemana} className={`cal-col${isToday ? ' cal-today' : ''}`}>
                    <div className="cal-dh">
                      <div className="cal-dname">{label}</div>
                      <div className="cal-ddate">{dayNum}</div>
                      <div className="cal-dmonth">{monthShort}</div>
                    </div>

                    <div className="cal-body">
                      {timeMap.size === 0 ? (
                        <div className="cal-none">No slots</div>
                      ) : (
                        Array.from(timeMap.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([, slots]) => {
                            const h = slots[0]
                            // Prefer 'confirmado' confirmacao (may be a claimer, not the original coach)
                            const allConfs = confirmacoes.filter(c => c.horario_id === h.id)
                            const activeConf = allConfs.find(c => c.status === 'confirmado') ?? allConfs[0]
                            const displayTecnico = activeConf?.status === 'confirmado'
                              ? tecnicos.find(t => t.id === activeConf.tecnico_id)
                              : tecnicos.find(t => t.id === h.tecnico_id)
                            const expired = isSlotExpired(week, h.dia_semana, h.hora_inicio)
                            const vacant = activeConf?.status === 'cancelado' || (expired && (!activeConf?.status || activeConf.status === 'pendente'))
                            const lost = vacant && isSlotLost(week, h.dia_semana, h.hora_inicio)
                            const st = statusBlockStyle(activeConf?.status, expired, lost)

                            return (
                              <div
                                key={h.hora_inicio}
                                className="cal-block"
                                style={{ background: st.bg, borderColor: st.border, borderLeft: `3px solid ${st.accent}`, opacity: vacant ? .75 : 1 }}
                              >
                                <div className="cal-btime" style={{ color: st.accent }}>
                                  {formatTime(h.hora_inicio)} – {formatTime(h.hora_fim)}
                                </div>
                                {displayTecnico ? (
                                  <div className="cal-coach">
                                    <span className="cal-cname" style={{ fontWeight: 700, color: st.text }}>
                                      {lost ? 'Forfeited' : vacant ? 'Vacant' : displayTecnico.nome}
                                    </span>
                                    <span className={`cal-cs ${lost ? 'cs-lost' : calStatusClass(activeConf?.status)}`}>
                                      {lost ? '✕' : calStatusLabel(activeConf?.status)}
                                    </span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: 'var(--gray)', fontStyle: 'italic' }}>Unassigned</div>
                                )}
                              </div>
                            )
                          })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
