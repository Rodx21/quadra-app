import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentWeekMonday, getMondayByOffset, getClaimDeadline } from '@/lib/dates'

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentWeek = getCurrentWeekMonday()
  const since = getMondayByOffset(-51) // ~1 year of weekly data

  const [{ count: totalHorarios }, { data: confirmacoes }, { data: horarios }] = await Promise.all([
    supabaseAdmin.from('horarios').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('confirmacoes').select('semana, horario_id, status').gte('semana', since),
    supabaseAdmin.from('horarios').select('id, dia_semana, hora_inicio'),
  ])

  const total = totalHorarios ?? 0
  const now = new Date()

  // Group by semana → track which horario_ids are confirmed
  const bySemana = new Map<string, Set<string>>()
  for (const c of confirmacoes ?? []) {
    if (!bySemana.has(c.semana)) bySemana.set(c.semana, new Set())
    if (c.status === 'confirmado') bySemana.get(c.semana)!.add(c.horario_id)
  }
  if (!bySemana.has(currentWeek)) bySemana.set(currentWeek, new Set())

  // Build weekly stats
  type WeekStat = { semana: string; total: number; covered: number; forfeited: number; inProgress: boolean; rate: number }
  const weekly: WeekStat[] = []

  for (const [semana, confirmed] of Array.from(bySemana)) {
    const covered = confirmed.size
    const isPast = semana < currentWeek
    let forfeited = 0

    if (isPast) {
      forfeited = total - covered
    } else {
      // Current week: count slots whose 1-hour claim deadline has already passed
      for (const h of horarios ?? []) {
        if (!confirmed.has(h.id) && now > getClaimDeadline(semana, h.dia_semana, h.hora_inicio)) {
          forfeited++
        }
      }
    }

    const rate = total > 0 ? Math.round(covered / total * 100) : 0
    weekly.push({ semana, total, covered, forfeited, inProgress: !isPast, rate })
  }

  weekly.sort((a, b) => b.semana.localeCompare(a.semana))

  // Monthly rollup
  type MonthStat = { year: number; month: number; label: string; totalSlots: number; covered: number; forfeited: number; inProgress: boolean; rate: number }
  const byMonth = new Map<string, MonthStat>()

  for (const wk of weekly) {
    const d = new Date(wk.semana + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth.has(key)) byMonth.set(key, {
      year: d.getFullYear(), month: d.getMonth() + 1,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      totalSlots: 0, covered: 0, forfeited: 0, inProgress: false, rate: 0,
    })
    const m = byMonth.get(key)!
    m.totalSlots += wk.total
    m.covered += wk.covered
    m.forfeited += wk.forfeited
    if (wk.inProgress) m.inProgress = true
  }
  for (const m of Array.from(byMonth.values())) {
    m.rate = m.totalSlots > 0 ? Math.round(m.covered / m.totalSlots * 100) : 0
  }
  const monthly = Array.from(byMonth.values()).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  // Yearly rollup
  type YearStat = { year: number; totalSlots: number; covered: number; forfeited: number; inProgress: boolean; rate: number }
  const byYear = new Map<number, YearStat>()

  for (const m of monthly) {
    if (!byYear.has(m.year)) byYear.set(m.year, { year: m.year, totalSlots: 0, covered: 0, forfeited: 0, inProgress: false, rate: 0 })
    const y = byYear.get(m.year)!
    y.totalSlots += m.totalSlots
    y.covered += m.covered
    y.forfeited += m.forfeited
    if (m.inProgress) y.inProgress = true
  }
  for (const y of Array.from(byYear.values())) {
    y.rate = y.totalSlots > 0 ? Math.round(y.covered / y.totalSlots * 100) : 0
  }
  const yearly = Array.from(byYear.values()).sort((a, b) => b.year - a.year)

  return NextResponse.json({ weekly, monthly, yearly })
}
