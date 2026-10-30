import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { calendarMonthRange, calendarMonthWeeks, calendarWeekRange, formatShortChartDate, getAnalyticsChartPeriod, MonthCalendarPicker, MonthWeekPicker } from './AnalyticsChartPeriod'

function number(value) {
  return Number(value || 0).toLocaleString('vi-VN')
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
  return total ? `${(value * 100 / total).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '0%'
}

function FoodGrowthChart({ rows, mode }) {
  const isWeekly = mode === 'month'
  const maxDaily = Math.max(0, ...rows.flatMap((row) => [row.added, row.activated, row.hidden].map((value) => Number(value) || 0)))
  const targetStep = Math.max(1, Math.ceil(maxDaily / 5))
  const stepMagnitude = 10 ** Math.floor(Math.log10(targetStep))
  const normalizedStep = targetStep / stepMagnitude
  const stepFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10
  const tickStep = Math.max(1, stepFactor * stepMagnitude)
  const scaleMax = Math.max(tickStep, Math.ceil(maxDaily / tickStep) * tickStep)
  const ticks = Array.from({ length: Math.floor(scaleMax / tickStep) + 1 }, (_, index) => scaleMax - index * tickStep)
  const labelIndexes = new Set(rows.map((_, index) => index))
  const series = [
    { key: 'added', className: 'added' },
    { key: 'activated', className: 'activated' },
    { key: 'hidden', className: 'hidden' },
  ]

  return (
    <div className={`aa-food-chart ${isWeekly ? 'is-weekly' : ''}`} role="img" aria-label={`Biểu đồ số món ăn được thêm mới, kích hoạt và ẩn theo ${isWeekly ? 'tuần' : 'ngày'}`}>
      <div className="aa-food-axis">{ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
      <div className="aa-food-bars" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}>
        <div className="aa-food-gridlines" aria-hidden="true">{ticks.map((tick) => <span key={tick} />)}</div>
        {rows.map((row, index) => <div className="aa-food-day" key={row.date} title={`${isWeekly ? `Tuần ${row.weekNumber} (${formatInputDate(row.startDate)} - ${formatInputDate(row.endDate)})` : formatInputDate(row.date)} · Mới ${row.added}, kích hoạt ${row.activated}, ẩn ${row.hidden}`}>
          <div className="aa-food-bar-group">
            {series.map(({ key, className }) => {
              const value = Number(row[key]) || 0
              const barHeight = `${value / scaleMax * 100}%`
              const showValue = value > 0 && labelIndexes.has(index)
              return <div className="aa-food-bar-item" key={key} style={{ '--bar-height': barHeight }}>
                {showValue && <span>{number(value)}</span>}
                <i className={className} style={{ height: barHeight }} />
              </div>
            })}
          </div>
          {labelIndexes.has(index) && <span>{isWeekly ? <><b>Tuần {row.weekNumber}</b><small>{formatShortChartDate(row.startDate)} - {formatShortChartDate(row.endDate)}</small></> : formatShortChartDate(row.date)}</span>}
        </div>)}
      </div>
    </div>
  )
}

function FoodStatusDonut({ total, active }) {
  const activeDegrees = total ? active / total * 360 : 0
  return <div className="aa-food-donut" style={{ background: `conic-gradient(#14ad82 0deg ${activeDegrees}deg, #f59e0b ${activeDegrees}deg 360deg)` }}>
    <div><strong>{number(total)}</strong><span>Tổng món ăn</span></div>
  </div>
}

export default function AdminFoodAnalyticsPage({ onNavigate }) {
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
  const [summary, setSummary] = useState({ total: 0, active: 0, hidden: 0, pendingRequests: 0 })
  const [categories, setCategories] = useState([])
  const [dailyData, setDailyData] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axiosInstance.get('/admin/foods/analytics', {
          params: { from: startDate, to: endDate },
          signal: controller.signal,
        })
        setSummary({ total: 0, active: 0, hidden: 0, pendingRequests: 0, ...(data.summary || {}) })
        setCategories(data.categories || [])
        setDailyData(data.daily || [])
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') setError(requestError.response?.data?.message || 'Không thể tải thống kê món ăn.')
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
      rows.push({ date, added: 0, activated: 0, hidden: 0, approved: 0, rejected: 0, ...(byDate.get(date) || {}) })
    }
    return rows
  }, [dailyData, endDate, startDate])
  const chartPeriod = getAnalyticsChartPeriod(dailyRows, { sumKeys: ['added', 'activated', 'hidden'] })

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? dailyRows.filter((row) => formatInputDate(row.date).includes(query) || row.date.includes(query)) : dailyRows
  }, [dailyRows, search])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 7))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * 7, currentPage * 7)
  const tableTotals = filteredRows.reduce((totals, row) => ({
    added: totals.added + row.added,
    activated: totals.activated + row.activated,
    hidden: totals.hidden + row.hidden,
    approved: totals.approved + row.approved,
    rejected: totals.rejected + row.rejected,
  }), { added: 0, activated: 0, hidden: 0, approved: 0, rejected: 0 })
  const activeShare = summary.total ? summary.active / summary.total * 100 : 0
  const categoriesToShow = categories
  const categoryMax = Math.max(1, ...categories.map((category) => category.count))

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

  const visibleStart = filteredRows.length ? (currentPage - 1) * 7 + 1 : 0
  const visibleEnd = Math.min(currentPage * 7, filteredRows.length)

  return (
    <section className="admin-analytics aa-food-analytics">
      <nav className="aa-category-nav" aria-label="Thống kê theo mục">
        <div className="aa-category-title"><strong>Thống kê theo mục</strong></div>
        <div className="aa-category-tabs">
          <button type="button" onClick={() => onNavigate?.('Báo cáo')}><i className="bi bi-people-fill" />Người dùng</button>
          <button type="button" className="active" aria-current="page"><i className="bi bi-egg-fried" />Món ăn</button>
          <button type="button" onClick={() => onNavigate?.('Bài tập')}><i className="bi bi-person-walking" />Bài tập</button>
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

      <section className="aa-metrics" aria-label="Tổng quan món ăn">
        <article className="aa-metric"><span className="aa-metric-icon mint"><i className="bi bi-egg-fried" /></span><div><small>Tổng số món ăn</small><strong>{number(summary.total)}</strong><span className="aa-growth"><i className="bi bi-plus-lg" />{number(tableTotals.added)} trong kỳ</span><small className="aa-caption">Món mới được thêm</small></div></article>
        <article className="aa-metric"><span className="aa-metric-icon green"><i className="bi bi-check-circle-fill" /></span><div><small>Đang hoạt động</small><strong>{number(summary.active)}</strong><span className="aa-growth"><i className="bi bi-check2" />{percent(summary.active, summary.total)}</span><small className="aa-caption">Trong tổng danh mục</small></div></article>
        <article className="aa-metric"><span className="aa-metric-icon orange"><i className="bi bi-eye-slash-fill" /></span><div><small>Đã ẩn</small><strong>{number(summary.hidden)}</strong><span className="aa-growth aa-food-muted"><i className="bi bi-eye-slash" />{percent(summary.hidden, summary.total)}</span><small className="aa-caption">Món ăn đang ẩn</small></div></article>
        <article className="aa-metric"><span className="aa-metric-icon blue"><i className="bi bi-file-earmark-check-fill" /></span><div><small>Yêu cầu bổ sung chờ duyệt</small><strong>{number(summary.pendingRequests)}</strong><span className="aa-growth"><i className="bi bi-hourglass-split" />Đang chờ xử lý</span><small className="aa-caption">Yêu cầu từ người dùng</small></div></article>
      </section>

      <section className="aa-food-chart-grid">
        <article className="aa-panel aa-food-trend-panel">
          <div className="aa-panel-heading aa-period-chart-heading"><h2><i className="bi bi-graph-up-arrow" />Biến động số lượng món ăn</h2><div className="aa-legend"><span><i className="aa-food-legend-added" />Món mới</span><span><i className="aa-food-legend-activated" />Kích hoạt</span><span><i className="aa-food-legend-hidden" />Ẩn</span></div></div>
          {loading ? <div className="aa-food-chart-state"><span className="user-spinner" />Đang tải thống kê...</div> : error ? <div className="aa-food-chart-state aa-error">{error}</div> : <FoodGrowthChart rows={chartPeriod.rowsToDisplay} mode={chartPeriod.mode} />}
        </article>
        <article className="aa-panel aa-food-status-panel">
          <div className="aa-panel-heading"><h2>Phân bố trạng thái món ăn</h2></div>
          <div className="aa-food-status-content"><FoodStatusDonut total={summary.total} active={summary.active} /><div className="aa-food-status-legend"><span><i className="active" />Đang hoạt động <b>{number(summary.active)} ({percent(summary.active, summary.total)})</b></span><span><i className="hidden" />Đã ẩn <b>{number(summary.hidden)} ({percent(summary.hidden, summary.total)})</b></span></div></div>
        </article>
        <article className="aa-panel aa-food-category-panel">
          <div className="aa-panel-heading"><h2>Phân bổ món ăn theo danh mục</h2></div>
          <div className="aa-food-category-list">{categoriesToShow.map((category, index) => <div className="aa-food-category-row" key={category.name}><span className={`aa-food-category-icon tone-${index % 5}`}><i className={`bi ${['bi-egg-fried', 'bi-cup-straw', 'bi-basket2-fill', 'bi-cake2-fill', 'bi-three-dots'][index % 5]}`} /></span><label title={category.name}>{category.name}</label><div className="aa-food-category-progress"><i style={{ width: `${category.count / categoryMax * 100}%` }} /></div><strong>{number(category.count)} <small>({percent(category.count, summary.total)})</small></strong></div>)}{!loading && !categoriesToShow.length && <div className="aa-food-empty">Chưa có danh mục món ăn.</div>}</div>
        </article>
      </section>

      <section className="aa-panel aa-food-daily-panel">
        <div className="aa-food-daily-heading"><div className="aa-panel-heading"><h2><i className="bi bi-calendar3" />Thống kê chi tiết theo thời gian</h2><p>Dữ liệu từ ngày {formatInputDate(startDate)} đến {formatInputDate(endDate)}.</p></div><label className="aa-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo ngày..." /></label></div>
        <div className="aa-table-wrap"><table className="aa-table aa-food-table"><thead><tr><th>Ngày</th><th>Món mới được thêm</th><th>Món được kích hoạt</th><th>Món bị ẩn</th><th>Yêu cầu bổ sung được duyệt</th><th>Yêu cầu bổ sung bị từ chối</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6" className="aa-table-message"><span className="user-spinner" />Đang tải thống kê...</td></tr> : error ? <tr><td colSpan="6" className="aa-table-message aa-error">{error}</td></tr> : pageRows.length ? pageRows.map((row) => <tr key={row.date}><td>{formatInputDate(row.date)}</td><td>{number(row.added)}</td><td>{number(row.activated)}</td><td>{number(row.hidden)}</td><td>{number(row.approved)}</td><td>{number(row.rejected)}</td></tr>) : <tr><td colSpan="6" className="aa-table-message">Không có dữ liệu trong khoảng ngày đã chọn.</td></tr>}
          {!loading && !error && filteredRows.length > 0 && <tr className="aa-food-total-row"><td>Tổng cộng</td><td>{number(tableTotals.added)}</td><td>{number(tableTotals.activated)}</td><td>{number(tableTotals.hidden)}</td><td>{number(tableTotals.approved)}</td><td>{number(tableTotals.rejected)}</td></tr>}
        </tbody></table></div>
        <footer className="aa-pagination"><span>Hiển thị {visibleStart} – {visibleEnd} trong tổng số {filteredRows.length} ngày</span><div><button type="button" aria-label="Trang trước" disabled={currentPage <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="bi bi-chevron-left" /></button><button type="button" className="current" disabled={loading}>{currentPage}</button><button type="button" aria-label="Trang sau" disabled={currentPage >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><i className="bi bi-chevron-right" /></button></div></footer>
      </section>
    </section>
  )
}
