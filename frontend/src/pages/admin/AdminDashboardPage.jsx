import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

const reviewItems = [
  ['🍲', 'Bún chả Hà Nội', 'CNN 98.4%', '#REQ-8491', 'Người gửi: ThuTrang98 (Hôm nay 09:15)', '585 kcal / 1 suất tiêu chuẩn', 'green'],
  ['🍛', 'Cơm gạo lứt cá ngừ nướng sốt cam', 'AI 95.1%', '', 'Gửi bởi: BS. DinhDuong (Hôm qua 16:40)', '420 kcal / 350g khẩu phần', 'green'],
  ['🥤', 'Sinh tố bơ chuối yến mạch', 'AI 89.2%', '', 'Gửi bởi: HoangMinh_FIT (22/10 11:20)', '310 kcal / ly 300ml', 'orange'],
  ['🍲', 'Canh chua cá lóc miền Tây', 'AI 97.2%', '', 'Gửi bởi: LanHuong_Food', '240 kcal / tô 400ml', 'green'],
]

const alerts = [
  ['User #1042 — Nguyễn Văn B.', '⚠ BMI 31.4 (Béo phì độ 2)', 'Lượng nạp cao vượt 140% theo dõi 5 ngày liên tiếp. Cần điều chỉnh cân đối đạm Nitri bổ sung.', 'VƯỢT 140% TDEE', 'critical'],
  ['User #893 — Lê Thùy Dung', '⚠ Thiếu hụt vi chất Protein & Fe', 'Nhật ký ăn uống thiếu nghiêm trọng đạm sinh học và khoáng chất sắt.', '3 NGÀY LIỀN', 'warning'],
  ['User #2105 — Phạm Quốc Huy', '♧ Nhịp tim đỉnh: 188 bpm', 'Nhịp tim cao bất thường vượt vùng an toàn Zone 5 sau bài Cardio cường độ cao.', 'TABATA', 'exercise'],
]

export default function AdminDashboardPage() {
  const { user, handleLogout } = useAuth()
  const [activeItem, setActiveItem] = useState('Dashboard')

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span><i className="bi bi-activity" /></span> NutriLes</div>
        <div className="admin-section-label">TỔNG QUAN</div>
        <button className={activeItem === 'Dashboard' ? 'active' : ''} onClick={() => setActiveItem('Dashboard')}><i className="bi bi-grid-1x2" /> Dashboard</button>
        <button onClick={() => setActiveItem('Báo cáo')}><i className="bi bi-bar-chart-line" /> Thống kê & Báo cáo</button>
        <div className="admin-section-label">NGƯỜI DÙNG</div>
        <button onClick={() => setActiveItem('Người dùng')}><i className="bi bi-people" /> Quản lý người dùng</button>
        <div className="admin-section-label">DINH DƯỠNG</div>
        <button onClick={() => setActiveItem('Món ăn')}><i className="bi bi-tools" /> Danh mục món ăn <b className="sidebar-badge">356</b></button>
        <button onClick={() => setActiveItem('Bổ sung món')}><i className="bi bi-patch-plus" /> Yêu cầu bổ sung món <b className="sidebar-badge coral">18</b></button>
        <div className="admin-section-label">VẬN ĐỘNG</div>
        <button onClick={() => setActiveItem('Bài tập')}><i className="bi bi-person-walking" /> Quản lý bài tập</button>
        <div className="admin-section-label">CỘNG ĐỒNG & TIN TỨC</div>
        <button onClick={() => setActiveItem('Community')}><i className="bi bi-chat-left-text" /> Kiểm duyệt Community <b className="sidebar-badge amber">5</b></button>
        <button onClick={() => setActiveItem('Blog')}><i className="bi bi-journal-text" /> Blog y khoa</button>
        <div className="admin-sidebar-footer"><button onClick={handleLogout}><i className="bi bi-box-arrow-left" /> Đăng xuất</button></div>
      </aside>

      <main className="admin-content">
        <header className="admin-topbar"><div><h1>Bảng điều khiển Vận hành NutriLes</h1><p>Giám sát thời gian thực hoạt động các microservices, hàng đợi phê duyệt AI Lens và chỉ số an toàn sức khỏe người dùng trong ngày.</p></div><div className="admin-user"><button title="Thông báo"><i className="bi bi-bell" /></button><strong>{user?.fullName || 'Admin'}</strong><span>{(user?.fullName || 'A').charAt(0)}</span></div></header>
        <div className="admin-body">
          <section className="admin-kpis"><article><span>LƯỢT QUÉT AI LENS HÔM NAY <i className="bi bi-phone" /></span><strong>2.840 <em>+18.4%</em></strong><small>Độ trễ: 1.38s　 Độ chính xác: <b>96.8% mAP</b></small></article><article><span>YÊU CẦU MÓN ĂN CHỜ DUYỆT <i className="bi bi-card-text" /></span><strong>18 <small>món</small></strong><small className="danger-dot">● 3 ca chuyên gia gửi <b>Cần xử lý &lt; 2h</b></small></article><article><span>CẢNH BÁO SỨC KHỎE KHẨN CẤP <i className="bi bi-shield-exclamation" /></span><strong className="critical-number">04 <small>CRITICAL</small></strong><small>Vượt 140% TDEE &amp; T <b>Can thiệp ngay</b></small></article><article><span>TÌNH TRẠNG CỤM AI VISION <i className="bi bi-cpu" /></span><strong className="healthy-number">100% <small>Sẵn sàng</small></strong><small>NVIDIA T4 (Lại: 42%) <b>142ms API</b></small></article></section>

          <section className="admin-columns"><article className="admin-panel review-panel"><div className="admin-panel-heading"><div><h2>Yêu cầu bổ sung món ăn &amp; Gắn nhãn AI mới <b>18 chờ duyệt</b></h2><p></p></div><div><button>Lọc độ tin cậy</button><button className="approve-all">✓ Duyệt hàng loạt</button></div></div>{reviewItems.map(([icon, title, confidence, id, sender, calories, tone], index) => <div className="review-row" key={title}><span className="food-thumb">{icon}</span><div className="review-info"><h3>{title} <b className={tone}>{confidence}</b></h3><small>{id}</small><p>{sender}</p><span className={`calorie-line ${tone}`}>•　{calories}</span></div><div className="review-actions">{index === 2 ? <><button className="edit-high">⚑ Hiệu chỉnh cao</button><button>Từ chối</button></> : <><button>▤ Hiệu chỉnh</button><button className="approve">✓ Duyệt{index === 0 ? ' ngay' : ''}</button></>}</div></div>)}</article>
            <aside className="admin-panel alert-panel"><div className="admin-panel-heading"><h2><i className="bi bi-circle-fill" /> Cảnh báo sức khỏe khẩn cấp <b>4 Ca can thiệp</b></h2></div>{alerts.map(([title, issue, copy, label, tone]) => <div className={`admin-alert ${tone}`} key={title}><h3>{title}<b>{label}</b></h3><strong>{issue}</strong><p>{copy}</p><button>{tone === 'critical' ? 'Gợi ý gói can thiệp dinh dưỡng　→' : tone === 'warning' ? 'Nhắc nhở qua thông báo push　♟' : 'Xem chi tiết buổi tập　↗'}</button></div>)}</aside></section>

          <section className="admin-panel telemetry-panel"><div className="admin-panel-heading"><div><h2><i className="bi bi-camera" /> Tải xử lý AI Lens theo khung giờ trong ngày</h2><p>Lưu lượng quét ảnh nhận diện bữa ăn đạt cực đại vào 11h30 – 13h00 (Bữa trưa) và 18h30 – 20h00 (Bữa tối).</p></div><div className="telemetry-heading-right"><div className="telemetry-legend"><span>■ Scan thành công</span><span>■ Cần nhận diện lại</span></div></div></div><div className="admin-chart"><div className="chart-axis"><span>Số lượt quét (req)</span><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div><div className="chart-plot"><div className="peak-band lunch"><b>Cao điểm – Bữa trưa</b><small>11:30 – 13:00</small></div><div className="peak-band dinner"><b>Cao điểm – Bữa tối</b><small>18:30 – 20:00</small></div><div className="chart-bars"><svg className="telemetry-line" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true"><polyline points="4,116 16,96 28,108 40,24 52,76 64,104 76,40 88,88 96,136" />{[[4, 116], [16, 96], [28, 108], [40, 24], [52, 76], [64, 104], [76, 40], [88, 88], [96, 136]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />)}</svg>{[[120, 20, 220], [300, 35, 320], [150, 25, 260], [580, 60, 680], [370, 45, 420], [220, 30, 280], [470, 55, 620], [250, 20, 360], [120, 5, 120]].map(([success, retry, trend], index) => <div className="chart-column" key={index} style={{ '--trend-height': `${trend / 5}px`, '--bar-height': `${success / 4}px` }}><div className="chart-values"><span>{success}</span><i>{retry}</i></div><b style={{ height: `${success / 4}px` }} /><i style={{ height: `${Math.max(retry / 4, 3)}px` }} /><em>{trend}</em></div>)}<div className="chart-time-labels"><span>06:00</span><span>07:30</span><span>11:00</span><b>12:30<br />[Trưa]</b><span>15:00</span><span>18:30</span><b>19:30<br />[Tối]</b><span>22:00</span><span>23:30</span></div></div></div><div className="chart-right-axis"><span>Tải xử lý (req)</span><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div></div><div className="telemetry-foot"><span>◉ Auto-scaler đã cấp phát bổ sung <b>+2 GPU Pods</b> lúc 11:25 cho bữa trưa.</span><b>▤　Tỷ lệ cache hit: 84.6%</b></div></section>
        </div>
      </main>
    </div>
  )
}
