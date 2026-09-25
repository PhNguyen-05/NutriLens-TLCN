import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'

const meals = [
  ['🍜', 'Phở Bò Tái Lăn Hà Nội', 'Bữa Sáng · 08:15 · Đã xác nhận AI', '485 kcal', ['Protein 28g', 'Carbs 62g', 'Fat 14g', 'Natri 890mg']],
  ['🥗', 'Gỏi Cuốn Tôm Thịt & Sốt Tương Đậu Phộng', 'Bữa Trưa · 12:15 · Đã xác nhận AI', '380 kcal', ['Protein 24g', 'Carbs 45g', 'Fat 8g', 'Chất xơ 6.2g']],
]

const articles = [
  ['Cách kiểm soát đường huyết sau ăn với thực đơn Việt Nam', 'Dinh dưỡng lâm sàng', '5 phút đọc'],
  ['Bóc tách Macro chuẩn xác: Bí quyết từ mô hình AI Vision', 'Thực phẩm & AI', '4 phút đọc'],
  ['Tối ưu lượng đạm (Protein) cho người tập luyện & giảm mỡ', 'Chuyển hóa & Calo', '6 phút đọc'],
  ['5 bí kíp nêm nếm gia vị giảm 40% lượng muối mà vẫn đậm đà', 'Mẹo nấu nướng', '3 phút đọc'],
]

function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function HealthMetricsPanel({ profile, loading }) {
  const metrics = profile?.healthMetrics
  const hasMetrics = metrics?.bmi != null && metrics?.bmr != null && metrics?.tdee != null

  if (loading) {
    return <article className="content-panel bmi-panel"><PanelHeading title="Chỉ số cơ thể" /><p>Đang tải chỉ số sức khỏe...</p></article>
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

  const bmiPosition = Math.min(92, Math.max(8, ((metrics.bmi - 14) / 18) * 100))
  const bmiTone = metrics.bmiCategory === 'Bình thường' ? 'healthy' : 'attention'

  return (
    <article className="content-panel bmi-panel">
      <PanelHeading
        title="Chỉ số cơ thể"
        subtitle="Tự động tính theo hồ sơ sức khỏe mới nhất"
        action={
          <Link to="/profile" title="Chỉnh sửa hồ sơ & mục tiêu dinh dưỡng"><i className="bi bi-pencil-square" /></Link>
        }
      />
      <div className="bmi-stats">
        <span>Cân nặng hiện tại<strong>{profile.currentWeightKg} <small>kg</small></strong><em>{metrics.bmiCategory}</em></span>
        <span>Chỉ số BMI<strong>{metrics.bmi} <small>kg/m²</small></strong><em className={bmiTone}>WHO châu Á</em></span>
      </div>
      <div className="bmi-scale" aria-label={`BMI ${metrics.bmi}: ${metrics.bmiCategory}`}><i style={{ left: `${bmiPosition}%` }} /></div>
      <p><i className="bi bi-fire" /> BMR: <b>{metrics.bmr} kcal/ngày</b><span><i className="bi bi-lightning-charge" /> TDEE: <b>{metrics.tdee} kcal/ngày</b></span></p>
      
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
        <span>Mục tiêu calo: <b>{profile.nutritionGoal?.calorieTarget ? `${profile.nutritionGoal.calorieTarget.toLocaleString('vi-VN')} kcal` : 'Chưa thiết lập'}</b></span>
        <Link to="/profile" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          {profile.nutritionGoal?.calorieTarget ? 'Chỉnh sửa →' : 'Thiết lập ngay →'}
        </Link>
      </div>
    </article>
  )
}

export default function DashboardPage() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [healthProfile, setHealthProfile] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const firstName = user?.fullName?.split(' ')[0] || 'bạn'

  useEffect(() => {
    let isActive = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (isActive) setHealthProfile(data.profile) })
      .catch(() => { if (isActive) setHealthProfile(null) })
      .finally(() => { if (isActive) setMetricsLoading(false) })
    return () => { isActive = false }
  }, [])

  // Gắn số liệu mục tiêu dinh dưỡng (UC09) động lên các thẻ hiển thị
  const targetCalo = healthProfile?.nutritionGoal?.calorieTarget || 1850
  const targetProtein = healthProfile?.nutritionGoal?.proteinG || 110
  const targetCarbs = healthProfile?.nutritionGoal?.carbsG || 210
  const targetFat = healthProfile?.nutritionGoal?.fatG || 55

  const eatenCalo = 1420
  const eatenProtein = 82
  const eatenCarbs = 150
  const eatenFat = 42

  const caloPct = Math.min(100, Math.round((eatenCalo / targetCalo) * 100))
  const proteinPct = Math.min(100, Math.round((eatenProtein / targetProtein) * 100))
  const carbsPct = Math.min(100, Math.round((eatenCarbs / targetCarbs) * 100))
  const fatPct = Math.min(100, Math.round((eatenFat / targetFat) * 100))

  const dynamicMetrics = [
    ['bi-fire', 'Tổng năng lượng', eatenCalo.toLocaleString('vi-VN'), `/ ${targetCalo.toLocaleString('vi-VN')} kcal`, `${caloPct}%`, targetCalo > eatenCalo ? `Còn ${(targetCalo - eatenCalo).toLocaleString('vi-VN')} kcal` : 'Đạt mục tiêu', 'orange'],
    ['bi-lightning-charge', 'Đạm (Protein)', eatenProtein, `/ ${targetProtein} g`, `${proteinPct}%`, targetProtein > eatenProtein ? `Thiếu ${targetProtein - eatenProtein}g` : 'Đã đủ', 'green'],
    ['bi-grid-3x3-gap', 'Tinh bột (Carbs)', eatenCarbs, `/ ${targetCarbs} g`, `${carbsPct}%`, targetCarbs > eatenCarbs ? `Còn ${targetCarbs - eatenCarbs}g` : 'Đã đủ', 'orange'],
    ['bi-droplet', 'Chất béo (Lipid)', eatenFat, `/ ${targetFat} g`, `${fatPct}%`, targetFat > eatenFat ? `Còn ${targetFat - eatenFat}g` : 'Đã đủ', 'blue'],
    ['bi-cup-straw', 'Nước', '1.80', '/ 2.50 L', '72%', 'Còn 700ml', 'blue'],
  ]

  const goalTitles = {
    lose_weight: 'Giảm cân (Thâm hụt 500 kcal)',
    gain_weight: 'Tăng cân (Dư thừa 350 kcal)',
    maintain_weight: 'Duy trì cân nặng',
  }
  const goalText = healthProfile?.nutritionGoal?.goal
    ? `⚑ Mục tiêu: ${goalTitles[healthProfile.nutritionGoal.goal] || 'Dinh dưỡng cá nhân hóa'} (${healthProfile.nutritionGoal.calorieTarget} kcal/ngày)`
    : '⚑ Mục tiêu dinh dưỡng: Chưa thiết lập'

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <a className="dashboard-logo" href="/dashboard"><span><i className="bi bi-leaf-fill" /></span> NutriLens</a>
        <nav className="dashboard-nav">
          <a className="active" href="/dashboard">Tổng quan</a>
          <a href="/dashboard">Nhận diện & Đồ ăn</a>
          <a href="/dashboard">Luyện tập</a>
          <a href="/dashboard">Chỉ số & Xu hướng</a>
          <a href="/dashboard">Cộng đồng</a>
          <a href="/dashboard">Bài viết & Mẹo</a>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search"><i className="bi bi-search" /> Tra cứu thực phẩm...</span>
          <i className="bi bi-bell dashboard-bell" />
          <div className="profile-menu">
            <button className="dashboard-avatar" onClick={() => setProfileOpen((isOpen) => !isOpen)} aria-expanded={profileOpen} aria-haspopup="menu" title="Mở menu tài khoản">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : firstName.charAt(0).toUpperCase()}
            </button>
            {profileOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-name">Xin chào, {firstName}</div>
                <button className="profile-link" onClick={() => navigate('/profile')} role="menuitem">
                  <i className="bi bi-person-circle" /> Hồ sơ cá nhân & Sức khỏe
                </button>
                <button onClick={handleLogout} role="menuitem">
                  <i className="bi bi-box-arrow-right" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-daybar">
          <div>
            <strong><i className="bi bi-calendar3" /> Hôm nay</strong>
            <span className="dot-separator">•</span>
            <Link to="/profile" className="goal-pill" style={{ textDecoration: 'none' }} title="Bấm để xem & cập nhật mục tiêu trong hồ sơ">
              {goalText}
            </Link>
            <small>● NutriLens Vision v2.4 Sẵn sàng (99.2%)</small>
          </div>
          <div className="day-actions">
            <button><i className="bi bi-calendar-check" /> Chọn ngày</button>
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

        <section className="dashboard-intro-grid">
          <article className="welcome-panel">
            <span className="eyebrow">✦ Chỉ số chuyển hóa & Năng lượng AI</span>
            <h1>Xin chào {firstName}!</h1>
            <p>Bữa trưa của bạn đang đạt <b>18g Protein</b> để hoàn thành chỉ số tạo cơ nạc. Hãy ưu tiên bổ sung thực phẩm thanh đạm như cá áp chảo hoặc cá hồi cho bữa tối nhé!</p>
            <div className="welcome-stats">
              <span>◉ <b>Độ chuẩn khớp AI</b><strong>Đạt 98.7% hôm nay</strong></span>
              <span>◷ <b>Tốc độ trích xuất</b><strong>1.2 giây / hình ảnh</strong></span>
              <span>⌁ <b>Thâm hụt calo mục tiêu</b><strong>-430 kcal</strong></span>
            </div>
          </article>
          <article className="scanner-panel">
            <div className="scanner-heading"><span>● AI LIVE SCANNER</span><small>↻ Lịch sử scan</small></div>
            <div className="scanner-box"><i className="bi bi-camera2" /><strong>Chụp ảnh hoặc kéo thả món ăn</strong><small>Hỗ trợ nhận diện Phở, Gỏi cuốn, Cơm tấm & 1,200+ món Việt</small></div>
            <div className="scanner-actions">
              <button className="scanner-button"><i className="bi bi-camera" /> Bật Camera Quét</button>
              <button className="scanner-upload" title="Tải ảnh món ăn"><i className="bi bi-file-earmark-arrow-up" /></button>
            </div>
          </article>
        </section>

        <section className="metric-grid">
          {dynamicMetrics.map(([icon, label, value, unit, progress, note, tone]) => (
            <article className="metric-card" key={label}>
              <div className={`metric-icon ${tone}`}><i className={`bi ${icon}`} /></div>
              <span>{label}</span>
              <strong>{value}<small>{unit}</small></strong>
              <div className="metric-progress"><i style={{ width: progress }} /></div>
              <em className={tone}>{progress} mục tiêu</em>
              <small>{note}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-columns">
          <article className="content-panel meal-panel">
            <PanelHeading title="🍴 Nhật ký trực quan: Món ăn đã nhận diện hôm nay" subtitle="Tự động phân tích nguyên liệu và ước tính calo hình ảnh nhận diện AI" action={<span className="heading-chip">2 / 3 bữa chính đã nạp</span>} />
            {meals.map(([image, title, meta, kcal, tags]) => (
              <div className="meal-row" key={title}>
                <div className="meal-image">{image}<small>CONF: 98.4%</small></div>
                <div className="meal-details">
                  <small>{meta}</small>
                  <h3>{title}</h3>
                  <p>Bánh phở nhỏ tiêu 10g, thịt bò tái mỏng 95g. Nước dùng không quá hời, hành lá ngoài ra.</p>
                  <div>{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <small className="ai-note">◉ <b>Đánh giá AI:</b> Cân đối đạm và tinh bột tốt cho năng lượng dài. Điều chỉnh hạn chế nước béo.</small>
                </div>
                <strong className="meal-kcal">{kcal}</strong>
              </div>
            ))}
            <div className="meal-footer">
              ◉ <b>Bữa Tối (Dự kiến 19:00)</b>
              <span>Chưa nhận món</span>
              <small>Khuyến nghị tinh đậu củ quả, 430 kcal & 28g Protein</small>
              <button>▣ Chụp / Ghi nhận món</button>
            </div>
          </article>
          
          <aside className="side-stack">
            <HealthMetricsPanel profile={healthProfile} loading={metricsLoading} />
            <article className="content-panel suggestion-panel">
              <h2>✧ Gợi ý AI: Món tối chuẩn Macro</h2>
              <p>Đề xuất một bữa phù hợp hoàn hảo chỉ số đạm còn thiếu và tổng kcal của bạn:</p>
              {['Salad Ức Gà Áp Chảo Sốt Chanh', 'Cá Hồi Nướng & Măng Tây'].map((dish, index) => (
                <div className="suggestion" key={dish}>
                  <b>{dish}</b>
                  <span>Protein {index ? 28 : 26}g</span>
                  <small>{index ? 340 : 280} kcal · Chuẩn bị {index ? 20 : 15} phút<br />Carbs: {index ? 8 : 12}g | Fat: {index ? '8g' : '6g'}</small>
                  <a href="/dashboard">Chọn vào thực đơn →</a>
                </div>
              ))}
            </article>
          </aside>
        </section>

        <section className="dashboard-columns lower-grid">
          <article className="content-panel chart-panel">
            <PanelHeading title="⌁ Cân bằng chuyển hóa tuần: Năng lượng Nạp vào vs Tiêu hao" subtitle="Dữ liệu tổng hợp đối soát 7 ngày gần nhất kết nối thiết bị theo dõi" action={<div className="chart-legend"><span>● Nạp vào (kcal)</span><span>● Tiêu hao (kcal)</span></div>} />
            <div className="bar-chart">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, index) => (
                <div className="bar-day" key={day}>
                  <div><i style={{ height: `${42 + index * 5}px` }} /><b style={{ height: `${32 + (6 - index) * 6}px` }} /></div>
                  <small>{day}</small>
                </div>
              ))}
            </div>
            <div className="chart-summary">
              <span>Thâm hụt trung bình tuần<strong>-380 kcal / ngày</strong></span>
              <span>Tuân thủ Macro<strong>92% đạt chuẩn</strong></span>
              <span>Đánh giá chuyển hóa<strong className="orange-text">Đốt mỡ tối ưu</strong></span>
            </div>
          </article>
          <article className="content-panel streak-panel">
            <h2>Huy hiệu & Chuỗi kỷ lục <span>♧</span></h2>
            <div className="streak-badge"><b>12</b><strong>Chuỗi 12 ngày kỷ luật!<small>Chính nhờ ăn đã đủ đạm qua camera AI</small></strong></div>
            <p>Thử thách cách xả: 5/7 ngày <b>71%</b></p>
            <div className="streak-progress" />
          </article>
        </section>

        <section className="content-panel workout-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">✦ Hoạt động thể chất & Đốt mỡ</span>
              <h2>Bài tập hôm nay</h2>
              <p>Mục tiêu tiêu hao: 450 kcal · Đã hoàn thành 1/3 bài tập (160 kcal)</p>
            </div>
            <div>
              <button className="solid-button">⊕ Thêm bài tập</button>
            </div>
          </div>
          <div className="workout-content">
            <div>
              {[
                ['♟', 'Đi bộ nhanh ngoài trời (Brisk Walking)', '25 phút · Tiêu hao 140 kcal · Nhịp tim TB 118 bpm', 'Đã hoàn thành'],
                ['♨', 'Cardio HIIT đốt mỡ cơ bản', '20 phút · Dự kiến đốt 180 kcal · Vùng nhịp tim 135–155 bpm', 'Bắt đầu ngay'],
                ['♙', 'Giãn cơ & Thả lỏng toàn thân (Stretching)', '15 phút · Dự kiến đốt 65 kcal · Phục hồi cơ & hạ cortisol', 'Nhắc lúc 21:00'],
              ].map(([icon, title, info, status], index) => (
                <div className={`workout-row ${index === 1 ? 'focus' : ''}`} key={title}>
                  <b>{icon}</b>
                  <span><strong>{title}</strong><small>{info}</small></span>
                  <button>{status}</button>
                </div>
              ))}
            </div>
            <div className="energy-box">
              <b>Tổng quan thể lực</b>
              <span>Tiến độ tiêu hao <strong>160 / 450 kcal (36%)</strong></span>
              <div className="energy-progress"><i /></div>
              <div className="energy-values"><b>25<small>Thời gian tập</small></b><b>-380<small>Thâm hụt calo</small></b><b>118<small>Nhịp tim TB</small></b></div>
              <p>◉ AI Coach: Hoàn thành bài HIIT 2 phút trước 18:30 sẽ kích hoạt hiệu ứng Afterburn (EPOC) tiêu đốt mỡ đến đêm!</p>
            </div>
          </div>
        </section>

        <section className="content-panel articles-panel">
          <PanelHeading title="✦ Kiến thức & Đời sống" subtitle="Cập nhật kiến thức dinh dưỡng khoa học, mẹo ăn uống lành mạnh và công nghệ AI" action={<a href="/dashboard">Xem tất cả bài viết →</a>} />
          <div className="article-grid">
            {articles.map(([title, tag, time]) => (
              <article key={title}>
                <span>{tag}</span>
                <h3>{title}</h3>
                <small>{time}</small>
                <a href="/dashboard">Đọc tiếp →</a>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="dashboard-footer">
        <span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b> © 2026 NutriLens Health Inc. Đồng hành dinh dưỡng thông minh dựa trên AI.</span>
        <span className="footer-links">Điều khoản dịch vụ　 Chính sách bảo mật y tế　 Trung tâm hỗ trợ</span>
      </footer>
    </div>
  )
}
