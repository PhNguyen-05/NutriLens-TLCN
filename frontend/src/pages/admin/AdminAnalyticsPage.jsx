import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { calendarMonthRange, calendarMonthWeeks, calendarWeekRange, getAnalyticsChartPeriod, MonthCalendarPicker, MonthWeekPicker } from './AnalyticsChartPeriod'

const ageGroups = [
  ['under18', 'Dưới 18'],
  ['18-24', '18–24'],
  ['25-34', '25–34'],
  ['35-44', '35–44'],
  ['45-54', '45–54'],
  ['55+', '55+'],
  ['unknown', 'Chưa rõ'],
]

const genderGroups = [
  ['female', 'Nữ', '#e65bad'],
  ['male', 'Nam', '#3e9bf3'],
  ['unknown', 'Chưa cập nhật', '#9aaabd'],
]

const emptyDemographics = {
  total: 0,
  gender: { female: 0, male: 0, other: 0, unknown: 0 },
  ages: { under18: 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, unknown: 0 },
}

const metricCards = [
  { title: 'Tổng người dùng', key: 'total', growth: '12', icon: 'bi-people-fill', tone: 'mint' },
  { title: 'Người dùng mới', key: 'new', icon: 'bi-person-plus-fill', tone: 'green' },
  { title: 'Người dùng hoạt động', key: 'active', growth: '9', icon: 'bi-person-check-fill', tone: 'blue' },
  { title: 'Người dùng bị khóa', key: 'locked', growth: '11', icon: 'bi-lock-fill', tone: 'orange' },
]

function number(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function date(value) {
  return value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—'
}

function dateTime(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value)).replace(',', '') : '—'
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

function niceAxisScale(maxValue) {
  if (!maxValue) return { step: 1, maximum: 1, ticks: [1, 0] }

  const rawStep = maxValue / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const step = Math.max(1, (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude)
  let intervals = Math.ceil(maxValue / step)

  if (maxValue % step === 0) intervals += 1

  const maximum = intervals * step
  return {
    step,
    maximum,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => maximum - index * step),
  }
}

function genderDonutGradient(values) {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!total) return 'conic-gradient(#e5edf3 0deg 360deg)'

  let currentDegree = 0
  const stops = values.map(({ value, color }) => {
    const start = currentDegree
    currentDegree += value / total * 360
    return `${color} ${start}deg ${currentDegree}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function TrendChart({ points, mode }) {
  const isWeekly = mode === 'month'
  const visiblePoints = points.length ? points : [{ date: '', total: 0, fresh: 0 }]
  const maxValue = Math.max(1, ...visiblePoints.map((point) => Math.max(point.total, point.fresh)))
  const axis = niceAxisScale(maxValue)
  const x = (index) => 38 + index * (visiblePoints.length > 1 ? 482 / (visiblePoints.length - 1) : 0)
  const y = (value) => 128 - value / axis.maximum * 120
  const totals = visiblePoints.map((point, index) => `${x(index)},${y(point.total)}`).join(' ')
  const newUsers = visiblePoints.map((point, index) => `${x(index)},${y(point.fresh)}`).join(' ')
  return (
    <svg className="aa-trend-chart" viewBox="0 0 540 160" role="img" aria-label={`Biểu đồ số người dùng đăng ký theo ${isWeekly ? 'tuần' : 'ngày'}`}>
      <defs><linearGradient id="aa-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#02b388" stopOpacity=".18" /><stop offset="100%" stopColor="#02b388" stopOpacity="0" /></linearGradient></defs>
      {axis.ticks.map((tick) => { const lineY = 8 + (axis.maximum - tick) / axis.maximum * 120; return <g key={tick}><line x1="38" x2="520" y1={lineY} y2={lineY} /><text x="27" y={lineY + 4}>{number(tick)}</text></g> })}
      {visiblePoints.map((point, index) => {
        const startLabel = point.startDate ? `${point.startDate.slice(8, 10)}/${point.startDate.slice(5, 7)}` : ''
        const endLabel = point.endDate ? `${point.endDate.slice(8, 10)}/${point.endDate.slice(5, 7)}` : ''
        return <g key={point.date || 'empty'}>
          <title>{isWeekly ? `Tuần ${point.weekNumber}: ${formatInputDate(point.startDate)} - ${formatInputDate(point.endDate)}` : formatInputDate(point.date)}</title>
          <line className="aa-trend-tick" x1={x(index)} x2={x(index)} y1="8" y2="128" />
          {isWeekly
            ? <><text className="aa-trend-date" x={x(index)} y="140">Tuần {point.weekNumber}</text><text className="aa-trend-week-range" x={x(index)} y="151">{startLabel} – {endLabel}</text></>
            : <text className="aa-trend-date" x={x(index)} y="150">{point.date ? `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}` : ''}</text>}
        </g>
      })}
      <polygon className="aa-trend-area" points={`38,128 ${totals} 520,128`} />
      <polyline className="aa-trend-total" points={totals} />
      <polyline className="aa-trend-new" points={newUsers} />
      {visiblePoints.map((point, index) => <g key={`${point.date || 'empty'}-points`}><circle className="aa-dot-total" cx={x(index)} cy={y(point.total)} r="3" /><circle className="aa-dot-new" cx={x(index)} cy={y(point.fresh)} r="3" /></g>)}
    </svg>
  )
}

function Donut({ kind, total, style, label = 'Tổng người dùng' }) {
  return <div className={`aa-donut ${kind}`} style={style}><div><strong>{number(total)}</strong><span>{label}</span></div></div>
}

function Percent({ value, total }) {
  if (!total) return '0%'
  return `${(value * 100 / total).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export default function AdminAnalyticsPage({ onNavigate }) {
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, locked: 0, local: 0, google: 0 })
  const [demographics, setDemographics] = useState(emptyDemographics)
  const [dailyRegistrations, setDailyRegistrations] = useState([])
  const [totalBeforeRange, setTotalBeforeRange] = useState(0)
  const [previousPeriodRegistrations, setPreviousPeriodRegistrations] = useState(0)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('Theo tuần')
  const [endDate, setEndDate] = useState(() => calendarWeekRange(toLocalInputDate(new Date())).endDate)
  const [startDate, setStartDate] = useState(() => calendarWeekRange(toLocalInputDate(new Date())).startDate)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showPeriodWeekPicker, setShowPeriodWeekPicker] = useState(false)
  const [monthSelection, setMonthSelection] = useState(() => toLocalInputDate(new Date()).slice(0, 7))

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axiosInstance.get('/admin/users', {
          params: { search, status, page, limit: 10, from: startDate, to: endDate },
          signal: controller.signal,
        })
        setUsers(data.data || [])
        setSummary({ total: 0, active: 0, locked: 0, local: 0, google: 0, ...(data.summary || {}) })
        setDemographics({
          total: data.demographics?.total ?? data.summary?.total ?? 0,
          gender: { ...emptyDemographics.gender, ...(data.demographics?.gender || {}) },
          ages: { ...emptyDemographics.ages, ...(data.demographics?.ages || {}) },
        })
        setDailyRegistrations(data.analytics?.dailyRegistrations || [])
        setTotalBeforeRange(data.analytics?.totalBeforeRange || 0)
        setPreviousPeriodRegistrations(data.analytics?.previousPeriodRegistrations || 0)
        setPagination(data.pagination || { total: 0, totalPages: 0 })
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') setError(requestError.response?.data?.message || 'Không thể tải danh sách người dùng.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 250 : 0)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [search, status, page, startDate, endDate])

  const filteredUsers = useMemo(() => gender === 'all' ? users : users.filter((user) => user.gender === gender), [gender, users])
  const growthPoints = useMemo(() => {
    const countByDate = new Map(dailyRegistrations.map(({ date: day, count }) => [day, Number(count || 0)]))
    const points = []
    const lastDay = new Date(`${endDate}T12:00:00`)
    const dayCursor = new Date(`${startDate}T12:00:00`)
    let total = Number(totalBeforeRange || 0)

    for (; dayCursor <= lastDay; dayCursor.setDate(dayCursor.getDate() + 1)) {
      const day = toLocalInputDate(dayCursor)
      const fresh = countByDate.get(day) || 0
      total += fresh
      points.push({ date: day, total, fresh })
    }

    return points
  }, [dailyRegistrations, endDate, startDate, totalBeforeRange])
  const newUserCount = growthPoints.reduce((sum, point) => sum + point.fresh, 0)
  const chartPeriod = getAnalyticsChartPeriod(growthPoints, { sumKeys: ['fresh'] })
  const trendPoints = chartPeriod.mode === 'month'
    ? chartPeriod.rowsToDisplay.map((week) => ({ ...week, total: week.days[week.days.length - 1]?.total || 0 }))
    : growthPoints
  const newUserChange = previousPeriodRegistrations
    ? Math.round((newUserCount - previousPeriodRegistrations) * 100 / previousPeriodRegistrations)
    : newUserCount ? 100 : 0
  const periodComparison = period === 'Theo tháng' ? 'So với tháng trước' : 'So với tuần trước'
  const start = pagination.total ? (page - 1) * 10 + 1 : 0
  const end = Math.min(page * 10, pagination.total)
  const pages = Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + index)
  const providerTotal = Number(summary.local || 0) + Number(summary.google || 0)
  const localSweep = providerTotal ? Number(summary.local || 0) / providerTotal * 360 : 0
  const genderLegend = genderGroups.map(([key, label, color]) => ({ key, label, color, value: demographics.gender[key] || 0 }))
  const genderTotal = genderLegend.reduce((sum, group) => sum + group.value, 0)
  const ageValues = ageGroups.map(([key, label]) => ({ key, label, value: demographics.ages[key] || 0 }))
  const ageAxis = niceAxisScale(Math.max(0, ...ageValues.map(({ value }) => value)))
  const ageAxisMaximum = ageAxis.maximum

  function openMonthPicker() {
    setMonthSelection((period === 'Theo tháng' ? startDate : endDate).slice(0, 7))
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
    setStartDate(dateRange.startDate)
    setEndDate(dateRange.endDate)
    setPeriod('Theo tháng')
    setShowMonthPicker(false)
    setShowPeriodWeekPicker(false)
    setPage(1)
  }

  return (
    <section className="admin-analytics">
      <nav className="aa-category-nav" aria-label="Thống kê theo mục">
        <div className="aa-category-title"><strong>Thống kê theo mục</strong></div>
        <div className="aa-category-tabs">
          <button type="button" className="active" aria-current="page"><i className="bi bi-people-fill" />Người dùng</button>
          <button type="button" onClick={() => onNavigate?.('Món ăn')}><i className="bi bi-egg-fried" />Món ăn</button>
          <button type="button" onClick={() => onNavigate?.('Bài tập')}><i className="bi bi-person-walking" />Bài tập</button>
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

      <section className="aa-metrics" aria-label="Tổng quan người dùng">
        {metricCards.map((card) => <article className="aa-metric" key={card.title}><span className={`aa-metric-icon ${card.tone}`}><i className={`bi ${card.icon}`} /></span><div><small>{card.title}</small><strong>{card.key === 'new' ? number(newUserCount) : number(summary[card.key])}</strong><span className="aa-growth"><i className={`bi bi-arrow-${card.key === 'new' ? (newUserChange >= 0 ? 'up' : 'down') : 'up'}-short`} />{card.key === 'new' ? Math.abs(newUserChange) : card.growth}%</span><small className="aa-caption">{card.key === 'new' ? 'So với kỳ trước' : periodComparison}</small></div></article>)}
      </section>

      <section className="aa-chart-grid">
        <article className="aa-panel aa-trend-panel"><div className="aa-panel-heading"><h2><i className="bi bi-people-fill" />Biểu đồ tăng trưởng người dùng theo {chartPeriod.mode === 'month' ? 'tuần' : 'ngày'}</h2><div className="aa-legend"><span><i className="total" />Tổng người dùng</span><span><i className="new" />Người dùng mới</span></div></div><TrendChart points={trendPoints} mode={chartPeriod.mode} /></article>
        <article className="aa-panel"><div className="aa-panel-heading"><h2>Người dùng theo giới tính</h2></div><div className="aa-gender-content"><Donut kind="gender" total={genderTotal} label={genderTotal === demographics.total ? 'Tổng người dùng' : 'Nhóm hiển thị'} style={{ background: genderDonutGradient(genderLegend) }} /><div className="aa-legend-list">{genderLegend.map(({ key, label, color, value }) => <span key={key}><i className={key} style={{ backgroundColor: color }} />{label}<b>{number(value)} ({Percent({ value, total: genderTotal })})</b></span>)}</div></div></article>
        <article className="aa-panel"><div className="aa-panel-heading"><h2>Người dùng theo độ tuổi</h2></div><div className="aa-age-chart"><div className="aa-age-axis">{ageAxis.ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div><div className="aa-age-plot">{ageAxis.ticks.map((tick) => <i className="aa-age-gridline" key={tick} style={{ bottom: `${14 + tick / ageAxisMaximum * 120}px` }} />)}<div className="aa-age-bars">{ageValues.map(({ key, label, value }) => <div className="aa-age-bar" key={key} title={`${key === 'unknown' ? 'Chưa cập nhật ngày sinh' : label}: ${number(value)} người dùng`}><strong>{value}</strong><i style={{ height: `${value / ageAxisMaximum * 120}px` }} /><span>{label}</span></div>)}</div></div></div></article>
      </section>

      <section className="aa-lower-grid">
        <article className="aa-panel aa-status-panel"><div className="aa-panel-heading"><h2><i className="bi bi-person-walking" />Tình trạng tài khoản</h2></div><div className="aa-status-list">
          {[
            ['Đang hoạt động', summary.active, 'active', summary.total ? summary.active / summary.total : 0],
            ['Bị khóa', summary.locked, 'locked', summary.total ? summary.locked / summary.total : 0],
          ].map(([label, value, tone, ratio]) => <div className="aa-status-row" key={tone}><span className="aa-status-icon"><i className={`bi ${tone === 'pending' ? 'bi-clock-fill' : 'bi-person-fill'}`} /></span><label>{label}</label><div className="aa-progress"><i style={{ width: `${Math.max(ratio * 100, value ? 7 : 0)}%` }} /></div><strong>{number(value)} <small>({(ratio * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</small></strong></div>)}
        </div></article>
        <article className="aa-panel aa-provider-panel"><div className="aa-panel-heading"><h2>Phân bố người dùng theo loại tài khoản</h2></div><div className="aa-provider-content"><Donut kind="provider" total={summary.total} style={providerTotal ? { background: `conic-gradient(#14a871 0deg ${localSweep}deg, #3188ed ${localSweep}deg 360deg)` } : undefined} /><div className="aa-provider-legend"><span><i className="local" />Tài khoản thường <b>{number(summary.local)} ({summary.total ? <Percent value={summary.local} total={summary.total} /> : '0%'})</b></span><span><i className="google" />Tài khoản Google <b>{number(summary.google)} ({summary.total ? <Percent value={summary.google} total={summary.total} /> : '0%'})</b></span></div></div></article>
      </section>

      <section className="aa-panel aa-recent-panel"><div className="aa-recent-heading"><div className="aa-panel-heading"><h2><i className="bi bi-calendar3" />Danh sách người dùng gần đây</h2><p>Hiển thị 10 người dùng mới nhất trong khoảng thời gian đã chọn.</p></div><div className="aa-table-tools"><label className="aa-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm kiếm theo tên, email..." /></label><select aria-label="Lọc giới tính" value={gender} onChange={(event) => setGender(event.target.value)}><option value="all">Tất cả giới tính</option><option value="female">Nữ</option><option value="male">Nam</option></select><select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Bị khóa</option><option value="pending">Chưa xác thực</option></select></div></div>
        <div className="aa-table-wrap"><table className="aa-table"><thead><tr><th>STT</th><th>Tên người dùng</th><th>Email</th><th>Giới tính</th><th>Ngày sinh</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Xác thực</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="8" className="aa-table-message"><span className="user-spinner" />Đang tải danh sách...</td></tr> : error ? <tr><td colSpan="8" className="aa-table-message aa-error">{error}</td></tr> : filteredUsers.length ? filteredUsers.map((user, index) => <tr key={user._id}><td>{start + index}</td><td>{user.fullName || user.name || '—'}</td><td>{user.email || '—'}</td><td>{user.gender === 'female' ? 'Nữ' : user.gender === 'male' ? 'Nam' : '—'}</td><td>{date(user.dateOfBirth)}</td><td>{dateTime(user.createdAt)}</td><td><span className={`aa-status-pill ${user.status || 'active'}`}>{user.status === 'locked' ? 'Bị khóa' : user.status === 'pending' ? 'Chưa xác thực' : 'Đang hoạt động'}</span></td><td>{user.status === 'pending' ? 'Chưa xác thực' : 'Đã xác thực'}</td></tr>) : <tr><td colSpan="8" className="aa-table-message">Không tìm thấy người dùng phù hợp.</td></tr>}
        </tbody></table></div>
        <footer className="aa-pagination"><span>Hiển thị {start} – {end} trong tổng số {number(pagination.total)} người dùng</span><div><button type="button" aria-label="Trang trước" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><i className="bi bi-chevron-left" /></button>{pages.map((value) => <button type="button" key={value} className={value === page ? 'current' : ''} disabled={loading} onClick={() => setPage(value)}>{value}</button>)}<button type="button" aria-label="Trang sau" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}><i className="bi bi-chevron-right" /></button></div></footer>
      </section>

    </section>
  )
}
