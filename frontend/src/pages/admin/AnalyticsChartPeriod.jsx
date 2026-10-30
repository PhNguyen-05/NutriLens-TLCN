export function formatShortChartDate(value) {
  return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : '—'
}

export function calendarMonthRange(dateValue) {
  const [year, month] = dateValue.slice(0, 7).split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const monthText = String(month).padStart(2, '0')
  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function calendarMonthWeeks(monthValue) {
  const { startDate, endDate } = calendarMonthRange(monthValue)
  const [year, month] = startDate.slice(0, 7).split('-')
  const lastDay = Number(endDate.slice(8, 10))
  const weeks = []
  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const startDay = (weekNumber - 1) * 7 + 1
    if (startDay > lastDay) break
    const endDay = weekNumber === 4 ? lastDay : Math.min(startDay + 6, lastDay)
    weeks.push({
      weekNumber,
      startDate: `${year}-${month}-${String(startDay).padStart(2, '0')}`,
      endDate: `${year}-${month}-${String(endDay).padStart(2, '0')}`,
    })
  }
  return weeks
}

export function calendarWeekRange(dateValue) {
  const weeks = calendarMonthWeeks(dateValue.slice(0, 7))
  const weekIndex = Math.min(Math.floor((Number(dateValue.slice(8, 10)) - 1) / 7), weeks.length - 1)
  return weeks[weekIndex]
}

export function getAnalyticsChartPeriod(rows, { sumKeys = [], averageKeys = [] } = {}) {
  const weeks = []
  const weekCount = Math.min(4, Math.ceil(rows.length / 7))
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const start = weekIndex * 7
    const end = weekIndex === weekCount - 1 ? rows.length : Math.min(start + 7, rows.length)
    const days = rows.slice(start, end)
    const weekNumber = weekIndex + 1
    const totals = Object.fromEntries(sumKeys.map((key) => [
      key,
      days.reduce((sum, row) => sum + (Number(row[key]) || 0), 0),
    ]))
    const averages = Object.fromEntries(averageKeys.map((key) => [
      key,
      days.length ? days.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / days.length : 0,
    ]))

    weeks.push({
      ...totals,
      ...averages,
      date: days[0]?.date,
      startDate: days[0]?.date,
      endDate: days[days.length - 1]?.date,
      days,
      weekNumber,
    })
  }

  const mode = rows.length >= 28 ? 'month' : 'day'
  return {
    mode,
    weeks,
    rowsToDisplay: mode === 'month' ? weeks : rows,
  }
}

export function MonthCalendarPicker({ value, onChange, onApply }) {
  return <div className="aa-date-picker aa-month-picker" role="dialog" aria-label="Chọn tháng và năm">
    <label>Chọn tháng và năm<input type="month" value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <button type="button" onClick={onApply}>Áp dụng</button>
  </div>
}

export function MonthWeekPicker({ month, weeks, selectedStartDate, selectedEndDate, onSelectWeek }) {
  return <div className="aa-date-picker aa-week-picker aa-toolbar-week-picker" role="dialog" aria-label={`Chọn tuần trong tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`}>
    <strong>Các tuần trong tháng {month.slice(5, 7)}/{month.slice(0, 4)}</strong>
    {weeks.map((week) => <button type="button" key={week.weekNumber} aria-pressed={week.startDate === selectedStartDate && week.endDate === selectedEndDate} onClick={() => onSelectWeek(week)}>
      <b>Tuần {week.weekNumber}</b><span>{formatShortChartDate(week.startDate)} – {formatShortChartDate(week.endDate)}</span>
    </button>)}
  </div>
}
