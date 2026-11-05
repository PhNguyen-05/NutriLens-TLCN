import UserHeader from '../../components/common/UserHeader'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'
import UserFooter from '../../components/common/UserFooter'

function resolveAvatarUrl(value) {
  const url = String(value || '').trim()
  if (/^(https?:|data:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

function localDate() {
  return new Date().toLocaleDateString('sv-SE')
}

function formatDateVi(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12, 0, 0)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const raw = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const formatted = raw.charAt(0).toUpperCase() + raw.slice(1)
  return isToday ? `Hôm nay (${formatted})` : formatted
}

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  if (!apiOrigin) return url
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`
}

function mealTypeInfo(type) {
  switch (type) {
    case 'breakfast':
      return { label: 'Bữa Sáng', icon: '🍳', tone: '#10b981' }
    case 'lunch':
      return { label: 'Bữa Trưa', icon: '🍲', tone: '#f59e0b' }
    case 'dinner':
      return { label: 'Bữa Tối', icon: '🥗', tone: '#3b82f6' }
    case 'snack':
    default:
      return { label: 'Bữa Phụ', icon: '🥪', tone: '#8b5cf6' }
  }
}

function formatArticleCategory(article) {
  const cat = article?.category || article?.categoryTags?.[0] || 'Dinh dưỡng'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

function formatArticleDate(dateStr) {
  if (!dateStr) return 'Gần đây'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Gần đây'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const ARTICLE_CATEGORY_FALLBACKS = {
  vitamin: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
  'tiểu đường': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=500&auto=format&fit=crop&q=80',
  'sức khỏe': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&auto=format&fit=crop&q=80',
  'sức khoẻ': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&auto=format&fit=crop&q=80',
  'dinh dưỡng': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&auto=format&fit=crop&q=80',
  'mẹo ăn uống': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'vận động': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80',
  'tập luyện': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80',
}

const DEFAULT_ARTICLE_COVER = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500&auto=format&fit=crop&q=80'

function getArticleFallbackImage(category = '') {
  const normalized = String(category).trim().toLowerCase()
  for (const [key, url] of Object.entries(ARTICLE_CATEGORY_FALLBACKS)) {
    if (normalized.includes(key)) return url
  }
  return DEFAULT_ARTICLE_COVER
}

function getArticleExcerpt(content, maxLength = 80) {
  if (!content) return ''
  const clean = String(content)
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`_~>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean
}

function DashboardArticleCard({ article }) {
  const navigate = useNavigate()
  const category = formatArticleCategory(article)
  const publishDate = formatArticleDate(article.publishedAt || article.createdAt)
  const resolvedUrl = resolveMediaUrl(article?.imageUrl)
  const fallbackUrl = getArticleFallbackImage(category)
  const [currentImg, setCurrentImg] = useState(resolvedUrl || fallbackUrl)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const nextUrl = resolveMediaUrl(article?.imageUrl) || getArticleFallbackImage(category)
    setCurrentImg(nextUrl)
    setImageError(false)
  }, [article?.imageUrl, category])

  const handleImageError = () => {
    if (currentImg !== fallbackUrl) {
      setCurrentImg(fallbackUrl)
    } else {
      setImageError(true)
    }
  }

  const excerpt = getArticleExcerpt(article.content, 75)

  const handleCardClick = (e) => {
    if (!e.target.closest('a') && !e.target.closest('button')) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      navigate(`/articles/${article._id}`)
    }
  }

  const handleLinkClick = (e) => {
    e.stopPropagation()
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  return (
    <article className="dashboard-article-card" onClick={handleCardClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(e) }}>
      <div className="article-card-cover-wrap" aria-label={article.title} onClick={handleCardClick}>
        {!imageError ? (
          <img
            src={currentImg}
            alt={article.title}
            className="article-card-img"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="article-card-fallback-cover">
            <i className="bi bi-journal-richtext" />
          </div>
        )}
        <span className="article-card-badge">{category}</span>
      </div>

      <div className="article-card-content">
        <div className="article-card-meta">
          <span><i className="bi bi-calendar3" /> {publishDate}</span>
          {Boolean(article.viewCount) && (
            <span><i className="bi bi-eye" /> {article.viewCount}</span>
          )}
        </div>

        <h3 className="article-card-title" title={article.title}>
          <Link to={`/articles/${article._id}`} onClick={handleLinkClick}>
            {article.title}
          </Link>
        </h3>

        {excerpt && (
          <p className="article-card-snippet" title={excerpt}>
            {excerpt}
          </p>
        )}

        <div className="article-card-action">
          <Link to={`/articles/${article._id}`} className="article-card-read-more" onClick={handleLinkClick}>
            Đọc tiếp <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>
    </article>
  )
}


function AnimatedNumber({ value, duration = 600 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const target = typeof value === 'number' ? value : parseInt(String(value).replace(/\D/g, ''), 10) || 0

  useEffect(() => {
    if (target === 0) {
      setDisplayValue(0)
      return
    }
    const startTime = performance.now()
    let frameId

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(easeOut * target))
      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(target)
      }
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [target, duration])

  return <>{displayValue.toLocaleString('vi-VN')}</>
}

function MetricCardSkeleton() {
  return (
    <article className="metric-card metric-skeleton">
      <div className="skeleton-box skeleton-icon" />
      <div className="skeleton-box" style={{ width: '60%', height: '12px', margin: '4px 0 10px' }} />
      <div className="skeleton-box" style={{ width: '85%', height: '26px', margin: '8px 0' }} />
      <div className="skeleton-box" style={{ width: '100%', height: '6px', margin: '8px 0 6px' }} />
      <div className="skeleton-box" style={{ width: '45%', height: '10px' }} />
    </article>
  )
}

function MealRowSkeleton() {
  return (
    <div className="meal-row meal-skeleton-row">
      <div className="skeleton-box" style={{ width: '84px', height: '74px', borderRadius: '8px' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        <div className="skeleton-box" style={{ width: '35%', height: '12px' }} />
        <div className="skeleton-box" style={{ width: '60%', height: '16px' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <div className="skeleton-box" style={{ width: '55px', height: '18px', borderRadius: '12px' }} />
          <div className="skeleton-box" style={{ width: '55px', height: '18px', borderRadius: '12px' }} />
          <div className="skeleton-box" style={{ width: '55px', height: '18px', borderRadius: '12px' }} />
        </div>
      </div>
      <div className="skeleton-box" style={{ width: '55px', height: '18px', alignSelf: 'center' }} />
    </div>
  )
}

function ArticleCardSkeleton() {
  return (
    <div className="dashboard-article-card skeleton-card">
      <div className="skeleton-box" style={{ width: '100%', height: '145px', borderRadius: 0 }} />
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="skeleton-box" style={{ width: '40%', height: '12px' }} />
        <div className="skeleton-box" style={{ width: '90%', height: '18px' }} />
        <div className="skeleton-box" style={{ width: '70%', height: '14px' }} />
        <div className="skeleton-box" style={{ width: '30%', height: '12px', marginTop: '10px', alignSelf: 'flex-end' }} />
      </div>
    </div>
  )
}

function formatDateViShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function PanelHeading({ title, subtitle, action }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function HealthMetricsPanel({ profile, loading, onQuickLog, baselineStatus }) {
  const metrics = profile?.healthMetrics
  const hasMetrics = metrics?.bmi != null && metrics?.bmr != null && metrics?.tdee != null

  if (loading) {
    return (
      <article className="content-panel bmi-panel">
        <PanelHeading title="Chỉ số cơ thể" />
        <p>Đang tải chỉ số sức khỏe...</p>
      </article>
    )
  }

  if (!hasMetrics) {
    return (
      <article className="content-panel bmi-panel bmi-panel--empty">
        <PanelHeading title="Chỉ số cơ thể" />
        <p>Vui lòng hoàn tất hồ sơ sức khỏe để xem chỉ số BMI/BMR/TDEE</p>
        <Link to="/profile">Hoàn tất hồ sơ</Link>
      </article>
    )
  }

  const bmiTone = metrics.bmiCategory === 'Bình thường' ? 'healthy' : 'attention'

  return (
    <article className="content-panel bmi-panel">
      <PanelHeading
        title="Chỉ số cơ thể"
        subtitle="Tự động tính theo hồ sơ sức khỏe mới nhất"
        action={
          <Link to="/profile" title="Chỉnh sửa hồ sơ & mục tiêu dinh dưỡng">
            <i className="bi bi-pencil-square" />
          </Link>
        }
      />
      <div className="bmi-stats">
        <span>
          Cân nặng mốc<strong>{profile.currentWeightKg} <small>kg</small></strong>
          <em>{metrics.bmiCategory}</em>
        </span>
        <span>
          Chỉ số BMI<strong>{metrics.bmi} <small>kg/m²</small></strong>
          <em className={bmiTone}>WHO châu Á</em>
        </span>
      </div>
      <p>
        <i className="bi bi-fire" /> BMR: <b>{metrics.bmr} kcal/ngày</b>
        <span>
          <i className="bi bi-lightning-charge" /> TDEE: <b>{metrics.tdee} kcal/ngày</b>
        </span>
      </p>

      {/* Thông báo chu kỳ 14 ngày hoặc ân hạn */}
      {baselineStatus?.canReviewMilestone && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: '#ecfdf5', border: '1.5px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '0.84rem', color: '#065f46' }}>
            <strong>🎉 Hoàn thành chu kỳ 14 ngày!</strong>
            <div style={{ fontSize: '0.78rem', color: '#047857' }}>Đã có thể cập nhật lại mốc cân nặng và tính lại Calo.</div>
          </div>
          <Link to="/profile" style={{ padding: '6px 12px', background: '#059669', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Xem lại →
          </Link>
        </div>
      )}

      {baselineStatus?.isLocked && (
        <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="bi bi-lock-fill" style={{ color: '#d97706' }} />
          <span>Bảo lưu chu kỳ 14 ngày: <b>Ngày {baselineStatus.daysElapsed}/14</b> (còn {baselineStatus.daysRemaining} ngày)</span>
        </div>
      )}

      {baselineStatus?.inGracePeriod && (
        <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="bi bi-clock-history" style={{ color: '#2563eb' }} />
          <span>Điều chỉnh cân nặng hiện tại: <b>còn {baselineStatus.hoursRemainingInGrace} giờ</b></span>
        </div>
      )}

      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
        <span>Mục tiêu calo: <b>{profile.nutritionGoal?.calorieTarget ? `${profile.nutritionGoal.calorieTarget.toLocaleString('vi-VN')} kcal` : 'Chưa thiết lập'}</b></span>
        <Link to="/profile" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          {profile.nutritionGoal?.calorieTarget ? 'Chỉnh sửa →' : 'Thiết lập ngay →'}
        </Link>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onQuickLog}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46',
            fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <i className="bi bi-speedometer2" /> Cân hôm nay
        </button>
        <Link
          to="/weight-tracker"
          style={{
            padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
            fontWeight: 600, fontSize: '0.84rem', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}
          title="Xem biểu đồ & lịch sử cân nặng"
        >
          Tiến trình <i className="bi bi-arrow-right" />
        </Link>
      </div>
    </article>
  )
}

export default function DashboardPage() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const scanUploadInputRef = useRef(null)

  const [healthProfile, setHealthProfile] = useState(null)
  const [baselineStatus, setBaselineStatus] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  // Danh sách bài viết blog thực tế từ hệ thống
  const [blogArticles, setBlogArticles] = useState([])
  const [blogLoading, setBlogLoading] = useState(true)

  // Ngày được chọn để xem thống kê (mặc định hôm nay)
  const todayStr = localDate()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [dashboardData, setDashboardData] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const firstName = user?.fullName?.split(' ')[0] || 'bạn'

  // Tải dữ liệu thống kê từ API khi selectedDate thay đổi
  useEffect(() => {
    let isActive = true
    setStatsLoading(true)

    axiosInstance
      .get('/profile/dashboard-stats', { params: { date: selectedDate } })
      .then(({ data }) => {
        if (!isActive) return
        setDashboardData(data)
        setHealthProfile(data.profile || null)
        setBaselineStatus(data.baselineStatus || null)
      })
      .catch((err) => {
        console.error('[DashboardPage] Không thể tải dữ liệu thống kê:', err)
      })
      .finally(() => {
        if (isActive) {
          setStatsLoading(false)
          setMetricsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [selectedDate])

  // Tải danh sách bài viết blog thực tế từ hệ thống
  useEffect(() => {
    let isActive = true
    axiosInstance
      .get('/blog')
      .then(({ data }) => {
        if (!isActive) return
        const list = Array.isArray(data?.data) ? data.data : []
        setBlogArticles(list.slice(0, 4))
      })
      .catch((err) => {
        console.error('[DashboardPage] Không thể tải bài viết blog:', err)
      })
      .finally(() => {
        if (isActive) setBlogLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  function handlePrevDay() {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const prev = new Date(y, m - 1, d - 1, 12, 0, 0)
    setSelectedDate(prev.toLocaleDateString('sv-SE'))
  }

  function handleNextDay() {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1, 12, 0, 0)
    const nextStr = next.toLocaleDateString('sv-SE')
    if (nextStr <= todayStr) {
      setSelectedDate(nextStr)
    }
  }

  function handleGoToWeightTrackerToLog() {
    navigate('/weight-tracker', { state: { openLog: true } })
  }

  function handleScanImageSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) navigate('/food-scan', { state: { scanImageFile: file } })
  }

  function handleScanImageDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) navigate('/food-scan', { state: { scanImageFile: file } })
  }

  function openFoodCamera() {
    navigate('/food-scan', { state: { openFoodCamera: true } })
  }

  // --- TRÍCH XUẤT SỐ LIỆU THỐNG KÊ THẬT TỪ API ---
  const targetCalo = dashboardData?.targets?.calorieTarget || healthProfile?.nutritionGoal?.calorieTarget || 1850
  const targetProtein = dashboardData?.targets?.proteinTarget || healthProfile?.nutritionGoal?.proteinG || 110
  const targetCarbs = dashboardData?.targets?.carbsTarget || healthProfile?.nutritionGoal?.carbsG || 210
  const targetFat = dashboardData?.targets?.fatTarget || healthProfile?.nutritionGoal?.fatG || 55

  const eatenCalo = dashboardData?.todayNutrition?.calories || 0
  const eatenProtein = dashboardData?.todayNutrition?.protein || 0
  const eatenCarbs = dashboardData?.todayNutrition?.carbs || 0
  const eatenFat = dashboardData?.todayNutrition?.fat || 0

  const burnedCalo = dashboardData?.todayExercise?.caloriesBurned || 0
  const exerciseMinutes = dashboardData?.todayExercise?.durationMinutes || 0
  const workoutCount = dashboardData?.todayExercise?.workoutCount || 0

  const netCalories = dashboardData?.netCalories ?? (eatenCalo - burnedCalo)
  const remainingCalo = targetCalo - eatenCalo + burnedCalo

  // Tỉ lệ phần trăm thực tế (không bị giới hạn 100% để hiển thị đúng khi vượt ngưỡng)
  const realCaloPct = targetCalo > 0 ? Math.round((eatenCalo / targetCalo) * 100) : 0
  const realProteinPct = targetProtein > 0 ? Math.round((eatenProtein / targetProtein) * 100) : 0
  const realCarbsPct = targetCarbs > 0 ? Math.round((eatenCarbs / targetCarbs) * 100) : 0
  const realFatPct = targetFat > 0 ? Math.round((eatenFat / targetFat) * 100) : 0

  const caloPct = Math.min(100, realCaloPct)
  const proteinPct = Math.min(100, realProteinPct)
  const carbsPct = Math.min(100, realCarbsPct)
  const fatPct = Math.min(100, realFatPct)

  // 4 thẻ chỉ số dinh dưỡng chính được chuẩn hóa theo mã màu nhóm chất
  const dynamicMetrics = [
    {
      icon: 'bi-fire',
      label: 'Tổng năng lượng',
      numericVal: eatenCalo,
      unit: '',
      targetStr: `/ ${targetCalo.toLocaleString('vi-VN')} kcal`,
      progress: `${caloPct}%`,
      progressText: `${realCaloPct}% mục tiêu`,
      note: remainingCalo >= 0 ? `Còn ${remainingCalo.toLocaleString('vi-VN')} kcal` : `Vượt ${Math.abs(remainingCalo).toLocaleString('vi-VN')} kcal`,
      theme: realCaloPct > 105 ? 'metric-theme-coral' : 'metric-theme-green',
    },
    {
      icon: 'bi-lightning-charge-fill',
      label: 'Đạm (Protein)',
      numericVal: Math.round(eatenProtein),
      unit: 'g',
      targetStr: `/ ${targetProtein} g`,
      progress: `${proteinPct}%`,
      progressText: `${realProteinPct}% mục tiêu`,
      note: targetProtein > eatenProtein ? `Thiếu ${Math.round(targetProtein - eatenProtein)}g` : 'Đã đạt chuẩn',
      theme: 'metric-theme-coral', // Đỏ san hô (#f43f5e)
    },
    {
      icon: 'bi-pie-chart-fill',
      label: 'Tinh bột (Carbs)',
      numericVal: Math.round(eatenCarbs),
      unit: 'g',
      targetStr: `/ ${targetCarbs} g`,
      progress: `${carbsPct}%`,
      progressText: `${realCarbsPct}% mục tiêu`,
      note: targetCarbs >= eatenCarbs ? (targetCarbs === eatenCarbs ? 'Đã đủ mục tiêu' : `Còn ${Math.round(targetCarbs - eatenCarbs)}g`) : `Vượt ${Math.round(eatenCarbs - targetCarbs)}g`,
      theme: 'metric-theme-amber', // Vàng cam năng lượng (#f59e0b)
    },
    {
      icon: 'bi-droplet-fill',
      label: 'Chất béo (Fat)',
      numericVal: Math.round(eatenFat),
      unit: 'g',
      targetStr: `/ ${targetFat} g`,
      progress: `${fatPct}%`,
      progressText: `${realFatPct}% mục tiêu`,
      note: targetFat >= eatenFat ? (targetFat === eatenFat ? 'Đã đủ mục tiêu' : `Còn ${Math.round(targetFat - eatenFat)}g`) : `Vượt ${Math.round(eatenFat - targetFat)}g`,
      theme: 'metric-theme-blue', // Xanh dương dịu (#3b82f6)
    },
  ]

  const goalTitles = {
    lose_weight: 'Giảm cân (Thâm hụt 500 kcal)',
    gain_weight: 'Tăng cân (Dư thừa 350 kcal)',
    maintain_weight: 'Duy trì cân nặng',
  }
  const goalText = healthProfile?.nutritionGoal?.goal
    ? `Mục tiêu: ${goalTitles[healthProfile.nutritionGoal.goal] || 'Dinh dưỡng cá nhân hóa'} (${targetCalo} kcal/ngày)`
    : 'Mục tiêu dinh dưỡng: Chưa thiết lập'

  function getAiWelcomeAdvice() {
    const isPast = selectedDate !== todayStr
    if (eatenCalo === 0 && burnedCalo === 0) {
      return isPast
        ? `Ngày ${formatDateViShort(selectedDate)} chưa có dữ liệu bữa ăn hoặc bài tập nào được ghi nhận.`
        : `Chào ${firstName}! Bạn chưa ghi nhận bữa ăn hoặc bài tập nào hôm nay. Hãy dùng camera bên cạnh để chụp hoặc tải ảnh món ăn đầu tiên và theo dõi mục tiêu nhé!`
    }
    if (eatenCalo === 0 && burnedCalo > 0) {
      return isPast
        ? `Ngày ${formatDateViShort(selectedDate)}: Đã tiêu hao xuất sắc ${burnedCalo} kcal qua bài tập vận động.`
        : `Chào ${firstName}! Bạn đã tiêu hao xuất sắc ${burnedCalo} kcal qua vận động hôm nay. Hãy nhớ nạp thêm bữa ăn giàu protein để nuôi dưỡng và phục hồi cơ bắp nhé!`
    }
    if (eatenCarbs > targetCarbs * 0.75 && eatenProtein < targetProtein * 0.5) {
      return isPast
        ? `💡 Ngày ${formatDateViShort(selectedDate)}: Lượng tinh bột khá cao (${eatenCarbs}g Carbs / ${eatenProtein}g Protein), thiếu hụt đạm so với mục tiêu.`
        : `💡 Lượng tinh bột hôm nay đang khá cao (${eatenCarbs}g Carbs / ${eatenProtein}g Protein). Bữa tiếp theo bạn nên ưu tiên thêm ức gà, trứng hoặc cá hồi và nhiều rau xanh để cân bằng đạm nhé!`
    }
    if (eatenCalo > targetCalo * 1.05) {
      const over = eatenCalo - targetCalo
      return isPast
        ? `⚡ Ngày ${formatDateViShort(selectedDate)}: Nạp ${eatenCalo.toLocaleString('vi-VN')} kcal (vượt ${over.toLocaleString('vi-VN')} kcal so với mục tiêu).`
        : `⚡ Hôm nay bạn đã nạp ${eatenCalo.toLocaleString('vi-VN')} kcal (vượt ${over.toLocaleString('vi-VN')} kcal so với mục tiêu). Hãy cân nhắc tập luyện thêm 20-30 phút hoặc đi bộ nhẹ để cân bằng calo!`
    }
    if (eatenProtein < targetProtein * 0.6) {
      const missing = Math.round(targetProtein - eatenProtein)
      return isPast
        ? `🥩 Ngày ${formatDateViShort(selectedDate)}: Lượng Protein đạt ${eatenProtein}g (còn thiếu ${missing}g so với mục tiêu chuẩn).`
        : `🥩 Lượng Protein hiện tại đạt ${eatenProtein}g (còn thiếu ${missing}g). Hãy ưu tiên thực phẩm giàu đạm như ức gà, cá, trứng hoặc đậu hũ cho bữa tiếp theo nhé!`
    }
    return isPast
      ? `✨ Ngày ${formatDateViShort(selectedDate)}: Kiểm soát dinh dưỡng tốt! Nạp ${eatenCalo.toLocaleString('vi-VN')} / ${targetCalo.toLocaleString('vi-VN')} kcal với ${eatenProtein}g Protein.`
      : `✨ Bạn đang kiểm soát dinh dưỡng rất tốt! Đã nạp ${eatenCalo.toLocaleString('vi-VN')} / ${targetCalo.toLocaleString('vi-VN')} kcal với ${eatenProtein}g Protein. Cố gắng tiếp tục duy trì phong độ nhé!`
  }

  // Danh sách món ăn của ngày đang chọn (backend đã sắp xếp mới nhất lên đầu)
  const meals = dashboardData?.meals || []
  // 3 món mới nhất trong ngày hiện tại theo yêu cầu người dùng
  const todayLatestMeals = meals.slice(0, 3)

  // Danh sách bài tập thực tế hôm nay
  const exercises = dashboardData?.exercises || []
  // Dữ liệu biểu đồ 7 ngày gần nhất
  const weeklyDays = dashboardData?.weeklyDays || []
  const maxCaloInWeek = Math.max(targetCalo, ...weeklyDays.map((d) => Math.max(d.caloriesIn || 0, d.caloriesOut || 0))) || 2000
  const avgDeficit = dashboardData?.avgDeficit || 0
  const streak = dashboardData?.streak || 0
  // Mục tiêu tiêu hao từ profile (exercise target hoặc ~20% TDEE, tối thiểu 300 kcal)
  const burnTarget = Math.max(300, Math.round((healthProfile?.healthMetrics?.tdee || 2000) * 0.2))

  const isToday = selectedDate === todayStr

  return (
    <div className="dashboard-shell">
      <UserHeader />

      <main className="dashboard-main">
        {/* THANH ĐIỀU HƯỚNG NGÀY & MỤC TIÊU */}
        <section className="dashboard-daybar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <strong>
              <i className="bi bi-calendar3" /> {formatDateVi(selectedDate)}
            </strong>
            {streak > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#fff7ed',
                  color: '#ea580c',
                  border: '1px solid #fed7aa',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
                title="Chuỗi ngày liên tiếp ghi nhận nhật ký dinh dưỡng hoặc tập luyện"
              >
                🔥 Chuỗi {streak} ngày
              </span>
            )}
          </div>
          <div className="day-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handlePrevDay}
              title="Ngày trước đó"
              style={{ padding: '6px 10px', cursor: 'pointer' }}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => {
                const val = e.target.value
                if (val && val <= todayStr) {
                  setSelectedDate(val)
                }
              }}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '0.85rem',
                color: '#1f2937',
                background: '#fff',
                cursor: 'pointer',
              }}
              title="Chọn ngày thống kê"
            />
            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDate >= todayStr}
              title="Ngày kế tiếp"
              style={{ padding: '6px 10px', cursor: selectedDate >= todayStr ? 'not-allowed' : 'pointer', opacity: selectedDate >= todayStr ? 0.4 : 1 }}
            >
              <i className="bi bi-chevron-right" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                style={{ padding: '6px 12px', background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
              >
                Hôm nay
              </button>
            )}
          </div>
        </section>

        {!metricsLoading && (!healthProfile || !healthProfile.heightCm) && (
          <div style={{ margin: '12px 0', padding: '12px 18px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="bi bi-info-circle-fill" style={{ color: '#059669', fontSize: '1.2rem' }} />
              <span style={{ color: '#065f46', fontSize: '0.92rem', fontWeight: 500 }}>
                Bạn chưa hoàn tất hồ sơ sức khỏe. Hãy cập nhật để NutriLens cá nhân hóa các chỉ số BMR, TDEE và mục tiêu dinh dưỡng!
              </span>
            </div>
            <Link to="/profile" style={{ padding: '6px 14px', background: '#059669', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
              Thiết lập ngay
            </Link>
          </div>
        )}

        {/* INTRO GRID: TỔNG QUAN NĂNG LƯỢNG & SCANNER */}
        <section className="dashboard-intro-grid">
          <article className="welcome-panel smart-ai-panel">
            <h1>Xin chào {firstName}!</h1>

            <div className="ai-insight-box">
              <div className="ai-insight-icon">
                <i className="bi bi-robot" />
              </div>
              <div className="ai-insight-content">
                <div className="ai-insight-title">
                  <span>Lời khuyên cá nhân hóa cho bạn</span>
                </div>
                <p className="ai-insight-text">{getAiWelcomeAdvice()}</p>
              </div>
            </div>
          </article>

          <article className="scanner-panel">
            <div className="scanner-heading">
              <span>Nhận diện món ăn</span>
              <small onClick={() => navigate('/meal-diary')} style={{ cursor: 'pointer' }}>Lịch sử bữa ăn</small>
            </div>
            <div
              className="scanner-box"
              role="button"
              tabIndex={0}
              aria-label="Chọn hoặc kéo thả ảnh món ăn để nhận diện"
              onClick={() => scanUploadInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  scanUploadInputRef.current?.click()
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleScanImageDrop}
            >
              <i className="bi bi-camera2" />
              <strong>Chụp ảnh hoặc kéo thả món ăn</strong>
              <small>Nhận diện nhanh món ăn &amp; phân tích calo bằng AI</small>
            </div>
            <div className="scanner-actions">
              <button type="button" className="scanner-button" onClick={openFoodCamera}>
                <i className="bi bi-camera" /> Bật Camera Quét
              </button>
              <button
                type="button"
                className="scanner-upload"
                title="Tải ảnh món ăn"
                aria-label="Tải ảnh món ăn"
                onClick={() => scanUploadInputRef.current?.click()}
              >
                <i className="bi bi-file-earmark-arrow-up" />
              </button>
              <input
                ref={scanUploadInputRef}
                className="scanner-file-input"
                type="file"
                accept="image/*"
                aria-label="Chọn ảnh món ăn"
                onChange={handleScanImageSelected}
              />
            </div>
          </article>
        </section>

        {/* 4 THẺ CHỈ SỐ DINH DƯỠNG TRONG NGÀY (4 CỘT CÂN ĐỐI) */}
        <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {statsLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            dynamicMetrics.map((item) => (
              <article className={`metric-card ${item.theme}`} key={item.label}>
                <div className={`metric-icon ${item.theme}`}>
                  <i className={`bi ${item.icon}`} />
                </div>
                <span>{item.label}</span>
                <strong>
                  <AnimatedNumber value={item.numericVal} />
                  {item.unit && <span style={{ marginLeft: '2px', fontSize: '18px' }}>{item.unit}</span>}
                  <small>{item.targetStr}</small>
                </strong>
                <div className="metric-progress">
                  <i style={{ width: item.progress }} className={item.theme} />
                </div>
                <em className={item.theme}>{item.progressText || `${item.progress} mục tiêu`}</em>
                <small>{item.note}</small>
              </article>
            ))
          )}
        </section>

        {/* CỘT NHẬT KÝ MÓN ĂN & CHỈ SỐ CƠ THỂ */}
        <section className="dashboard-columns">
          <article className="content-panel meal-panel">
            <PanelHeading
              title={`Món ăn ${selectedDate === todayStr ? 'hôm nay' : selectedDate} (3 món mới nhất)`}
              subtitle="Danh sách 3 món ăn mới nhất được ghi nhận trong ngày"
              action={
                <span className="heading-chip">
                  {todayLatestMeals.length > 0 ? `${todayLatestMeals.length} món mới nhất` : 'Chưa có món ăn'}
                </span>
              }
            />

            {statsLoading ? (
              <div className="meal-skeleton-container" style={{ padding: '4px 0' }}>
                <MealRowSkeleton />
                <MealRowSkeleton />
                <MealRowSkeleton />
              </div>
            ) : todayLatestMeals.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', margin: '14px 0', border: '1.5px dashed #cbd5e1' }}>
                <i className="bi bi-journal-x" style={{ fontSize: '2.4rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }} />
                <strong style={{ display: 'block', fontSize: '0.98rem', color: '#334155', marginBottom: '4px' }}>
                  Chưa có món ăn nào trong ngày {selectedDate === todayStr ? 'hôm nay' : selectedDate}
                </strong>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.85rem' }}>
                  Món ăn được nhận diện từ mục quét phía trên sẽ hiển thị tại đây.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/meal-diary?date=${selectedDate}`)}
                    style={{ padding: '8px 18px', background: '#008560', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    <i className="bi bi-journal-text" /> Xem nhật ký bữa ăn
                  </button>
                </div>
              </div>
            ) : (
              todayLatestMeals.map((meal) => {
                const meta = mealTypeInfo(meal.mealType)
                const imageSrc = resolveMediaUrl(meal.imageUrl)
                return (
                  <div className="meal-row" key={meal._id}>
                    <div className="meal-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f1f5f9' }}>
                      {imageSrc ? (
                        <img src={imageSrc} alt={meal.foodName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '2rem' }}>{meta.icon}</span>
                      )}
                      {meal.confidence && <small>AI: {Math.round(meal.confidence)}%</small>}
                    </div>
                    <div className="meal-details">
                      <small style={{ color: meta.tone, fontWeight: 700 }}>
                        {meta.label} · {meal.servings} khẩu phần
                      </small>
                      <h3>{meal.foodName}</h3>
                      <div className="meal-macros-row">
                        <span className="macro-badge macro-protein">
                          <i className="macro-dot protein-dot" /> Protein {meal.protein}g
                        </span>
                        <span className="macro-badge macro-carbs">
                          <i className="macro-dot carbs-dot" /> Carbs {meal.carbs}g
                        </span>
                        <span className="macro-badge macro-fat">
                          <i className="macro-dot fat-dot" /> Fat {meal.fat}g
                        </span>
                      </div>
                    </div>
                    <strong className="meal-kcal">{meal.calories} kcal</strong>
                  </div>
                )
              })
            )}

            {meals.length > 0 && (
              <div className="meal-footer">
                <b>Tổng năng lượng các bữa ăn:</b>
                <span>{eatenCalo.toLocaleString('vi-VN')} kcal ({meals.length} món)</span>
                <small>Xem và quản lý thực đơn đầy đủ tại trang Nhật ký bữa ăn</small>
                <button type="button" onClick={() => navigate(`/meal-diary?date=${selectedDate}`)}>
                  <i className="bi bi-journal-text" /> Xem toàn bộ nhật ký
                </button>
              </div>
            )}
          </article>

          <aside className="side-stack">
            <HealthMetricsPanel
              profile={healthProfile}
              loading={metricsLoading}
              onQuickLog={handleGoToWeightTrackerToLog}
              baselineStatus={baselineStatus}
            />
          </aside>
        </section>

        {/* BIỂU ĐỒ 7 NGÀY (CÂN BẰNG CHUYỂN HÓA NĂNG LƯỢNG) */}
        <section className="dashboard-columns lower-grid" style={{ gridTemplateColumns: '1fr' }}>
          <article className="content-panel chart-panel">
            <PanelHeading
              title="Cân bằng năng lượng tuần: Nạp vào vs Tiêu hao"
              subtitle="Dữ liệu tổng hợp 7 ngày gần nhất giữa bữa ăn và vận động"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="chart-legend">
                    <span>Nạp vào (kcal)</span>
                    <span>Tiêu hao (kcal)</span>
                  </div>
                  <Link to="/trends" style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '4px 10px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                    Chỉ số &amp; Xu hướng <i className="bi bi-arrow-right" />
                  </Link>
                </div>
              }
            />
            {statsLoading ? (
              <div style={{ height: '128px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
                <i className="bi bi-arrow-repeat" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.85rem' }}>Đang tổng hợp dữ liệu chuyển hóa tuần...</span>
              </div>
            ) : (
              <div className="bar-chart">
                {weeklyDays.map((day) => {
                const inHeight = Math.min(95, Math.max(day.caloriesIn > 0 ? 6 : 2, Math.round(((day.caloriesIn || 0) / maxCaloInWeek) * 95)))
                const outHeight = Math.min(95, Math.max(day.caloriesOut > 0 ? 6 : 2, Math.round(((day.caloriesOut || 0) / maxCaloInWeek) * 95)))
                const isDaySelected = day.date === selectedDate

                return (
                  <div
                    className="bar-day"
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    style={{ cursor: 'pointer', opacity: isDaySelected ? 1 : 0.85 }}
                    title={`Ngày ${day.date}: Nạp ${day.caloriesIn} kcal | Tiêu hao ${day.caloriesOut} kcal`}
                  >
                    <div>
                      <i style={{ height: `${inHeight}px`, outline: isDaySelected ? '2px solid #064e3b' : 'none' }} />
                      <b style={{ height: `${outHeight}px` }} />
                    </div>
                    <small style={{ fontWeight: isDaySelected ? 700 : 400, color: isDaySelected ? '#047857' : '#5e6e69' }}>
                      {day.dayLabel}
                    </small>
                  </div>
                )
              })}
              </div>
            )}
            <div className="chart-summary">
              <span>
                Thâm hụt TB tuần
                <strong className={avgDeficit > 0 ? 'orange-text' : ''}>
                  {avgDeficit > 0 ? `+${avgDeficit}` : avgDeficit} kcal / ngày
                </strong>
              </span>
              <span>
                Tuân thủ Macro
                <strong>{caloPct >= 75 && caloPct <= 110 ? 'Chuẩn mục tiêu' : `${caloPct}% năng lượng`}</strong>
              </span>
              <span>
                Đánh giá chuyển hóa
                <strong className={eatenCalo > targetCalo * 1.05 ? 'orange-text' : ''}>
                  {(() => {
                    const goal = healthProfile?.nutritionGoal?.goal
                    if (goal === 'gain_weight') {
                      return eatenCalo >= targetCalo ? 'Thặng dư tăng cân' : 'Chưa đủ thặng dư'
                    }
                    if (goal === 'lose_weight') {
                      return eatenCalo <= targetCalo ? 'Thâm hụt đốt mỡ' : 'Vượt mức calo'
                    }
                    return Math.abs(eatenCalo - targetCalo) <= targetCalo * 0.1 ? 'Cân bằng lý tưởng' : (eatenCalo > targetCalo ? 'Dư năng lượng' : 'Thâm hụt nhẹ')
                  })()}
                </strong>
              </span>
            </div>
          </article>
        </section>

        {/* KHỐI BÀI TẬP HÔM NAY */}
        <section className="content-panel workout-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Hoạt động thể chất &amp; Vận động</span>
              <h2>Bài tập ngày {selectedDate === todayStr ? 'hôm nay' : selectedDate}</h2>
              <p>
                Đã ghi nhận <b>{workoutCount} bài tập</b> · Tiêu hao <b>{burnedCalo} kcal</b> ({exerciseMinutes} phút vận động)
              </p>
            </div>
            <div>
              <button className="solid-button" onClick={() => navigate('/exercise')}>
                ⊕ Thêm bài tập
              </button>
            </div>
          </div>
          <div className="workout-content">
            <div>
              {exercises.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <i className="bi bi-person-walking" style={{ fontSize: '2rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }} />
                  <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '0.85rem' }}>
                    Chưa có bài tập nào được ghi nhận cho ngày này.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/exercise')}
                    style={{ padding: '6px 14px', background: '#008560', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ⊕ Ghi nhận buổi tập
                  </button>
                </div>
              ) : (
                exercises.slice(0, 3).map((ex, index) => (
                  <div className={`workout-row ${index === 0 ? 'focus' : ''}`} key={ex._id}>
                    <b>
                      {ex.category === 'cardio' ? '🏃' : ex.category === 'strength' ? '🏋' : ex.category === 'flexibility' ? '🧘' : '⚽'}
                    </b>
                    <span>
                      <strong>{ex.exerciseName}</strong>
                      <small>
                        {ex.durationMinutes} phút · Tiêu hao {ex.caloriesBurned} kcal
                        {ex.time ? ` · Lúc ${ex.time}` : ''}
                        {ex.notes ? ` · ${ex.notes}` : ''}
                      </small>
                    </span>
                    <button type="button" onClick={() => navigate('/exercise?tab=history')}>
                      Xem nhật ký →
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="energy-box">
              <b>Tổng quan thể lực</b>
              <span>
                Tiến độ tiêu hao <strong>{burnedCalo} / {burnTarget} kcal ({Math.min(100, Math.round((burnedCalo / burnTarget) * 100))}%)</strong>
              </span>
              <div className="energy-progress">
                <i style={{ width: `${Math.min(100, Math.round((burnedCalo / burnTarget) * 100))}%` }} />
              </div>
              <div className="energy-values">
                <b>
                  {exerciseMinutes}
                  <small>Thời gian tập (phút)</small>
                </b>
                <b>
                  {netCalories >= 0 ? `+${netCalories}` : netCalories}
                  <small>Calo ròng (kcal)</small>
                </b>
                <b>
                  {workoutCount}
                  <small>Bài tập đã hoàn thành</small>
                </b>
              </div>
              <p>
                <b>Gợi ý vận động:</b> {burnedCalo >= burnTarget ? 'Tuyệt vời! Bạn đã hoàn thành mức vận động lý tưởng hôm nay để tăng cường trao đổi chất.' : `Dành thêm 15-20 phút đi bộ nhanh hoặc nhảy dây để đạt mốc ${burnTarget} kcal tiêu hao nhé!`}
              </p>
            </div>
          </div>
        </section>

        {/* BÀI VIẾT & TIN TỨC */}
        <section className="content-panel articles-panel">
          <PanelHeading
            title="Kiến thức & Đời sống"
            subtitle="Cập nhật kiến thức dinh dưỡng khoa học, mẹo ăn uống lành mạnh và lối sống cân bằng"
            action={<Link to="/articles" className="articles-heading-link">Xem tất cả bài viết →</Link>}
          />
          {blogLoading ? (
            <div className="article-grid">
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </div>
          ) : blogArticles.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              <i className="bi bi-journal-x" style={{ fontSize: '1.75rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }} />
              Chưa có bài viết nào được xuất bản.
            </div>
          ) : (
            <div className="article-grid">
              {blogArticles.map((article) => (
                <DashboardArticleCard key={article._id} article={article} />
              ))}
            </div>
          )}
        </section>
      </main>

      <UserFooter />
    </div>
  )
}
