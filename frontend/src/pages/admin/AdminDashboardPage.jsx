import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'
import AdminActionLogsModal from './AdminActionLogsModal'
import UserManagementPage from './UserManagementPage'
import FoodManagementPage from './FoodManagementPage'
import FoodRequestManagementPage from './FoodRequestManagementPage'
import ExerciseManagementPage from './ExerciseManagementPage'

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
  const [showActionLogs, setShowActionLogs] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  // Tự động tải số lượng yêu cầu chờ duyệt hiển thị lên badge sidebar
  useEffect(() => {
    let isMounted = true
    async function fetchPendingCount() {
      try {
        const { data } = await axiosInstance.get('/admin/food-requests', { params: { limit: 1 } })
        if (isMounted && data.summary) {
          setPendingRequestsCount(data.summary.pending || 0)
        }
      } catch (err) {
        // im lặng bỏ qua nếu lỗi mạng ban đầu
      }
    }
    fetchPendingCount()
    return () => {
      isMounted = false
    }
  }, [activeItem])

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span><i className="bi bi-activity" /></span> NutriLes</div>
        <div className="admin-section-label">TỔNG QUAN</div>
        <button className={activeItem === 'Dashboard' ? 'active' : ''} onClick={() => { setActiveItem('Dashboard'); setShowActionLogs(false) }}><i className="bi bi-grid-1x2" /> Dashboard</button>
        <button className={activeItem === 'Lịch sử thao tác' ? 'active' : ''} onClick={() => { setActiveItem('Lịch sử thao tác'); setShowActionLogs(true) }}><i className="bi bi-clock-history" /> Lịch sử thao tác</button>
        <button onClick={() => setActiveItem('Báo cáo')}><i className="bi bi-bar-chart-line" /> Thống kê & Báo cáo</button>
        <div className="admin-section-label">NGƯỜI DÙNG</div>
        <button className={activeItem === 'Người dùng' ? 'active' : ''} onClick={() => setActiveItem('Người dùng')}><i className="bi bi-people" /> Quản lý người dùng</button>
        <div className="admin-section-label">DINH DƯỠNG</div>
        <button onClick={() => setActiveItem('Món ăn')} className={activeItem === 'Món ăn' ? 'active' : ''}><i className="bi bi-tools" /> Danh mục món ăn</button>
        <button onClick={() => { setActiveItem('Bổ sung món'); setShowActionLogs(false) }} className={activeItem === 'Bổ sung món' ? 'active' : ''}>
          <i className="bi bi-patch-plus" /> Yêu cầu bổ sung món
          {pendingRequestsCount > 0 && <b className="sidebar-badge coral">{pendingRequestsCount}</b>}
        </button>
        <div className="admin-section-label">VẬN ĐỘNG</div>
        <button
          className={activeItem === 'Bài tập' ? 'active' : ''}
          onClick={() => { setActiveItem('Bài tập'); setShowActionLogs(false) }}
        >
          <i className="bi bi-person-walking" /> Quản lý bài tập
        </button>
        <div className="admin-section-label">CỘNG ĐỒNG & TIN TỨC</div>
        <button onClick={() => setActiveItem('Community')}><i className="bi bi-chat-left-text" /> Kiểm duyệt Community <b className="sidebar-badge amber">5</b></button>
        <button onClick={() => setActiveItem('Blog')}><i className="bi bi-journal-text" /> Blog y khoa</button>
        <div className="admin-sidebar-footer"><button onClick={handleLogout}><i className="bi bi-box-arrow-left" /> Đăng xuất</button></div>
      </aside>

      <main className="admin-content">
        <header className={`admin-topbar ${activeItem === 'Lịch sử thao tác' ? 'action-log-admin-topbar' : ''}`}>
          <div className={`admin-topbar-title ${activeItem === 'Lịch sử thao tác' ? 'action-log-topbar-title' : ''}`}>
            {activeItem === 'Lịch sử thao tác' && <span className="action-log-heading-icon"><i className="bi bi-clock-history" /></span>}
            <div>
              <h1>
                {activeItem === 'Người dùng'
                  ? 'Quản lý người dùng'
                  : activeItem === 'Lịch sử thao tác'
                  ? 'Lịch sử thao tác của Admin'
                  : activeItem === 'Món ăn'
                  ? 'Quản lý danh mục món ăn'
                  : activeItem === 'Bổ sung món'
                  ? 'Duyệt yêu cầu bổ sung món ăn'
                  : activeItem === 'Bài tập'
                  ? 'Quản lý danh mục bài tập'
                  : 'Bảng điều khiển Vận hành NutriLes'}
              </h1>
              <p>
                {activeItem === 'Người dùng'
                  ? 'Xem và quản lý thông tin người dùng, theo dõi trạng thái tài khoản.'
                  : activeItem === 'Lịch sử thao tác'
                  ? 'Xem chi tiết các thao tác quản lý tài khoản, bao gồm khóa, mở khóa, cập nhật thông tin và các hành động khác.'
                  : activeItem === 'Món ăn'
                  ? 'Thêm, chỉnh sửa, ẩn/hiển thị hoặc xóa món ăn trong danh mục hệ thống.'
                  : activeItem === 'Bổ sung món'
                  ? 'Xem xét, chuẩn hóa thành phần dinh dưỡng và phê duyệt hoặc từ chối các yêu cầu món ăn do người dùng đề xuất.'
                  : activeItem === 'Bài tập'
                  ? 'Thêm, chỉnh sửa, ẩn hoặc hiển thị thông tin bài tập và chỉ số MET làm cơ sở tính calories cho người dùng.'
                  : 'Giám sát thời gian thực hoạt động các microservices, hàng đợi phê duyệt AI Lens và chỉ số an toàn sức khỏe người dùng trong ngày.'}
              </p>
            </div>
          </div>
          <div className="admin-user">
            <button title="Thông báo"><i className="bi bi-bell" /></button>
            <strong>{user?.fullName || 'Admin'}</strong>
            <span>{(user?.fullName || 'A').charAt(0)}</span>
          </div>
        </header>

        <div className={`admin-body ${activeItem === 'Lịch sử thao tác' ? 'action-log-admin-body' : ''}`}>
          {activeItem === 'Người dùng' ? (
            <UserManagementPage />
          ) : activeItem === 'Lịch sử thao tác' ? (
            <AdminActionLogsModal embedded isOpen={showActionLogs} onClose={() => { setShowActionLogs(false); setActiveItem('Dashboard') }} />
          ) : activeItem === 'Món ăn' ? (
            <FoodManagementPage />
          ) : activeItem === 'Bổ sung món' ? (
            <FoodRequestManagementPage />
          ) : activeItem === 'Bài tập' ? (
            <ExerciseManagementPage />
          ) : (
            <>
              <section className="admin-kpis">
                <article>
                  <span>LƯỢT QUÉT AI LENS HÔM NAY <i className="bi bi-phone" /></span>
                  <strong>2.840 <em>+18.4%</em></strong>
                  <small>Độ trễ: 1.38s　 Độ chính xác: <b>96.8% mAP</b></small>
                </article>
                <article>
                  <span>YÊU CẦU MÓN ĂN CHỜ DUYỆT <i className="bi bi-card-text" /></span>
                  <strong>{pendingRequestsCount} <small>món</small></strong>
                  <small className="danger-dot">● Chờ xử lý phê duyệt</small>
                </article>
                <article>
                  <span>CẢNH BÁO SỨC KHỎE KHẨN CẤP <i className="bi bi-shield-exclamation" /></span>
                  <strong className="critical-number">04 <small>CRITICAL</small></strong>
                  <small>Vượt 140% TDEE &amp; T <b>Can thiệp ngay</b></small>
                </article>
                <article>
                  <span>TÌNH TRẠNG CỤM AI VISION <i className="bi bi-cpu" /></span>
                  <strong className="healthy-number">100% <small>Sẵn sàng</small></strong>
                  <small>NVIDIA T4 (Lại: 42%) <b>142ms API</b></small>
                </article>
              </section>

              <section className="admin-columns">
                <article className="admin-panel review-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Yêu cầu bổ sung món ăn &amp; Gắn nhãn AI mới <b>{pendingRequestsCount} chờ duyệt</b></h2>
                      <p></p>
                    </div>
                    <div>
                      <button onClick={() => setActiveItem('Bổ sung món')}>Đi đến trang phê duyệt →</button>
                    </div>
                  </div>
                  {reviewItems.map(([icon, title, confidence, id, sender, calories, tone], index) => (
                    <div className="review-row" key={title}>
                      <span className="food-thumb">{icon}</span>
                      <div className="review-info">
                        <h3>{title} <b className={tone}>{confidence}</b></h3>
                        <small>{id}</small>
                        <p>{sender}</p>
                        <span className={`calorie-line ${tone}`}>•　{calories}</span>
                      </div>
                      <div className="review-actions">
                        <button className="approve" onClick={() => setActiveItem('Bổ sung món')}>
                          Xem xét
                        </button>
                      </div>
                    </div>
                  ))}
                </article>

                <aside className="admin-panel alert-panel">
                  <div className="admin-panel-heading">
                    <h2><i className="bi bi-circle-fill" /> Cảnh báo sức khỏe khẩn cấp <b>4 Ca can thiệp</b></h2>
                  </div>
                  {alerts.map(([title, issue, copy, label, tone]) => (
                    <div className={`admin-alert ${tone}`} key={title}>
                      <h3>{title}<b>{label}</b></h3>
                      <strong>{issue}</strong>
                      <p>{copy}</p>
                      <button>
                        {tone === 'critical'
                          ? 'Gợi ý gói can thiệp dinh dưỡng　→'
                          : tone === 'warning'
                          ? 'Nhắc nhở qua thông báo push　♟'
                          : 'Xem chi tiết buổi tập　↗'}
                      </button>
                    </div>
                  ))}
                </aside>
              </section>

              <section className="admin-panel telemetry-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2><i className="bi bi-camera" /> Tải xử lý AI Lens theo khung giờ trong ngày</h2>
                    <p>Lưu lượng quét ảnh nhận diện bữa ăn đạt cực đại vào 11h30 – 13h00 (Bữa trưa) và 18h30 – 20h00 (Bữa tối).</p>
                  </div>
                  <div className="telemetry-heading-right">
                    <div className="telemetry-legend">
                      <span>■ Scan thành công</span>
                      <span>■ Cần nhận diện lại</span>
                    </div>
                  </div>
                </div>
                <div className="admin-chart">
                  <div className="chart-axis">
                    <span>Số lượt quét (req)</span>
                    <span>800</span>
                    <span>600</span>
                    <span>400</span>
                    <span>200</span>
                    <span>0</span>
                  </div>
                  <div className="chart-plot">
                    <div className="peak-band lunch"><b>Cao điểm – Bữa trưa</b><small>11:30 – 13:00</small></div>
                    <div className="peak-band dinner"><b>Cao điểm – Bữa tối</b><small>18:30 – 20:00</small></div>
                    <div className="chart-bars">
                      <svg className="telemetry-line" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">
                        <polyline points="4,116 16,96 28,108 40,24 52,76 64,104 76,40 88,88 96,136" />
                        {[[4, 116], [16, 96], [28, 108], [40, 24], [52, 76], [64, 104], [76, 40], [88, 88], [96, 136]].map(([cx, cy]) => (
                          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />
                        ))}
                      </svg>
                      {[[120, 20, 220], [300, 35, 320], [150, 25, 260], [580, 60, 680], [370, 45, 420], [220, 30, 280], [470, 55, 620], [250, 20, 360], [120, 5, 120]].map(([success, retry, trend], index) => (
                        <div className="chart-column" key={index} style={{ '--trend-height': `${trend / 5}px`, '--bar-height': `${success / 4}px` }}>
                          <div className="chart-values"><span>{success}</span><i>{retry}</i></div>
                          <b style={{ height: `${success / 4}px` }} />
                          <i style={{ height: `${Math.max(retry / 4, 3)}px` }} />
                          <em>{trend}</em>
                        </div>
                      ))}
                      <div className="chart-time-labels">
                        <span>06:00</span><span>07:30</span><span>11:00</span><b>12:30<br />[Trưa]</b><span>15:00</span><span>18:30</span><b>19:30<br />[Tối]</b><span>22:00</span><span>23:30</span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-right-axis">
                    <span>Tải xử lý (req)</span>
                    <span>800</span>
                    <span>600</span>
                    <span>400</span>
                    <span>200</span>
                    <span>0</span>
                  </div>
                </div>
                <div className="telemetry-foot">
                  <span>◉ Auto-scaler đã cấp phát bổ sung <b>+2 GPU Pods</b> lúc 11:25 cho bữa trưa.</span>
                  <b>▤　Tỷ lệ cache hit: 84.6%</b>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

