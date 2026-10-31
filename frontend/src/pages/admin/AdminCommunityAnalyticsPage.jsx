import { useEffect, useMemo, useState } from 'react'
import {
  calendarMonthRange,
  calendarMonthWeeks,
  calendarWeekRange,
  formatShortChartDate,
  getAnalyticsChartPeriod,
  MonthCalendarPicker,
  MonthWeekPicker,
} from './AnalyticsChartPeriod'
import { COMMUNITY_POSTS_STORAGE_KEY, getCommunityPostsSnapshot } from './communityPostStore'
import './AdminCommunityAnalyticsPage.css'

const STATUS_DEFINITIONS = [
  { key: 'approved', label: 'Đã duyệt', status: 'Đã duyệt', color: '#11a878' },
  { key: 'hidden', label: 'Đã ẩn', status: 'Đã ẩn', color: '#3c98f5' },
  { key: 'pending', label: 'Chờ duyệt', status: 'Chờ duyệt', color: '#ff941f' },
  { key: 'reported', label: 'Bị báo cáo', color: '#f28b27' },
  { key: 'rejected', label: 'Đã từ chối', status: 'Từ chối', color: '#f24d54' },
]

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

function getPostDate(post) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(post.createdAt))
}

function isReportedPost(post) {
  return Number(post.reports || 0) > 0 || post.status === 'Cần xem xét' || post.status === 'Bị báo cáo'
}

function summarizePosts(posts, date = '') {
  const visibleEngagement = posts.filter((post) => post.status !== 'Chờ duyệt')
  return {
    date,
    posts: posts.length,
    likes: visibleEngagement.reduce((sum, post) => sum + Number(post.likes || 0), 0),
    comments: visibleEngagement.reduce((sum, post) => sum + Number(post.comments || 0), 0),
    reportedPosts: posts.filter(isReportedPost).length,
    reportCount: posts.reduce((sum, post) => sum + Number(post.reports || 0), 0),
  }
}

function previousPeriodRange(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousEnd.getDate() - duration + 1)
  return { startDate: toLocalInputDate(previousStart), endDate: toLocalInputDate(previousEnd) }
}

function periodChange(current, previous) {
  if (!previous) return current ? { label: 'Mới phát sinh', positive: true, compare: false } : { label: '0%', positive: true, compare: true }
  const change = Math.round((current - previous) * 100 / previous)
  return { label: `${change > 0 ? '+' : ''}${change}%`, positive: change >= 0, compare: true }
}

function TrendChart({ rows, period }) {
  const maxValue = Math.max(0, ...rows.map((row) => Math.max(row.posts, row.reportedPosts)))
  const step = Math.max(1, Math.ceil(maxValue / 5))
  const maximum = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = Array.from({ length: 6 }, (_, index) => maximum - index * maximum / 5)
  const isMonthly = period === 'Theo tháng'

  return <div className="ac-trend-chart" role="img" aria-label={`Bài đăng Community theo ${isMonthly ? 'tuần' : 'ngày trong tuần'}`}>
    <div className="ac-chart-axis">{ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
    <div className="ac-chart-plot" style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}>
      {rows.map((row, index) => <div className="ac-chart-column" key={row.date || `${row.startDate}-${index}`}>
        <div className="ac-chart-bars">
          <span className="posts" style={{ height: `${row.posts ? Math.max(row.posts / maximum * 100, 2) : 0}%` }} title={`${number(row.posts)} bài đăng mới`}><b>{row.posts ? number(row.posts) : ''}</b></span>
          <span className="reports" style={{ height: `${row.reportedPosts ? Math.max(row.reportedPosts / maximum * 100, 3) : 0}%` }} title={`${number(row.reportedPosts)} bài bị báo cáo`}><b>{row.reportedPosts ? number(row.reportedPosts) : ''}</b></span>
        </div>
        <small>{isMonthly
          ? <><b>Tuần {row.weekNumber}</b><em>{formatShortChartDate(row.startDate)} – {formatShortChartDate(row.endDate)}</em></>
          : formatShortChartDate(row.date)}</small>
      </div>)}
    </div>
  </div>
}

function StatusDonut({ statuses, total }) {
  let currentDegree = 0
  const segments = statuses.filter((status) => status.value > 0).map((status) => {
    const startDegree = currentDegree
    currentDegree += status.value / Math.max(total, 1) * 360
    return `${status.color} ${startDegree}deg ${currentDegree}deg`
  })

  return <div className="aa-donut ac-donut" style={{ background: total ? `conic-gradient(${segments.join(', ')})` : '#e5edf3' }}>
    <div><strong>{number(total)}</strong><span>Tổng bài đăng</span></div>
  </div>
}

export default function AdminCommunityAnalyticsPage({ onNavigate }) {
  const today = toLocalInputDate(new Date())
  const initialWeek = calendarWeekRange(today)
  const [period, setPeriod] = useState('Theo tuần')
  const [startDate, setStartDate] = useState(initialWeek.startDate)
  const [endDate, setEndDate] = useState(initialWeek.endDate)
  const [monthSelection, setMonthSelection] = useState(today.slice(0, 7))
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showPeriodWeekPicker, setShowPeriodWeekPicker] = useState(false)
  const [posts, setPosts] = useState(getCommunityPostsSnapshot)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    function refreshPosts(event) {
      if (!event.key || event.key === COMMUNITY_POSTS_STORAGE_KEY) setPosts(getCommunityPostsSnapshot())
    }
    window.addEventListener('storage', refreshPosts)
    return () => window.removeEventListener('storage', refreshPosts)
  }, [])

  const dailyRows = useMemo(() => {
    const postsByDate = new Map()
    posts.forEach((post) => {
      const postDate = getPostDate(post)
      if (postDate < startDate || postDate > endDate) return
      const datePosts = postsByDate.get(postDate) || []
      datePosts.push(post)
      postsByDate.set(postDate, datePosts)
    })

    const rows = []
    const cursor = new Date(`${startDate}T12:00:00`)
    const lastDay = new Date(`${endDate}T12:00:00`)
    for (; cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
      const date = toLocalInputDate(cursor)
      rows.push(summarizePosts(postsByDate.get(date) || [], date))
    }
    return rows
  }, [posts, startDate, endDate])

  const chartPeriod = useMemo(() => getAnalyticsChartPeriod(dailyRows, {
    sumKeys: ['posts', 'likes', 'comments', 'reportedPosts', 'reportCount'],
  }), [dailyRows])
  const tableRows = period === 'Theo tháng' ? chartPeriod.rowsToDisplay : dailyRows
  const currentMetrics = summarizePosts(posts.filter((post) => {
    const postDate = getPostDate(post)
    return postDate >= startDate && postDate <= endDate
  }))
  const previousRange = previousPeriodRange(startDate, endDate)
  const previousMetrics = summarizePosts(posts.filter((post) => {
    const postDate = getPostDate(post)
    return postDate >= previousRange.startDate && postDate <= previousRange.endDate
  }))
  const statusTotals = STATUS_DEFINITIONS.map((definition) => ({
    ...definition,
    value: posts.filter((post) => definition.key === 'reported'
      ? isReportedPost(post)
      : !isReportedPost(post) && post.status === definition.status).length,
  }))
  const totalPosts = posts.length
  const maxInteraction = Math.max(currentMetrics.likes, currentMetrics.comments, currentMetrics.reportCount, 1)
  const interactions = [
    { label: 'Lượt thích', value: currentMetrics.likes, tone: 'green' },
    { label: 'Bình luận', value: currentMetrics.comments, tone: 'blue' },
    { label: 'Lượt báo cáo', value: currentMetrics.reportCount, tone: 'orange' },
  ]
  const metrics = [
    { label: 'Bài đăng mới', value: currentMetrics.posts, key: 'posts', icon: 'bi-file-earmark-text-fill', tone: 'green' },
    { label: 'Lượt thích', value: currentMetrics.likes, key: 'likes', icon: 'bi-heart-fill', tone: 'mint' },
    { label: 'Bình luận', value: currentMetrics.comments, key: 'comments', icon: 'bi-chat-dots-fill', tone: 'blue' },
    { label: 'Bài đăng bị báo cáo', value: currentMetrics.reportedPosts, key: 'reportedPosts', icon: 'bi-exclamation-triangle-fill', tone: 'orange' },
  ].map((metric) => ({ ...metric, change: periodChange(metric.value, previousMetrics[metric.key]) }))

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi')
    if (!normalizedSearch) return tableRows
    return tableRows.filter((row) => {
      const label = period === 'Theo tháng'
        ? `Tuần ${row.weekNumber} ${formatInputDate(row.startDate)} ${formatInputDate(row.endDate)}`
        : formatInputDate(row.date)
      return `${label} ${row.date || ''}`.toLocaleLowerCase('vi').includes(normalizedSearch)
    })
  }, [tableRows, search, period])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 7))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * 7, currentPage * 7)
  const tableTotals = filteredRows.reduce((totals, row) => ({
    posts: totals.posts + row.posts,
    likes: totals.likes + row.likes,
    comments: totals.comments + row.comments,
    reports: totals.reports + row.reportedPosts,
  }), { posts: 0, likes: 0, comments: 0, reports: 0 })
  const visibleStart = filteredRows.length ? (currentPage - 1) * 7 + 1 : 0
  const visibleEnd = Math.min(currentPage * 7, filteredRows.length)

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
    setSearch('')
  }

  function applyMonthSelection() {
    if (!monthSelection) return
    const range = calendarMonthRange(monthSelection)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setPeriod('Theo tháng')
    setShowMonthPicker(false)
    setShowPeriodWeekPicker(false)
    setPage(1)
    setSearch('')
  }

  return <section className="admin-analytics aa-community-analytics">
    <nav className="aa-category-nav ac-category-nav" aria-label="Thống kê theo mục">
      <div className="aa-category-title"><strong>Thống kê theo mục</strong></div>
      <div className="aa-category-tabs">
        <button type="button" onClick={() => onNavigate?.('Báo cáo')}><i className="bi bi-people-fill" />Người dùng</button>
        <button type="button" onClick={() => onNavigate?.('Món ăn')}><i className="bi bi-egg-fried" />Món ăn</button>
        <button type="button" onClick={() => onNavigate?.('Bài tập')}><i className="bi bi-person-walking" />Bài tập</button>
        <button type="button" className="active" aria-current="page"><i className="bi bi-chat-square-heart" />Community</button>
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

    <section className="aa-metrics ac-metrics" aria-label="Chỉ số Community trong kỳ">
      {metrics.map((metric) => <article className="aa-metric ac-metric-card" key={metric.label}>
        <span className={`ac-metric-icon ${metric.tone}`}><i className={`bi ${metric.icon}`} /></span>
        <div className="ac-metric-copy"><small>{metric.label}</small><strong>{number(metric.value)}</strong><span className={`aa-growth ${metric.change.positive ? 'positive' : 'negative'}`}><i className={`bi bi-arrow-${metric.change.positive ? 'up' : 'down'}-short`} />{metric.change.label}</span>{metric.change.compare && <small className="aa-caption ac-metric-caption">So với kỳ trước</small>}</div>
      </article>)}
    </section>

    <section className="aa-chart-grid ac-charts-grid" aria-label="Biểu đồ Community">
      <article className="aa-panel ac-panel aa-trend-panel ac-trend-panel">
        <div className="aa-panel-heading ac-panel-heading"><h2><i className="bi bi-bar-chart-fill" />Bài đăng Community theo thời gian</h2><div className="aa-legend ac-legend"><span><i className="posts" />Bài đăng mới</span><span><i className="reports" />Bài đăng bị báo cáo</span></div></div>
        <TrendChart rows={chartPeriod.rowsToDisplay} period={period} />
      </article>
      <article className="aa-panel ac-panel ac-status-panel">
        <div className="aa-panel-heading ac-panel-heading"><h2><i className="bi bi-pie-chart-fill" />Trạng thái bài đăng</h2></div>
        <div className="ac-status-content"><StatusDonut statuses={statusTotals} total={totalPosts} /><div className="ac-status-legend">{statusTotals.map((status) => <span key={status.key}><i style={{ background: status.color }} /><span>{status.label}</span><small>{number(status.value)} ({(status.value * 100 / Math.max(totalPosts, 1)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)</small></span>)}</div></div>
      </article>
      <article className="aa-panel ac-panel ac-interactions-panel">
        <div className="aa-panel-heading ac-panel-heading"><h2><i className="bi bi-chat-left-dots-fill" />Tương tác Community</h2></div>
        <div className="ac-interaction-list">{interactions.map((interaction) => <div className="ac-interaction-row" key={interaction.label}><span>{interaction.label}</span><div className="ac-interaction-track"><i className={interaction.tone} style={{ width: `${interaction.value ? Math.max(interaction.value / maxInteraction * 100, 2) : 0}%` }} /></div><strong>{number(interaction.value)}</strong></div>)}</div>
      </article>
    </section>

    <section className="aa-panel ac-panel ac-details-panel">
      <div className="ac-details-heading"><div className="aa-panel-heading"><h2><i className="bi bi-list-columns-reverse" />Thống kê chi tiết theo thời gian</h2><p>Dữ liệu từ {formatInputDate(startDate)} đến {formatInputDate(endDate)} · Đồng bộ từ trang kiểm duyệt Community.</p></div><label className="ac-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={`Tìm theo ${period === 'Theo tuần' ? 'ngày' : 'tuần'}...`} /></label></div>
      <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>{period === 'Theo tuần' ? 'Ngày' : 'Tuần'}</th><th>Bài đăng mới</th><th>Lượt thích</th><th>Bình luận</th><th>Bài đăng bị báo cáo</th></tr></thead><tbody>
        {pageRows.length ? pageRows.map((row, index) => <tr key={row.date || `${row.startDate}-${index}`}><td>{period === 'Theo tháng' ? `Tuần ${row.weekNumber} (${formatShortChartDate(row.startDate)} – ${formatShortChartDate(row.endDate)})` : formatInputDate(row.date)}</td><td>{number(row.posts)}</td><td>{number(row.likes)}</td><td>{number(row.comments)}</td><td>{number(row.reportedPosts)}</td></tr>) : <tr><td colSpan="5" className="ac-empty-row">Không có dữ liệu trong khoảng thời gian đã chọn.</td></tr>}
        {filteredRows.length > 0 && <tr className="ac-total-row"><td>Tổng cộng</td><td>{number(tableTotals.posts)}</td><td>{number(tableTotals.likes)}</td><td>{number(tableTotals.comments)}</td><td>{number(tableTotals.reports)}</td></tr>}
      </tbody></table></div>
      <div className="ac-table-footer"><span>Hiển thị {visibleStart} – {visibleEnd} trong tổng số {filteredRows.length} {period === 'Theo tuần' ? 'ngày' : 'tuần'}</span><div><button type="button" disabled={currentPage <= 1} aria-label="Trang trước" onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="bi bi-chevron-left" /></button><span>{currentPage}</span><button type="button" disabled={currentPage >= totalPages} aria-label="Trang sau" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><i className="bi bi-chevron-right" /></button></div></div>
    </section>
  </section>
}
