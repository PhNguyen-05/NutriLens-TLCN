import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

  const metrics = [
    ['bi-fire', 'Tổng năng lượng', '1,420', '/ 1,850 kcal', '76%', 'Còn 430 kcal', 'orange'],
    ['bi-lightning-charge', 'Đạm (Protein)', '82', '/ 110 g', '74%', 'Thiếu 28g', 'green'],
    ['bi-grid-3x3-gap', 'Tinh bột (Carbs)', '150', '/ 210 g', '71%', 'Còn 60g', 'orange'],
    ['bi-droplet', 'Chất béo (Lipid)', '42', '/ 55 g', '76%', 'Còn 13g', 'blue'],
    ['bi-cup-straw', 'Nước', '1.80', '/ 2.50 L', '72%', 'Còn 700ml', 'blue'],
  ]

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

  export default function DashboardPage() {
    const { user, handleLogout } = useAuth()
    const navigate = useNavigate()
    const [profileOpen, setProfileOpen] = useState(false)
    const firstName = user?.fullName?.split(' ')[0] || 'bạn'

    return (
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <a className="dashboard-logo" href="/dashboard"><span><i className="bi bi-leaf-fill" /></span> NutriLens</a>
          <nav className="dashboard-nav"><a className="active" href="/dashboard">Tổng quan</a><a href="/dashboard">Nhận diện & Đồ ăn</a><a href="/dashboard">Luyện tập</a><a href="/dashboard">Chỉ số & Xu hướng</a><a href="/dashboard">Cộng đồng</a><a href="/dashboard">Bài viết & Mẹo</a></nav>
          <div className="dashboard-actions"><span className="dashboard-search"><i className="bi bi-search" /> Tra cứu thực phẩm...</span><i className="bi bi-bell dashboard-bell" /><div className="profile-menu"><button className="dashboard-avatar" onClick={() => setProfileOpen((isOpen) => !isOpen)} aria-expanded={profileOpen} aria-haspopup="menu" title="Mở menu tài khoản">{user?.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : firstName.charAt(0).toUpperCase()}</button>{profileOpen && <div className="profile-dropdown" role="menu"><div className="profile-name">Xin chào, {firstName}</div><button className="profile-link" onClick={() => navigate('/profile')} role="menuitem"><i className="bi bi-person-circle" /> Hồ sơ của tôi</button><button onClick={handleLogout} role="menuitem"><i className="bi bi-box-arrow-right" /> Đăng xuất</button></div>}</div></div>
        </header>

        <main className="dashboard-main">
          <section className="dashboard-daybar"><div><strong><i className="bi bi-calendar3" /> Hôm nay, 24 Tháng 9</strong><span className="dot-separator">•</span><span className="goal-pill">⚑ Mục tiêu: Giảm 2kg mỡ & Tăng cơ</span><small>● NutriLens Vision v2.4 Sẵn sàng (99.2%)</small></div><div className="day-actions"><button><i className="bi bi-calendar-check" /> Chọn ngày</button></div></section>

          <section className="dashboard-intro-grid"><article className="welcome-panel"><span className="eyebrow">✦ Chỉ số chuyển hóa & Năng lượng AI</span><h1>Xin chào {firstName}!</h1><p>Bữa trưa của bạn đang đạt <b>18g Protein</b> để hoàn thành chỉ số tạo cơ nạc. Hãy ưu tiên bổ sung thực phẩm thanh đạm như cá áp chảo hoặc cá hồi cho bữa tối nhé!</p><div className="welcome-stats"><span>◉ <b>Độ chuẩn khớp AI</b><strong>Đạt 98.7% hôm nay</strong></span><span>◷ <b>Tốc độ trích xuất</b><strong>1.2 giây / hình ảnh</strong></span><span>⌁ <b>Thâm hụt calo mục tiêu</b><strong>-430 kcal</strong></span></div></article><article className="scanner-panel"><div className="scanner-heading"><span>● AI LIVE SCANNER</span><small>↻ Lịch sử scan</small></div><div className="scanner-box"><i className="bi bi-camera2" /><strong>Chụp ảnh hoặc kéo thả món ăn</strong><small>Hỗ trợ nhận diện Phở, Gỏi cuốn, Cơm tấm & 1,200+ món Việt</small></div><div className="scanner-actions"><button className="scanner-button"><i className="bi bi-camera" /> Bật Camera Quét</button><button className="scanner-upload" title="Tải ảnh món ăn"><i className="bi bi-file-earmark-arrow-up" /></button></div></article></section>

          <section className="metric-grid">{metrics.map(([icon, label, value, unit, progress, note, tone]) => <article className="metric-card" key={label}><div className={`metric-icon ${tone}`}><i className={`bi ${icon}`} /></div><span>{label}</span><strong>{value}<small>{unit}</small></strong><div className="metric-progress"><i style={{ width: progress }} /></div><em className={tone}>{progress} mục tiêu</em><small>{note}</small></article>)}</section>

          <section className="dashboard-columns"><article className="content-panel meal-panel"><PanelHeading title="🍴 Nhật ký trực quan: Món ăn đã nhận diện hôm nay" subtitle="Tự động phân tích nguyên liệu và ước tính calo hình ảnh nhận diện AI" action={<span className="heading-chip">2 / 3 bữa chính đã nạp</span>} />{meals.map(([image, title, meta, kcal, tags]) => <div className="meal-row" key={title}><div className="meal-image">{image}<small>CONF: 98.4%</small></div><div className="meal-details"><small>{meta}</small><h3>{title}</h3><p>Bánh phở nhỏ tiêu 10g, thịt bò tái mỏng 95g. Nước dùng không quá hời, hành lá ngoài ra.</p><div>{tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small className="ai-note">◉ <b>Đánh giá AI:</b> Cân đối đạm và tinh bột tốt cho năng lượng dài. Điều chỉnh hạn chế nước béo.</small></div><strong className="meal-kcal">{kcal}</strong></div>)}<div className="meal-footer">◉ <b>Bữa Tối (Dự kiến 19:00)</b><span>Chưa nhận món</span><small>Khuyến nghị tinh đậu củ quả, 430 kcal & 28g Protein</small><button>▣ Chụp / Ghi nhận món</button></div></article>
            <aside className="side-stack"><article className="content-panel bmi-panel"><PanelHeading title="♙ Chỉ số Thể trạng & BMI" action={<b>···</b>} /><div className="bmi-stats"><span>Cân nặng hiện tại<strong>52.4 <small>kg</small></strong><em>↓ 1.2kg tháng này</em></span><span>Chỉ số BMI<strong>20.8 <small>kg/m²</small></strong><em>Vùng khỏe: 18.5 - 22.9</em></span></div><div className="bmi-scale"><i /></div><p>⚡ Vận động: 6,850 bước (~340 kcal) <span>⚒ Mỡ: 21.5% (-0.8%)</span></p></article><article className="content-panel suggestion-panel"><h2>✧ Gợi ý AI: Món tối chuẩn Macro</h2><p>Đề xuất một bữa phù hợp hoàn hảo chỉ số đạm còn thiếu và tổng kcal của bạn:</p>{['Salad Ức Gà Áp Chảo Sốt Chanh', 'Cá Hồi Nướng & Măng Tây'].map((dish, index) => <div className="suggestion" key={dish}><b>{dish}</b><span>Protein {index ? 28 : 26}g</span><small>{index ? 340 : 280} kcal · Chuẩn bị {index ? 20 : 15} phút<br />Carbs: {index ? 8 : 12}g | Fat: {index ? '8g' : '6g'}</small><a href="/dashboard">Chọn vào thực đơn →</a></div>)}</article></aside></section>

          <section className="dashboard-columns lower-grid"><article className="content-panel chart-panel"><PanelHeading title="⌁ Cân bằng chuyển hóa tuần: Năng lượng Nạp vào vs Tiêu hao" subtitle="Dữ liệu tổng hợp đối soát 7 ngày gần nhất kết nối thiết bị theo dõi" action={<div className="chart-legend"><span>● Nạp vào (kcal)</span><span>● Tiêu hao (kcal)</span></div>} /><div className="bar-chart">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, index) => <div className="bar-day" key={day}><div><i style={{ height: `${42 + index * 5}px` }} /><b style={{ height: `${32 + (6 - index) * 6}px` }} /></div><small>{day}</small></div>)}</div><div className="chart-summary"><span>Thâm hụt trung bình tuần<strong>-380 kcal / ngày</strong></span><span>Tuân thủ Macro<strong>92% đạt chuẩn</strong></span><span>Đánh giá chuyển hóa<strong className="orange-text">Đốt mỡ tối ưu</strong></span></div></article><article className="content-panel streak-panel"><h2>Huy hiệu & Chuỗi kỷ lục <span>♧</span></h2><div className="streak-badge"><b>12</b><strong>Chuỗi 12 ngày kỷ luật!<small>Chính nhờ ăn đã đủ đạm qua camera AI</small></strong></div><p>Thử thách cách xả: 5/7 ngày <b>71%</b></p><div className="streak-progress" /></article></section>

          <section className="content-panel workout-panel"><div className="panel-heading"><div><span className="eyebrow">✦ Hoạt động thể chất & Đốt mỡ</span><h2>Bài tập hôm nay</h2><p>Mục tiêu tiêu hao: 450 kcal · Đã hoàn thành 1/3 bài tập (160 kcal)</p></div><div><button className="solid-button">⊕ Thêm bài tập</button></div></div><div className="workout-content"><div>{[['♟', 'Đi bộ nhanh ngoài trời (Brisk Walking)', '25 phút · Tiêu hao 140 kcal · Nhịp tim TB 118 bpm', 'Đã hoàn thành'], ['♨', 'Cardio HIIT đốt mỡ cơ bản', '20 phút · Dự kiến đốt 180 kcal · Vùng nhịp tim 135–155 bpm', 'Bắt đầu ngay'], ['♙', 'Giãn cơ & Thả lỏng toàn thân (Stretching)', '15 phút · Dự kiến đốt 65 kcal · Phục hồi cơ & hạ cortisol', 'Nhắc lúc 21:00']].map(([icon, title, info, status], index) => <div className={`workout-row ${index === 1 ? 'focus' : ''}`} key={title}><b>{icon}</b><span><strong>{title}</strong><small>{info}</small></span><button>{status}</button></div>)}</div><div className="energy-box"><b>Tổng quan thể lực</b><span>Tiến độ tiêu hao <strong>160 / 450 kcal (36%)</strong></span><div className="energy-progress"><i /></div><div className="energy-values"><b>25<small>Thời gian tập</small></b><b>-380<small>Thâm hụt calo</small></b><b>118<small>Nhịp tim TB</small></b></div><p>◉ AI Coach: Hoàn thành bài HIIT 2 phút trước 18:30 sẽ kích hoạt hiệu ứng Afterburn (EPOC) tiêu đốt mỡ đến đêm!</p></div></div></section>

          <section className="content-panel articles-panel"><PanelHeading title="✦ Kiến thức & Đời sống" subtitle="Cập nhật kiến thức dinh dưỡng khoa học, mẹo ăn uống lành mạnh và công nghệ AI" action={<a href="/dashboard">Xem tất cả bài viết →</a>} /><div className="article-grid">{articles.map(([title, tag, time]) => <article key={title}><span>{tag}</span><h3>{title}</h3><small>{time}</small><a href="/dashboard">Đọc tiếp →</a></article>)}</div></section>
        </main>
        <footer className="dashboard-footer"><span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b> © 2026 NutriLens Health Inc. Đồng hành dinh dưỡng thông minh dựa trên AI.</span><span className="footer-links">Điều khoản dịch vụ　 Chính sách bảo mật y tế　 Trung tâm hỗ trợ</span></footer>
      </div>
    )
  }
