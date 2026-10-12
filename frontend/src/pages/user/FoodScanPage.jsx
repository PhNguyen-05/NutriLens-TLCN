/**
 * FoodScanPage.jsx
 * UC13 — Nhận diện món ăn qua ảnh và thêm vào nhật ký bữa ăn.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toLocaleDateString('sv-SE') // 'YYYY-MM-DD' theo locale Sweden
}

function roundN(v, n = 1) {
  return v == null ? 0 : Math.round(Number(v) * 10 ** n) / 10 ** n
}

const MEAL_LABELS = {
  breakfast: 'Bữa sáng',
  lunch:     'Bữa trưa',
  dinner:    'Bữa tối',
  snack:     'Ăn vặt',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thanh confidence với màu động */
function ConfidenceBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  const tone = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low'
  return (
    <div className={`fs-confidence ${tone}`}>
      <span className="fs-confidence-track"><i style={{ width: `${pct}%` }} /></span>
      <strong>{pct}%</strong>
    </div>
  )
}

/** Bảng dinh dưỡng */
function NutritionTable({ nutrition, servings }) {
  if (!nutrition) return null
  const s = servings || 1
  const rows = [
    { label: 'Calories', value: roundN(nutrition.calories * s), unit: 'kcal', tone: 'calories', icon: 'bi-fire' },
    { label: 'Carbohydrate', value: roundN(nutrition.carbs * s), unit: 'g', tone: 'carbs', icon: 'bi-flower1' },
    { label: 'Protein', value: roundN(nutrition.protein * s), unit: 'g', tone: 'protein', icon: 'bi-circle-fill' },
    { label: 'Fat', value: roundN(nutrition.fat * s), unit: 'g', tone: 'fat', icon: 'bi-droplet-fill' },
  ]
  return (
    <div className="fs-macro-grid">
      {rows.map((row) => (
        <article className={`fs-macro-card ${row.tone}`} key={row.label}>
          <span><i className={`bi ${row.icon}`} />{row.label}</span>
          <strong>{row.value}<small> {row.unit}</small></strong>
          <small>{row.tone === 'calories' ? 'Năng lượng' : row.label === 'Protein' ? 'Chất đạm' : row.label === 'Fat' ? 'Chất béo' : 'Tinh bột'}</small>
        </article>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FoodScanPage() {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  // Ảnh preview
  const [preview, setPreview]     = useState(null)   // data URL
  const [fileObj, setFileObj]     = useState(null)   // File object

  // Kết quả AI
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState(null)   // { recognized, predictions, nutrition, message }
  const [scanError, setScanError] = useState(null)

  // Form thêm vào nhật ký
  const [selectedPred, setSelectedPred] = useState(0)   // index trong predictions
  const [servings, setServings]         = useState(1)
  const [date, setDate]                 = useState(todayString)
  const [mealType, setMealType]         = useState('lunch')

  // Trạng thái lưu nhật ký
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)  // { type:'success'|'error', text }
  const [mealLogs, setMealLogs] = useState([])
  const [dailyTotals, setDailyTotals] = useState(null)
  const [logsLoading, setLogsLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const firstName = user?.fullName?.split(' ')[0] || 'bạn'
  const selectedPrediction = result?.predictions?.[selectedPred]
  const targetCalories = Number(profile?.nutritionGoal?.calorieTarget || 2000)

  const loadMealLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const { data } = await axiosInstance.get('/food/meal-logs', { params: { date } })
      setMealLogs(data.logs || [])
      setDailyTotals(data.totals || null)
    } catch {
      setMealLogs([])
      setDailyTotals(null)
    } finally {
      setLogsLoading(false)
    }
  }, [date])

  useEffect(() => {
    let isActive = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (isActive) setProfile(data.profile || null) })
      .catch(() => { if (isActive) setProfile(null) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    loadMealLogs()
  }, [loadMealLogs])

  // ── Handlers ──

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null); setScanError(null); setSaveMsg(null); setSelectedPred(0)
    setFileObj(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) { fileInputRef.current.files = e.dataTransfer.files; handleFileChange({ target: { files: [file] } }) }
  }, [handleFileChange])

  const handleScan = async () => {
    if (!fileObj) return
    setScanning(true); setResult(null); setScanError(null); setSaveMsg(null)
    try {
      const form = new FormData()
      form.append('file', fileObj)
      const { data } = await axiosInstance.post('/food/scan', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      })
      setResult(data)
      setSelectedPred(0)
    } catch (err) {
      setScanError(err.response?.data?.message || 'Không thể kết nối tới server. Vui lòng thử lại.')
    } finally {
      setScanning(false)
    }
  }

  const handleAddLog = async () => {
    if (!result?.recognized) return
    const pred = result.predictions[selectedPred]
    setSaving(true); setSaveMsg(null)
    try {
      await axiosInstance.post('/food/meal-logs', {
        foodSlug:   pred.slug,
        foodName:   pred.name,
        confidence: pred.confidence,
        servings:   Number(servings),
        date,
        mealType,
      })
      setSaveMsg({ type: 'success', text: `Đã thêm "${pred.name}" vào nhật ký ${MEAL_LABELS[mealType]} ngày ${date}!` })
      await loadMealLogs()
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.response?.data?.message || 'Lưu thất bại, vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPreview(null); setFileObj(null); setResult(null)
    setScanError(null); setSaveMsg(null); setSelectedPred(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // ── Render ──
  const dailyCalories = Number(dailyTotals?.calories || 0)
  const calorieProgress = Math.min(100, Math.round((dailyCalories / targetCalories) * 100))
  const recentMeals = [...mealLogs].reverse().slice(0, 3)

  return (
    <div className="dashboard-shell foodscan-shell">
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard"><span><i className="bi bi-leaf-fill" /></span>NutriLens</Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <Link className="active" to="/food-scan">Nhận diện &amp; Đồ ăn</Link>
          <Link to="/dashboard">Luyện tập</Link>
          <Link to="/weight-tracker">Chỉ số &amp; Xu hướng</Link>
          <Link to="/dashboard">Cộng đồng</Link>
          <Link to="/dashboard">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search"><i className="bi bi-search" />Tra cứu thực phẩm, món ăn...</span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo"><i className="bi bi-bell" /></button>
          <div className="profile-menu">
            <button className="dashboard-avatar" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" title="Mở menu tài khoản">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : firstName.charAt(0).toUpperCase()}
            </button>
            {profileOpen && <div className="profile-dropdown" role="menu">
              <div className="profile-name">Xin chào, {firstName}</div>
              <button className="profile-link" onClick={() => navigate('/profile')} role="menuitem"><i className="bi bi-person-circle" /> Hồ sơ cá nhân</button>
              <button className="profile-link" onClick={() => navigate('/weight-tracker')} role="menuitem"><i className="bi bi-activity" /> Tiến trình cân nặng</button>
              <button onClick={handleLogout} role="menuitem"><i className="bi bi-box-arrow-right" /> Đăng xuất</button>
            </div>}
          </div>
        </div>
      </header>

      <main className="dashboard-main foodscan-main">
        <section className="fs-page-heading">
          <span className="fs-page-icon"><i className="bi bi-camera-fill" /></span>
          <div>
            <h1>Nhận Diện &amp; Phân Tích Món Ăn</h1>
            <p>Tải lên hoặc chụp ảnh món ăn, hệ thống AI sẽ tự động nhận diện tên món và cung cấp thông tin dinh dưỡng chi tiết.</p>
          </div>
          <span className="fs-system-status"><i className="bi bi-cpu-fill" /><span><strong>CÔNG NGHỆ AI (CNN)</strong><small>Nhận diện chính xác · Nhanh chóng · Đáng tin cậy</small></span></span>
        </section>

        {(scanError || saveMsg?.type === 'error') && <div className="fs-alert error" role="alert"><i className="bi bi-exclamation-triangle-fill" />{scanError || saveMsg?.text}</div>}
        {saveMsg?.type === 'success' && <div className="fs-alert success" role="status"><i className="bi bi-check-circle-fill" />{saveMsg.text}</div>}

        <section className="fs-workspace">
          <article className="fs-panel fs-upload-panel">
            <div className="fs-upload-tabs">
              <button type="button" className="active" onClick={() => fileInputRef.current?.click()}><i className="bi bi-upload" />Tải ảnh lên</button>
              <button type="button" onClick={() => cameraInputRef.current?.click()}><i className="bi bi-camera" />Chụp ảnh</button>
              {preview && <button type="button" className="fs-reset-button" onClick={reset} aria-label="Xóa ảnh"><i className="bi bi-trash3" /></button>}
            </div>
            <div className="fs-upload-grid">
              <div
                className={`fs-dropzone ${preview ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => !preview && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (!preview && (event.key === 'Enter' || event.key === ' ')) fileInputRef.current?.click() }}
              >
                {preview ? <><i className="bi bi-check-circle-fill" /><strong>Ảnh đã sẵn sàng</strong><span>Kéo ảnh khác vào đây hoặc chọn lại</span></> : <>
                  <span className="fs-upload-cloud"><i className="bi bi-cloud-arrow-up" /></span>
                  <strong>Kéo và thả ảnh vào đây</strong><span>hoặc</span>
                  <span className="fs-choose-file">Chọn ảnh từ máy</span>
                  <small>Hỗ trợ định dạng JPG, PNG tối đa 5MB</small>
                </>}
              </div>
              <div className={`fs-photo-preview ${preview ? 'has-photo' : ''}`}>
                {preview ? <><img src={preview} alt="Ảnh món ăn đã chọn" />{scanning && <div className="fs-scanning-overlay"><span className="fs-scan-ring" /><strong>AI đang phân tích ảnh...</strong></div>}</> : <div className="fs-photo-placeholder"><i className="bi bi-image" /><span>Ảnh món ăn sẽ hiển thị tại đây</span></div>}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} hidden />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} hidden />
            <div className="fs-upload-actions">
              {preview && <button type="button" className="fs-button secondary" onClick={() => fileInputRef.current?.click()}><i className="bi bi-arrow-repeat" />Đổi ảnh</button>}
              <button type="button" className="fs-button primary" onClick={handleScan} disabled={!fileObj || scanning}>
                <i className={`bi ${scanning ? 'bi-hourglass-split' : 'bi-search'}`} />{scanning ? 'Đang nhận diện...' : 'Nhận diện món ăn'}
              </button>
            </div>
          </article>

          <article className="fs-panel fs-top-results">
            <div className="fs-panel-heading"><h2><i className="bi bi-patch-check-fill" />Top 3 kết quả đáng tin cậy nhất</h2><span>AI đề xuất</span></div>
            {result?.predictions?.length ? <div className="fs-prediction-list">
              {result.predictions.slice(0, 3).map((prediction, index) => <button type="button" className={`fs-prediction ${selectedPred === index && result.recognized ? 'selected' : ''}`} key={prediction.slug || prediction.name} onClick={() => result.recognized && setSelectedPred(index)} disabled={!result.recognized}>
                <span className="fs-prediction-rank">{index + 1}</span>
                <span className="fs-prediction-info"><strong>{prediction.name}</strong><ConfidenceBar value={prediction.confidence} /></span>
                {selectedPred === index && result.recognized && <i className="bi bi-check-circle-fill fs-prediction-check" />}
              </button>)}
            </div> : <div className="fs-empty-ranking"><span><i className="bi bi-stars" /></span><strong>Chưa có kết quả nhận diện</strong><p>Tải ảnh món ăn để AI phân tích và xếp hạng các gợi ý phù hợp.</p></div>}
            <div className="fs-top-results-foot"><i className="bi bi-info-circle" />Độ tin cậy được tính theo mức độ phù hợp của hình ảnh.</div>
          </article>
        </section>

        <section className="fs-content-grid">
          <div className="fs-main-column">
            <article className="fs-panel fs-recognition-panel">
              <div className="fs-panel-heading"><h2><i className={`bi ${result?.recognized ? 'bi-check-circle-fill' : 'bi-camera-fill'}`} />Kết quả nhận diện</h2>{result?.recognized && <span className="fs-recognized-tag">Đã xác nhận AI</span>}</div>
              {result?.recognized && selectedPrediction ? <div className="fs-recognition-result">
                {preview && <img className="fs-result-image" src={preview} alt={selectedPrediction.name} />}
                <div className="fs-result-copy">
                  <div className="fs-result-title"><h3>{selectedPrediction.name}</h3><span className="fs-vietnam-food">Món ăn Việt Nam</span></div>
                  <p>{result.nutrition ? `${result.nutrition.servingSize || 0}g · ${roundN(result.nutrition.calories)} kcal mỗi khẩu phần` : 'AI đã tìm thấy món ăn phù hợp trong cơ sở dữ liệu.'}</p>
                  <ConfidenceBar value={selectedPrediction.confidence} />
                </div>
              </div> : result ? <div className="fs-result-empty"><span className="fs-result-empty-icon"><i className="bi bi-exclamation-circle" /></span><div><strong>{result.message || 'Chưa nhận diện được món ăn'}</strong><p>{result.predictions?.length ? 'Hãy chọn lại ảnh rõ hơn hoặc kiểm tra các gợi ý bên cạnh.' : 'Hãy thử ảnh có ánh sáng tốt, nhìn rõ toàn bộ món ăn.'}</p></div></div> : <div className="fs-result-empty"><span className="fs-result-empty-icon"><i className="bi bi-stars" /></span><div><strong>Kết quả phân tích sẽ xuất hiện ở đây</strong><p>Chọn ảnh món ăn và bắt đầu nhận diện để xem tên món cùng độ tin cậy của AI.</p></div></div>}
            </article>

            <article className="fs-panel fs-nutrition-panel" id="fs-nutrition">
              <div className="fs-panel-heading"><div><h2><i className="bi bi-journal-medical" />Thông tin dinh dưỡng (ước tính)</h2><p>Giá trị dinh dưỡng thay đổi theo khẩu phần thực tế.</p></div>
                {result?.nutrition && <label className="fs-serving-select"><select value={servings} onChange={(event) => setServings(Number(event.target.value))} aria-label="Số khẩu phần">{[0.5, 1, 1.5, 2, 3].map((value) => <option key={value} value={value}>{value} khẩu phần ({Math.round((result.nutrition.servingSize || 0) * value)}g)</option>)}</select><i className="bi bi-chevron-down" /></label>}
              </div>
              {result?.recognized && result.nutrition ? <>
                <NutritionTable nutrition={result.nutrition} servings={servings} />
                {result.nutrition.fiber != null && <div className="fs-nutrition-note"><i className="bi bi-lightbulb-fill" /><span><strong>Đánh giá dinh dưỡng</strong>Món ăn cung cấp năng lượng và các nhóm chất theo khẩu phần đã chọn.</span></div>}
                <div className="fs-food-tags"><strong><i className="bi bi-diagram-3-fill" />Thành phần chính</strong><div><span>{selectedPrediction?.name || result.nutrition.foodName}</span><span>Ước tính theo khẩu phần</span><span>Dữ liệu NutriLens</span></div></div>
              </> : <div className="fs-nutrition-empty"><i className="bi bi-bar-chart-line" /><span>{result?.recognized ? 'Chưa có dữ liệu dinh dưỡng cho món này trong hệ thống.' : 'Nhận diện món ăn để xem calories, protein, carbohydrate và chất béo.'}</span></div>}
            </article>
            {result?.recognized && result.nutrition && <button type="button" className="fs-request-food-button"><i className="bi bi-patch-plus" />Yêu cầu bổ sung món ăn</button>}

            {result?.recognized && selectedPrediction && <article className="fs-panel fs-add-log-panel">
              <div className="fs-panel-heading"><h2><i className="bi bi-journal-plus" />Thêm vào nhật ký bữa ăn</h2></div>
              <div className="fs-log-form">
                <label><span>Ngày ghi nhận</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label><span>Bữa ăn</span><select value={mealType} onChange={(event) => setMealType(event.target.value)}>{Object.entries(MEAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Số khẩu phần</span><input type="number" min="0.5" max="10" step="0.5" value={servings} onChange={(event) => setServings(Math.max(0.5, Math.min(10, Number(event.target.value))))} /></label>
                <button type="button" className="fs-button primary" onClick={handleAddLog} disabled={saving}><i className={`bi ${saving ? 'bi-hourglass-split' : 'bi-plus-lg'}`} />{saving ? 'Đang lưu...' : 'Thêm vào nhật ký'}</button>
              </div>
            </article>}

            <article className="fs-panel fs-recent-meals">
              <div className="fs-panel-heading"><div><h2><i className="bi bi-clock-history" />Nhật ký bữa ăn gần đây</h2><p>Các món bạn đã ghi nhận trong ngày {date.split('-').reverse().join('/')}</p></div><Link to="/dashboard">Xem tất cả <i className="bi bi-arrow-right" /></Link></div>
              {logsLoading ? <div className="fs-log-empty"><span className="fs-mini-spinner" />Đang tải nhật ký...</div> : recentMeals.length ? <div className="fs-recent-list">
                {recentMeals.map((log) => <div className="fs-recent-item" key={log._id}>
                  <span className="fs-recent-thumb">{log.imageUrl ? <img src={log.imageUrl} alt="" /> : <i className="bi bi-egg-fried" />}</span>
                  <div><strong>{log.foodName}</strong><small>{MEAL_LABELS[log.mealType] || 'Bữa ăn'} · {log.servings || 1} khẩu phần</small></div>
                  <span className="fs-recent-kcal">{roundN((log.nutrition?.calories || 0) * (log.servings || 1))} kcal</span>
                </div>)}
              </div> : <div className="fs-log-empty"><i className="bi bi-journal-check" />Chưa có món ăn nào được ghi nhận trong ngày này.</div>}
            </article>
          </div>

          <aside className="fs-side-column">
            <article className="fs-panel fs-detail-panel">
              <div className="fs-panel-heading"><h2><i className="bi bi-info-square-fill" />Thông tin chi tiết</h2></div>
              <dl>
                <div><dt>Tên món ăn</dt><dd>{selectedPrediction?.name || result?.nutrition?.foodName || 'Chưa nhận diện'}</dd></div>
                <div><dt>Độ tin cậy AI</dt><dd>{selectedPrediction ? `${roundN(selectedPrediction.confidence, 0)}%` : '—'}</dd></div>
                <div><dt>Khẩu phần cơ sở</dt><dd>{result?.nutrition?.servingSize ? `${result.nutrition.servingSize}g` : '—'}</dd></div>
                <div><dt>Loại bữa ăn</dt><dd>{result?.recognized ? MEAL_LABELS[mealType] || '—' : '—'}</dd></div>
              </dl>
              <div className="fs-data-source"><i className="bi bi-shield-check" />Thông tin được đối chiếu với cơ sở dữ liệu dinh dưỡng NutriLens.</div>
            </article>

            <article className="fs-panel fs-calorie-panel">
              <div className="fs-panel-heading"><h2><i className="bi bi-speedometer2" />Giá trị dinh dưỡng theo ngày</h2><span>ước tính</span></div>
              <div className="fs-calorie-summary">
                <div className="fs-calorie-ring" style={{ '--food-progress': `${calorieProgress}%` }}><span><strong>{roundN(dailyCalories, 0)}</strong><small>kcal</small><em>{calorieProgress}%</em></span></div>
                <p>Đã nạp trong ngày<strong>{roundN(dailyCalories, 0)} / {targetCalories.toLocaleString('vi-VN')} kcal</strong><small>{profile?.nutritionGoal?.calorieTarget ? 'Theo mục tiêu dinh dưỡng cá nhân' : 'Mục tiêu tham chiếu 2.000 kcal'}</small></p>
              </div>
              <div className="fs-calorie-progress"><i style={{ width: `${calorieProgress}%` }} /></div>
              <Link to="/profile" className="fs-text-button">Xem chi tiết mục tiêu <i className="bi bi-arrow-right" /></Link>
            </article>

            <div className="fs-encouragement"><span><i className="bi bi-heart-fill" /></span><p><strong>Bạn đang lựa chọn rất tốt!</strong>Hãy duy trì thói quen ghi nhận để theo dõi dinh dưỡng chính xác hơn.</p></div>
          </aside>
        </section>
      </main>
      <footer className="dashboard-footer"><span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b>© 2026 NutriLens Health Inc. Dinh dưỡng chính xác bắt đầu từ hiểu rõ bữa ăn.</span><span className="footer-links">Điều khoản dịch vụ　 Chính sách bảo mật　 Trung tâm hỗ trợ</span></footer>
    </div>
  )
}

