import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import FoodNavMenu from '../../components/common/FoodNavMenu'
import ExerciseNavMenu from '../../components/common/ExerciseNavMenu'
import UserNavMenu from '../../components/common/UserNavMenu'

function resolveAvatarUrl(value) {
  const url = String(value || '').trim()
  if (/^(https?:|data:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

const CATEGORY_TABS = [
  { id: 'all',         label: 'Tất cả',          icon: 'bi-grid' },
  { id: 'my',          label: 'Bài tập của tôi', icon: 'bi-person-heart' },
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

function getTodayStr(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTimeStr(d = new Date()) {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getMinDateStr(daysAgo = 90) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getTodayStr(d)
}

function validateDateTime(date, time) {
  const today = getTodayStr()
  const nowTime = getTimeStr()
  const minDate = getMinDateStr(90)

  if (!date) {
    return 'Vui lòng chọn ngày tập'
  }
  if (date > today) {
    return 'Ngày tập không thể ở thời điểm tương lai'
  }
  if (date < minDate) {
    return 'Ngày tập không được vượt quá 90 ngày trong quá khứ'
  }
  if (date === today && time && time > nowTime) {
    return 'Giờ bắt đầu tập không thể ở thời điểm tương lai'
  }
  return null
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
  const [intensityFilter, setIntensityFilter]  = useState('all')
  const [sortBy,          setSortBy]           = useState('default')

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

  // Modal Xóa bản ghi lịch sử
  const [deleting,        setDeleting]         = useState(null)
  const [isDeleting,      setIsDeleting]       = useState(false)

  // Modal Tạo bài tập cá nhân
  const [creatingCustom,  setCreatingCustom]   = useState(false)
  const [customForm,      setCustomForm]       = useState({
    name: '',
    category: 'cardio',
    intensity: 'Trung bình',
    description: '',
    defaultDurationMinutes: 30,
  })
  const [customErr,       setCustomErr]        = useState('')
  const [savingCustom,    setSavingCustom]     = useState(false)

  // Xóa bài tập cá nhân
  const [deletingCustom,  setDeletingCustom]   = useState(null)
  const [isDeletingCustom,setIsDeletingCustom] = useState(false)

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const fetchExercises = async () => {
    setLoadingEx(true)
    try {
      const { data } = await axiosInstance.get('/exercises')
      setExercises(data.exercises || [])
    } catch {
      toast('error', 'Không thể tải danh mục bài tập')
    } finally {
      setLoadingEx(false)
    }
  }

  useEffect(() => {
    let alive = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (alive) setUserWeight(data.profile?.currentWeightKg || null) })
      .catch(() => {})

    fetchExercises()
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
      else if (period === '14d')   { const d = new Date(); d.setDate(d.getDate()-13); params.startDate = d.toLocaleDateString('sv-SE'); params.endDate = today }
      else if (period === '30d')   { const d = new Date(); d.setDate(d.getDate()-29); params.startDate = d.toLocaleDateString('sv-SE'); params.endDate = today }
      else if (period === 'custom'){
        let s = customStart
        let e = customEnd
        if (s && e && s > e) {
          const t = s; s = e; e = t;
        }
        if (s) params.startDate = s
        if (e) params.endDate = e
      }
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

  function handleCustomStartChange(val) {
    setCustomStart(val)
    if (val && customEnd && val > customEnd) {
      setCustomEnd(val)
    }
  }

  function handleCustomEndChange(val) {
    setCustomEnd(val)
    if (val && customStart && val < customStart) {
      setCustomStart(val)
    }
  }

  function toast(type, text) {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(p => p?.text === text ? null : p), 4000)
  }

  // ─── Catalog ───────────────────────────────────────────────────────────────

  const myCustomCount = useMemo(() => exercises.filter(e => e.isCustom).length, [exercises])

  const filteredEx = useMemo(() => {
    let list = exercises.filter(e => {
      const inCat = catFilter === 'all'
        ? true
        : catFilter === 'my'
        ? Boolean(e.isCustom)
        : e.category === catFilter
      const inIntensity = intensityFilter === 'all' || e.intensity === intensityFilter
      const q = searchQ.toLowerCase().trim()
      const inQ = !q || e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)
      return inCat && inIntensity && inQ
    })

    if (sortBy === 'met-desc') {
      list.sort((a, b) => (b.met || 0) - (a.met || 0))
    } else if (sortBy === 'met-asc') {
      list.sort((a, b) => (a.met || 0) - (b.met || 0))
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name, 'vi'))
    }
    return list
  }, [exercises, catFilter, intensityFilter, searchQ, sortBy])

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
    if (d > 1440) { setLogErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)'); setLogCalories(0); return }
    if (!userWeight) { setLogErr('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe'); setLogCalories(0); return }
    setLogCalories(calcCalories(logging?.met, userWeight, d))
  }

  function onLogDateChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    setLogForm(p => {
      let nextTime = p.time
      if (val === today && p.time > nowTime) {
        nextTime = nowTime
      }
      return { ...p, date: val, time: nextTime }
    })
    if (val > today) {
      setLogErr('Ngày tập không thể ở thời điểm tương lai')
    } else {
      setLogErr('')
    }
  }

  function onLogTimeChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    if (logForm.date === today && val > nowTime) {
      setLogErr('Giờ bắt đầu tập không thể ở thời điểm tương lai')
    } else {
      setLogErr('')
    }
    setLogForm(p => ({ ...p, time: val }))
  }

  async function saveLog() {
    const dtErr = validateDateTime(logForm.date, logForm.time)
    if (dtErr) { setLogErr(dtErr); return }
    const d = Number(logForm.duration)
    if (!d || d <= 0)  { setLogErr('Thời lượng tập luyện phải lớn hơn 0'); return }
    if (d > 1440)      { setLogErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)'); return }
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

  function onEditDateChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    setEditForm(p => {
      let nextTime = p.time
      if (val === today && p.time > nowTime) {
        nextTime = nowTime
      }
      return { ...p, date: val, time: nextTime }
    })
    if (val > today) {
      setEditErr('Ngày tập không thể ở thời điểm tương lai')
    } else {
      setEditErr('')
    }
  }

  function onEditTimeChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    if (editForm.date === today && val > nowTime) {
      setEditErr('Giờ bắt đầu tập không thể ở thời điểm tương lai')
    } else {
      setEditErr('')
    }
    setEditForm(p => ({ ...p, time: val }))
  }

  function onEditDuration(dur, exId = null) {
    const d = Number(dur)
    const eId = exId || editForm.exerciseId
    const ex = exercises.find(e => String(e._id) === String(eId))
    const met = ex ? ex.met : editing.met
    setEditForm(p => ({ ...p, duration: dur, exerciseId: eId }))
    setEditErr('')
    if (!d || d <= 0) { setEditErr('Thời lượng phải lớn hơn 0'); setEditCalories(0); return }
    if (d > 1440) { setEditErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)'); setEditCalories(0); return }
    setEditCalories(calcCalories(met, editing.weightKg, d))
  }

  async function saveEdit() {
    const dtErr = validateDateTime(editForm.date, editForm.time)
    if (dtErr) { setEditErr(dtErr); return }
    const d = Number(editForm.duration)
    if (!d || d <= 0) { setEditErr('Thời lượng phải lớn hơn 0'); return }
    if (d > 1440) { setEditErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)'); return }
    setSavingEdit(true); setEditErr('')
    try {
      const { data } = await axiosInstance.patch(`/exercises/logs/${editing._id}`, {
        exerciseId: editForm.exerciseId, durationMinutes: d,
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

  // ─── Custom Exercise handlers ──────────────────────────────────────────────

  function openCreateModal(initialName = '') {
    setCustomForm({
      name: initialName || '',
      category: 'cardio',
      intensity: 'Trung bình',
      description: '',
      defaultDurationMinutes: 30,
    })
    setCustomErr('')
    setCreatingCustom(true)
  }

  async function saveCustomExercise() {
    if (!customForm.name || !customForm.name.trim()) {
      setCustomErr('Vui lòng nhập tên bài tập')
      return
    }
    setSavingCustom(true)
    setCustomErr('')
    try {
      const { data } = await axiosInstance.post('/exercises/custom', customForm)
      toast('success', data.message || 'Tạo bài tập cá nhân thành công')
      setCreatingCustom(false)
      await fetchExercises()
      if (data.exercise) {
        openLog(data.exercise)
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể tạo bài tập, vui lòng thử lại'
      setCustomErr(msg)
    } finally {
      setSavingCustom(false)
    }
  }

  async function confirmDeleteCustom() {
    if (!deletingCustom) return
    setIsDeletingCustom(true)
    try {
      const { data } = await axiosInstance.delete(`/exercises/custom/${deletingCustom._id}`)
      toast('success', data.message || 'Xóa bài tập cá nhân thành công')
      setDeletingCustom(null)
      fetchExercises()
    } catch (e) {
      toast('error', e.response?.data?.message || 'Không thể xóa bài tập, vui lòng thử lại')
    } finally {
      setIsDeletingCustom(false)
    }
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
          <Link to="/weight-tracker">Tiến trình &amp; Cân nặng</Link>
          <Link to="/community">Cộng đồng</Link>
          <Link to="/articles">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search">
            <i className="bi bi-search" />Tra cứu thực phẩm, món ăn...
          </span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo">
            <i className="bi bi-bell" />
          </button>
          <UserNavMenu />
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



        {/* ══════════════════════════════════════════════════
            TAB 1: DANH MỤC BÀI TẬP
            ══════════════════════════════════════════════════ */}
        {activeTab === 'catalog' && (
          <section>
            {/* Toolbar */}
            <div className="ex-catalog-toolbar">
              <div className="ex-catalog-toolbar-row">
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

                <div className="ex-filter-group">
                  <select
                    className="ex-cat-select"
                    value={intensityFilter}
                    onChange={e => setIntensityFilter(e.target.value)}
                    aria-label="Lọc theo cường độ"
                  >
                    <option value="all">Tất cả cường độ</option>
                    <option value="Nhẹ">Cường độ: Nhẹ</option>
                    <option value="Trung bình">Cường độ: Trung bình</option>
                    <option value="Cao">Cường độ: Cao</option>
                  </select>

                  <select
                    className="ex-cat-select"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    aria-label="Sắp xếp"
                  >
                    <option value="default">Sắp xếp: Mặc định</option>
                    <option value="met-desc">Calo tiêu hao: Cao → Thấp</option>
                    <option value="met-asc">Calo tiêu hao: Thấp → Cao</option>
                    <option value="name-asc">Tên bài tập: A → Z</option>
                    <option value="name-desc">Tên bài tập: Z → A</option>
                  </select>

                  <button
                    type="button"
                    className="ex-btn ex-btn--primary"
                    onClick={() => openCreateModal()}
                    title="Tạo bài tập mới vào danh mục cá nhân"
                  >
                    <i className="bi bi-plus-circle" /> Thêm bài tập
                  </button>
                </div>
              </div>

              <div className="ex-cat-tabs" role="group" aria-label="Lọc theo thể loại">
                {CATEGORY_TABS.map(ct => {
                  const badge = ct.id === 'my' && myCustomCount > 0 ? ` (${myCustomCount})` : ''
                  return (
                    <button
                      key={ct.id} type="button"
                      className={`ex-cat-tab ${catFilter === ct.id ? 'active' : ''}`}
                      onClick={() => setCatFilter(ct.id)}
                    >
                      <i className={`bi ${ct.icon}`} />{ct.label}{badge}
                    </button>
                  )
                })}
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
                {catFilter === 'my' ? (
                  <>
                    <i className="bi bi-person-heart" style={{ fontSize: '2.5rem', color: '#10b981' }} />
                    <strong>Bạn chưa có bài tập cá nhân nào</strong>
                    <p>Hãy thêm bài tập yêu thích hoặc môn thể thao đặc thù của riêng bạn để ghi nhận nhanh chóng.</p>
                    <button className="ex-btn ex-btn--primary" onClick={() => openCreateModal()}>
                      <i className="bi bi-plus-circle" /> Tạo bài tập đầu tiên
                    </button>
                  </>
                ) : (
                  <>
                    <i className="bi bi-search" />
                    <strong>Không tìm thấy bài tập phù hợp</strong>
                    <p>Bạn có thể tự tạo bài tập mới vào danh mục cá nhân hoặc xóa bộ lọc để tìm lại.</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="ex-btn ex-btn--primary" onClick={() => openCreateModal(searchQ)}>
                        <i className="bi bi-plus-circle" /> Tạo bài tập "{searchQ || 'mới'}"
                      </button>
                      <button className="ex-btn ex-btn--outline" onClick={() => { setSearchQ(''); setCatFilter('all'); setIntensityFilter('all'); setSortBy('default'); }}>
                        Xóa bộ lọc
                      </button>
                    </div>
                  </>
                )}
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
                          {ex.isCustom && (
                            <span className="ex-chip ex-chip--custom" title="Bài tập cá nhân">
                              <i className="bi bi-person-fill" /> Cá nhân
                            </span>
                          )}
                          <span className={`ex-chip ${chip.cls}`}>
                            <i className={`bi ${chip.icon}`} />{ex.intensity}
                          </span>
                          <span className="ex-chip ex-chip--met">MET {ex.met}</span>
                        </div>
                      </div>
                      <h3 className="ex-card-title">{ex.name}</h3>
                      <p className="ex-card-desc">{ex.description || (ex.isCustom ? 'Bài tập cá nhân do bạn tạo' : '')}</p>
                      <div className="ex-card-foot">
                        {est != null ? (
                          <span className="ex-card-est"><i className="bi bi-fire" /> ~<strong>{est}</strong> kcal / 30 phút</span>
                        ) : (
                          <span className="ex-card-est ex-card-est--met"><i className="bi bi-lightning-charge" /> Tiêu chuẩn MET <strong>{ex.met}</strong></span>
                        )}
                        <div className="ex-card-actions">
                          {ex.isCustom && (
                            <button
                              type="button"
                              className="ex-icon-btn ex-icon-btn--del ex-icon-btn--sm"
                              title="Xóa bài tập cá nhân này"
                              onClick={() => setDeletingCustom(ex)}
                            >
                              <i className="bi bi-trash3" />
                            </button>
                          )}
                          <button type="button" className="ex-btn ex-btn--primary" onClick={() => openLog(ex)}>
                            <i className="bi bi-plus-lg" /> Ghi nhận
                          </button>
                        </div>
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
                  { id: '14d',   label: '14 ngày' },
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
                    Từ&nbsp;<input type="date" min={getMinDateStr(365)} value={customStart} max={customEnd || getTodayStr()} onChange={e => handleCustomStartChange(e.target.value)} />
                  </label>
                  <span>—</span>
                  <label>
                    Đến&nbsp;<input type="date" value={customEnd} min={customStart} max={getTodayStr()} onChange={e => handleCustomEndChange(e.target.value)} />
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
                  <input type="date" min={getMinDateStr(90)} max={getTodayStr()} value={logForm.date}
                    onChange={e => onLogDateChange(e.target.value)} />
                </div>
                <div className="ex-field">
                  <label>Giờ bắt đầu tập</label>
                  <input type="time"
                    max={logForm.date === getTodayStr() ? getTimeStr() : undefined}
                    value={logForm.time}
                    onChange={e => onLogTimeChange(e.target.value)} />
                </div>
              </div>

              {/* Thời lượng */}
              <div className="ex-field">
                <label>Thời lượng tập (phút)</label>
                <input type="number" min="1" max="1440" step="1" placeholder="Ví dụ: 30"
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
              <div className="ex-result-simple">
                <i className="bi bi-fire" />
                <span>Ước tính tiêu hao: <strong>{logCalories} kcal</strong></span>
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
                  <dt>Giờ bắt đầu tập</dt><dd>{detailLog.time || '—'}</dd>
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
                  {editing && !exercises.some(ex => String(ex._id) === String(editForm.exerciseId)) && (
                    <option value={editForm.exerciseId}>
                      {editing.exerciseName} (Đã ngưng áp dụng)
                    </option>
                  )}
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
                  <input type="date" min={getMinDateStr(90)} max={getTodayStr()} value={editForm.date}
                    onChange={e => onEditDateChange(e.target.value)} />
                </div>
                <div className="ex-field">
                  <label>Giờ bắt đầu tập</label>
                  <input type="time"
                    max={editForm.date === getTodayStr() ? getTimeStr() : undefined}
                    value={editForm.time}
                    onChange={e => onEditTimeChange(e.target.value)} />
                </div>
              </div>

              <div className="ex-field">
                <label>Thời lượng (phút)</label>
                <input type="number" min="1" max="1440" step="1"
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
              <div className="ex-result-simple">
                <i className="bi bi-fire" />
                <span>Calories sau cập nhật: <strong>{editCalories} kcal</strong></span>
                <span style={{ fontSize: '0.8rem', marginLeft: 6, color: '#64748b' }}>
                  (ban đầu: {editing.caloriesBurned} kcal)
                </span>
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
      {/* ══════════════════════════════════════════════════
          MODAL: Xác nhận xóa bài tập cá nhân
          ══════════════════════════════════════════════════ */}
      {deletingCustom && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog ex-dialog--confirm">
            <div className="ex-confirm-icon"><i className="bi bi-trash3" /></div>
            <h3>Xóa bài tập cá nhân?</h3>
            <p>
              Bạn có chắc chắn muốn xóa bài tập <strong>"{deletingCustom.name}"</strong> khỏi danh mục cá nhân?
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
              Lưu ý: Các bản ghi bạn đã tập bài này trước đó trong lịch sử vẫn sẽ được giữ nguyên.
            </p>
            <div className="ex-dialog-foot ex-dialog-foot--center">
              <button type="button" className="ex-btn ex-btn--ghost" onClick={() => setDeletingCustom(null)} disabled={isDeletingCustom}>
                Hủy
              </button>
              <button type="button" className="ex-btn ex-btn--danger" onClick={confirmDeleteCustom} disabled={isDeletingCustom}>
                {isDeletingCustom
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Đang xóa...</>
                  : <><i className="bi bi-trash3" /> Xác nhận xóa</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Tạo bài tập cá nhân
          ══════════════════════════════════════════════════ */}
      {creatingCustom && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog">
            <div className="ex-dialog-head">
              <div>
                <small>Danh mục cá nhân</small>
                <h3>Thêm bài tập mới</h3>
              </div>
              <button type="button" className="ex-dialog-close" onClick={() => setCreatingCustom(false)} aria-label="Đóng">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="ex-dialog-body">
              {/* Tên bài tập */}
              <div className="ex-field">
                <label>Tên bài tập <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đá cầu, Nhảy hiện đại, Pilates, Leo núi..."
                  maxLength={100}
                  value={customForm.name}
                  onChange={e => { setCustomForm(p => ({ ...p, name: e.target.value })); setCustomErr('') }}
                  autoFocus
                />
              </div>

              {/* Thể loại */}
              <div className="ex-field">
                <label>Thể loại</label>
                <select
                  className="ex-select"
                  value={customForm.category}
                  onChange={e => setCustomForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="cardio">Cardio &amp; Vận động</option>
                  <option value="strength">Sức mạnh &amp; Gym</option>
                  <option value="flexibility">Yoga &amp; Thư giãn</option>
                  <option value="sports">Thể thao</option>
                </select>
              </div>

              {/* Mức độ cường độ */}
              <div className="ex-field">
                <label>Cường độ vận động</label>
                <div className="ex-custom-intensities">
                  {[
                    { id: 'Nhẹ', label: 'Nhẹ', met: 3.5, desc: 'Vận động nhẹ nhàng, thư thả' },
                    { id: 'Trung bình', label: 'Trung bình', met: 6.0, desc: 'Vừa phải, toát mồ hôi' },
                    { id: 'Cao', label: 'Cao', met: 8.5, desc: 'Vận động nặng, đốt nhiều calo' },
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      className={`ex-intensity-btn ${customForm.intensity === lvl.id ? 'active' : ''}`}
                      onClick={() => setCustomForm(p => ({ ...p, intensity: lvl.id }))}
                    >
                      <div className="ex-intensity-title">
                        <strong>{lvl.label}</strong>
                        <small>~{lvl.met} MET</small>
                      </div>
                      <span>{lvl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Thời lượng mặc định */}
              <div className="ex-field">
                <label>Thời lượng gợi ý (phút)</label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  step="1"
                  value={customForm.defaultDurationMinutes}
                  onChange={e => setCustomForm(p => ({ ...p, defaultDurationMinutes: e.target.value }))}
                />
              </div>

              {/* Mô tả */}
              <div className="ex-field">
                <label>Mô tả / Lưu ý <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span></label>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Ghi chú thêm về dụng cụ, cách tập..."
                  value={customForm.description}
                  onChange={e => setCustomForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              {/* Calo ước tính */}
              <div className="ex-result-simple">
                <i className="bi bi-fire" />
                <span>
                  Ước tính tiêu hao: <strong>
                    {calcCalories(
                      customForm.intensity === 'Nhẹ' ? 3.5 : customForm.intensity === 'Cao' ? 8.5 : 6.0,
                      userWeight || 60,
                      Number(customForm.defaultDurationMinutes) || 30
                    )} kcal
                  </strong> / {Number(customForm.defaultDurationMinutes) || 30} phút
                </span>
              </div>

              {customErr && (
                <div className="ex-inline-err"><i className="bi bi-exclamation-circle" /> {customErr}</div>
              )}
            </div>

            <div className="ex-dialog-foot">
              <button
                type="button"
                className="ex-btn ex-btn--ghost"
                onClick={() => setCreatingCustom(false)}
                disabled={savingCustom}
              >
                Hủy
              </button>
              <button
                type="button"
                className="ex-btn ex-btn--primary"
                onClick={saveCustomExercise}
                disabled={savingCustom || !customForm.name.trim()}
              >
                {savingCustom
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Đang lưu...</>
                  : <><i className="bi bi-check2-circle" /> Lưu &amp; Thêm vào danh mục</>
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
