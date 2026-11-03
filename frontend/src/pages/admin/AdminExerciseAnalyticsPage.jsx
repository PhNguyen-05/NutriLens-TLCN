import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { calendarMonthRange, calendarMonthWeeks, calendarWeekRange, formatShortChartDate, getAnalyticsChartPeriod, MonthCalendarPicker, MonthWeekPicker } from './AnalyticsChartPeriod'

const CATEGORY_COLORS = ['#12aa7c', '#f39879', '#8a6ee8', '#b05fe4', '#2998f4', '#54b9e7']

function number(value, digits = 0) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: digits })
}

function toLocalInputDate(value) {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function formatInputDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function percent(value, total) {
  return total ? `${number(value * 100 / total, 1)}%` : '0%'
}

function periodChange(current, previous) {
  if (!previous) return current ? { text: 'Mới phát sinh', positive: true } : { text: '0%', positive: true }
  const change = (current - previous) * 100 / previous
  return {
    text: `${change > 0 ? '+' : ''}${number(change, 1)}%`,
    positive: change >= 0,
  }
}

function activityAxis(maxValue) {
  const targetStep = Math.max(1, Math.ceil(maxValue / 5))
  const magnitude = 10 ** Math.floor(Math.log10(targetStep))
  const normalized = targetStep / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = Math.max(1, factor * magnitude)
  const maximum = Math.max(step, Math.ceil(maxValue / step) * step)
  return { maximum, ticks: Array.from({ length: Math.floor(maximum / step) + 1 }, (_, index) => maximum - index * step) }
}

function ActivityChart({ rows, mode }) {
  const isWeekly = mode === 'month'
  const axis = activityAxis(Math.max(0, ...rows.map((row) => Number(row.sessions) || 0)))
  const maxSessions = axis.maximum
  const maxUsers = Math.max(1, ...rows.map((row) => row.activeUsers))
  const userPoints = rows.map((row, index) => {
    const x = (index + 0.5) * 700 / Math.max(rows.length, 1)
    const y = 100 - row.activeUsers / maxUsers * 82
    return `${x},${y}`
  }).join(' ')

  return <div className={`aa-exercise-chart ${isWeekly ? 'is-weekly' : ''}`} role="img" aria-label={`Lượt ghi nhận và người dùng vận động theo ${isWeekly ? 'tuần' : 'ngày'}`}>
    <div className="aa-exercise-axis">{axis.ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
    <div className="aa-exercise-plot">
      <div className="aa-exercise-grid-lines" aria-hidden="true">{axis.ticks.map((tick) => <i key={tick} />)}</div>
      <div className="aa-exercise-day-bars" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}>{rows.map((row, index) => <div className="aa-exercise-day" key={row.date} title={`${isWeekly ? `Tuần ${row.weekNumber} (${formatInputDate(row.startDate)} - ${formatInputDate(row.endDate)})` : formatInputDate(row.date)} · ${number(row.sessions)} lượt · ${isWeekly ? `${number(row.activeUsers, 1)} người/ngày trung bình` : `${number(row.activeUsers)} người`}`}>
        <i className="session" style={{ height: `${row.sessions / maxSessions * 100}%` }} />
        {row.sessions > 0 && <b className="aa-exercise-value" style={{ '--session-height': `${row.sessions / maxSessions * 100}%` }}>{number(row.sessions)}</b>}
        <span>{isWeekly ? <><b>Tuần {row.weekNumber}</b><small>{formatShortChartDate(row.startDate)} - {formatShortChartDate(row.endDate)}</small></> : formatShortChartDate(row.date)}</span>
      </div>)}</div>
      <svg className="aa-exercise-line" viewBox="0 0 700 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={userPoints} />
        {rows.map((row, index) => <circle key={row.date} cx={(index + 0.5) * 700 / Math.max(rows.length, 1)} cy={100 - row.activeUsers / maxUsers * 82} r="2.3" />)}
      </svg>
    </div>
  </div>
}

function CaloriesChart({ rows }) {
  const maxCalories = Math.max(1, ...rows.map((row) => row.calories))
  const points = rows.map((row, index) => {
    const x = (index + 0.5) * 700 / Math.max(rows.length, 1)
    const y = 100 - row.calories / maxCalories * 82
    return `${x},${y}`
  }).join(' ')

  return <div className="aa-exercise-chart" role="img" aria-label="Calories tiêu hao theo ngày">
    <div className="aa-exercise-axis"><span>{number(maxCalories)}</span><span>{number(maxCalories * .75)}</span><span>{number(maxCalories * .5)}</span><span>{number(maxCalories * .25)}</span><span>0</span></div>
    <div className="aa-exercise-plot">
      <div className="aa-exercise-grid-lines" />
      <div className="aa-exercise-day-labels">{rows.map((row) => <div className="aa-exercise-day" key={row.date} title={`${formatInputDate(row.date)} · ${number(row.calories)} kcal`}>
        <span>{row.date.slice(8, 10)}/{row.date.slice(5, 7)}</span>
      </div>)}</div>
      <svg className="aa-exercise-calorie-line" viewBox="0 0 700 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,100 ${points} 700,100`} />
        <polyline points={points} />
        {rows.map((row, index) => <circle key={row.date} cx={(index + 0.5) * 700 / Math.max(rows.length, 1)} cy={100 - row.calories / maxCalories * 82} r="2.3" />)}
      </svg>
    </div>
  </div>
}

function DurationDonut({ categories, totalDuration }) {
  let angle = 0
  const slices = categories.filter((category) => category.totalDuration > 0).map((category, index) => {
    const start = angle
    angle += category.totalDuration / Math.max(totalDuration, 1) * 360
    return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}deg ${angle}deg`
  })
  const background = totalDuration ? `conic-gradient(${slices.join(', ')})` : '#e7f1f7'
  return <div className="aa-exercise-donut" style={{ background }}>
    <div><strong>{number(totalDuration)}</strong><span>phút hoạt động</span></div>
  </div>
}

export default function AdminExerciseAnalyticsPage({ onNavigate }) {
  const [endDate, setEndDate] = useState(() => calendarWeekRange(toLocalInputDate(new Date())).endDate)
  const [startDate, setStartDate] = useState(() => calendarWeekRange(toLocalInputDate(new Date())).startDate)
  const [period, setPeriod] = useState('Theo tuần')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showPeriodWeekPicker, setShowPeriodWeekPicker] = useState(false)
  const [monthSelection, setMonthSelection] = useState(() => toLocalInputDate(new Date()).slice(0, 7))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ catalogCount: 0, sessions: 0, calories: 0, activeUsers: 0, totalDuration: 0, previous: {} })
  const [categories, setCategories] = useState([])
  const [dailyData, setDailyData] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axiosInstance.get('/admin/exercises/analytics', {
          params: { from: startDate, to: endDate },
          signal: controller.signal,
        })
        setSummary({ catalogCount: 0, sessions: 0, calories: 0, activeUsers: 0, totalDuration: 0, previous: {}, ...(data.summary || {}) })
        setCategories(data.categories || [])
        setDailyData(data.daily || [])
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') setError(requestError.response?.data?.message || 'Không thể tải thống kê bài tập.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 0)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [startDate, endDate])

  const dailyRows = useMemo(() => {
    const byDate = new Map(dailyData.map((row) => [row.date, row]))
    const rows = []
    const lastDate = new Date(`${endDate}T12:00:00`)
    const cursor = new Date(`${startDate}T12:00:00`)
    for (; cursor <= lastDate; cursor.setDate(cursor.getDate() + 1)) {
      const date = toLocalInputDate(cursor)
      rows.push({ date, sessions: 0, activeUsers: 0, totalDuration: 0, averageDuration: 0, calories: 0, ...(byDate.get(date) || {}) })
    }
    return rows
  }, [dailyData, endDate, startDate])
  const activityPeriod = getAnalyticsChartPeriod(dailyRows, { sumKeys: ['sessions'], averageKeys: ['activeUsers'] })

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? dailyRows.filter((row) => formatInputDate(row.date).includes(query) || row.date.includes(query)) : dailyRows
  }, [dailyRows, search])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 7))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * 7, currentPage * 7)
  const totals = filteredRows.reduce((result, row) => ({
    sessions: result.sessions + row.sessions,
    activeUsers: result.activeUsers + row.activeUsers,
    totalDuration: result.totalDuration + row.totalDuration,
    calories: result.calories + row.calories,
  }), { sessions: 0, activeUsers: 0, totalDuration: 0, calories: 0 })
  const averageDuration = totals.sessions ? totals.totalDuration / totals.sessions : 0
  const categoryMax = Math.max(1, ...categories.map((category) => category.sessions))
  const visibleStart = filteredRows.length ? (currentPage - 1) * 7 + 1 : 0
  const visibleEnd = Math.min(currentPage * 7, filteredRows.length)

  function openMonthPicker() {
    setMonthSelection((period === '' ? startDate : endDate).slice(0, 7))
    setShowPeriodWeekPicker(false)
    setShowMonthPicker((visible) => !visible)
  }

  function openWeekPicker() {
    setMonthSelection((period === 'Theo tháng' ? startDate : endDate).slice(0, 7))
    setShowMonthPicker(false)
    setShowPeriodWeekPicker((visible) => !visible)
  }

  function selectCalendarWeek(week) {
    setStartDate(week.startDate)
    setEndDate(week.endDate)
    setPeriod('Theo tuần')
    setShowPeriodWeekPicker(false)
    setPage(1)
  }

  function applyMonthSelection() {
    if (!monthSelection) return
    const dateRange = calendarMonthRange(monthSelection)
    setPeriod('Theo tháng')
    setStartDate(dateRange.startDate)
    setEndDate(dateRange.endDate)
    setShowMonthPicker(false)
    setShowPeriodWeekPicker(false)
    setPage(1)
  }

  const sessionChange = periodChange(summary.sessions, summary.previous?.sessions)
  const calorieChange = periodChange(summary.calories, summary.previous?.calories)
  const userChange = periodChange(summary.activeUsers, summary.previous?.activeUsers)
  const totalDuration = categories.reduce((sum, category) => sum + category.totalDuration, 0)

  return <section className="admin-analytics aa-exercise-analytics">
    <nav className="aa-category-nav" aria-label="Thống kê theo mục">
      <div className="aa-category-title"><strong>Thống kê theo mục</strong></div>
      <div className="aa-category-tabs">
        <button type="button" onClick={() => onNavigate?.('Báo cáo')}><i className="bi bi-people-fill" />Người dùng</button>
        <button type="button" onClick={() => onNavigate?.('Món ăn')}><i className="bi bi-egg-fried" />Món ăn</button>
        <button type="button" className="active" aria-current="page"><i className="bi bi-person-walking" />Bài tập</button>
        <button type="button" onClick={() => onNavigate?.('Community')}><i className="bi bi-chat-square-heart" />Community</button>
        <button type="button" onClick={() => onNavigate?.('Blog')}><i className="bi bi-journal-text" />Blog</button>
      </div>
    </nav>

    <div className="aa-toolbar">
      <div className="aa-date-tools">
        <div className="aa-week-filter">
          <button type="button" className={period === 'Theo tuần' || showPeriodWeekPicker ? 'active' : ''} aria-expanded={showPeriodWeekPicker} onClick={openWeekPicker}>Theo tuần</button>
          {showPeriodWeekPicker && <MonthWeekPicker month={monthSelection} weeks={calendarMonthWeeks(monthSelection)} selectedStartDate={startDate} selectedEndDate={endDate} onSelectWeek={selectCalendarWeek} />}
        </div>
        <button type="button" className={period === 'Theo tháng' ? 'active' : ''} aria-expanded={showMonthPicker} onClick={openMonthPicker}>Theo tháng</button>
        {showMonthPicker && <MonthCalendarPicker value={monthSelection} onChange={setMonthSelection} onApply={applyMonthSelection} />}
      </div>
    </div>

    <section className="aa-metrics" aria-label="Tổng quan bài tập">
      <article className="aa-metric"><span className="aa-metric-icon mint"><i className="bi bi-person-running" /></span><div><small>Bài tập trong danh mục</small><strong>{number(summary.catalogCount)}</strong><span className="aa-growth"><i className="bi bi-collection" />Danh mục hệ thống</span><small className="aa-caption">Bài tập chuẩn hóa</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon blue"><i className="bi bi-file-earmark-text-fill" /></span><div><small>Lượt ghi nhận bài tập</small><strong>{number(summary.sessions)}</strong><span className={`aa-growth ${sessionChange.positive ? '' : 'aa-exercise-negative'}`}><i className={`bi ${sessionChange.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`} />{sessionChange.text}</span><small className="aa-caption">So với kỳ trước</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon orange"><i className="bi bi-fire" /></span><div><small>Calories tiêu hao</small><strong>{number(summary.calories)} kcal</strong><span className={`aa-growth ${calorieChange.positive ? '' : 'aa-exercise-negative'}`}><i className={`bi ${calorieChange.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`} />{calorieChange.text}</span><small className="aa-caption">Trong khoảng thời gian đã chọn</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon purple"><i className="bi bi-people-fill" /></span><div><small>Người dùng có vận động</small><strong>{number(summary.activeUsers)}</strong><span className={`aa-growth ${userChange.positive ? '' : 'aa-exercise-negative'}`}><i className={`bi ${userChange.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`} />{userChange.text}</span><small className="aa-caption">So với kỳ trước</small></div></article>
    </section>

    <section className="aa-exercise-trends">
      <article className="aa-panel aa-exercise-trend-panel">
        <div className="aa-panel-heading aa-period-chart-heading"><h2><i className="bi bi-person-walking" />Lượt ghi nhận bài tập theo thời gian</h2><div className="aa-legend"><span><i className="aa-exercise-session-legend" />Lượt ghi nhận</span><span><i className="aa-exercise-user-legend" />{activityPeriod.mode === 'month' ? 'TB người dùng/ngày' : 'Người dùng có vận động'}</span></div></div>
        {loading ? <div className="aa-food-chart-state"><span className="user-spinner" />Đang tải thống kê...</div> : error ? <div className="aa-food-chart-state aa-error">{error}</div> : <ActivityChart rows={activityPeriod.rowsToDisplay} mode={activityPeriod.mode} />}
      </article>
      <article className="aa-panel aa-exercise-trend-panel">
        <div className="aa-panel-heading"><h2><i className="bi bi-fire" />Calories tiêu hao theo thời gian</h2><div className="aa-legend"><span><i className="aa-exercise-calorie-legend" />Calories tiêu hao (kcal)</span></div></div>
        {loading ? <div className="aa-food-chart-state"><span className="user-spinner" />Đang tải thống kê...</div> : error ? <div className="aa-food-chart-state aa-error">{error}</div> : <CaloriesChart rows={dailyRows} />}
      </article>
    </section>

    <section className="aa-exercise-distributions">
      <article className="aa-panel aa-exercise-category-panel">
        <div className="aa-panel-heading"><h2><i className="bi bi-person-walking" />Phân bổ bài tập theo loại</h2></div>
        <div className="aa-exercise-category-list">{categories.map((category, index) => <div className="aa-exercise-category-row" key={category.name}>
          <span className="aa-exercise-category-icon" style={{ '--category-color': CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}><i className={`bi ${['bi-person-walking', 'bi-bicycle', 'bi-dribbble', 'bi-universal-access', 'bi-activity', 'bi-three-dots'][index % 6]}`} /></span>
          <label title={category.name}>{category.name}</label>
          <div className="aa-exercise-category-progress"><i style={{ width: `${category.sessions / categoryMax * 100}%`, background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /></div>
          <strong>{number(category.sessions)} <small>({percent(category.sessions, summary.sessions)})</small></strong>
        </div>)}{!loading && !categories.length && <div className="aa-food-empty">Chưa có lượt ghi nhận trong khoảng ngày đã chọn.</div>}</div>
      </article>
      <article className="aa-panel aa-exercise-duration-panel">
        <div className="aa-panel-heading"><h2><i className="bi bi-people-fill" />Phân bổ thời lượng vận động</h2></div>
        <div className="aa-exercise-duration-content">
          <DurationDonut categories={categories} totalDuration={totalDuration} />
          <div className="aa-exercise-duration-legend">{categories.map((category, index) => <span key={category.name}><i style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />{category.name}<b>{percent(category.totalDuration, totalDuration)}</b></span>)}</div>
        </div>
      </article>
    </section>

    <section className="aa-panel aa-exercise-daily-panel">
      <div className="aa-exercise-daily-heading"><div className="aa-panel-heading"><h2><i className="bi bi-calendar3" />Thống kê chi tiết theo thời gian</h2><p>Dữ liệu từ ngày {formatInputDate(startDate)} đến {formatInputDate(endDate)}.</p></div><label className="aa-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo ngày..." /></label></div>
      <div className="aa-table-wrap"><table className="aa-table aa-exercise-table"><thead><tr><th>Ngày</th><th>Người dùng có vận động</th><th>Lượt ghi nhận bài tập</th><th>Thời lượng trung bình</th><th>Tổng thời lượng</th><th>Calories tiêu hao</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6" className="aa-table-message"><span className="user-spinner" />Đang tải thống kê...</td></tr> : error ? <tr><td colSpan="6" className="aa-table-message aa-error">{error}</td></tr> : pageRows.length ? pageRows.map((row) => <tr key={row.date}><td>{formatInputDate(row.date)}</td><td>{number(row.activeUsers)}</td><td>{number(row.sessions)}</td><td>{number(row.averageDuration)} phút</td><td>{number(row.totalDuration)} phút</td><td>{number(row.calories)} kcal</td></tr>) : <tr><td colSpan="6" className="aa-table-message">Không có dữ liệu trong khoảng ngày đã chọn.</td></tr>}
        {!loading && !error && filteredRows.length > 0 && <tr className="aa-food-total-row"><td>Tổng cộng</td><td>{number(summary.activeUsers)}</td><td>{number(totals.sessions)}</td><td>{number(averageDuration)} phút</td><td>{number(totals.totalDuration)} phút</td><td>{number(totals.calories)} kcal</td></tr>}
      </tbody></table></div>
      <footer className="aa-pagination"><span>Hiển thị {visibleStart} – {visibleEnd} trong tổng số {filteredRows.length} ngày</span><div><button type="button" aria-label="Trang trước" disabled={currentPage <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="bi bi-chevron-left" /></button><button type="button" className="current" disabled={loading}>{currentPage}</button><button type="button" aria-label="Trang sau" disabled={currentPage >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><i className="bi bi-chevron-right" /></button></div></footer>
    </section>
  </section>
}
