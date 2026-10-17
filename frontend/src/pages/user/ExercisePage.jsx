import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import FoodNavMenu from '../../components/common/FoodNavMenu'
import ExerciseNavMenu from '../../components/common/ExerciseNavMenu'

const CATEGORY_TABS = [
  { id: 'all',         label: 'Tất cả',          icon: 'bi-grid' },
  { id: 'cardio',      label: 'Cardio',           icon: 'bi-lightning-charge' },
  { id: 'strength',    label: 'Sức mạnh',         icon: 'bi-trophy' },
  { id: 'flexibility', label: 'Yoga & Thư giãn',  icon: 'bi-flower1' },
  { id: 'sports',      label: 'Thể thao',         icon: 'bi-dribbble' },
]

const INTENSITY_CHIP = {
  'Nhẹ':       { cls: 'ex-chip--low',    icon: 'bi-circle-fill' },
  'Trung bình':{ cls: 'ex-chip--mid',    icon: 'bi-circle-fill' },
  'Cao':       { cls: 'ex-chip--high',   icon: 'bi-circle-fill' },
}

function getTodayStr() {
  return new Date().toLocaleDateString('sv-SE')
}

function getTimeStr() {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(`${dateStr}T12:00:00`))
  } catch { return dateStr }
}

function calcCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes || minutes <= 0) return 0
  return Math.round((met * 3.5 * weightKg * minutes) / 200)
}

export default function ExercisePage() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.fullName?.split(' ')[0] || 'bạn'
  const [profileOpen, setProfileOpen] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'catalog'

  // Tab chính
  const [activeTab, setActiveTab] = useState(initialTab) // 'catalog' | 'history'

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history' || tabParam === 'catalog') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  function switchTab(tab) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  // Dữ liệu
  const [exercises,       setExercises]       = useState([])
  const [loadingEx,       setLoadingEx]        = useState(true)
  const [logs,            setLogs]             = useState([])
  const [loadingLogs,     setLoadingLogs]      = useState(false)
  const [userWeight,      setUserWeight]       = useState(null)
  const [todayStats,      setTodayStats]       = useState({ calories: 0, minutes: 0, count: 0 })
  const [toastMsg,        setToastMsg]         = useState(null)

  // Bộ lọc Catalog
  const [searchQ,         setSearchQ]          = useState('')
  const [catFilter,       setCatFilter]        = useState('all')

  // Bộ lọc History
  const [period,          setPeriod]           = useState('7d')
  const [customStart,     setCustomStart]      = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toLocaleDateString('sv-SE')
  })
  const [customEnd,       setCustomEnd]        = useState(getTodayStr)
  const [histCat,         setHistCat]          = useState('all')

  // Modal Ghi nhận
  const [logging,         setLogging]          = useState(null)  // exercise object
  const [logForm,         setLogForm]          = useState({ duration: 30, date: getTodayStr(), time: getTimeStr(), notes: '' })
  const [logCalories,     setLogCalories]      = useState(0)
  const [logErr,          setLogErr]           = useState('')
  const [saving,          setSaving]           = useState(false)

  // Modal Chi tiết
  const [detailLog,       setDetailLog]        = useState(null)

  // Modal Sửa
  const [editing,         setEditing]          = useState(null)
  const [editForm,        setEditForm]         = useState({ exerciseId: '', duration: 30, date: '', time: '', notes: '' })
  const [editCalories,    setEditCalories]     = useState(0)
  const [editErr,         setEditErr]          = useState('')
  const [savingEdit,      setSavingEdit]       = useState(false)

  // Modal Xóa
  const [deleting,        setDeleting]         = useState(null)
  const [isDeleting,      setIsDeleting]       = useState(false)

  // ─── Data loaders ──────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (alive) setUserWeight(data.profile?.currentWeightKg || null) })
      .catch(() => {})

    setLoadingEx(true)
    axiosInstance.get('/exercises')
      .then(({ data }) => { if (alive) setExercises(data.exercises || []) })
      .catch(() => toast('error', 'Không thể tải danh mục bài tập'))
      .finally(() => { if (alive) setLoadingEx(false) })

    return () => { alive = false }
  }, [])

  const fetchTodayStats = async () => {
    try {
      const { data } = await axiosInstance.get('/exercises/logs', { params: { date: getTodayStr() } })
      setTodayStats({
        calories: data.summary?.totalCalories || 0,
        minutes:  data.summary?.totalMinutes  || 0,
        count:    data.logs?.length           || 0,
      })
    } catch (_) {}
  }

  useEffect(() => { fetchTodayStats() }, [])

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const params = {}
      const today = getTodayStr()
      if (histCat !== 'all') params.category = histCat
      if      (period === 'today') { params.date = today }
      else if (period === '7d')    { const d = new Date(); d.setDate(d.getDate()-6); params.startDate = d.toLocaleDateString('sv-SE'); params.endDate = today }
      else if (period === '30d')   { const d = new Date(); d.setDate(d.getDate()-29); params.startDate = d.toLocaleDateString('sv-SE'); params.endDate = today }
      else if (period === 'custom'){ if (customStart) params.startDate = customStart; if (customEnd) params.endDate = customEnd }
      const { data } = await axiosInstance.get('/exercises/logs', { params })
      setLogs(data.logs || [])
      if (data.currentWeightKg && !userWeight) setUserWeight(data.currentWeightKg)
    } catch (_) {
      toast('error', 'Không thể tải lịch sử tập luyện')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => { fetchLogs() }, [period, customStart, customEnd, histCat])

  function toast(type, text) {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(p => p?.text === text ? null : p), 4000)
  }

  // ─── Catalog ───────────────────────────────────────────────────────────────

  const filteredEx = useMemo(() => exercises.filter(e => {
    const inCat = catFilter === 'all' || e.category === catFilter
    const q = searchQ.toLowerCase().trim()
    const inQ = !q || e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)
    return inCat && inQ
  }), [exercises, catFilter, searchQ])

  function openLog(exercise) {
    setLogging(exercise)
    setLogErr('')
    const dur = exercise.defaultDurationMinutes || 30
    setLogForm({ duration: dur, date: getTodayStr(), time: getTimeStr(), notes: '' })
    setLogCalories(userWeight ? calcCalories(exercise.met, userWeight, dur) : 0)
  }

  function onDurationChange(val) {
    const d = Number(val)
    setLogForm(p => ({ ...p, duration: val }))
    setLogErr('')
    if (!val || d <= 0) { setLogErr('Thời lượng tập luyện phải lớn hơn 0'); setLogCalories(0); return }
    if (!userWeight) { setLogErr('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe'); setLogCalories(0); return }
    setLogCalories(calcCalories(logging?.met, userWeight, d))
  }

  async function saveLog() {
    const d = Number(logForm.duration)
    if (!d || d <= 0)  { setLogErr('Thời lượng tập luyện phải lớn hơn 0'); return }
    if (!userWeight)   { setLogErr('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe'); return }
    if (!logging?.met) { setLogErr('Bài tập chưa có dữ liệu tính calories'); return }
    setSaving(true); setLogErr('')
    try {
      const { data } = await axiosInstance.post('/exercises/logs', {
        exerciseId: logging._id, durationMinutes: d,
        date: logForm.date, time: logForm.time, notes: logForm.notes,
        customWeightKg: userWeight,
      })
      toast('success', data.message || 'Ghi nhận bài tập thành công')
      setLogging(null)
      fetchTodayStats(); fetchLogs()
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể lưu thông tin bài tập, vui lòng thử lại'
      setLogErr(msg); toast('error', msg)
    } finally { setSaving(false) }
  }

  // ─── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(log) {
    setEditing(log); setEditErr('')
    setEditForm({ exerciseId: log.exerciseId, duration: log.durationMinutes, date: log.date, time: log.time || '', notes: log.notes || '' })
    setEditCalories(calcCalories(log.met, log.weightKg, log.durationMinutes))
  }

  function onEditDuration(dur, exId = null) {
    const d = Number(dur)
    const eId = exId || editForm.exerciseId
    const ex = exercises.find(e => String(e._id) === String(eId))
    const met = ex ? ex.met : editing.met
    setEditForm(p => ({ ...p, duration: dur, exerciseId: eId }))
    setEditErr('')
    if (!d || d <= 0) { setEditErr('Thời lượng phải lớn hơn 0'); setEditCalories(0); return }
    setEditCalories(calcCalories(met, editing.weightKg, d))
  }

  async function saveEdit() {
    if (!Number(editForm.duration) || Number(editForm.duration) <= 0) { setEditErr('Thời lượng phải lớn hơn 0'); return }
    setSavingEdit(true); setEditErr('')
    try {
      const { data } = await axiosInstance.patch(`/exercises/logs/${editing._id}`, {
        exerciseId: editForm.exerciseId, durationMinutes: Number(editForm.duration),
        date: editForm.date, time: editForm.time, notes: editForm.notes,
      })
      toast('success', data.message || 'Cập nhật bài tập thành công')
      setEditing(null); fetchTodayStats(); fetchLogs()
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại'
      setEditErr(msg); toast('error', msg)
      if (e.response?.status === 404) { setEditing(null); fetchLogs() }
    } finally { setSavingEdit(false) }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const { data } = await axiosInstance.delete(`/exercises/logs/${deleting._id}`)
      toast('success', data.message || 'Xóa bài tập thành công')
      setDeleting(null); fetchTodayStats(); fetchLogs()
    } catch (e) {
      toast('error', e.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại')
      if (e.response?.status === 404) { setDeleting(null); fetchLogs() }
    } finally { setIsDeleting(false) }
  }

  const histSummary = useMemo(() => ({
    calories: logs.reduce((s, l) => s + (l.caloriesBurned || 0), 0),
    minutes:  logs.reduce((s, l) => s + (l.durationMinutes || 0), 0),
    sessions: logs.length,
  }), [logs])

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-shell foodscan-shell ex-shell">

      {/* Toast */}
      {toastMsg && (
        <div className={`ex-toast ex-toast--${toastMsg.type}`} role="alert">
          <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
          <span>{toastMsg.text}</span>
          <button type="button" onClick={() => setToastMsg(null)}><i className="bi bi-x" /></button>
        </div>
      )}

      {/* ── Header (đồng bộ với MealDiaryPage) ── */}
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard">
          <span><i className="bi bi-leaf-fill" /></span>NutriLens
        </Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <FoodNavMenu />
          <ExerciseNavMenu />
          <Link to="/weight-tracker">Chỉ số &amp; Xu hướng</Link>
          <Link to="/dashboard">Cộng đồng</Link>
          <Link to="/dashboard">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search">
            <i className="bi bi-search" />Tra cứu thực phẩm, món ăn...
          </span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo">
            <i className="bi bi-bell" />
          </button>
          <div className="profile-menu">
            <button
              className="dashboard-avatar"
              onClick={() => setProfileOpen(o => !o)}
              aria-expanded={profileOpen} aria-haspopup="menu"
              title="Mở menu tài khoản"
            >
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Avatar" /> : firstName.charAt(0).toUpperCase()}
            </button>
            {profileOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-name">Xin chào, {firstName}</div>
                <button className="profile-link" onClick={() => navigate('/profile')} role="menuitem">
                  <i className="bi bi-person-circle" /> Hồ sơ cá nhân
                </button>
                <button className="profile-link" onClick={() => navigate('/weight-tracker')} role="menuitem">
                  <i className="bi bi-activity" /> Tiến trình cân nặng
                </button>
                <button onClick={handleLogout} role="menuitem">
                  <i className="bi bi-box-arrow-right" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="ex-main">

        {/* ── Page heading (tối giản, hiện đại, không có nút dư thừa) ── */}
        <section className="fs-page-heading" style={{ marginBottom: 20 }}>
          <span className="fs-page-icon"><i className="bi bi-activity" /></span>
          <div>
            <h1>Luyện Tập &amp; Vận Động</h1>
            <p>Ghi nhận bài tập, ước tính lượng calories tiêu hao và theo dõi lịch sử rèn luyện thể chất.</p>
          </div>
        </section>

        {/* ── Cân nặng chưa thiết lập ── */}
        {(!userWeight || userWeight <= 0) && (
          <div className="ex-missing-weight-bar">
            <i className="bi bi-exclamation-circle-fill" />
            <p>
              Hệ thống cần thông tin <strong>cân nặng</strong> để ước tính lượng calories tiêu hao.
            </p>
            <Link to="/profile">Cập nhật hồ sơ sức khỏe →</Link>
          </div>
        )}

        {/* ── KPI hôm nay ── */}
        <section className="ex-kpi-row">
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--fire"><i className="bi bi-fire" /></div>
            <div>
              <span className="ex-kpi-label">Calories tiêu hao hôm nay</span>
              <strong className="ex-kpi-value">{todayStats.calories.toLocaleString('vi-VN')} <small>kcal</small></strong>
            </div>
          </article>
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--time"><i className="bi bi-stopwatch" /></div>
            <div>
              <span className="ex-kpi-label">Thời gian tập hôm nay</span>
              <strong className="ex-kpi-value">{todayStats.minutes} <small>phút</small></strong>
            </div>
          </article>
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--count"><i className="bi bi-activity" /></div>
            <div>
              <span className="ex-kpi-label">Số bài tập đã hoàn thành</span>
              <strong className="ex-kpi-value">{todayStats.count} <small>bài</small></strong>
            </div>
          </article>
          <article className="ex-kpi-card ex-kpi-card--weight">
            <div className="ex-kpi-icon ex-kpi-icon--weight"><i className="bi bi-person-badge" /></div>
            <div>
              <span className="ex-kpi-label">Cân nặng dùng tính calo</span>
              {userWeight
                ? <strong className="ex-kpi-value">{userWeight} <small>kg</small></strong>
                : <span className="ex-kpi-missing">Chưa thiết lập</span>
              }
            </div>
          </article>
        </section>

        {/* ── Tab nav ── */}
        <div className="ex-tab-nav" role="tablist">
          <button
            type="button" role="tab"
            className={`ex-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => switchTab('catalog')}
          >
            <i className="bi bi-journal-plus" /> Danh mục bài tập
          </button>
          <button
            type="button" role="tab"
            className={`ex-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => switchTab('history')}
          >
            <i className="bi bi-clock-history" /> Lịch sử tập luyện
            {logs.length > 0 && <span className="ex-tab-count">{logs.length}</span>}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 1: DANH MỤC BÀI TẬP
            ══════════════════════════════════════════════════ */}
        {activeTab === 'catalog' && (
          <section>
            {/* Toolbar */}
            <div className="ex-catalog-toolbar">
              <div className="ex-search-wrap">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm bài tập (vd: chạy bộ, yoga, đạp xe...)"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                {searchQ && (
                  <button type="button" className="ex-clear-btn" onClick={() => setSearchQ('')} aria-label="Xóa">
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>
              <div className="ex-cat-tabs" role="group">
                {CATEGORY_TABS.map(ct => (
                  <button
                    key={ct.id} type="button"
                    className={`ex-cat-tab ${catFilter === ct.id ? 'active' : ''}`}
                    onClick={() => setCatFilter(ct.id)}
                  >
                    <i className={`bi ${ct.icon}`} />{ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {loadingEx ? (
              <div className="ex-state-empty">
                <span className="fs-mini-spinner" />
                <p>Đang tải danh mục bài tập...</p>
              </div>
            ) : filteredEx.length === 0 ? (
              <div className="ex-state-empty">
                <i className="bi bi-search" />
                <strong>Không tìm thấy bài tập phù hợp</strong>
                <p>Thử từ khóa khác hoặc bỏ chọn bộ lọc để xem toàn bộ danh mục.</p>
                <button className="ex-btn ex-btn--outline" onClick={() => { setSearchQ(''); setCatFilter('all') }}>
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="ex-exercise-grid">
                {filteredEx.map(ex => {
                  const chip = INTENSITY_CHIP[ex.intensity] || INTENSITY_CHIP['Trung bình']
                  const est  = userWeight ? calcCalories(ex.met, userWeight, 30) : null
                  return (
                    <article key={ex._id} className="fd-panel ex-card">
                      <div className="ex-card-head">
                        <div className="ex-card-icon">
                          <i className={`bi ${ex.icon || 'bi-activity'}`} />
                        </div>
                        <div className="ex-card-badges">
                          <span className={`ex-chip ${chip.cls}`}>
                            <i className={`bi ${chip.icon}`} />{ex.intensity}
                          </span>
                          <span className="ex-chip ex-chip--met">MET {ex.met}</span>
                        </div>
                      </div>
                      <h3 className="ex-card-title">{ex.name}</h3>
                      <p className="ex-card-desc">{ex.description || ''}</p>
                      <div className="ex-card-foot">
                        {est != null ? (
                          <span className="ex-card-est"><i className="bi bi-fire" /> ~<strong>{est}</strong> kcal / 30 phút</span>
                        ) : (
                          <span className="ex-card-est ex-card-est--met"><i className="bi bi-lightning-charge" /> Tiêu chuẩn MET <strong>{ex.met}</strong></span>
                        )}
                        <button type="button" className="ex-btn ex-btn--primary" onClick={() => openLog(ex)}>
                          <i className="bi bi-plus-lg" /> Ghi nhận
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2: LỊCH SỬ TẬP LUYỆN
            ══════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <section>
            {/* Toolbar lịch sử */}
            <div className="ex-history-bar">
              <div className="ex-period-btns">
                {[
                  { id: 'today', label: 'Hôm nay' },
                  { id: '7d',    label: '7 ngày' },
                  { id: '30d',   label: '30 ngày' },
                  { id: 'all',   label: 'Tất cả' },
                  { id: 'custom',label: 'Tùy chọn' },
                ].map(p => (
                  <button key={p.id} type="button"
                    className={`ex-period-btn ${period === p.id ? 'active' : ''}`}
                    onClick={() => setPeriod(p.id)}
                  >{p.label}</button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="ex-date-range">
                  <label>
                    Từ&nbsp;<input type="date" value={customStart} max={getTodayStr()} onChange={e => setCustomStart(e.target.value)} />
                  </label>
                  <span>—</span>
                  <label>
                    Đến&nbsp;<input type="date" value={customEnd} max={getTodayStr()} onChange={e => setCustomEnd(e.target.value)} />
                  </label>
                </div>
              )}
              <select
                className="ex-cat-select"
                value={histCat}
                onChange={e => setHistCat(e.target.value)}
              >
                <option value="all">Tất cả nhóm</option>
                <option value="cardio">Cardio &amp; Vận động</option>
                <option value="strength">Sức mạnh &amp; Gym</option>
                <option value="flexibility">Yoga &amp; Thư giãn</option>
                <option value="sports">Thể thao</option>
              </select>
            </div>

            {/* Tổng kết kỳ lọc */}
            <div className="ex-summary-strip">
              <div className="ex-sum-item">
                <span>{histSummary.sessions}</span><small>Buổi tập</small>
              </div>
              <div className="ex-sum-sep" />
              <div className="ex-sum-item">
                <span>{histSummary.minutes}</span><small>Phút</small>
              </div>
              <div className="ex-sum-sep" />
              <div className="ex-sum-item ex-sum-item--hi">
                <span>{histSummary.calories.toLocaleString('vi-VN')}</span><small>kcal tiêu hao</small>
              </div>
            </div>

            {/* Danh sách */}
            {loadingLogs ? (
              <div className="ex-state-empty">
                <span className="fs-mini-spinner" />
                <p>Đang tải lịch sử tập luyện...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="ex-state-empty">
                <i className="bi bi-calendar-x" />
                <strong>Không tìm thấy dữ liệu phù hợp</strong>
                <p>Không có bản ghi nào trong khoảng thời gian hoặc điều kiện lọc này.</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="ex-btn ex-btn--outline" onClick={() => { setPeriod('all'); setHistCat('all') }}>
                    Xem tất cả
                  </button>
                  <button className="ex-btn ex-btn--primary" onClick={() => setActiveTab('catalog')}>
                    Thêm bài tập
                  </button>
                </div>
              </div>
            ) : (
              <div className="ex-log-list">
                {logs.map(log => (
                  <article key={log._id} className="fd-panel ex-log-row">
                    <div className="ex-log-left">
                      <div className="ex-log-icon"><i className="bi bi-lightning-fill" /></div>
                      <div className="ex-log-info">
                        <div className="ex-log-top">
                          <strong>{log.exerciseName}</strong>
                          <span className="ex-log-date">
                            <i className="bi bi-calendar3" /> {formatDateShort(log.date)}
                            {log.time && <>&nbsp;·&nbsp;{log.time}</>}
                          </span>
                        </div>
                        <div className="ex-log-chips">
                          <span className="ex-meta-chip"><i className="bi bi-stopwatch" /> {log.durationMinutes} phút</span>
                          <span className="ex-meta-chip">MET {log.met}</span>
                          <span className="ex-meta-chip"><i className="bi bi-person" /> {log.weightKg} kg</span>
                          {log.notes && <span className="ex-meta-note" title={log.notes}><i className="bi bi-chat-left-text" /> {log.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ex-log-right">
                      <div className="ex-log-burn">
                        <strong>−{log.caloriesBurned}</strong>
                        <small>kcal</small>
                      </div>
                      <div className="ex-log-actions">
                        <button type="button" className="ex-icon-btn" title="Xem chi tiết" onClick={() => setDetailLog(log)}>
                          <i className="bi bi-eye" />
                        </button>
                        <button type="button" className="ex-icon-btn" title="Chỉnh sửa" onClick={() => openEdit(log)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button type="button" className="ex-icon-btn ex-icon-btn--del" title="Xóa" onClick={() => setDeleting(log)}>
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ══════════════════════════════════════════════════
          MODAL: Ghi nhận bài tập
          ══════════════════════════════════════════════════ */}
      {logging && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog">
            <div className="ex-dialog-head">
              <div>
                <small>Ghi nhận bài tập</small>
                <h3>{logging.name}</h3>
              </div>
              <button type="button" className="ex-dialog-close" onClick={() => setLogging(null)} aria-label="Đóng">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="ex-dialog-body">
              {/* Info chips */}
              <div className="ex-info-chips">
                <span>MET: <b>{logging.met}</b></span>
                <span>Cường độ: <b>{logging.intensity}</b></span>
                <span>Cân nặng: <b>{userWeight ? `${userWeight} kg` : '—'}</b></span>
              </div>

              {/* Cảnh báo thiếu cân nặng */}
              {(!userWeight || userWeight <= 0) && (
                <div className="ex-dialog-warn">
                  <i className="bi bi-exclamation-triangle-fill" />
                  <div>
                    <strong>Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe</strong>
                    <Link to="/profile" style={{ display: 'block', marginTop: 4, fontSize: '0.82rem', color: '#2563eb' }}>
                      Đi đến Hồ sơ sức khỏe →
                    </Link>
                  </div>
                </div>
              )}

              {/* Ngày & Giờ */}
              <div className="ex-form-row">
                <div className="ex-field">
                  <label>Ngày tập</label>
                  <input type="date" max={getTodayStr()} value={logForm.date}
                    onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="ex-field">
                  <label>Giờ thực hiện</label>
                  <input type="time" value={logForm.time}
                    onChange={e => setLogForm(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>

              {/* Thời lượng */}
              <div className="ex-field">
                <label>Thời lượng tập (phút)</label>
                <input type="number" min="1" max="1440" placeholder="Ví dụ: 30"
                  value={logForm.duration} onChange={e => onDurationChange(e.target.value)} />
                <div className="ex-quick-chips">
                  {[15, 30, 45, 60, 90].map(m => (
                    <button key={m} type="button"
                      className={`ex-qchip ${Number(logForm.duration) === m ? 'active' : ''}`}
                      onClick={() => onDurationChange(m)}>
                      {m} phút
                    </button>
                  ))}
                </div>
              </div>

              {/* Ghi chú */}
              <div className="ex-field">
                <label>Ghi chú <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span></label>
                <input type="text" maxLength={500} placeholder="Cảm nhận buổi tập, nhịp tim..."
                  value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {/* Kết quả tính */}
              <div className="ex-result-box">
                <div className="ex-result-label"><i className="bi bi-lightning-charge-fill" /> Ước tính calories tiêu hao</div>
                <div className="ex-result-value">
                  <strong>{logCalories}</strong> <span>kcal</span>
                </div>
                <div className="ex-result-formula">
                  <code>({logging.met} × 3.5 × {userWeight || '?'} × {logForm.duration || 0}) / 200</code>
                </div>
                <p className="ex-result-note">* Lượng calories tiêu hao được ước tính theo công thức MET chuẩn dựa trên cân nặng và thời lượng tập luyện.</p>
              </div>

              {logErr && (
                <div className="ex-inline-err"><i className="bi bi-exclamation-circle" /> {logErr}</div>
              )}
            </div>

            <div className="ex-dialog-foot">
              <button type="button" className="ex-btn ex-btn--ghost" onClick={() => setLogging(null)} disabled={saving}>
                Hủy
              </button>
              <button type="button" className="ex-btn ex-btn--primary"
                onClick={saveLog}
                disabled={saving || !userWeight || Number(logForm.duration) <= 0}
              >
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Đang lưu...</>
                  : <><i className="bi bi-check2-circle" /> Lưu bài tập</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Chi tiết bản ghi
          ══════════════════════════════════════════════════ */}
      {detailLog && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog">
            <div className="ex-dialog-head">
              <div>
                <small>Chi tiết bài tập</small>
                <h3>{detailLog.exerciseName}</h3>
              </div>
              <button type="button" className="ex-dialog-close" onClick={() => setDetailLog(null)} aria-label="Đóng">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="ex-dialog-body">
              <dl className="ex-detail-dl">
                <div className="ex-detail-row">
                  <dt>Ngày thực hiện</dt><dd>{formatDateShort(detailLog.date)}</dd>
                </div>
                <div className="ex-detail-row">
                  <dt>Giờ</dt><dd>{detailLog.time || '—'}</dd>
                </div>
                <div className="ex-detail-row">
                  <dt>Thời lượng</dt><dd>{detailLog.durationMinutes} phút</dd>
                </div>
                <div className="ex-detail-row">
                  <dt>Cân nặng (lúc ghi nhận)</dt><dd>{detailLog.weightKg} kg</dd>
                </div>
                <div className="ex-detail-row">
                  <dt>Chỉ số MET</dt><dd>{detailLog.met}</dd>
                </div>
                <div className="ex-detail-row ex-detail-row--highlight">
                  <dt>Calories tiêu hao ước tính</dt>
                  <dd><strong style={{ color: '#059669', fontSize: '1.2rem' }}>{detailLog.caloriesBurned} kcal</strong></dd>
                </div>
                {detailLog.notes && (
                  <div className="ex-detail-row">
                    <dt>Ghi chú</dt><dd>{detailLog.notes}</dd>
                  </div>
                )}
              </dl>
              <div className="ex-result-box" style={{ marginTop: 0 }}>
                <div className="ex-result-label"><i className="bi bi-calculator" /> Công thức đã áp dụng</div>
                <div className="ex-result-formula" style={{ marginTop: 6 }}>
                  <code>
                    ({detailLog.met} × 3.5 × {detailLog.weightKg} kg × {detailLog.durationMinutes} phút) / 200 = <b>{detailLog.caloriesBurned} kcal</b>
                  </code>
                </div>
              </div>
            </div>
            <div className="ex-dialog-foot">
              <button type="button" className="ex-btn ex-btn--ghost" onClick={() => setDetailLog(null)}>
                Đóng
              </button>
              <button type="button" className="ex-btn ex-btn--primary" onClick={() => { const t = detailLog; setDetailLog(null); openEdit(t) }}>
                <i className="bi bi-pencil" /> Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Chỉnh sửa
          ══════════════════════════════════════════════════ */}
      {editing && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog">
            <div className="ex-dialog-head">
              <div>
                <small>Chỉnh sửa bài tập</small>
                <h3>{editing.exerciseName}</h3>
              </div>
              <button type="button" className="ex-dialog-close" onClick={() => setEditing(null)} aria-label="Đóng">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="ex-dialog-body">
              {/* Đổi bài tập */}
              <div className="ex-field">
                <label>Bài tập</label>
                <select className="ex-select"
                  value={editForm.exerciseId}
                  onChange={e => onEditDuration(editForm.duration, e.target.value)}
                >
                  {exercises.map(ex => (
                    <option key={ex._id} value={ex._id}>
                      {ex.name} (MET {ex.met})
                    </option>
                  ))}
                </select>
              </div>

              <div className="ex-form-row">
                <div className="ex-field">
                  <label>Ngày tập</label>
                  <input type="date" max={getTodayStr()} value={editForm.date}
                    onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="ex-field">
                  <label>Giờ</label>
                  <input type="time" value={editForm.time}
                    onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>

              <div className="ex-field">
                <label>Thời lượng (phút)</label>
                <input type="number" min="1" max="1440"
                  value={editForm.duration} onChange={e => onEditDuration(e.target.value)} />
                <div className="ex-quick-chips">
                  {[15, 30, 45, 60, 90].map(m => (
                    <button key={m} type="button"
                      className={`ex-qchip ${Number(editForm.duration) === m ? 'active' : ''}`}
                      onClick={() => onEditDuration(m)}>
                      {m} phút
                    </button>
                  ))}
                </div>
              </div>

              <div className="ex-field">
                <label>Ghi chú</label>
                <input type="text" maxLength={500} value={editForm.notes}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {/* Calo sau chỉnh sửa */}
              <div className="ex-result-box">
                <div className="ex-result-label"><i className="bi bi-arrow-repeat" /> Calories sau cập nhật</div>
                <div className="ex-result-value">
                  <strong>{editCalories}</strong> <span>kcal</span>
                  <em style={{ fontSize: '0.8rem', marginLeft: 8, color: '#64748b' }}>
                    (ban đầu: {editing.caloriesBurned} kcal)
                  </em>
                </div>
              </div>

              {editErr && <div className="ex-inline-err"><i className="bi bi-exclamation-circle" /> {editErr}</div>}
            </div>
            <div className="ex-dialog-foot">
              <button type="button" className="ex-btn ex-btn--ghost" onClick={() => setEditing(null)} disabled={savingEdit}>Hủy</button>
              <button type="button" className="ex-btn ex-btn--primary"
                onClick={saveEdit}
                disabled={savingEdit || Number(editForm.duration) <= 0}
              >
                {savingEdit
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Đang lưu...</>
                  : <><i className="bi bi-check-lg" /> Lưu thay đổi</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Xác nhận xóa
          ══════════════════════════════════════════════════ */}
      {deleting && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog ex-dialog--confirm">
            <div className="ex-confirm-icon"><i className="bi bi-trash3" /></div>
            <h3>Xóa bản ghi bài tập?</h3>
            <p>
              Xóa <strong>{deleting.exerciseName}</strong> ({deleting.durationMinutes} phút) ngày {formatDateShort(deleting.date)}?
              Thao tác này sẽ cập nhật lại tổng calories tiêu hao và không thể hoàn tác.
            </p>
            <div className="ex-dialog-foot ex-dialog-foot--center">
              <button type="button" className="ex-btn ex-btn--ghost" onClick={() => setDeleting(null)} disabled={isDeleting}>
                Hủy
              </button>
              <button type="button" className="ex-btn ex-btn--danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Đang xóa...</>
                  : <><i className="bi bi-trash3" /> Xác nhận xóa</>
                }
              </button>
            </div>
          </div>
        </div>
      )}



      <footer className="dashboard-footer">
        <span className="footer-copy">
          <b><i className="bi bi-leaf-fill" /></b> © 2026 NutriLens Health Inc. Đồng hành dinh dưỡng thông minh.
        </span>
        <span className="footer-links">Điều khoản dịch vụ · Chính sách bảo mật · Trung tâm hỗ trợ</span>
      </footer>
    </div>
  )
}
