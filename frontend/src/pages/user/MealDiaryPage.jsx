import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import FoodNavMenu from '../../components/common/FoodNavMenu'
import ExerciseNavMenu from '../../components/common/ExerciseNavMenu'
import UserNavMenu from '../../components/common/UserNavMenu'

const MEALS = [
  { value: 'breakfast', label: 'Bữa sáng', icon: 'bi-sunrise', color: '#13a879' },
  { value: 'lunch', label: 'Bữa trưa', icon: 'bi-sun', color: '#f3a73b' },
  { value: 'snack', label: 'Bữa phụ', icon: 'bi-cup-hot', color: '#a45af5' },
  { value: 'dinner', label: 'Bữa tối', icon: 'bi-moon-stars', color: '#5685df' },
]
const HIDDEN_FOOD_MESSAGE = 'Món ăn đã bị ẩn khỏi danh mục, bạn không thể chỉnh sửa bản ghi này'

function localDate() {
  return new Date().toLocaleDateString('sv-SE')
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
}

function moveDate(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toLocaleDateString('sv-SE')
}

function formatDate(value, options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) {
  return new Intl.DateTimeFormat('vi-VN', options).format(new Date(`${value}T12:00:00`))
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  if (!apiOrigin) return url
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`
}

function amount(value, digits = 0) {
  const number = Number(value || 0)
  return number.toLocaleString('vi-VN', { maximumFractionDigits: digits })
}

function logValue(log, key) {
  return Number(log.nutrition?.[key] || 0) * Number(log.servings || 1)
}

function DiaryImage({ log }) {
  const [failed, setFailed] = useState(false)
  const src = resolveMediaUrl(log.imageUrl)

  return (
    <div className={`fd-food-image ${src && !failed ? 'has-image' : ''}`}>
      {src && !failed && <img src={src} alt={`Ảnh ${log.foodName}`} onError={() => setFailed(true)} />}
      <i className="bi bi-image" aria-hidden="true" />
    </div>
  )
}

export default function MealDiaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(() => {
    const requestedDate = searchParams.get('date')
    return validDate(requestedDate) ? requestedDate : localDate()
  })
  const [activeMeal, setActiveMeal] = useState('all')
  const [logs, setLogs] = useState([])
  const [totals, setTotals] = useState(null)
  const [loadedDate, setLoadedDate] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [editingLog, setEditingLog] = useState(null)
  const [viewingLog, setViewingLog] = useState(null)
  const [editForm, setEditForm] = useState({ date: '', mealType: 'lunch', servings: '1' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingLogId, setDeletingLogId] = useState(null)
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const firstName = user?.fullName?.split(' ')[0] || 'bạn'
  const loading = loadedDate !== date

  useEffect(() => {
    let active = true
    axiosInstance.get('/food/meal-logs', { params: { date } })
      .then(({ data }) => {
        if (!active) return
        setLogs(data.logs || [])
        setTotals(data.totals || null)
        setError('')
        setLoadedDate(date)
      })
      .catch(() => {
        if (!active) return
        setLogs([])
        setTotals(null)
        setError('Không thể tải nhật ký bữa ăn. Vui lòng thử lại.')
        setLoadedDate(date)
      })
    return () => { active = false }
  }, [date, reloadKey])

  useEffect(() => {
    let active = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (active) setProfile(data.profile || null) })
      .catch(() => { if (active) setProfile(null) })
    return () => { active = false }
  }, [])

  const groupedMeals = useMemo(() => MEALS.map((meal) => ({
    ...meal,
    logs: logs.filter((log) => log.mealType === meal.value),
  })).filter((meal) => meal.logs.length > 0), [logs])

  const visibleMeals = activeMeal === 'all'
    ? groupedMeals
    : groupedMeals.filter((meal) => meal.value === activeMeal)

  const calories = Number(totals?.calories || 0)
  const protein = Number(totals?.protein || 0)
  const carbs = Number(totals?.carbs || 0)
  const fat = Number(totals?.fat || 0)
  const goals = profile?.nutritionGoal || {}
  const targets = {
    calories: Number(goals.calorieTarget || 1850),
    protein: Number(goals.proteinG || 100),
    carbs: Number(goals.carbsG || 210),
    fat: Number(goals.fatG || 55),
  }
  const calorieProgress = Math.min(100, Math.round((calories / targets.calories) * 100))
  const mealCalories = groupedMeals.map((meal) => ({
    ...meal,
    calories: meal.logs.reduce((sum, log) => sum + logValue(log, 'calories'), 0),
  }))
  const totalMealCalories = mealCalories.reduce((sum, meal) => sum + meal.calories, 0)
  const chartStops = mealCalories.map((meal, index) => {
    const start = mealCalories.slice(0, index).reduce((sum, entry) => (
      sum + (totalMealCalories ? (entry.calories / totalMealCalories) * 100 : 0)
    ), 0)
    const end = start + (totalMealCalories ? (meal.calories / totalMealCalories) * 100 : 0)
    return `${meal.color} ${start}% ${end}%`
  })
  const mealChart = totalMealCalories ? `conic-gradient(${chartStops.join(', ')})` : 'conic-gradient(#e8efed 0% 100%)'
  const macroShares = [
    { key: 'protein', label: 'Protein', grams: protein, energy: protein * 4, color: '#13a879' },
    { key: 'carbs', label: 'Carbs', grams: carbs, energy: carbs * 4, color: '#f2a139' },
    { key: 'fat', label: 'Fats', grams: fat, energy: fat * 9, color: '#a45af5' },
  ]
  const totalMacroEnergy = macroShares.reduce((sum, macro) => sum + macro.energy, 0)

  function changeDate(nextDate) {
    setDate(nextDate)
    setSearchParams({ date: nextDate }, { replace: true })
  }

  function openEdit(log) {
    if (log.foodHidden) {
      setViewingLog(log)
      return
    }
    setEditingLog(log)
    setEditError('')
    setEditForm({
      date: log.date || date,
      mealType: log.mealType || 'lunch',
      servings: String(log.servings || 1),
    })
  }

  async function saveEdit(event) {
    event.preventDefault()
    setSavingEdit(true)
    setEditError('')
    try {
      await axiosInstance.patch(`/food/meal-logs/${editingLog._id}`, {
        date: editForm.date,
        mealType: editForm.mealType,
        servings: Number(editForm.servings),
      })
      setEditingLog(null)
      if (editForm.date !== date) changeDate(editForm.date)
      else {
        setLoadedDate(null)
        setReloadKey((key) => key + 1)
      }
    } catch (requestError) {
      const message = requestError.response?.data?.message
      if (requestError.response?.status === 409 && message === HIDDEN_FOOD_MESSAGE) {
        setEditingLog(null)
        setViewingLog({ ...editingLog, foodHidden: true })
        setLoadedDate(null)
        setReloadKey((key) => key + 1)
      } else {
        setEditError(message || 'Không thể cập nhật món ăn.')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteLog(log) {
    if (!window.confirm(`Xóa ${log.foodName} khỏi nhật ký bữa ăn?`)) return false
    setDeletingLogId(log._id)
    setError('')
    try {
      await axiosInstance.delete(`/food/meal-logs/${log._id}`)
      setLoadedDate(null)
      setReloadKey((key) => key + 1)
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể xóa món ăn khỏi nhật ký.')
      return false
    } finally {
      setDeletingLogId(null)
    }
  }

  async function deleteViewedLog() {
    if (await deleteLog(viewingLog)) setViewingLog(null)
  }

  const viewingMealLabel = MEALS.find((meal) => meal.value === viewingLog?.mealType)?.label || 'Không xác định'

  const metricCards = [
    { key: 'calories', label: 'Tổng calories ngày này', value: amount(calories), target: amount(targets.calories), unit: 'kcal', icon: 'bi-fire', tone: 'calories', percent: calorieProgress },
    { key: 'protein', label: 'Đạm (Protein)', value: amount(protein, 1), target: amount(targets.protein), unit: 'g', icon: 'bi-droplet-half', tone: 'protein', percent: Math.min(100, Math.round((protein / targets.protein) * 100)) },
    { key: 'carbs', label: 'Tinh bột (Carbs)', value: amount(carbs, 1), target: amount(targets.carbs), unit: 'g', icon: 'bi-lightning-charge', tone: 'carbs', percent: Math.min(100, Math.round((carbs / targets.carbs) * 100)) },
    { key: 'fat', label: 'Chất béo', value: amount(fat, 1), target: amount(targets.fat), unit: 'g', icon: 'bi-droplet', tone: 'fat', percent: Math.min(100, Math.round((fat / targets.fat) * 100)) },
  ]

  return (
    <div className="dashboard-shell foodscan-shell fd-shell">
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard"><span><i className="bi bi-leaf-fill" /></span>NutriLens</Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <FoodNavMenu />
          <ExerciseNavMenu />
          <Link to="/weight-tracker">Tiến trình &amp; Cân nặng</Link>
          <Link to="/dashboard">Cộng đồng</Link>
          <Link to="/articles">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search"><i className="bi bi-search" />Tra cứu thực phẩm, món ăn...</span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo"><i className="bi bi-bell" /></button>
          <UserNavMenu />
        </div>
      </header>

      <main className="fd-main">
        <section className="fd-heading">
          <div><h1>Nhật ký bữa ăn hằng ngày</h1><p>Theo dõi và ghi nhận các bữa ăn trong ngày để đảm bảo dinh dưỡng và đạt được mục tiêu sức khỏe của bạn.</p></div>
          <Link className="fd-back-button" to="/food-scan"><i className="bi bi-arrow-left" />Quay lại nhận diện món ăn</Link>
        </section>

        <section className="fd-toolbar" aria-label="Chọn ngày và lọc bữa ăn">
          <div className="fd-date-control">
            <button type="button" onClick={() => changeDate(moveDate(date, -1))} aria-label="Ngày trước"><i className="bi bi-chevron-left" /></button>
            <label><i className="bi bi-calendar3" /><span>{formatDate(date)}</span><input type="date" value={date} onChange={(event) => event.target.value && changeDate(event.target.value)} aria-label="Chọn ngày nhật ký" /></label>
            <button type="button" onClick={() => changeDate(moveDate(date, 1))} aria-label="Ngày sau" disabled={date >= localDate()}><i className="bi bi-chevron-right" /></button>
            <button className="fd-today-button" type="button" onClick={() => changeDate(localDate())}>Hôm nay</button>
          </div>
          <div className="fd-meal-filters" role="group" aria-label="Lọc theo bữa">
            <button className={activeMeal === 'all' ? 'active' : ''} type="button" onClick={() => setActiveMeal('all')}>Tất cả bữa ăn</button>
            {MEALS.map((meal) => <button className={activeMeal === meal.value ? 'active' : ''} type="button" key={meal.value} onClick={() => setActiveMeal(meal.value)}>{meal.label}</button>)}
          </div>
        </section>

        {error && <div className="fd-alert" role="alert"><i className="bi bi-exclamation-circle" />{error}<button type="button" onClick={() => { setLoadedDate(null); setError(''); setReloadKey((key) => key + 1) }}>Thử lại</button></div>}

        <section className="fd-metric-grid" aria-label="Tổng dinh dưỡng trong ngày">
          {metricCards.map((metric) => <article className={`fd-metric-card ${metric.tone}`} key={metric.key}>
            <span className={`fd-metric-icon ${metric.key === 'calories' ? 'calorie-progress-ring' : ''}`} style={metric.key === 'calories' ? { '--metric-progress': `${metric.percent}%` } : undefined}>
              {metric.key === 'calories' ? <span><i className={`bi ${metric.icon}`} /><small>{metric.percent}%</small></span> : <i className={`bi ${metric.icon}`} />}
            </span>
            <div className="fd-metric-body"><small>{metric.label}</small><strong>{metric.value}<span> / {metric.target} {metric.unit}</span></strong><div className="fd-progress"><i style={{ width: `${metric.percent}%` }} /></div><em>{metric.key === 'calories' ? `${metric.percent}% mục tiêu` : `Còn ${amount(Math.max(0, targets[metric.key] - Number({ protein, carbs, fat }[metric.key])), 1)} ${metric.unit}`}</em></div>
          </article>)}
        </section>

        <section className="fd-content-grid">
          <article className="fd-panel fd-meal-panel">
            <header className="fd-panel-heading"><div><h2><i className="bi bi-fork-knife" />Chi tiết các bữa ăn trong ngày</h2><p>{formatDate(date)}</p></div><span className="fd-entry-count">{logs.length} món</span></header>
            {loading ? <div className="fd-state"><span className="fs-mini-spinner" />Đang tải nhật ký...</div> : visibleMeals.length ? <div className="fd-meal-groups">
              {visibleMeals.map((meal) => <section className="fd-meal-group" key={meal.value}>
                <header><span className="fd-meal-label" style={{ '--meal-color': meal.color }}><i className={`bi ${meal.icon}`} />{meal.label}</span><strong>{amount(meal.logs.reduce((sum, log) => sum + logValue(log, 'calories'), 0))} kcal</strong></header>
                {meal.logs.map((log) => <article className={`fd-food-row ${log.foodHidden ? 'is-food-hidden' : ''}`} key={log._id}>
                  <DiaryImage log={log} />
                  <div className="fd-food-copy"><h3>{log.foodName}</h3>{log.foodHidden && <span className="fd-hidden-food-badge"><i className="bi bi-eye-slash-fill" />Món ăn đã bị ẩn</span>}<p><i className="bi bi-clock" />{formatTime(log.createdAt)}<span>·</span>{amount(log.servings || 1, 1)} khẩu phần</p><div className="fd-food-macros"><span className="protein"><i className="bi bi-droplet-half" />Đạm {amount(logValue(log, 'protein'), 1)}g</span><span className="carbs"><i className="bi bi-lightning-charge" />Carbs {amount(logValue(log, 'carbs'), 1)}g</span><span className="fat"><i className="bi bi-droplet" />Béo {amount(logValue(log, 'fat'), 1)}g</span></div></div>
                  <div className="fd-food-actions"><strong className="fd-food-calories">{amount(logValue(log, 'calories'))}<small>kcal</small></strong><div>{log.foodHidden ? <button type="button" className="fd-edit-button" onClick={() => setViewingLog(log)}><i className="bi bi-eye" />Chi tiết</button> : <button type="button" className="fd-edit-button" onClick={() => openEdit(log)}><i className="bi bi-pencil" />Sửa</button>}<button type="button" className="fd-delete-button" onClick={() => deleteLog(log)} disabled={deletingLogId === log._id}><i className="bi bi-trash3" />{deletingLogId === log._id ? 'Đang xóa' : 'Xóa'}</button></div></div>
                </article>)}
              </section>)}
            </div> : <div className="fd-empty"><span><i className="bi bi-journal-plus" /></span><strong>{activeMeal === 'all' ? 'Chưa có món ăn trong ngày này' : `Chưa có món ${MEALS.find((meal) => meal.value === activeMeal)?.label.toLowerCase()} nào`}</strong><p>Ghi nhận món ăn để theo dõi calories và dinh dưỡng tại đây.</p><Link to="/food-scan"><i className="bi bi-camera" />Nhận diện món ăn</Link></div>}
          </article>

          <aside className="fd-side-column">
            <article className="fd-panel fd-distribution-panel">
              <header className="fd-panel-heading"><div><h2><i className="bi bi-pie-chart-fill" />Phân bố calories</h2><p>Theo từng bữa ăn</p></div></header>
              {loading ? <div className="fd-side-loading"><span className="fs-mini-spinner" /></div> : <>
                <div className="fd-calorie-chart-row"><div className="fd-calorie-chart" style={{ background: mealChart }}><span><strong>{amount(calories)}</strong><small>kcal</small></span></div><div className="fd-distribution-legend">{MEALS.map((meal) => {
                  const row = mealCalories.find((entry) => entry.value === meal.value)
                  const value = row?.calories || 0
                  const percent = totalMealCalories ? Math.round((value / totalMealCalories) * 100) : 0
                  return <div key={meal.value}><i style={{ background: meal.color }} /><span>{meal.label}</span><small>{percent}%</small><strong>{amount(value)} kcal</strong></div>
                })}</div></div>
                <div className="fd-side-total"><span>Tổng năng lượng đã ghi</span><strong>{amount(calories)} <small>kcal</small></strong></div>
              </>}
            </article>

            <article className="fd-panel fd-macro-panel">
              <header className="fd-panel-heading"><div><h2><i className="bi bi-bar-chart-line-fill" />Tỷ lệ đa lượng (Macro Split)</h2><p>Tỷ lệ ước tính từ các món đã ghi nhận.</p></div></header>
              <div className="fd-macro-split">{macroShares.map((macro) => {
                const percent = totalMacroEnergy ? Math.round((macro.energy / totalMacroEnergy) * 100) : 0
                return <div className="fd-macro-share" key={macro.key}>
                  <span className="fd-macro-share-ring" style={{ '--macro-color': macro.color, '--macro-progress': `${percent}%` }}><strong>{percent}%</strong></span>
                  <strong>{macro.label}</strong><small>{amount(macro.grams, 1)} g</small>
                </div>
              })}</div>
              <p className="fd-target-note"><i className="bi bi-info-circle" />Tỷ lệ được tính từ các món đã ghi nhận.</p>
            </article>
          </aside>
        </section>
      </main>
      {viewingLog && <div className="fd-edit-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingLog(null) }}>
        <section className="fd-edit-dialog fd-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-detail-title">
          <header><div><small>NHẬT KÝ BỮA ĂN</small><h2 id="fd-detail-title">Chi tiết bản ghi</h2></div><button type="button" onClick={() => setViewingLog(null)} aria-label="Đóng"><i className="bi bi-x-lg" /></button></header>
          <div className="fd-hidden-food-alert" role="alert"><i className="bi bi-exclamation-triangle-fill" />{HIDDEN_FOOD_MESSAGE}</div>
          <div className="fd-detail-food"><DiaryImage log={viewingLog} /><strong>{viewingLog.foodName}</strong></div>
          <dl className="fd-detail-values">
            <div><dt>Ngày ghi nhận</dt><dd>{formatDate(viewingLog.date)}</dd></div>
            <div><dt>Loại bữa ăn</dt><dd>{viewingMealLabel}</dd></div>
            <div><dt>Khối lượng</dt><dd>{amount(viewingLog.servings || 1, 1)} khẩu phần</dd></div>
            <div><dt>Năng lượng</dt><dd>{amount(logValue(viewingLog, 'calories'))} kcal</dd></div>
            <div><dt>Đạm</dt><dd>{amount(logValue(viewingLog, 'protein'), 1)} g</dd></div>
            <div><dt>Carbs</dt><dd>{amount(logValue(viewingLog, 'carbs'), 1)} g</dd></div>
            <div><dt>Chất béo</dt><dd>{amount(logValue(viewingLog, 'fat'), 1)} g</dd></div>
            <div><dt>Thời gian ghi</dt><dd>{formatTime(viewingLog.createdAt)}</dd></div>
          </dl>
          {error && <p className="fd-edit-error" role="alert">{error}</p>}
          <footer><button type="button" className="fd-detail-delete" onClick={deleteViewedLog} disabled={deletingLogId === viewingLog._id}><i className="bi bi-trash3" />{deletingLogId === viewingLog._id ? 'Đang xóa...' : 'Xóa bản ghi'}</button></footer>
        </section>
      </div>}
      {editingLog && <div className="fd-edit-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingLog(null) }}>
        <form className="fd-edit-dialog" onSubmit={saveEdit} role="dialog" aria-modal="true" aria-labelledby="fd-edit-title">
          <header><div><small>NHẬT KÝ BỮA ĂN</small><h2 id="fd-edit-title">Chỉnh sửa món ăn</h2></div><button type="button" onClick={() => setEditingLog(null)} aria-label="Đóng"><i className="bi bi-x-lg" /></button></header>
          <strong className="fd-edit-food-name">{editingLog.foodName}</strong>
          <label>Ngày ghi nhận<input type="date" value={editForm.date} onChange={(event) => setEditForm((form) => ({ ...form, date: event.target.value }))} required /></label>
          <label>Loại bữa ăn<select value={editForm.mealType} onChange={(event) => setEditForm((form) => ({ ...form, mealType: event.target.value }))}>{MEALS.map((meal) => <option key={meal.value} value={meal.value}>{meal.label}</option>)}</select></label>
          <label>Khẩu phần<input type="number" min="0.1" max="99" step="0.1" value={editForm.servings} onChange={(event) => setEditForm((form) => ({ ...form, servings: event.target.value }))} required /></label>
          {editError && <p className="fd-edit-error" role="alert">{editError}</p>}
          <footer><button type="button" onClick={() => setEditingLog(null)}>Hủy</button><button type="submit" disabled={savingEdit}><i className={`bi ${savingEdit ? 'bi-hourglass-split' : 'bi-check2'}`} />{savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}</button></footer>
        </form>
      </div>}
      <footer className="dashboard-footer"><span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b>© 2026 NutriLens Health Inc. Dinh dưỡng chính xác bắt đầu từ hiểu rõ bữa ăn.</span><span className="footer-links">Điều khoản dịch vụ · Chính sách bảo mật · Trung tâm hỗ trợ</span></footer>
    </div>
  )
}
