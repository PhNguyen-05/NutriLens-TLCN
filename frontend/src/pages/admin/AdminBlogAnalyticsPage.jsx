import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { calendarMonthRange, calendarMonthWeeks, calendarWeekRange, formatShortChartDate, getAnalyticsChartPeriod, MonthCalendarPicker, MonthWeekPicker } from './AnalyticsChartPeriod'

const CATEGORY_COLORS = ['#12a77b', '#378df1', '#13b7a5', '#ff9d29', '#9a69ef', '#e65aa8']

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
  return { text: `${change > 0 ? '+' : ''}${number(change, 1)}%`, positive: change >= 0 }
}

function blogChartAxis(maxValue) {
  if (!maxValue) return { maximum: 1, ticks: [1, 0] }

  const rawStep = maxValue / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const step = Math.max(1, (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude)
  const intervals = Math.ceil(maxValue / step)
  const maximum = intervals * step

  return { maximum, ticks: Array.from({ length: intervals + 1 }, (_, index) => maximum - index * step) }
}

function blogImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

function BlogPublishingChart({ rows, mode }) {
  const isWeekly = mode === 'month'
  const maxValue = Math.max(0, ...rows.flatMap((row) => [row.published, row.drafted]))
  const axis = blogChartAxis(maxValue)
  const labelIndices = new Set(rows.map((_, index) => index))
  const axisLabelWidth = Math.max(34, number(axis.maximum).length * 8 + 8)
  const gridBottom = isWeekly ? 30 : 18
  const plotHeight = isWeekly ? 140 : 137
  return <div className={`aa-blog-bars-chart ${isWeekly ? 'is-weekly' : ''}`} style={{ gridTemplateColumns: `${axisLabelWidth}px minmax(0, 1fr)` }} role="img" aria-label={`Số bài viết được xuất bản và chuyển thành bản nháp theo ${isWeekly ? 'tuần' : 'ngày'}`}>
    <div className="aa-blog-chart-axis">{axis.ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
    <div className="aa-blog-chart-plot" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}><div className="aa-blog-chart-grid-lines">{axis.ticks.map((tick) => <i key={tick} style={{ bottom: `calc(${gridBottom}px + ${tick / axis.maximum * plotHeight}px)` }} />)}</div>{rows.map((row, index) => <div className="aa-blog-chart-day" key={row.date} title={`${isWeekly ? `Tuần ${row.weekNumber} (${formatInputDate(row.startDate)} - ${formatInputDate(row.endDate)})` : formatInputDate(row.date)} · Xuất bản ${row.published} · Bản nháp ${row.drafted}`}>
      <div className={`aa-blog-bar-group ${isWeekly ? 'is-weekly' : ''}`}>
        {[{ key: 'published', value: row.published }, { key: 'drafted', value: row.drafted }].map(({ key, value }) => {
          const barHeight = `${value / axis.maximum * 100}%`
          return <div className="aa-blog-bar-item" key={key} style={{ '--blog-bar-height': barHeight }}>
            {value > 0 && <b className={key}>{number(value)}</b>}
            <i className={key} style={{ height: barHeight }} />
          </div>
        })}
      </div>
      {labelIndices.has(index) && <span>{isWeekly ? <><b>Tuần {row.weekNumber}</b><small>{formatShortChartDate(row.startDate)} - {formatShortChartDate(row.endDate)}</small></> : formatShortChartDate(row.date)}</span>}
    </div>)}</div>
  </div>
}

function BlogCategoryDonut({ categories, total }) {
  let angle = 0
  const slices = categories.filter((category) => category.count > 0).map((category, index) => {
    const start = angle
    angle += category.count / Math.max(total, 1) * 360
    return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}deg ${angle}deg`
  })
  return <div className="aa-blog-donut" style={{ background: total ? `conic-gradient(${slices.join(', ')})` : '#e7f1f7' }}>
    <div><strong>{number(total)}</strong><span>Tổng bài viết</span></div>
  </div>
}

function statusForDay(row) {
  if (row.published > 0) return { label: 'Đã đăng', status: 'published' }
  if (row.created > 0 || row.drafted > 0) return { label: 'Bản nháp', status: 'draft' }
  if (row.views > 0 || row.interactions > 0) return { label: 'Có tương tác', status: 'activity' }
  return { label: 'Không hoạt động', status: 'inactive' }
}

export default function AdminBlogAnalyticsPage({ onNavigate }) {
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
  const [summary, setSummary] = useState({ total: 0, published: 0, drafts: 0, hidden: 0, views: 0, likes: 0 })
  const [categories, setCategories] = useState([])
  const [topPosts, setTopPosts] = useState([])
  const [dailyData, setDailyData] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axiosInstance.get('/admin/blog/analytics', {
          params: { from: startDate, to: endDate },
          signal: controller.signal,
        })
        setSummary({ total: 0, published: 0, drafts: 0, hidden: 0, views: 0, likes: 0, ...(data.summary || {}) })
        setCategories(data.categories || [])
        setTopPosts(data.topPosts || [])
        setDailyData(data.daily || [])
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') setError(requestError.response?.data?.message || 'Không thể tải thống kê bài viết.')
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
      rows.push({ date, created: 0, published: 0, drafted: 0, views: 0, interactions: 0, ...(byDate.get(date) || {}) })
    }
    return rows
  }, [dailyData, endDate, startDate])
  const chartPeriod = getAnalyticsChartPeriod(dailyRows, { sumKeys: ['published', 'drafted'] })

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? dailyRows.filter((row) => formatInputDate(row.date).includes(query) || row.date.includes(query)) : dailyRows
  }, [dailyRows, search])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 7))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * 7, currentPage * 7)
  const totals = filteredRows.reduce((result, row) => ({
    created: result.created + row.created,
    published: result.published + row.published,
    drafted: result.drafted + row.drafted,
    views: result.views + row.views,
    interactions: result.interactions + row.interactions,
  }), { created: 0, published: 0, drafted: 0, views: 0, interactions: 0 })
  const categoryMax = Math.max(1, ...categories.map((category) => category.count))
  const visibleStart = filteredRows.length ? (currentPage - 1) * 7 + 1 : 0
  const visibleEnd = Math.min(currentPage * 7, filteredRows.length)
  const viewsChange = periodChange(summary.viewsInPeriod, summary.previous?.views)

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

  return <section className="admin-analytics aa-blog-analytics">
    <nav className="aa-category-nav" aria-label="Thống kê theo mục">
      <div className="aa-category-title"><strong>Thống kê theo mục</strong></div>
      <div className="aa-category-tabs">
        <button type="button" onClick={() => onNavigate?.('Báo cáo')}><i className="bi bi-people-fill" />Người dùng</button>
        <button type="button" onClick={() => onNavigate?.('Món ăn')}><i className="bi bi-egg-fried" />Món ăn</button>
        <button type="button" onClick={() => onNavigate?.('Bài tập')}><i className="bi bi-person-walking" />Bài tập</button>
        <button type="button" onClick={() => onNavigate?.('Community')}><i className="bi bi-chat-square-heart" />Community</button>
        <button type="button" className="active" aria-current="page"><i className="bi bi-file-earmark-text" />Blog</button>
      </div>
    </nav>

    <div className="aa-toolbar"><div className="aa-date-tools">
      <div className="aa-week-filter">
        <button type="button" className={period === 'Theo tuần' || showPeriodWeekPicker ? 'active' : ''} aria-expanded={showPeriodWeekPicker} onClick={openWeekPicker}>Theo tuần</button>
        {showPeriodWeekPicker && <MonthWeekPicker month={monthSelection} weeks={calendarMonthWeeks(monthSelection)} selectedStartDate={startDate} selectedEndDate={endDate} onSelectWeek={selectCalendarWeek} />}
      </div>
      <button type="button" className={period === 'Theo tháng' ? 'active' : ''} aria-expanded={showMonthPicker} onClick={openMonthPicker}>Theo tháng</button>
      {showMonthPicker && <MonthCalendarPicker value={monthSelection} onChange={setMonthSelection} onApply={applyMonthSelection} />}
    </div></div>

    <section className="aa-metrics aa-blog-metrics" aria-label="Tổng quan bài viết Blog">
      <article className="aa-metric"><span className="aa-metric-icon blue"><i className="bi bi-file-earmark-text-fill" /></span><div><small>Tổng số bài viết Blog</small><strong>{number(summary.total)}</strong><span className="aa-growth"><i className="bi bi-journal-richtext" />Bài viết hiện có</span><small className="aa-caption">Không tính bài đã xóa</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon green"><i className="bi bi-check-circle-fill" /></span><div><small>Đã xuất bản</small><strong>{number(summary.published)}</strong><span className="aa-growth"><i className="bi bi-broadcast" />Đang công khai</span><small className="aa-caption">Bài viết hiện được đăng</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon mint"><i className="bi bi-file-earmark-minus-fill" /></span><div><small>Bản nháp</small><strong>{number(summary.drafts)}</strong><span className="aa-growth"><i className="bi bi-pencil-square" />Đang chỉnh sửa</span><small className="aa-caption">Bài viết chưa xuất bản</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon orange"><i className="bi bi-eye-slash-fill" /></span><div><small>Đã ẩn</small><strong>{number(summary.hidden)}</strong><span className="aa-growth aa-blog-hidden"><i className="bi bi-eye-slash" />Bài viết đang ẩn</span><small className="aa-caption">Không hiển thị công khai</small></div></article>
      <article className="aa-metric"><span className="aa-metric-icon blue"><i className="bi bi-eye-fill" /></span><div><small>Lượt xem bài viết</small><strong>{number(summary.views)}</strong><span className={`aa-growth ${viewsChange.positive ? '' : 'aa-blog-negative'}`}><i className={`bi ${viewsChange.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`} />{viewsChange.text}</span><small className="aa-caption">Lượt xem trong kỳ so với kỳ trước</small></div></article>
    </section>

    <section className="aa-blog-chart-grid">
      <article className="aa-panel aa-blog-publishing-panel">
        <div className="aa-panel-heading aa-period-chart-heading"><h2><i className="bi bi-person-lines-fill" />Số lượng bài viết Blog theo thời gian</h2><div className="aa-legend"><span><i className="aa-blog-published-legend" />Bài viết đã xuất bản</span><span><i className="aa-blog-draft-legend" />Chuyển thành bản nháp</span></div></div>
        {loading ? <div className="aa-food-chart-state"><span className="user-spinner" />Đang tải thống kê...</div> : error ? <div className="aa-food-chart-state aa-error">{error}</div> : <BlogPublishingChart rows={chartPeriod.rowsToDisplay} mode={chartPeriod.mode} />}
      </article>
      <article className="aa-panel aa-blog-category-panel">
        <div className="aa-panel-heading"><h2><i className="bi bi-journal-check" />Phân bố bài viết theo chuyên mục</h2></div>
        <div className="aa-blog-category-content"><BlogCategoryDonut categories={categories} total={summary.total} /><div className="aa-blog-category-legend">{categories.slice(0, 6).map((category, index) => <span key={category.name}><i style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />{category.name}<b>{percent(category.count, summary.total)} ({number(category.count)})</b></span>)}</div></div>
      </article>
      <article className="aa-panel aa-blog-top-panel">
        <div className="aa-panel-heading"><h2><i className="bi bi-bookmark-star" />Top 5 bài viết được xem nhiều nhất</h2></div>
        {loading ? <div className="aa-blog-top-state"><span className="user-spinner" />Đang tải bài viết...</div> : error ? <div className="aa-blog-top-state aa-error">{error}</div> : <div className="aa-blog-top-list">{topPosts.map((post, index) => <div className="aa-blog-top-row" key={post.id}>
          <div className="aa-blog-top-thumb">{post.imageUrl ? <img src={blogImageUrl(post.imageUrl)} alt="" loading="lazy" /> : <i className="bi bi-card-image" />}</div>
          <div className="aa-blog-top-info"><strong title={post.title}>{post.title}</strong><div><i style={{ width: `${Math.max(post.views / Math.max(topPosts[0]?.views || 1, 1) * 100, post.views ? 4 : 0)}%` }} /></div></div>
          <span className="aa-blog-top-views"><i className="bi bi-eye" />{number(post.views)}</span>
          <span className="aa-blog-top-rank">{index + 1}</span>
        </div>)}{!topPosts.length && <div className="aa-blog-top-state">Chưa có bài viết được xuất bản.</div>}</div>}
      </article>
    </section>

    <section className="aa-panel aa-blog-daily-panel">
      <div className="aa-blog-daily-heading"><div className="aa-panel-heading"><h2><i className="bi bi-calendar3" />Thống kê chi tiết theo thời gian</h2><p>Lượt xem và lượt thích theo ngày được ghi nhận từ khi bật thống kê.</p></div><label className="aa-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo ngày..." /></label></div>
      <div className="aa-table-wrap"><table className="aa-table aa-blog-table"><thead><tr><th>Ngày</th><th>Bài viết mới</th><th>Xuất bản</th><th>Chuyển nháp</th><th>Lượt xem</th><th>Lượt thích</th><th>Trạng thái</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7" className="aa-table-message"><span className="user-spinner" />Đang tải thống kê...</td></tr> : error ? <tr><td colSpan="7" className="aa-table-message aa-error">{error}</td></tr> : pageRows.length ? pageRows.map((row) => { const status = statusForDay(row); return <tr key={row.date}><td>{formatInputDate(row.date)}</td><td>{number(row.created)}</td><td>{number(row.published)}</td><td>{number(row.drafted)}</td><td>{number(row.views)}</td><td>{number(row.interactions)}</td><td><span className={`aa-blog-status ${status.status}`}>{status.label}</span></td></tr> }) : <tr><td colSpan="7" className="aa-table-message">Không có dữ liệu trong khoảng ngày đã chọn.</td></tr>}
        {!loading && !error && filteredRows.length > 0 && <tr className="aa-food-total-row"><td>Tổng cộng</td><td>{number(totals.created)}</td><td>{number(totals.published)}</td><td>{number(totals.drafted)}</td><td>{number(totals.views)}</td><td>{number(totals.interactions)}</td><td>—</td></tr>}
      </tbody></table></div>
      <footer className="aa-pagination"><span>Hiển thị {visibleStart} – {visibleEnd} trong tổng số {filteredRows.length} ngày</span><div><button type="button" aria-label="Trang trước" disabled={currentPage <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="bi bi-chevron-left" /></button><button type="button" className="current" disabled={loading}>{currentPage}</button><button type="button" aria-label="Trang sau" disabled={currentPage >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><i className="bi bi-chevron-right" /></button></div></footer>
    </section>
  </section>
}
