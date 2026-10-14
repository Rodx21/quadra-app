'use client'

import { useState, useEffect, useCallback } from 'react'
import { CLUB_NAME, CLUB_SHORT_NAME } from '@/lib/club'
import { getDayLabel, formatTime, getWeekRangeShort, getMondayByOffset, getWeekDays, getTodayISO, isSlotExpired, isSlotLost } from '@/lib/dates'
import type { Tecnico, Confirmacao, Horario, TokenAcesso } from '@/lib/supabase'

type ConfirmacaoComHorario = Confirmacao & { horarios: Horario }
type SlotDisplay = { horario: Horario; confirmacao?: ConfirmacaoComHorario }
type TecnicoComDados = Tecnico & { slots: SlotDisplay[]; hasActiveLink: boolean }
type FlatSlot = { coach: Tecnico; horario: Horario; confirmacao?: ConfirmacaoComHorario }
type Tab = 'schedule' | 'calendar' | 'fixed' | 'coaches' | 'stats'
type StatsWeek  = { semana: string; total: number; covered: number; forfeited: number; inProgress: boolean; rate: number }
type StatsMonth = { year: number; month: number; label: string; totalSlots: number; covered: number; forfeited: number; inProgress: boolean; rate: number }
type StatsYear  = { year: number; totalSlots: number; covered: number; forfeited: number; inProgress: boolean; rate: number }

const AVATAR_COLORS = ['#1340A6', '#2e7d32', '#6a1b9a', '#c62828', '#f57f17', '#00838f']

function Badge({ status, expired, lost }: { status?: string; expired?: boolean; lost?: boolean }) {
  if (lost) return <span className="badge badge-lost"><span className="bd-dot" />Forfeited</span>
  if (expired && (!status || status === 'pendente')) return <span className="badge badge-vacant"><span className="bd-dot" />Vacant</span>
  if (!status || status === 'pendente') return <span className="badge ba"><span className="bd-dot" />Pending</span>
  if (status === 'confirmado') return <span className="badge bg"><span className="bd-dot" />Confirmed</span>
  if (status === 'cancelado') return <span className="badge br"><span className="bd-dot" />Not going</span>
  return <span className="badge bb"><span className="bd-dot" />Wants to swap</span>
}

function isVacant(s?: string, expired?: boolean) {
  return s === 'cancelado' || (expired && (!s || s === 'pendente'))
}
function calStatusClass(s?: string, expired?: boolean) {
  if (isVacant(s, expired)) return 'cs-vacant'
  if (s === 'confirmado') return 'cs-confirmed'
  if (s === 'troca') return 'cs-swap'
  return 'cs-pending'
}
function calStatusLabel(s?: string, expired?: boolean) {
  if (isVacant(s, expired)) return '—'
  if (s === 'confirmado') return '✓'
  if (s === 'troca') return '⇄'
  return '?'
}
type BlockStyle = { bg: string; border: string; accent: string; text: string }
function statusBlockStyle(status?: string, expired?: boolean, lost?: boolean): BlockStyle {
  if (isVacant(status, expired) && lost) return { bg: 'var(--red-bg)', border: 'var(--red-border)', accent: '#c62828', text: 'var(--red-text)' }
  if (isVacant(status, expired)) return { bg: '#f0f2f7', border: '#d0d4e0', accent: '#b0b8c8', text: 'var(--gray)' }
  if (status === 'confirmado')   return { bg: 'var(--green-bg)', border: 'var(--green-border)', accent: '#2e7d32', text: 'var(--green-text)' }
  if (status === 'troca')        return { bg: '#e8eeff', border: '#90caf9', accent: 'var(--blue)', text: 'var(--blue)' }
  return { bg: 'var(--amber-bg)', border: 'var(--amber-border)', accent: '#f57f17', text: 'var(--amber-text)' }
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [coaches, setCoaches] = useState<TecnicoComDados[]>([])
  const [allHorarios, setAllHorarios] = useState<Horario[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const week = getMondayByOffset(weekOffset)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('schedule')
  const [generatedLink, setGeneratedLink] = useState<{ name: string; link: string } | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [sendResults, setSendResults] = useState<Array<{ nome: string; link: string }>>([])
  const [coachesOpen, setCoachesOpen] = useState(true)
  const [filterCoach, setFilterCoach] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // key = `${dia}-${hora}`
  const [confirmacoesList, setConfirmacoesList] = useState<ConfirmacaoComHorario[]>([])
  const [newCoachName, setNewCoachName] = useState('')
  const [addingCoach, setAddingCoach] = useState(false)
  const [statsData, setStatsData] = useState<null | { weekly: StatsWeek[]; monthly: StatsMonth[]; yearly: StatsYear[] }>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const headers = { 'x-admin-password': password, 'Content-Type': 'application/json' }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/dados?semana=${week}`, { headers })
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    const activeTokens: TokenAcesso[] = data.tokens ?? []
    const horarios: Horario[] = data.horarios ?? []
    const allConfirmacoes: ConfirmacaoComHorario[] = data.confirmacoes ?? []

    setAllHorarios(horarios)
    setConfirmacoesList(data.confirmacoes ?? [])

    const coachesWithData: TecnicoComDados[] = (data.tecnicos ?? []).map((t: Tecnico) => {
      const myHorarios = horarios.filter((h) => h.tecnico_id === t.id)
      const myConfirmacoes = allConfirmacoes.filter((c) => c.tecnico_id === t.id)
      const slots: SlotDisplay[] = myHorarios.map((h) => ({
        horario: h,
        confirmacao: myConfirmacoes.find((c) => c.horario_id === h.id),
      }))
      return { ...t, slots, hasActiveLink: activeTokens.some((tk) => tk.tecnico_id === t.id) }
    })

    setCoaches(coachesWithData)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, password])

  useEffect(() => { if (authenticated) load() }, [authenticated, load])

  useEffect(() => {
    if (tab !== 'stats' || !authenticated || statsData || statsLoading) return
    setStatsLoading(true)
    fetch('/api/admin/estatisticas', { headers: { 'x-admin-password': password } })
      .then(r => r.json())
      .then(d => { setStatsData(d); setStatsLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authenticated])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/dados', { headers })
    if (res.ok) setAuthenticated(true)
    else alert('Wrong password')
  }

  async function generateLink(tecnico: Tecnico) {
    const res = await fetch('/api/admin/gerar-link', {
      method: 'POST', headers,
      body: JSON.stringify({ tecnico_id: tecnico.id }),
    })
    if (!res.ok) { alert('Error generating link'); return }
    const { link } = await res.json()
    setGeneratedLink({ name: tecnico.nome, link })
    await load()
  }

  async function sendAll() {
    setSendingAll(true)
    setSendResults([])
    const res = await fetch('/api/admin/enviar-todos', { method: 'POST', headers })
    if (!res.ok) { setSendingAll(false); alert('Error'); return }
    const { results } = await res.json()
    setSendResults(results)
    setSendingAll(false)
    await load()
  }

  async function addCoach(e: React.FormEvent) {
    e.preventDefault()
    setAddingCoach(true)
    await fetch('/api/admin/tecnicos', { method: 'POST', headers, body: JSON.stringify({ nome: newCoachName }) })
    setNewCoachName('')
    setAddingCoach(false)
    await load()
  }

  async function deleteCoach(id: string, nome: string) {
    if (!confirm(`Remove ${nome}? This will delete all their slots, confirmations and links.`)) return
    await fetch(`/api/admin/tecnicos/${id}`, { method: 'DELETE', headers })
    await load()
  }

  async function assign(dia_semana: number, hora_inicio: string, hora_fim: string, tecnico_id: string | null) {
    const key = `${dia_semana}-${hora_inicio}`
    setSaving(key)
    await fetch('/api/admin/atribuir', {
      method: 'POST', headers,
      body: JSON.stringify({ dia_semana, hora_inicio, hora_fim, tecnico_id }),
    })
    setSaving(null)
    await load()
  }

  // ── Derived data ──
  const visibleCoaches = filterCoach ? coaches.filter(c => c.id === filterCoach) : coaches
  const allSlots = visibleCoaches.flatMap(c => c.slots)
  const confirmed = allSlots.filter(s => s.confirmacao?.status === 'confirmado').length
  const cancelled = allSlots.filter(s => s.confirmacao?.status === 'cancelado').length
  const pending = allSlots.filter(s => !s.confirmacao || s.confirmacao.status === 'pendente').length
  const lost = allSlots.filter(s => {
    const exp = isSlotExpired(week, s.horario.dia_semana, s.horario.hora_inicio)
    return isVacant(s.confirmacao?.status, exp) && isSlotLost(week, s.horario.dia_semana, s.horario.hora_inicio)
  }).length

  const flatSlots: FlatSlot[] = visibleCoaches.flatMap(c =>
    c.slots.map(s => ({ coach: c, ...s }))
  ).sort((a, b) => {
    if (a.horario.dia_semana !== b.horario.dia_semana) return a.horario.dia_semana - b.horario.dia_semana
    return a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)
  })

  // Unique time slots for Fixed Schedules (one row per day+time)
  type UniqueSlot = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; tecnico_id: string | null }
  const uniqueSlotsMap = new Map<string, UniqueSlot>()
  allHorarios.forEach(h => {
    const key = `${h.dia_semana}-${h.hora_inicio}`
    if (!uniqueSlotsMap.has(key)) {
      uniqueSlotsMap.set(key, { id: h.id, dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, tecnico_id: h.tecnico_id })
    }
  })
  const uniqueSlots = Array.from(uniqueSlotsMap.values())
    .sort((a, b) => a.dia_semana !== b.dia_semana ? a.dia_semana - b.dia_semana : a.hora_inicio.localeCompare(b.hora_inicio))

  // Group unique slots by day
  const slotsByDay = new Map<number, UniqueSlot[]>()
  uniqueSlots.forEach(s => {
    if (!slotsByDay.has(s.dia_semana)) slotsByDay.set(s.dia_semana, [])
    slotsByDay.get(s.dia_semana)!.push(s)
  })
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
  const orderedDays = DAY_ORDER.filter(d => slotsByDay.has(d))

  if (!authenticated) {
    return (
      <div className="login-wrap">
        <form onSubmit={login} className="login-box an">
          <div className="login-logo">SV</div>
          <h1 className="login-title">Court Scheduler</h1>
          <p className="login-sub">{CLUB_NAME}</p>
          <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" required />
          <button type="submit" className="login-btn">Sign in</button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sl">
          <div className="sl-logo">SV</div>
          <div>
            <div className="club-txt">{CLUB_SHORT_NAME}</div>
            <div className="sub-txt">Basketball Club · Dublin</div>
          </div>
        </div>

        <div className="sw">
          <div className="wl">Week</div>
          <div className="wnav">
            <button onClick={() => setWeekOffset(o => o - 1)}>&#8249;</button>
            <div className="wlabel">{getWeekRangeShort(week)}</div>
            <button onClick={() => setWeekOffset(o => o + 1)}>&#8250;</button>
          </div>
        </div>

        <nav className="snav">
          <div className="nlabel">Views</div>
          <button className={`ni${tab === 'schedule' ? ' active' : ''}`} onClick={() => setTab('schedule')}>
            <span className="ic">📅</span>
            Weekly Schedule
            {filterCoach && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,.15)', borderRadius: 4, padding: '2px 5px' }}>filtered</span>}
          </button>
          <button className={`ni${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>
            <span className="ic">🗓</span> Calendar
          </button>
          <button className={`ni${tab === 'fixed' ? ' active' : ''}`} onClick={() => setTab('fixed')}>
            <span className="ic">📋</span> Fixed Schedules
          </button>
          <button className={`ni${tab === 'coaches' ? ' active' : ''}`} onClick={() => setTab('coaches')}>
            <span className="ic">👤</span> Manage Coaches
          </button>
          <button className={`ni${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
            <span className="ic">📊</span> Utilisation
          </button>

          <div className="nlabel" style={{ marginTop: 20 }}>Coaches</div>
          <button className="ni ni-acc" onClick={() => setCoachesOpen(o => !o)}>
            <span className="ic">👥</span>
            All Coaches
            <span className={`ni-ch${coachesOpen ? ' open' : ''}`}>▼</span>
          </button>

          {coachesOpen && (
            <div className="coach-sub">
              {filterCoach && (
                <button className="coach-si" style={{ color: 'rgba(255,255,255,.35)', fontSize: 11 }} onClick={() => setFilterCoach(null)}>
                  ✕ Clear filter
                </button>
              )}
              {coaches.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    className={`coach-si${filterCoach === t.id ? ' active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => { setFilterCoach(filterCoach === t.id ? null : t.id); setTab('schedule') }}
                  >
                    <span className="coach-dot" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} />
                    {t.nome}
                    <span style={{ marginLeft: 'auto', fontSize: 10, opacity: .5 }}>{t.slots.length}</span>
                  </button>
                  <button
                    title="Generate link"
                    onClick={() => generateLink(t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 14, padding: '4px 6px', borderRadius: 6, lineHeight: 1, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.7)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.3)')}
                  >
                    🔗
                  </button>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className="sf">Court Scheduler v1.0</div>
      </aside>

      {/* ── Main ── */}
      <div className="main-area">
        <div className="topbar">
          <div className="tt">
            {tab === 'schedule' && (filterCoach ? `${coaches.find(c => c.id === filterCoach)?.nome ?? ''} — Schedule` : 'Weekly Schedule')}
            {tab === 'calendar' && 'Calendar'}
            {tab === 'fixed' && 'Fixed Schedules'}
            {tab === 'coaches' && 'Manage Coaches'}
            {tab === 'stats' && 'Court Utilisation'}
          </div>
          <div className="ta">
            <button className="btn btn-o" onClick={load} disabled={loading}>↻ Refresh</button>
            <button className="btn btn-g" onClick={sendAll} disabled={sendingAll}>
              {sendingAll ? 'Sending...' : '✉ Send links to all'}
            </button>
          </div>
        </div>

        <div className="content">
          {sendResults.length > 0 && (
            <div className="send-banner an">
              <div className="send-banner-title">Links generated — copy and share via WhatsApp</div>
              {sendResults.map((r) => (
                <div key={r.nome} className="send-row">
                  <span style={{ fontWeight: 600, width: 120, flexShrink: 0 }}>{r.nome}</span>
                  <input readOnly value={r.link} style={{ flex: 1, border: '1px solid #e8eaf0', borderRadius: 6, padding: '4px 8px', fontSize: 12, background: '#f8f9fd' }} onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button onClick={() => navigator.clipboard.writeText(r.link)} className="lbtn">Copy</button>
                </div>
              ))}
            </div>
          )}

          {loading ? <div className="empty">Loading...</div> : (
            <>

              {/* ── SCHEDULE TAB ── */}
              {tab === 'schedule' && (
                <>
                  <div className="stats-row an" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                    <div className="sc sb"><div className="sn">{allSlots.length}</div><div className="slbl">Total slots</div></div>
                    <div className="sc sg"><div className="sn">{confirmed}</div><div className="slbl">Confirmed</div></div>
                    <div className="sc sr"><div className="sn">{cancelled}</div><div className="slbl">Not going</div></div>
                    <div className="sc sa"><div className="sn">{pending}</div><div className="slbl">Pending</div></div>
                    <div className="sc sr"><div className="sn">{lost}</div><div className="slbl">Forfeited</div></div>
                  </div>

                  <div className="sh"><div className="stitle">All Slots</div></div>

                  {flatSlots.length === 0 ? <div className="empty">No slots found.</div> : (
                    <div className="stable an a2">
                      <div className="thead">
                        <div className="th">Coach</div>
                        <div className="th">Day</div>
                        <div className="th">Time</div>
                        <div className="th">Group</div>
                        <div className="th">Status</div>
                      </div>
                      {flatSlots.map(({ coach, horario, confirmacao }) => {
                        const expired = isSlotExpired(week, horario.dia_semana, horario.hora_inicio)
                        const slotLost = isVacant(confirmacao?.status, expired) && isSlotLost(week, horario.dia_semana, horario.hora_inicio)
                        return (
                          <div key={horario.id} className="tr">
                            <div className="td tdn">{coach.nome}</div>
                            <div className="td tdd">{getDayLabel(horario.dia_semana)}</div>
                            <div className="td tdt">{formatTime(horario.hora_inicio)} – {formatTime(horario.hora_fim)}</div>
                            <div className="td tdt">{horario.descricao ?? '—'}</div>
                            <div className="td"><Badge status={confirmacao?.status} expired={expired} lost={slotLost} /></div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── CALENDAR TAB ── */}
              {tab === 'calendar' && (() => {
                const weekDays = getWeekDays(week)
                const todayISO = getTodayISO()
                return (
                  <>
                    <div className="sh"><div className="stitle">Week of {getWeekRangeShort(week)}</div></div>
                    <div className="cal-wrap an">
                      <div className="cal">
                        {weekDays.map(({ label, diaSemana, dateISO, dayNum, monthShort }) => {
                          // Use uniqueSlots so each time block shows exactly ONE assigned coach
                          const dayBlocks = uniqueSlots
                            .filter(s => s.dia_semana === diaSemana)
                            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                          const isToday = dateISO === todayISO
                          return (
                            <div key={diaSemana} className={`cal-col${isToday ? ' cal-today' : ''}`}>
                              <div className="cal-dh">
                                <div className="cal-dname">{label}</div>
                                <div className="cal-ddate">{dayNum}</div>
                                <div className="cal-dmonth">{monthShort}</div>
                              </div>
                              <div className="cal-body">
                                {dayBlocks.length === 0 ? <div className="cal-none">No slots</div> : (
                                  dayBlocks.map(slot => {
                                    const coach = coaches.find(c => c.id === slot.tecnico_id)
                                    const slotDisplay = coach?.slots.find(s =>
                                      s.horario.dia_semana === slot.dia_semana &&
                                      s.horario.hora_inicio === slot.hora_inicio
                                    )
                                    const slotConfs = confirmacoesList.filter(c => c.horario_id === slot.id)
                                    const activeConf = slotConfs.find(c => c.status === 'confirmado') ?? slotDisplay?.confirmacao
                                    const confStatus = activeConf?.status
                                    const displayCoach = activeConf?.status === 'confirmado'
                                      ? coaches.find(c => c.id === activeConf.tecnico_id) ?? coach
                                      : coach
                                    const expired = isSlotExpired(week, slot.dia_semana, slot.hora_inicio)
                                    const vacant = isVacant(confStatus, expired)
                                    const slotLost = vacant && isSlotLost(week, slot.dia_semana, slot.hora_inicio)
                                    const st = statusBlockStyle(confStatus, expired, slotLost)
                                    return (
                                      <div
                                        key={slot.hora_inicio}
                                        className="cal-block"
                                        style={{ background: st.bg, borderColor: st.border, borderLeft: `3px solid ${st.accent}`, opacity: (vacant && !slotLost) ? .75 : 1 }}
                                      >
                                        <div className="cal-btime" style={{ color: st.accent }}>
                                          {formatTime(slot.hora_inicio)} – {formatTime(slot.hora_fim)}
                                        </div>
                                        {displayCoach ? (
                                          <div className="cal-coach">
                                            <span className="cal-cname" style={{ fontWeight: 700, color: st.text }}>
                                              {slotLost ? 'Forfeited' : vacant ? 'Vacant' : displayCoach.nome}
                                            </span>
                                            <span className={`cal-cs ${slotLost ? 'cs-lost' : calStatusClass(confStatus, expired)}`}>
                                              {slotLost ? '✕' : calStatusLabel(confStatus, expired)}
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
                  </>
                )
              })()}

              {/* ── STATS TAB ── */}
              {tab === 'stats' && (() => {
                const rateBar = (rate: number) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 52, height: 6, borderRadius: 3, background: '#e8eaf0', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${rate}%`, borderRadius: 3, background: rate >= 75 ? '#2e7d32' : rate >= 45 ? '#f57f17' : '#c62828' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: rate >= 75 ? 'var(--green-text)' : rate >= 45 ? 'var(--amber-text)' : 'var(--red-text)' }}>{rate}%</span>
                  </div>
                )
                const statsHead = (cols: string[]) => (
                  <div className="thead" style={{ gridTemplateColumns: `2fr ${cols.map(() => '1fr').join(' ')}` }}>
                    <div className="th">Period</div>
                    {cols.map(c => <div key={c} className="th">{c}</div>)}
                  </div>
                )
                if (statsLoading || !statsData) return <div className="empty">{statsLoading ? 'Loading stats…' : 'No data yet.'}</div>
                const thisWeek  = statsData.weekly[0]
                const thisMonth = statsData.monthly[0]
                const thisYear  = statsData.yearly[0]
                return (
                  <>
                    {/* Summary cards */}
                    <div className="stats-row an" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 28 }}>
                      {[
                        { label: 'This week', stat: thisWeek,  sub: thisWeek  ? `${thisWeek.covered} / ${thisWeek.total} slots covered`  : '—' },
                        { label: 'This month', stat: thisMonth, sub: thisMonth ? `${thisMonth.covered} / ${thisMonth.totalSlots} slots covered` : '—' },
                        { label: 'This year',  stat: thisYear,  sub: thisYear  ? `${thisYear.covered} / ${thisYear.totalSlots} slots covered`  : '—' },
                      ].map(({ label, stat, sub }) => (
                        <div key={label} className="sc sb" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="slbl">{label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="sn" style={{ fontSize: 28 }}>{stat ? `${stat.rate}%` : '—'}</div>
                            {stat && <div style={{ width: 6, height: 36, borderRadius: 3, background: stat.rate >= 75 ? '#2e7d32' : stat.rate >= 45 ? '#f57f17' : '#c62828' }} />}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray)' }}>{sub}</div>
                          {stat?.inProgress && <div style={{ fontSize: 10, color: 'var(--amber-text)', fontWeight: 700 }}>IN PROGRESS</div>}
                        </div>
                      ))}
                    </div>

                    {/* Weekly */}
                    <div className="sh"><div className="stitle">Weekly breakdown</div></div>
                    <div className="stable an a2" style={{ marginBottom: 28 }}>
                      {statsHead(['Offered', '✓ Covered', '✗ Forfeited', 'Utilisation'])}
                      {statsData.weekly.map(wk => (
                        <div key={wk.semana} className="tr" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                          <div className="td">
                            <div className="tdn" style={{ fontSize: 12 }}>{getWeekRangeShort(wk.semana)}</div>
                            {wk.inProgress && <div style={{ fontSize: 10, color: 'var(--amber-text)', fontWeight: 700 }}>In progress</div>}
                          </div>
                          <div className="td tdt">{wk.total}</div>
                          <div className="td" style={{ color: 'var(--green-text)', fontWeight: 600 }}>{wk.covered}</div>
                          <div className="td" style={{ color: wk.forfeited > 0 ? 'var(--red-text)' : 'var(--gray)', fontWeight: wk.forfeited > 0 ? 600 : 400 }}>{wk.forfeited}</div>
                          <div className="td">{rateBar(wk.rate)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Monthly */}
                    <div className="sh"><div className="stitle">Monthly summary</div></div>
                    <div className="stable an a3" style={{ marginBottom: 28 }}>
                      {statsHead(['Offered', '✓ Covered', '✗ Forfeited', 'Utilisation'])}
                      {statsData.monthly.map(m => (
                        <div key={m.label} className="tr" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                          <div className="td">
                            <div className="tdn" style={{ fontSize: 12 }}>{m.label}</div>
                            {m.inProgress && <div style={{ fontSize: 10, color: 'var(--amber-text)', fontWeight: 700 }}>In progress</div>}
                          </div>
                          <div className="td tdt">{m.totalSlots}</div>
                          <div className="td" style={{ color: 'var(--green-text)', fontWeight: 600 }}>{m.covered}</div>
                          <div className="td" style={{ color: m.forfeited > 0 ? 'var(--red-text)' : 'var(--gray)', fontWeight: m.forfeited > 0 ? 600 : 400 }}>{m.forfeited}</div>
                          <div className="td">{rateBar(m.rate)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Yearly */}
                    <div className="sh"><div className="stitle">Annual summary</div></div>
                    <div className="stable an a4">
                      {statsHead(['Offered', '✓ Covered', '✗ Forfeited', 'Utilisation'])}
                      {statsData.yearly.map(y => (
                        <div key={y.year} className="tr" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                          <div className="td">
                            <div className="tdn" style={{ fontSize: 12 }}>{y.year}</div>
                            {y.inProgress && <div style={{ fontSize: 10, color: 'var(--amber-text)', fontWeight: 700 }}>In progress</div>}
                          </div>
                          <div className="td tdt">{y.totalSlots}</div>
                          <div className="td" style={{ color: 'var(--green-text)', fontWeight: 600 }}>{y.covered}</div>
                          <div className="td" style={{ color: y.forfeited > 0 ? 'var(--red-text)' : 'var(--gray)', fontWeight: y.forfeited > 0 ? 600 : 400 }}>{y.forfeited}</div>
                          <div className="td">{rateBar(y.rate)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}

              {/* ── COACHES TAB ── */}
              {tab === 'coaches' && (
                <>
                  <div className="sh"><div className="stitle">Add Coach</div></div>
                  <div style={{ background: 'white', borderRadius: 'var(--r)', border: '1px solid #e8eaf0', padding: '20px 24px', marginBottom: 24 }}>
                    <form onSubmit={addCoach} style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Coach name"
                        value={newCoachName}
                        onChange={e => setNewCoachName(e.target.value)}
                        className="login-input"
                        style={{ flex: 1, marginBottom: 0 }}
                        required
                      />
                      <button type="submit" className="btn btn-g" disabled={addingCoach}>
                        {addingCoach ? 'Adding…' : '+ Add coach'}
                      </button>
                    </form>
                  </div>

                  <div className="sh"><div className="stitle">All Coaches</div></div>
                  <div className="stable an a2">
                    <div className="thead" style={{ gridTemplateColumns: '1fr 80px 140px 110px' }}>
                      <div className="th">Coach</div>
                      <div className="th">Slots</div>
                      <div className="th">Link</div>
                      <div className="th">Actions</div>
                    </div>
                    {coaches.map((t, i) => (
                      <div key={t.id} className="tr" style={{ gridTemplateColumns: '1fr 80px 140px 110px' }}>
                        <div className="td" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 32, height: 32, borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-barlow-condensed)', flexShrink: 0 }}>
                            {t.nome[0].toUpperCase()}
                          </span>
                          <span className="tdn">{t.nome}</span>
                        </div>
                        <div className="td tdt">{t.slots.length}</div>
                        <div className="td">
                          <button className="lbtn" onClick={() => generateLink(t)}>🔗 Generate link</button>
                        </div>
                        <div className="td">
                          <button
                            onClick={() => deleteCoach(t.id, t.nome)}
                            style={{ background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── FIXED SCHEDULES TAB ── */}
              {tab === 'fixed' && (
                <>
                  <div className="sh">
                    <div className="stitle">Slot Assignments</div>
                    <span style={{ fontSize: 12, color: 'var(--gray)' }}>Each slot can have at most one coach. Changes are saved immediately.</span>
                  </div>

                  {uniqueSlots.length === 0 ? <div className="empty">No slots found.</div> : (
                    orderedDays.map(dia => (
                      <div key={dia} className="as-day">
                        <div className="as-day-title">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} />
                          {getDayLabel(dia)}
                        </div>
                        <div className="stable">
                          <div className="thead" style={{ gridTemplateColumns: '1fr 1fr 1.5fr' }}>
                            <div className="th">Start</div>
                            <div className="th">End</div>
                            <div className="th">Assigned coach</div>
                          </div>
                          {slotsByDay.get(dia)!.map(slot => {
                            const key = `${slot.dia_semana}-${slot.hora_inicio}`
                            const isSaving = saving === key
                            return (
                              <div key={slot.hora_inicio} className="tr" style={{ gridTemplateColumns: '1fr 1fr 1.5fr' }}>
                                <div className="td tdt">{formatTime(slot.hora_inicio)}</div>
                                <div className="td tdt">{formatTime(slot.hora_fim)}</div>
                                <div className="td">
                                  <select
                                    className={`as-select${slot.tecnico_id ? ' assigned' : ' unassigned'}`}
                                    value={slot.tecnico_id ?? ''}
                                    disabled={isSaving}
                                    onChange={e => assign(slot.dia_semana, slot.hora_inicio, slot.hora_fim, e.target.value || null)}
                                  >
                                    <option value="">— Unassigned —</option>
                                    {coaches.map((t) => (
                                      <option key={t.id} value={t.id}>{t.nome}</option>
                                    ))}
                                  </select>
                                  {isSaving && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray)' }}>Saving…</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

            </>
          )}
        </div>
      </div>

      {/* ── Link modal ── */}
      {generatedLink && (
        <div className="lmo open" onClick={(e) => { if (e.target === e.currentTarget) setGeneratedLink(null) }}>
          <div className="lm an">
            <div className="lmt">Link for {generatedLink.name}</div>
            <div className="lmf">Permanent link — share via WhatsApp once.</div>
            <div className="lb">{generatedLink.link}</div>
            <button className="cbtn" onClick={() => { navigator.clipboard.writeText(generatedLink.link); setGeneratedLink(null) }}>Copy &amp; close</button>
            <button className="clbtn" onClick={() => setGeneratedLink(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
