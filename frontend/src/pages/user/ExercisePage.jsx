import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import FoodNavMenu from '../../components/common/FoodNavMenu'

const CATEGORIES = [
  { id: 'all', label: 'Tất cả bài tập', icon: 'bi-grid-fill' },
  { id: 'cardio', label: 'Cardio & Vận động', icon: 'bi-lightning-charge-fill' },
  { id: 'strength', label: 'Sức mạnh & Gym', icon: 'bi-trophy-fill' },
  { id: 'flexibility', label: 'Yoga & Thư giãn', icon: 'bi-flower1' },
  { id: 'sports', label: 'Thể thao đối kháng', icon: 'bi-dribbble' },
]

const INTENSITY_COLORS = {
  'Nhẹ': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  'Trung bình': { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  'Cao': { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
}

function getTodayStr() {
  return new Date().toLocaleDateString('sv-SE')
}

function getCurrentTimeStr() {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${dateStr}T12:00:00`))
  } catch {
    return dateStr
  }
}

export default function ExercisePage() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.fullName?.split(' ')[0] || 'bạn'
  const [profileOpen, setProfileOpen] = useState(false)

  // Tab: 'catalog' (UC21: Ghi nhận) | 'history' (UC22: Lịch sử)
  const [activeTab, setActiveTab] = useState('catalog')

  // Data states
  const [exercises, setExercises] = useState([])
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [userWeight, setUserWeight] = useState(null)
  const [todaySummary, setTodaySummary] = useState({ totalCalories: 0, totalMinutes: 0, count: 0 })

  // Filters for Catalog (UC21 Luồng 4a)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('all')

  // Filters for History (UC22 Luồng chính bước 3)
  const [historyPeriod, setHistoryPeriod] = useState('7d') // 'today' | '7d' | '30d' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toLocaleDateString('sv-SE')
  })
  const [customEndDate, setCustomEndDate] = useState(getTodayStr)
  const [historyCategory, setHistoryCategory] = useState('all')

  // Logging Modal (UC21)
  const [loggingExercise, setLoggingExercise] = useState(null)
  const [logForm, setLogForm] = useState({
    durationMinutes: 30,
    date: getTodayStr(),
    time: getCurrentTimeStr(),
    notes: '',
  })
  const [estimatedCalories, setEstimatedCalories] = useState(0)
  const [logError, setLogError] = useState('')
  const [savingLog, setSavingLog] = useState(false)

  // Detail Modal (UC22 Luồng chính bước 5, 6)
  const [detailLog, setDetailLog] = useState(null)

  // Edit Modal (UC22 Luồng 5a)
  const [editingLog, setEditingLog] = useState(null)
  const [editForm, setEditForm] = useState({
    exerciseId: '',
    durationMinutes: 30,
    date: '',
    time: '',
    notes: '',
  })
  const [editEstimatedCalories, setEditEstimatedCalories] = useState(0)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete Confirmation Modal (UC22 Luồng 5b)
  const [deletingLog, setDeletingLog] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Feedback Toasts
  const [toastMessage, setToastMessage] = useState(null) // { type: 'success' | 'error', text: '' }

  // Load User Profile Weight & Exercises
  useEffect(() => {
    let active = true

    // Load profile to get weight
    axiosInstance.get('/profile')
      .then(({ data }) => {
        if (!active) return
        const weight = data.profile?.currentWeightKg || data.latestLog?.weightKg || null
        setUserWeight(weight)
      })
      .catch((err) => {
        console.warn('Không thể tải thông tin cân nặng hồ sơ:', err.message)
      })

    // Load exercises
    setLoadingExercises(true)
    axiosInstance.get('/exercises')
      .then(({ data }) => {
        if (!active) return
        setExercises(data.exercises || [])
      })
      .catch((err) => {
        console.error('Không thể tải bài tập:', err)
        showToast('error', 'Không thể kết nối đến danh mục bài tập')
      })
      .finally(() => {
        if (active) setLoadingExercises(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Load today's summary
  const fetchTodaySummary = async () => {
    try {
      const today = getTodayStr()
      const { data } = await axiosInstance.get('/exercises/logs', { params: { date: today } })
      setTodaySummary({
        totalCalories: data.summary?.totalCalories || 0,
        totalMinutes: data.summary?.totalMinutes || 0,
        count: data.logs?.length || 0,
      })
    } catch (err) {
      console.warn('Không thể tải thống kê hôm nay:', err.message)
    }
  }

  useEffect(() => {
    fetchTodaySummary()
  }, [])

  // Load History Logs when filters change
  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const params = {}
      if (historyCategory !== 'all') {
        params.category = historyCategory
      }

      const today = getTodayStr()
      if (historyPeriod === 'today') {
        params.date = today
      } else if (historyPeriod === '7d') {
        const d = new Date()
        d.setDate(d.getDate() - 6)
        params.startDate = d.toLocaleDateString('sv-SE')
        params.endDate = today
      } else if (historyPeriod === '30d') {
        const d = new Date()
        d.setDate(d.getDate() - 29)
        params.startDate = d.toLocaleDateString('sv-SE')
        params.endDate = today
      } else if (historyPeriod === 'custom') {
        if (customStartDate) params.startDate = customStartDate
        if (customEndDate) params.endDate = customEndDate
      }

      const { data } = await axiosInstance.get('/exercises/logs', { params })
      setLogs(data.logs || [])
      if (data.currentWeightKg && !userWeight) {
        setUserWeight(data.currentWeightKg)
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử tập luyện:', err)
      showToast('error', 'Không thể tải lịch sử tập luyện')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [historyPeriod, customStartDate, customEndDate, historyCategory])

  function showToast(type, text) {
    setToastMessage({ type, text })
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev))
    }, 4000)
  }

  // Formula calculation utility: Calories = (MET * 3.5 * Weight * Minutes) / 200
  function computeCalories(met, weight, duration) {
    if (!met || !weight || !duration || duration <= 0) return 0
    return Math.round((met * 3.5 * weight * duration) / 200)
  }

  // Filtered exercises for Catalog tab (UC21 Luồng 4a)
  const filteredExercises = useMemo(() => {
    return exercises.filter((item) => {
      const matchesCategory = catalogCategory === 'all' || item.category === catalogCategory
      const query = catalogSearch.toLowerCase().trim()
      const matchesSearch = !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(query))
      return matchesCategory && matchesSearch
    })
  }, [exercises, catalogCategory, catalogSearch])

  // UC21: Bắt đầu chọn bài tập để ghi nhận
  function handleSelectExerciseToLog(exercise) {
    setLoggingExercise(exercise)
    setLogError('')
    const initialDuration = exercise.defaultDurationMinutes || 30
    setLogForm({
      durationMinutes: initialDuration,
      date: getTodayStr(),
      time: getCurrentTimeStr(),
      notes: '',
    })

    // Tính ngay lượng calories nếu đã có cân nặng
    if (userWeight && userWeight > 0) {
      const cals = computeCalories(exercise.met, userWeight, initialDuration)
      setEstimatedCalories(cals)
    } else {
      setEstimatedCalories(0)
    }
  }

  // UC21 Luồng 6a: Thay đổi thời lượng tập luyện -> tự động tính lại calories
  function handleDurationChange(val) {
    const duration = Number(val)
    setLogForm((prev) => ({ ...prev, durationMinutes: val }))

    if (!val || duration <= 0) {
      setLogError('Thời lượng tập luyện phải lớn hơn 0')
      setEstimatedCalories(0)
      return
    }

    if (!userWeight || userWeight <= 0) {
      setLogError('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe')
      setEstimatedCalories(0)
      return
    }

    if (!loggingExercise?.met || loggingExercise.met <= 0) {
      setLogError('Bài tập chưa có dữ liệu tính calories')
      setEstimatedCalories(0)
      return
    }

    setLogError('')
    const cals = computeCalories(loggingExercise.met, userWeight, duration)
    setEstimatedCalories(cals)
  }

  // UC21 Bước 6: Nút "Tính calories" thủ công
  function handleManualCalculate() {
    const duration = Number(logForm.durationMinutes)
    // Ngoại lệ 5a
    if (!duration || duration <= 0) {
      setLogError('Thời lượng tập luyện phải lớn hơn 0')
      setEstimatedCalories(0)
      return
    }
    // Ngoại lệ 5b
    if (!userWeight || userWeight <= 0) {
      setLogError('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe')
      setEstimatedCalories(0)
      return
    }
    // Ngoại lệ 7c
    if (!loggingExercise?.met || loggingExercise.met <= 0) {
      setLogError('Bài tập chưa có dữ liệu tính calories')
      setEstimatedCalories(0)
      return
    }

    setLogError('')
    const cals = computeCalories(loggingExercise.met, userWeight, duration)
    setEstimatedCalories(cals)
  }

  // UC21 Bước 10: Lưu bài tập
  async function handleSaveLog() {
    const duration = Number(logForm.durationMinutes)
    // Luồng ngoại lệ 5a
    if (!duration || duration <= 0) {
      setLogError('Thời lượng tập luyện phải lớn hơn 0')
      return
    }
    // Luồng ngoại lệ 5b
    if (!userWeight || userWeight <= 0) {
      setLogError('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe')
      return
    }
    // Luồng ngoại lệ 7c
    if (!loggingExercise?.met || loggingExercise.met <= 0) {
      setLogError('Bài tập chưa có dữ liệu tính calories')
      return
    }

    setSavingLog(true)
    setLogError('')
    try {
      const { data } = await axiosInstance.post('/exercises/logs', {
        exerciseId: loggingExercise._id,
        durationMinutes: duration,
        date: logForm.date,
        time: logForm.time,
        notes: logForm.notes,
        customWeightKg: userWeight,
      })

      showToast('success', data.message || 'Ghi nhận bài tập thành công')
      setLoggingExercise(null)
      fetchTodaySummary()
      fetchLogs()
    } catch (err) {
      // Luồng ngoại lệ 11d
      const msg = err.response?.data?.message || 'Không thể lưu thông tin bài tập, vui lòng thử lại'
      setLogError(msg)
      showToast('error', msg)
    } finally {
      setSavingLog(false)
    }
  }

  // UC22 Luồng 5a: Mở modal sửa
  function handleOpenEdit(log) {
    setEditingLog(log)
    setEditError('')
    setEditForm({
      exerciseId: log.exerciseId,
      durationMinutes: log.durationMinutes,
      date: log.date,
      time: log.time || '',
      notes: log.notes || '',
    })

    const cals = computeCalories(log.met, log.weightKg, log.durationMinutes)
    setEditEstimatedCalories(cals)
  }

  // UC22 Luồng 5a & 9a: Đổi bài tập hoặc thời lượng khi sửa -> tính lại calo
  function handleEditDurationChange(newDuration, newExerciseId = null) {
    const duration = Number(newDuration)
    const exId = newExerciseId || editForm.exerciseId
    const targetExercise = exercises.find((e) => String(e._id) === String(exId))
    const met = targetExercise ? targetExercise.met : editingLog.met

    setEditForm((prev) => ({
      ...prev,
      durationMinutes: newDuration,
      exerciseId: exId,
    }))

    if (!duration || duration <= 0) {
      setEditError('Thông tin bài tập không hợp lệ: Thời lượng phải lớn hơn 0')
      setEditEstimatedCalories(0)
      return
    }

    if (!met || met <= 0) {
      setEditError('Không tìm thấy dữ liệu bài tập để tính calories')
      setEditEstimatedCalories(0)
      return
    }

    setEditError('')
    const cals = computeCalories(met, editingLog.weightKg, duration)
    setEditEstimatedCalories(cals)
  }

  // UC22 Bước 7a & 10a: Lưu chỉnh sửa
  async function handleSaveEdit() {
    const duration = Number(editForm.durationMinutes)
    // Luồng ngoại lệ 7b
    if (!duration || duration <= 0) {
      setEditError('Thông tin bài tập không hợp lệ')
      return
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const { data } = await axiosInstance.patch(`/exercises/logs/${editingLog._id}`, {
        exerciseId: editForm.exerciseId,
        durationMinutes: duration,
        date: editForm.date,
        time: editForm.time,
        notes: editForm.notes,
      })

      showToast('success', data.message || 'Cập nhật bài tập thành công')
      setEditingLog(null)
      fetchTodaySummary()
      fetchLogs()
    } catch (err) {
      // Ngoại lệ 8e, 9c, 8f
      const msg = err.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại'
      setEditError(msg)
      showToast('error', msg)
      if (err.response?.status === 404) {
        setEditingLog(null)
        fetchLogs()
      }
    } finally {
      setSavingEdit(false)
    }
  }

  // UC22 Luồng 5b: Xóa bản ghi
  async function handleConfirmDelete() {
    if (!deletingLog) return
    setIsDeleting(true)
    try {
      const { data } = await axiosInstance.delete(`/exercises/logs/${deletingLog._id}`)
      showToast('success', data.message || 'Xóa bài tập thành công')
      setDeletingLog(null)
      fetchTodaySummary()
      fetchLogs()
    } catch (err) {
      // Luồng ngoại lệ 8e, 8f
      const msg = err.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại'
      showToast('error', msg)
      if (err.response?.status === 404) {
        setDeletingLog(null)
        fetchLogs()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Summary of filtered logs
  const historySummary = useMemo(() => {
    const totalCalories = logs.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0)
    const totalMinutes = logs.reduce((sum, item) => sum + (item.durationMinutes || 0), 0)
    return {
      totalCalories,
      totalMinutes,
      totalSessions: logs.length,
    }
  }, [logs])

  return (
    <div className="dashboard-shell foodscan-shell ex-page-shell">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`ex-toast ex-toast--${toastMessage.type}`} role="alert">
          <i className={`bi ${toastMessage.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} aria-label="Đóng thông báo">
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* TOPBAR / HEADER NAVIGATION */}
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard">
          <span><i className="bi bi-leaf-fill" /></span>NutriLens
        </Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <FoodNavMenu />
          <Link to="/exercise" className="active">Luyện tập</Link>
          <Link to="/weight-tracker">Chỉ số &amp; Xu hướng</Link>
          <Link to="/dashboard">Cộng đồng</Link>
          <Link to="/dashboard">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search">
            <i className="bi bi-search" />Tra cứu bài tập, calo...
          </span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo">
            <i className="bi bi-bell" />
          </button>
          <div className="profile-menu">
            <button
              className="dashboard-avatar"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
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

      {/* MAIN CONTAINER */}
      <main className="ex-main-container">
        {/* HERO BANNER */}
        <section className="ex-hero">
          <div className="ex-hero-content">
            <div className="ex-hero-badge">
              <i className="bi bi-fire" /> Module 5: Exercise &amp; Calorie Burn
            </div>
            <h1>Trung tâm Luyện tập &amp; Thể chất</h1>
            <p>
              Ghi nhận các bài tập thể chất từ danh mục chuẩn hóa, ước tính lượng calories tiêu hao khoa học
              dựa trên chỉ số MET (Metabolic Equivalent of Task) và theo dõi lịch sử vận động của bạn.
            </p>

            <div className="ex-hero-actions">
              <button
                type="button"
                className={`ex-pill-btn ${activeTab === 'catalog' ? 'ex-pill-btn--primary' : 'ex-pill-btn--outline'}`}
                onClick={() => setActiveTab('catalog')}
              >
                <i className="bi bi-plus-circle" /> Thêm bài tập (UC21)
              </button>
              <button
                type="button"
                className={`ex-pill-btn ${activeTab === 'history' ? 'ex-pill-btn--primary' : 'ex-pill-btn--outline'}`}
                onClick={() => setActiveTab('history')}
              >
                <i className="bi bi-clock-history" /> Lịch sử tập luyện (UC22)
              </button>
            </div>
          </div>

          {/* User Profile Weight Card Indicator */}
          <div className="ex-hero-weight-card">
            <div className="ex-weight-header">
              <i className="bi bi-person-badge" />
              <span>Cân nặng áp dụng tính Calo</span>
            </div>
            {userWeight && userWeight > 0 ? (
              <div className="ex-weight-body">
                <div className="ex-weight-val">
                  <strong>{userWeight}</strong> <small>kg</small>
                </div>
                <span className="ex-weight-tag ex-weight-tag--valid">
                  <i className="bi bi-check-circle" /> Đồng bộ từ Hồ sơ sức khỏe
                </span>
                <Link to="/profile" className="ex-weight-link">
                  Chỉnh sửa cân nặng →
                </Link>
              </div>
            ) : (
              <div className="ex-weight-body ex-weight-body--missing">
                <div className="ex-weight-missing-alert">
                  <i className="bi bi-exclamation-triangle-fill" /> Chưa có cân nặng
                </div>
                <p>Hệ thống cần thông tin cân nặng của bạn để ước tính chính xác lượng Calo tiêu hao.</p>
                <Link to="/profile" className="ex-btn-update-weight">
                  Cập nhật hồ sơ ngay
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* METRICS HIGHLIGHT BAR */}
        <section className="ex-stats-grid">
          <div className="ex-stat-card">
            <div className="ex-stat-icon ex-stat-icon--fire">
              <i className="bi bi-fire" />
            </div>
            <div className="ex-stat-info">
              <span className="ex-stat-label">Calo tiêu hao hôm nay</span>
              <strong className="ex-stat-val">
                {todaySummary.totalCalories.toLocaleString('vi-VN')} <small>kcal</small>
              </strong>
              <span className="ex-stat-sub">Mục tiêu khuyến nghị: ~350 - 500 kcal</span>
            </div>
          </div>

          <div className="ex-stat-card">
            <div className="ex-stat-icon ex-stat-icon--clock">
              <i className="bi bi-stopwatch-fill" />
            </div>
            <div className="ex-stat-info">
              <span className="ex-stat-label">Thời gian tập hôm nay</span>
              <strong className="ex-stat-val">
                {todaySummary.totalMinutes} <small>phút</small>
              </strong>
              <span className="ex-stat-sub">Khuyến nghị WHO: ≥ 30 phút/ngày</span>
            </div>
          </div>

          <div className="ex-stat-card">
            <div className="ex-stat-icon ex-stat-icon--run">
              <i className="bi bi-activity" />
            </div>
            <div className="ex-stat-info">
              <span className="ex-stat-label">Số bài tập hôm nay</span>
              <strong className="ex-stat-val">
                {todaySummary.count} <small>bài</small>
              </strong>
              <span className="ex-stat-sub">
                {todaySummary.count > 0 ? 'Tuyệt vời! Duy trì phong độ' : 'Chưa có bài tập nào hôm nay'}
              </span>
            </div>
          </div>

          <div className="ex-stat-card ex-stat-card--formula">
            <div className="ex-stat-icon ex-stat-icon--info">
              <i className="bi bi-calculator" />
            </div>
            <div className="ex-stat-info">
              <span className="ex-stat-label">Công thức ước tính (ACSM)</span>
              <div className="ex-formula-preview">
                <code>Calories = (MET × 3.5 × kg × phút) / 200</code>
              </div>
              <span className="ex-stat-sub">Chuẩn chuyển hóa năng lượng thể chất</span>
            </div>
          </div>
        </section>

        {/* TAB CONTROLS */}
        <div className="ex-tab-nav" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            className={`ex-tab-item ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <i className="bi bi-journal-plus" />
            <span>Danh mục bài tập &amp; Ghi nhận (UC21)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`ex-tab-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <i className="bi bi-list-check" />
            <span>Lịch sử tập luyện (UC22)</span>
            {logs.length > 0 && <span className="ex-tab-badge">{logs.length}</span>}
          </button>
        </div>

        {/* =========================================================================
            TAB 1: GHI NHẬN BÀI TẬP (UC21)
            ========================================================================= */}
        {activeTab === 'catalog' && (
          <section className="ex-tab-pane" aria-label="Danh mục bài tập">
            {/* Filter & Search Toolbar (UC21 Luồng 4a) */}
            <div className="ex-catalog-toolbar">
              <div className="ex-search-box">
                <i className="bi bi-search" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bài tập (vd: chạy bộ, nhảy dây, yoga, bơi lội, đạp xe...)"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
                {catalogSearch && (
                  <button type="button" onClick={() => setCatalogSearch('')} aria-label="Xóa từ khóa">
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>

              <div className="ex-category-pills">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`ex-cat-pill ${catalogCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setCatalogCategory(cat.id)}
                  >
                    <i className={`bi ${cat.icon}`} />
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Precondition Notice (Ngoại lệ 5b) */}
            {(!userWeight || userWeight <= 0) && (
              <div className="ex-warning-banner">
                <i className="bi bi-exclamation-triangle-fill" />
                <div>
                  <strong>Chưa có thông tin cân nặng trong hồ sơ sức khỏe!</strong>
                  <p>Hệ thống cần cân nặng của bạn để tính lượng calories tiêu hao. Vui lòng cập nhật trước khi ghi nhận bài tập.</p>
                </div>
                <Link to="/profile" className="ex-banner-btn">
                  Cập nhật cân nặng →
                </Link>
              </div>
            )}

            {/* Exercise Grid */}
            {loadingExercises ? (
              <div className="ex-loading-state">
                <div className="spinner-border text-success" role="status" />
                <p>Đang tải danh mục bài tập...</p>
              </div>
            ) : filteredExercises.length === 0 ? (
              <div className="ex-empty-state">
                <i className="bi bi-search" />
                <h3>Không tìm thấy bài tập phù hợp</h3>
                <p>Vui lòng thử từ khóa khác hoặc bỏ chọn bộ lọc để xem toàn bộ danh mục bài tập.</p>
                <button
                  type="button"
                  className="ex-pill-btn ex-pill-btn--outline"
                  onClick={() => {
                    setCatalogSearch('')
                    setCatalogCategory('all')
                  }}
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              <div className="ex-exercise-grid">
                {filteredExercises.map((ex) => {
                  const intensityStyle = INTENSITY_COLORS[ex.intensity] || INTENSITY_COLORS['Trung bình']
                  // Sample calorie estimate for standard 30 minutes
                  const sampleCals = userWeight ? computeCalories(ex.met, userWeight, 30) : null

                  return (
                    <article key={ex._id} className="ex-card">
                      <div className="ex-card-top">
                        <div className="ex-card-icon">
                          <i className={`bi ${ex.icon || 'bi-activity'}`} />
                        </div>
                        <div className="ex-card-tags">
                          <span
                            className="ex-badge-intensity"
                            style={{
                              background: intensityStyle.bg,
                              color: intensityStyle.color,
                              borderColor: intensityStyle.border,
                            }}
                          >
                            {ex.intensity}
                          </span>
                          <span className="ex-badge-met" title="Giá trị MET (Mức tiêu hao năng lượng thể chất)">
                            MET: <b>{ex.met}</b>
                          </span>
                        </div>
                      </div>

                      <div className="ex-card-body">
                        <h3>{ex.name}</h3>
                        <p className="ex-card-desc">{ex.description || 'Bài tập tăng cường sức khỏe và đốt mỡ.'}</p>
                      </div>

                      <div className="ex-card-footer">
                        <div className="ex-card-meta">
                          <span className="ex-meta-est">
                            {sampleCals != null ? (
                              <>Đốt ~<strong>{sampleCals}</strong> kcal / 30'</>
                            ) : (
                              <>Tiêu chuẩn ~30 phút</>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ex-btn-log"
                          onClick={() => handleSelectExerciseToLog(ex)}
                        >
                          <i className="bi bi-plus-lg" /> Chọn bài tập
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* =========================================================================
            TAB 2: LỊCH SỬ TẬP LUYỆN (UC22)
            ========================================================================= */}
        {activeTab === 'history' && (
          <section className="ex-tab-pane" aria-label="Lịch sử bài tập">
            {/* History Filter Toolbar (UC22 Luồng chính bước 3) */}
            <div className="ex-history-toolbar">
              <div className="ex-period-selector">
                <span className="ex-period-label">Khoảng thời gian:</span>
                <button
                  type="button"
                  className={`ex-filter-btn ${historyPeriod === 'today' ? 'active' : ''}`}
                  onClick={() => setHistoryPeriod('today')}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  className={`ex-filter-btn ${historyPeriod === '7d' ? 'active' : ''}`}
                  onClick={() => setHistoryPeriod('7d')}
                >
                  7 ngày qua
                </button>
                <button
                  type="button"
                  className={`ex-filter-btn ${historyPeriod === '30d' ? 'active' : ''}`}
                  onClick={() => setHistoryPeriod('30d')}
                >
                  30 ngày qua
                </button>
                <button
                  type="button"
                  className={`ex-filter-btn ${historyPeriod === 'all' ? 'active' : ''}`}
                  onClick={() => setHistoryPeriod('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`ex-filter-btn ${historyPeriod === 'custom' ? 'active' : ''}`}
                  onClick={() => setHistoryPeriod('custom')}
                >
                  Tùy chọn ngày
                </button>
              </div>

              {historyPeriod === 'custom' && (
                <div className="ex-custom-dates">
                  <label>
                    <span>Từ ngày:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      max={getTodayStr()}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Đến ngày:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      max={getTodayStr()}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <div className="ex-category-select-wrapper">
                <select
                  value={historyCategory}
                  onChange={(e) => setHistoryCategory(e.target.value)}
                  className="ex-select-category"
                >
                  <option value="all">Tất cả nhóm bài tập</option>
                  <option value="cardio">Cardio &amp; Vận động</option>
                  <option value="strength">Sức mạnh &amp; Gym</option>
                  <option value="flexibility">Yoga &amp; Thư giãn</option>
                  <option value="sports">Thể thao đối kháng</option>
                </select>
              </div>
            </div>

            {/* Filter Summary Banner */}
            <div className="ex-history-summary-box">
              <div className="ex-summary-item">
                <span>Số buổi tập</span>
                <strong>{historySummary.totalSessions} <small>buổi</small></strong>
              </div>
              <div className="ex-summary-item">
                <span>Tổng thời gian</span>
                <strong>{historySummary.totalMinutes} <small>phút</small></strong>
              </div>
              <div className="ex-summary-item ex-summary-item--highlight">
                <span>Tổng calories tiêu hao</span>
                <strong>{historySummary.totalCalories.toLocaleString('vi-VN')} <small>kcal</small></strong>
              </div>
            </div>

            {/* History Logs List / Table */}
            {loadingLogs ? (
              <div className="ex-loading-state">
                <div className="spinner-border text-success" role="status" />
                <p>Đang tải lịch sử tập luyện...</p>
              </div>
            ) : logs.length === 0 ? (
              /* Luồng ngoại lệ 3a & 4a */
              <div className="ex-empty-state">
                <i className="bi bi-calendar-x" />
                <h3>Không tìm thấy dữ liệu phù hợp</h3>
                <p>Không có bản ghi bài tập nào trong khoảng thời gian hoặc điều kiện lọc này.</p>
                <div className="ex-empty-actions">
                  <button
                    type="button"
                    className="ex-pill-btn ex-pill-btn--outline"
                    onClick={() => {
                      setHistoryPeriod('all')
                      setHistoryCategory('all')
                    }}
                  >
                    Xem tất cả lịch sử
                  </button>
                  <button
                    type="button"
                    className="ex-pill-btn ex-pill-btn--primary"
                    onClick={() => setActiveTab('catalog')}
                  >
                    Thêm bài tập ngay
                  </button>
                </div>
              </div>
            ) : (
              <div className="ex-log-list">
                {logs.map((log) => (
                  <article key={log._id} className="ex-log-card">
                    <div className="ex-log-left">
                      <div className="ex-log-icon">
                        <i className="bi bi-lightning-fill" />
                      </div>
                      <div className="ex-log-main">
                        <div className="ex-log-title-row">
                          <h4>{log.exerciseName}</h4>
                          <span className="ex-log-date">
                            <i className="bi bi-calendar3" /> {formatDateDisplay(log.date)} {log.time ? `· ${log.time}` : ''}
                          </span>
                        </div>
                        <div className="ex-log-meta-pills">
                          <span className="ex-meta-badge">
                            <i className="bi bi-stopwatch" /> <b>{log.durationMinutes}</b> phút
                          </span>
                          <span className="ex-meta-badge">
                            <i className="bi bi-speedometer2" /> MET: <b>{log.met}</b>
                          </span>
                          <span className="ex-meta-badge">
                            <i className="bi bi-person" /> Cân nặng mốc: <b>{log.weightKg} kg</b>
                          </span>
                          {log.notes && (
                            <span className="ex-meta-notes" title={log.notes}>
                              <i className="bi bi-chat-left-text" /> {log.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ex-log-right">
                      <div className="ex-log-cal-burned">
                        <strong>-{log.caloriesBurned}</strong>
                        <span>kcal tiêu hao</span>
                      </div>
                      <div className="ex-log-actions">
                        {/* Bước 5: Xem chi tiết */}
                        <button
                          type="button"
                          className="ex-action-btn"
                          title="Xem chi tiết"
                          onClick={() => setDetailLog(log)}
                        >
                          <i className="bi bi-eye" />
                        </button>
                        {/* Luồng 5a: Sửa */}
                        <button
                          type="button"
                          className="ex-action-btn"
                          title="Sửa bản ghi"
                          onClick={() => handleOpenEdit(log)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        {/* Luồng 5b: Xóa */}
                        <button
                          type="button"
                          className="ex-action-btn ex-action-btn--delete"
                          title="Xóa bài tập"
                          onClick={() => setDeletingLog(log)}
                        >
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

      {/* =========================================================================
          MODAL 1: GHI NHẬN BÀI TẬP (UC21)
          ========================================================================= */}
      {loggingExercise && (
        <div className="ex-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ex-modal-box">
            <div className="ex-modal-header">
              <div>
                <span className="ex-modal-eyebrow">
                  <i className="bi bi-activity" /> Ghi nhận bài tập (UC21)
                </span>
                <h3>{loggingExercise.name}</h3>
              </div>
              <button
                type="button"
                className="ex-modal-close"
                onClick={() => setLoggingExercise(null)}
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="ex-modal-body">
              {/* Exercise Meta Information */}
              <div className="ex-modal-ex-info">
                <div className="ex-info-chip">
                  <span>Chỉ số MET:</span>
                  <b>{loggingExercise.met}</b>
                </div>
                <div className="ex-info-chip">
                  <span>Cường độ:</span>
                  <b>{loggingExercise.intensity}</b>
                </div>
                <div className="ex-info-chip">
                  <span>Cân nặng của bạn:</span>
                  <b>{userWeight ? `${userWeight} kg` : 'Chưa thiết lập'}</b>
                </div>
              </div>

              {/* Exception 5b Alert */}
              {(!userWeight || userWeight <= 0) && (
                <div className="ex-modal-error">
                  <i className="bi bi-exclamation-octagon-fill" />
                  <div>
                    <strong>Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe</strong>
                    <p>Hệ thống không thể ước tính calories nếu thiếu dữ liệu cân nặng.</p>
                    <Link to="/profile" className="ex-link-inline">
                      Đi đến Hồ sơ sức khỏe →
                    </Link>
                  </div>
                </div>
              )}

              {/* Form Inputs */}
              <div className="ex-form-row">
                <div className="ex-form-group">
                  <label htmlFor="logDate">Ngày tập luyện:</label>
                  <input
                    id="logDate"
                    type="date"
                    max={getTodayStr()}
                    value={logForm.date}
                    onChange={(e) => setLogForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="ex-form-group">
                  <label htmlFor="logTime">Giờ thực hiện:</label>
                  <input
                    id="logTime"
                    type="time"
                    value={logForm.time}
                    onChange={(e) => setLogForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Duration Input & Quick Chips */}
              <div className="ex-form-group">
                <div className="ex-label-row">
                  <label htmlFor="logDuration">Thời lượng tập (phút):</label>
                  <span className="ex-label-hint">Thời lượng phải lớn hơn 0</span>
                </div>
                <input
                  id="logDuration"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  placeholder="Nhập số phút (ví dụ: 30)"
                  value={logForm.durationMinutes}
                  onChange={(e) => handleDurationChange(e.target.value)}
                />
                <div className="ex-quick-chips">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`ex-quick-chip ${Number(logForm.durationMinutes) === mins ? 'active' : ''}`}
                      onClick={() => handleDurationChange(mins)}
                    >
                      +{mins} phút
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes Input */}
              <div className="ex-form-group">
                <label htmlFor="logNotes">Ghi chú buổi tập (tùy chọn):</label>
                <input
                  id="logNotes"
                  type="text"
                  maxLength={500}
                  placeholder="Cảm nhận buổi tập, nhịp tim trung bình, quãng đường..."
                  value={logForm.notes}
                  onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* Formula & Calculation Box (UC21 Bước 8 & 9) */}
              <div className="ex-calc-box">
                <div className="ex-calc-header">
                  <div className="ex-calc-title">
                    <i className="bi bi-lightning-charge-fill" /> Ước tính Calories tiêu hao
                  </div>
                  <button
                    type="button"
                    className="ex-btn-calc-refresh"
                    onClick={handleManualCalculate}
                    title="Tính lại calories"
                  >
                    <i className="bi bi-arrow-clockwise" /> Tính calories
                  </button>
                </div>

                <div className="ex-calc-result-row">
                  <div className="ex-calc-value">
                    <strong>{estimatedCalories}</strong>
                    <span>kcal tiêu hao</span>
                  </div>
                  <div className="ex-calc-formula-sub">
                    <code>({loggingExercise.met} MET × 3.5 × {userWeight || 'kg'} × {logForm.durationMinutes || 0}') / 200</code>
                  </div>
                </div>

                <p className="ex-calc-disclaimer">
                  * Kết quả là lượng calories tiêu hao ước tính dựa trên chuẩn ACSM, không phải giá trị đo trực tiếp tuyệt đối.
                </p>
              </div>

              {/* Inline Error (Ngoại lệ 5a, 5b, 7c) */}
              {logError && (
                <div className="ex-inline-error">
                  <i className="bi bi-exclamation-circle" /> {logError}
                </div>
              )}
            </div>

            <div className="ex-modal-footer">
              <button
                type="button"
                className="ex-btn-secondary"
                onClick={() => setLoggingExercise(null)}
                disabled={savingLog}
              >
                Hủy thao tác
              </button>
              <button
                type="button"
                className="ex-btn-primary"
                onClick={handleSaveLog}
                disabled={savingLog || !userWeight || userWeight <= 0 || Number(logForm.durationMinutes) <= 0}
              >
                {savingLog ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle" /> Lưu vào lịch sử
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CHI TIẾT BÀI TẬP (UC22 Luồng chính bước 6)
          ========================================================================= */}
      {detailLog && (
        <div className="ex-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ex-modal-box">
            <div className="ex-modal-header">
              <div>
                <span className="ex-modal-eyebrow">
                  <i className="bi bi-info-circle" /> Chi tiết bài tập đã ghi nhận
                </span>
                <h3>{detailLog.exerciseName}</h3>
              </div>
              <button
                type="button"
                className="ex-modal-close"
                onClick={() => setDetailLog(null)}
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="ex-modal-body">
              <div className="ex-detail-grid">
                <div className="ex-detail-row">
                  <span>Ngày thực hiện:</span>
                  <b>{formatDateDisplay(detailLog.date)}</b>
                </div>
                <div className="ex-detail-row">
                  <span>Thời gian:</span>
                  <b>{detailLog.time || 'Không ghi nhận'}</b>
                </div>
                <div className="ex-detail-row">
                  <span>Thời lượng tập:</span>
                  <b>{detailLog.durationMinutes} phút</b>
                </div>
                <div className="ex-detail-row">
                  <span>Cân nặng lúc tính:</span>
                  <b>{detailLog.weightKg} kg</b>
                </div>
                <div className="ex-detail-row">
                  <span>Chỉ số MET:</span>
                  <b>{detailLog.met}</b>
                </div>
                <div className="ex-detail-row ex-detail-row--highlight">
                  <span>Calories tiêu hao ước tính:</span>
                  <strong className="text-success">{detailLog.caloriesBurned} kcal</strong>
                </div>
                {detailLog.notes && (
                  <div className="ex-detail-row">
                    <span>Ghi chú:</span>
                    <p className="mb-0">{detailLog.notes}</p>
                  </div>
                )}
              </div>

              <div className="ex-detail-formula-box">
                <div className="ex-detail-formula-title">
                  <i className="bi bi-lightbulb" /> Công thức ước tính đã áp dụng:
                </div>
                <code>
                  Calories = ({detailLog.met} MET × 3.5 × {detailLog.weightKg} kg × {detailLog.durationMinutes} phút) / 200 = {detailLog.caloriesBurned} kcal
                </code>
              </div>
            </div>

            <div className="ex-modal-footer">
              <button
                type="button"
                className="ex-btn-secondary"
                onClick={() => setDetailLog(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="ex-btn-primary"
                onClick={() => {
                  const target = detailLog
                  setDetailLog(null)
                  handleOpenEdit(target)
                }}
              >
                <i className="bi bi-pencil" /> Chỉnh sửa bài tập này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: CHỈNH SỬA BÀI TẬP (UC22 Luồng 5a)
          ========================================================================= */}
      {editingLog && (
        <div className="ex-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ex-modal-box">
            <div className="ex-modal-header">
              <div>
                <span className="ex-modal-eyebrow">
                  <i className="bi bi-pencil" /> Chỉnh sửa bài tập (UC22)
                </span>
                <h3>Chỉnh sửa: {editingLog.exerciseName}</h3>
              </div>
              <button
                type="button"
                className="ex-modal-close"
                onClick={() => setEditingLog(null)}
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="ex-modal-body">
              {/* Change Exercise Selector */}
              <div className="ex-form-group">
                <label htmlFor="editExerciseId">Bài tập:</label>
                <select
                  id="editExerciseId"
                  value={editForm.exerciseId}
                  onChange={(e) => handleEditDurationChange(editForm.durationMinutes, e.target.value)}
                  className="ex-select-full"
                >
                  {exercises.map((ex) => (
                    <option key={ex._id} value={ex._id}>
                      {ex.name} (MET: {ex.met} - {ex.categoryName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="ex-form-row">
                <div className="ex-form-group">
                  <label htmlFor="editDate">Ngày tập:</label>
                  <input
                    id="editDate"
                    type="date"
                    max={getTodayStr()}
                    value={editForm.date}
                    onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="ex-form-group">
                  <label htmlFor="editTime">Giờ:</label>
                  <input
                    id="editTime"
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Duration Input */}
              <div className="ex-form-group">
                <div className="ex-label-row">
                  <label htmlFor="editDuration">Thời lượng tập (phút):</label>
                  <span className="ex-label-hint">Thời lượng phải lớn hơn 0</span>
                </div>
                <input
                  id="editDuration"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  value={editForm.durationMinutes}
                  onChange={(e) => handleEditDurationChange(e.target.value)}
                />
                <div className="ex-quick-chips">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`ex-quick-chip ${Number(editForm.durationMinutes) === mins ? 'active' : ''}`}
                      onClick={() => handleEditDurationChange(mins)}
                    >
                      +{mins} phút
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="ex-form-group">
                <label htmlFor="editNotes">Ghi chú:</label>
                <input
                  id="editNotes"
                  type="text"
                  maxLength={500}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* Auto Recalculated Calories Box (UC22 Luồng 9a) */}
              <div className="ex-calc-box">
                <div className="ex-calc-header">
                  <div className="ex-calc-title">
                    <i className="bi bi-arrow-repeat" /> Tự động tính lại Calories
                  </div>
                </div>

                <div className="ex-calc-result-row">
                  <div className="ex-calc-value">
                    <strong>{editEstimatedCalories}</strong>
                    <span>kcal tiêu hao sau cập nhật</span>
                  </div>
                  <div className="ex-calc-diff">
                    (Ban đầu: <b>{editingLog.caloriesBurned} kcal</b>)
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {editError && (
                <div className="ex-inline-error">
                  <i className="bi bi-exclamation-circle" /> {editError}
                </div>
              )}
            </div>

            <div className="ex-modal-footer">
              <button
                type="button"
                className="ex-btn-secondary"
                onClick={() => setEditingLog(null)}
                disabled={savingEdit}
              >
                Hủy
              </button>
              <button
                type="button"
                className="ex-btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit || Number(editForm.durationMinutes) <= 0}
              >
                {savingEdit ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" /> Đang cập nhật...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" /> Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: XÁC NHẬN XÓA (UC22 Luồng 5b)
          ========================================================================= */}
      {deletingLog && (
        <div className="ex-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ex-modal-box ex-modal-box--delete">
            <div className="ex-delete-icon">
              <i className="bi bi-exclamation-circle" />
            </div>
            <h3>Xác nhận xóa bài tập?</h3>
            <p>
              Bạn có chắc chắn muốn xóa bản ghi <strong>{deletingLog.exerciseName}</strong> ({deletingLog.durationMinutes} phút, {deletingLog.caloriesBurned} kcal) vào ngày {formatDateDisplay(deletingLog.date)}?
            </p>
            <p className="ex-delete-subtext">
              Thao tác này sẽ xóa bản ghi khỏi lịch sử và tự động cập nhật lại tổng lượng calories tiêu hao tương ứng.
            </p>

            <div className="ex-modal-footer ex-modal-footer--center">
              <button
                type="button"
                className="ex-btn-secondary"
                onClick={() => setDeletingLog(null)}
                disabled={isDeleting}
              >
                Hủy thao tác
              </button>
              <button
                type="button"
                className="ex-btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" /> Đang xóa...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3" /> Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="dashboard-footer">
        <span className="footer-copy">
          <b><i className="bi bi-leaf-fill" /></b> © 2026 NutriLens Health Inc. Đồng hành dinh dưỡng &amp; vận động thông minh.
        </span>
        <span className="footer-links">
          Điều khoản dịch vụ · Chính sách bảo mật y tế · Chuẩn hóa MET (ACSM)
        </span>
      </footer>
    </div>
  )
}
