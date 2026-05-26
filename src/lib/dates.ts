const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function getMondayOfCurrentWeek(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function getCurrentWeekMonday(): string {
  return formatDateToISO(getMondayOfCurrentWeek())
}

export function getMondayByOffset(offset: number): string {
  const d = getMondayOfCurrentWeek()
  d.setDate(d.getDate() + offset * 7)
  return formatDateToISO(d)
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

export function getDayLabel(day: number): string {
  return DAYS_OF_WEEK[day] ?? 'Unknown'
}

export function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00')
  return date.toLocaleDateString('en-IE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function getWeekRange(mondayISO: string): string {
  const monday = new Date(mondayISO + 'T12:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${formatDateLabel(mondayISO)} – ${formatDateLabel(formatDateToISO(sunday))}`
}

export function getWeekRangeShort(mondayISO: string): string {
  const monday = new Date(mondayISO + 'T12:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${monday.toLocaleDateString('en-IE', opts)} – ${sunday.toLocaleDateString('en-IE', opts)}`
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}

export function getSlotDatetime(mondayISO: string, diaSemana: number, horaInicio: string): Date {
  const [h, m] = horaInicio.split(':').map(Number)
  const d = new Date(mondayISO + 'T12:00:00')
  // dia_semana: 1=Mon…6=Sat, 0=Sun (which is 6 days after Monday)
  d.setDate(d.getDate() + (diaSemana === 0 ? 6 : diaSemana - 1))
  d.setHours(h, m, 0, 0)
  return d
}

export function getDeadline(mondayISO: string, diaSemana: number, horaInicio: string): Date {
  const slot = getSlotDatetime(mondayISO, diaSemana, horaInicio)
  return new Date(slot.getTime() - 24 * 60 * 60 * 1000)
}

export function isSlotExpired(mondayISO: string, diaSemana: number, horaInicio: string): boolean {
  return Date.now() > getDeadline(mondayISO, diaSemana, horaInicio).getTime()
}

export function getClaimDeadline(mondayISO: string, diaSemana: number, horaInicio: string): Date {
  return new Date(getSlotDatetime(mondayISO, diaSemana, horaInicio).getTime() - 60 * 60 * 1000)
}

export function isSlotLost(mondayISO: string, diaSemana: number, horaInicio: string): boolean {
  return Date.now() > getClaimDeadline(mondayISO, diaSemana, horaInicio).getTime()
}

export function formatClaimDeadline(mondayISO: string, diaSemana: number, horaInicio: string): string {
  const dl = getClaimDeadline(mondayISO, diaSemana, horaInicio)
  const date = dl.toLocaleDateString('en-IE', { weekday: 'short', day: '2-digit', month: 'short' })
  const time = dl.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function formatDeadline(mondayISO: string, diaSemana: number, horaInicio: string): string {
  const dl = getDeadline(mondayISO, diaSemana, horaInicio)
  const date = dl.toLocaleDateString('en-IE', { weekday: 'short', day: '2-digit', month: 'short' })
  const time = dl.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function getTodayISO(): string {
  return formatDateToISO(new Date())
}

export type WeekDay = {
  label: string
  diaSemana: number
  dateISO: string
  dayNum: string
  monthShort: string
}

export function getWeekDays(mondayISO: string): WeekDay[] {
  const monday = new Date(mondayISO + 'T12:00:00')
  const cols = [
    { label: 'Mon', diaSemana: 1 },
    { label: 'Tue', diaSemana: 2 },
    { label: 'Wed', diaSemana: 3 },
    { label: 'Thu', diaSemana: 4 },
    { label: 'Fri', diaSemana: 5 },
    { label: 'Sat', diaSemana: 6 },
    { label: 'Sun', diaSemana: 0 },
  ]
  return cols.map((col, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      ...col,
      dateISO: formatDateToISO(d),
      dayNum: String(d.getDate()).padStart(2, '0'),
      monthShort: d.toLocaleDateString('en-IE', { month: 'short' }),
    }
  })
}
