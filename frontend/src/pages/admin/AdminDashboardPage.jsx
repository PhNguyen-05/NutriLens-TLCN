import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'
import AdminActionLogsModal from './AdminActionLogsModal'
import UserManagementPage from './UserManagementPage'
import FoodManagementPage from './FoodManagementPage'
import FoodRequestManagementPage from './FoodRequestManagementPage'

import BlogManagementPage from './BlogManagementPage'

import ExerciseManagementPage from './ExerciseManagementPage'
import AdminAnalyticsPage from './AdminAnalyticsPage'
import AdminFoodAnalyticsPage from './AdminFoodAnalyticsPage'
import AdminExerciseAnalyticsPage from './AdminExerciseAnalyticsPage'
import AdminBlogAnalyticsPage from './AdminBlogAnalyticsPage'
import './AdminDashboardPage.css'

const emptyDashboardStats = {
  newUsers: null,
  meals: null,
  exercises: null,
  articles: null,
  pendingMeals: null,
  lockedUsers: null,
  draftArticles: null,
}

function getTodayInVietnam() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function formatActivityTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}

function getActivityCategory(log) {
  if (log.targetType === 'User') return 'Người dùng'
  if (log.targetType === 'FoodItem' || log.targetType === 'Request') return 'Món ăn'
  if (log.targetType === 'Exercise') return 'Bài tập'
  if (log.targetType === 'Post') return 'Bài viết'
  return 'Hệ thống'
}

function getActivityIcon(category) {
  if (category === 'Người dùng') return 'bi-person-fill'
  if (category === 'Món ăn') return 'bi-cup-hot-fill'
  if (category === 'Bài tập') return 'bi-person-walking'
  if (category === 'Bài viết') return 'bi-file-earmark-text-fill'
  return 'bi-clock-history'
}

function getActivityTone(category) {
  if (category === 'Người dùng') return 'user'
  if (category === 'Món ăn') return 'food'
  if (category === 'Bài tập') return 'exercise'
  if (category === 'Bài viết') return 'article'
  return 'system'
}

export default function AdminDashboardPage() {
  const { user, handleLogout } = useAuth()
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [showActionLogs, setShowActionLogs] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState(emptyDashboardStats)
  const [dashboardActivity, setDashboardActivity] = useState([])
  const isAnalyticsPage = ['Báo cáo', 'FoodAnalytics', 'ExerciseAnalytics', 'BlogAnalytics'].includes(activeItem)
  const isDashboard = activeItem === 'Dashboard' && !showActionLogs

  // Tự động tải số lượng yêu cầu chờ duyệt hiển thị lên badge sidebar
  useEffect(() => {
    if (activeItem === 'Dashboard') return undefined
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

  useEffect(() => {
    if (!isDashboard) return undefined

    const controller = new AbortController()
    const today = getTodayInVietnam()
    const params = { from: today, to: today }
    setDashboardLoading(true)

    async function loadDashboard() {
      const results = await Promise.allSettled([
        axiosInstance.get('/admin/users', { params: { ...params, page: 1, limit: 6 }, signal: controller.signal }),
        axiosInstance.get('/admin/foods/analytics', { params, signal: controller.signal }),
        axiosInstance.get('/admin/exercises/analytics', { params, signal: controller.signal }),
        axiosInstance.get('/admin/blog/analytics', { params, signal: controller.signal }),
        axiosInstance.get('/admin/food-requests', { params: { limit: 1 }, signal: controller.signal }),
        axiosInstance.get('/admin/users/action-logs', {
          params: { ...params, page: 1, limit: 8, targetType: 'all', action: 'all', adminId: 'all' },
          signal: controller.signal,
        }),
      ])
      if (controller.signal.aborted) return

      const [usersResult, foodsResult, exercisesResult, blogResult, requestsResult, logsResult] = results
      const users = usersResult.status === 'fulfilled' ? usersResult.value.data : null
      const foods = foodsResult.status === 'fulfilled' ? foodsResult.value.data : null
      const exercises = exercisesResult.status === 'fulfilled' ? exercisesResult.value.data : null
      const blogs = blogResult.status === 'fulfilled' ? blogResult.value.data : null
      const requests = requestsResult.status === 'fulfilled' ? requestsResult.value.data : null
      const logs = logsResult.status === 'fulfilled' ? logsResult.value.data : null
      const todayExercise = exercises?.daily?.find((row) => row.date === today)
      const todayFood = foods?.daily?.find((row) => row.date === today)
      const todayBlog = blogs?.daily?.find((row) => row.date === today)

      setDashboardStats({
        newUsers: users ? users.pagination?.total ?? users.data?.length ?? 0 : null,
        meals: foods ? todayFood?.added || 0 : null,
        exercises: exercises ? todayExercise?.sessions || 0 : null,
        articles: blogs ? todayBlog?.created || 0 : null,
        pendingMeals: requests ? requests.summary?.pending || 0 : null,
        lockedUsers: users ? users.summary?.locked || 0 : null,
        draftArticles: blogs ? blogs.summary?.drafts || 0 : null,
      })
      if (requests?.summary) setPendingRequestsCount(requests.summary.pending || 0)

      const newUserActivities = (users?.data || []).map((item) => ({
        id: `user-${item._id}`,
        category: 'Người dùng',
        title: 'Người dùng mới',
        detail: `${item.fullName || item.email || 'Người dùng'} đã đăng ký tài khoản mới`,
        createdAt: item.createdAt,
      }))
      const adminActivities = (logs?.data || []).map((item) => {
        const category = getActivityCategory(item)
        return {
          id: `log-${item._id}`,
          category,
          title: category,
          detail: item.reason || item.note || 'Có thay đổi mới trong hệ thống',
          createdAt: item.createdAt,
        }
      })
      setDashboardActivity([...newUserActivities, ...adminActivities]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 7))
    }

    loadDashboard().catch(() => {
      if (!controller.signal.aborted) setDashboardActivity([])
    }).finally(() => {
      if (!controller.signal.aborted) setDashboardLoading(false)
    })

    return () => controller.abort()
  }, [isDashboard, refreshKey])

  function navigateAdmin(item) {
    setActiveItem(item)
    setShowActionLogs(item === 'Lịch sử thao tác')
  }

  return (
    <div className={`admin-shell ${isAnalyticsPage ? 'admin-shell-analytics' : ''} ${isDashboard ? 'admin-dashboard-mode' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand"><span><i className="bi bi-heart-pulse-fill" /></span> NutriLens</div>
        <div className="admin-section-label">TỔNG QUAN</div>
        <button className={activeItem === 'Dashboard' ? 'active' : ''} onClick={() => { setActiveItem('Dashboard'); setShowActionLogs(false) }}><i className="bi bi-grid-1x2" /> Dashboard</button>
        <button className={activeItem === 'Lịch sử thao tác' ? 'active' : ''} onClick={() => { setActiveItem('Lịch sử thao tác'); setShowActionLogs(true) }}><i className="bi bi-clock-history" /> Lịch sử thao tác</button>
        <button className={isAnalyticsPage ? 'active' : ''} onClick={() => { setActiveItem('Báo cáo'); setShowActionLogs(false) }}><i className="bi bi-bar-chart-line" /> Thống kê &amp; Báo cáo</button>
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
        <div className="admin-section-label">TIN TỨC</div>
        <button onClick={() => { setActiveItem('Blog'); setShowActionLogs(false) }} className={activeItem === 'Blog' ? 'active' : ''}><i className="bi bi-journal-text" /> Blog y khoa</button>
        <div className="admin-sidebar-footer"><button onClick={handleLogout}><i className="bi bi-box-arrow-left" /> Đăng xuất</button></div>
      </aside>

      <main className="admin-content">
        <header className={`admin-topbar ${activeItem === 'Lịch sử thao tác' ? 'action-log-admin-topbar' : ''} ${isDashboard ? 'admin-overview-topbar' : ''}`}>
          <div className={`admin-topbar-title ${activeItem === 'Lịch sử thao tác' ? 'action-log-topbar-title' : ''}`}>
            {activeItem === 'Lịch sử thao tác' && <span className="action-log-heading-icon"><i className="bi bi-clock-history" /></span>}
            <div>
              <h1>
                {isDashboard
                  ? 'Dashboard'
                  : activeItem === 'Người dùng'
                  ? 'Quản lý người dùng'
                  : activeItem === 'FoodAnalytics'
                  ? 'Thống kê món ăn'
                  : activeItem === 'ExerciseAnalytics'
                  ? 'Thống kê bài tập'
                  : activeItem === 'BlogAnalytics'
                  ? 'Thống kê bài viết Blog'
                  : activeItem === 'Báo cáo'
                  ? 'Thống kê người dùng'
                  : activeItem === 'Lịch sử thao tác'
                  ? 'Lịch sử thao tác của Admin'
                  : activeItem === 'Món ăn'
                  ? 'Quản lý danh mục món ăn'
                  : activeItem === 'Bổ sung món'
                  ? 'Duyệt yêu cầu bổ sung món ăn'
                  : activeItem === 'Blog'
                  ? 'Quản lý Blog Y khoa'

                  : activeItem === 'Bài tập'
                  ? 'Quản lý danh mục bài tập'
                  : 'Bảng điều khiển Vận hành NutriLes'}
              </h1>
              <p>
                {isDashboard
                  ? 'Tổng quan hoạt động của hệ thống NutriLens'
                  : activeItem === 'Người dùng'
                  ? 'Xem và quản lý thông tin người dùng, theo dõi trạng thái tài khoản.'
                  : activeItem === 'FoodAnalytics'
                  ? 'Theo dõi số lượng, trạng thái và biến động danh mục món ăn theo thời gian.'
                  : activeItem === 'ExerciseAnalytics'
                  ? 'Theo dõi lượt ghi nhận, thời lượng vận động và calories tiêu hao theo thời gian.'
                  : activeItem === 'BlogAnalytics'
                  ? 'Theo dõi tình trạng xuất bản, lượt xem và tương tác của các bài viết Blog.'
                  : activeItem === 'Báo cáo'
                  ? 'Theo dõi và phân tích chi tiết các số liệu về người dùng trong hệ thống NutriLens.'
                  : activeItem === 'Lịch sử thao tác'
                  ? 'Xem chi tiết các thao tác quản lý tài khoản, bao gồm khóa, mở khóa, cập nhật thông tin và các hành động khác.'
                  : activeItem === 'Món ăn'
                  ? 'Thêm, chỉnh sửa, ẩn/hiển thị hoặc xóa món ăn trong danh mục hệ thống.'
                  : activeItem === 'Bổ sung món'
                  ? 'Xem xét, chuẩn hóa thành phần dinh dưỡng và phê duyệt hoặc từ chối các yêu cầu món ăn do người dùng đề xuất.'
                  : activeItem === 'Blog'
                  ? 'Quản lý nội dung và trạng thái xuất bản các bài viết sức khỏe, dinh dưỡng.'

                  : activeItem === 'Bài tập'
                  ? 'Thêm, chỉnh sửa, ẩn hoặc hiển thị thông tin bài tập và chỉ số MET làm cơ sở tính calories cho người dùng.'
                  : 'Giám sát thời gian thực hoạt động các microservices, hàng đợi phê duyệt AI Lens và chỉ số an toàn sức khỏe người dùng trong ngày.'}
              </p>
            </div>
          </div>
          <div className="admin-user">
            <button title="Thông báo" onClick={() => navigateAdmin('Bổ sung món')}>
              <i className="bi bi-bell" />
            </button>
            <strong>{user?.fullName || 'Admin'}</strong>
            <span>{(user?.fullName || 'A').charAt(0)}</span>
          </div>
        </header>

        <div className={`admin-body ${activeItem === 'Lịch sử thao tác' ? 'action-log-admin-body' : ''} ${isAnalyticsPage ? 'ua-admin-body' : ''}`}>
          {activeItem === 'Người dùng' ? (
            <UserManagementPage />
          ) : activeItem === 'ExerciseAnalytics' ? (
            <AdminExerciseAnalyticsPage onNavigate={(item) => {
              setShowActionLogs(false)
              setActiveItem(item === 'Món ăn' ? 'FoodAnalytics' : item === 'Bài tập' ? 'ExerciseAnalytics' : item === 'Blog' ? 'BlogAnalytics' : item)
            }} />
          ) : activeItem === 'BlogAnalytics' ? (
            <AdminBlogAnalyticsPage onNavigate={(item) => {
              setShowActionLogs(false)
              setActiveItem(item === 'Món ăn' ? 'FoodAnalytics' : item === 'Bài tập' ? 'ExerciseAnalytics' : item === 'Blog' ? 'BlogAnalytics' : item)
            }} />
          ) : activeItem === 'FoodAnalytics' ? (
            <AdminFoodAnalyticsPage onNavigate={(item) => {
              setShowActionLogs(false)
              setActiveItem(item === 'Món ăn' ? 'FoodAnalytics' : item === 'Bài tập' ? 'ExerciseAnalytics' : item === 'Blog' ? 'BlogAnalytics' : item)
            }} />
          ) : activeItem === 'Báo cáo' ? (
            <AdminAnalyticsPage onManageUsers={() => setActiveItem('Người dùng')} onNavigate={(item) => {
              setShowActionLogs(false)
              setActiveItem(item === 'Món ăn' ? 'FoodAnalytics' : item === 'Bài tập' ? 'ExerciseAnalytics' : item === 'Blog' ? 'BlogAnalytics' : item)
            }} />
          ) : activeItem === 'Lịch sử thao tác' ? (
            <AdminActionLogsModal embedded isOpen={showActionLogs} onClose={() => { setShowActionLogs(false); setActiveItem('Dashboard') }} />
          ) : activeItem === 'Món ăn' ? (
            <FoodManagementPage />
          ) : activeItem === 'Bổ sung món' ? (
            <FoodRequestManagementPage />

          ) : activeItem === 'Blog' ? (
            <BlogManagementPage />

          ) : activeItem === 'Bài tập' ? (
            <ExerciseManagementPage />

          ) : (
            <>
              <div className="overview-toolbar">
                <span><i className="bi bi-calendar3" />{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}</span>
                <button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={dashboardLoading}>
                  <i className={`bi bi-arrow-clockwise ${dashboardLoading ? 'is-spinning' : ''}`} /> Làm mới
                </button>
              </div>
              <section className="overview-stat-grid" aria-label="Tổng quan hoạt động hôm nay">
                {[
                  { label: 'Người dùng mới hôm nay', value: dashboardStats.newUsers, tone: 'green', icon: 'bi-people-fill' },
                  { label: 'Món ăn mới hôm nay', value: dashboardStats.meals, tone: 'orange', icon: 'bi-cup-hot-fill' },
                  { label: 'Lượt ghi nhận bài tập', value: dashboardStats.exercises, tone: 'blue', icon: 'bi-person-walking' },
                  { label: 'Bài viết Blog mới hôm nay', value: dashboardStats.articles, tone: 'purple', icon: 'bi-file-earmark-text-fill' },
                ].map((stat) => (
                  <article className={'overview-stat-card ' + stat.tone} key={stat.label}>
                    <span className="overview-stat-icon"><i className={'bi ' + stat.icon} /></span>
                    <div className="overview-stat-copy">
                      <p>{stat.label}</p>
                      <strong>{stat.value == null ? '—' : stat.value.toLocaleString('vi-VN')}</strong>
                      <small>Ghi nhận trong ngày</small>
                    </div>
                  </article>
                ))}
              </section>

              <section className="overview-content-grid">
                <article className="overview-panel overview-activity-panel">
                  <div className="overview-panel-heading">
                    <h2><span className="overview-heading-icon green"><i className="bi bi-clock-fill" /></span>Hoạt động mới nhất trong ngày</h2>
                  </div>
                  <div className="overview-activity-scroll">
                    {dashboardLoading && dashboardActivity.length === 0 ? (
                      <div className="overview-empty-state"><span className="overview-loader" />Đang tải hoạt động hôm nay…</div>
                    ) : dashboardActivity.length ? (
                      <div className="overview-activity-list">
                        {dashboardActivity.map((activity) => (
                          <button className={'overview-activity-row ' + getActivityTone(activity.category)} key={activity.id} type="button" onClick={() => navigateAdmin('Lịch sử thao tác')}>
                            <span className={'overview-activity-icon ' + getActivityTone(activity.category)}><i className={'bi ' + getActivityIcon(activity.category)} /></span>
                            <time>{formatActivityTime(activity.createdAt)}</time>
                            <span className="overview-activity-copy">
                              <b>{activity.title}</b>
                              <small>{activity.detail}</small>
                            </span>
                            <i className="bi bi-chevron-right overview-row-chevron" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="overview-empty-state"><i className="bi bi-calendar2-check" />Chưa có hoạt động nào được ghi nhận hôm nay.</div>
                    )}
                  </div>
                </article>

                <aside className="overview-panel overview-attention-panel">
                  <div className="overview-panel-heading attention-heading">
                    <h2><span className="overview-heading-icon coral"><i className="bi bi-exclamation-triangle-fill" /></span>Tình hình cần chú ý</h2>
                  </div>
                  <div className="overview-attention-scroll">
                    <div className="overview-attention-list">
                      <button type="button" className="overview-attention-row food" onClick={() => navigateAdmin('Bổ sung món')}>
                        <span className="overview-attention-icon"><i className="bi bi-cup-hot-fill" /></span>
                        <span className="overview-attention-copy"><b>Yêu cầu bổ sung món chờ duyệt</b><small>Có món ăn mới được người dùng đề xuất</small></span>
                        <strong>{dashboardStats.pendingMeals == null ? '—' : dashboardStats.pendingMeals}</strong>
                        <i className="bi bi-chevron-right" />
                      </button>
                      <button type="button" className="overview-attention-row users" onClick={() => navigateAdmin('Người dùng')}>
                        <span className="overview-attention-icon"><i className="bi bi-person-fill-lock" /></span>
                        <span className="overview-attention-copy"><b>Tài khoản đang bị khóa</b><small>Xem lại trạng thái và xử lý tài khoản</small></span>
                        <strong>{dashboardStats.lockedUsers == null ? '—' : dashboardStats.lockedUsers}</strong>
                        <i className="bi bi-chevron-right" />
                      </button>
                      <button type="button" className="overview-attention-row blog" onClick={() => navigateAdmin('Blog')}>
                        <span className="overview-attention-icon"><i className="bi bi-file-earmark-text-fill" /></span>
                        <span className="overview-attention-copy"><b>Bài viết chưa xuất bản</b><small>Bài viết Blog đang ở trạng thái nháp</small></span>
                        <strong>{dashboardStats.draftArticles == null ? '—' : dashboardStats.draftArticles}</strong>
                        <i className="bi bi-chevron-right" />
                      </button>
                    </div>
                  </div>
                  <div className="overview-welcome-card">
                    <span><i className="bi bi-leaf-fill" /></span>
                    <div><b>Cùng xây dựng cộng đồng sống khỏe hơn!</b><small>Cảm ơn bạn đã đồng hành cùng NutriLens <i className="bi bi-heart-fill" /></small></div>
                    <i className="bi bi-leaf overview-welcome-leaf" />
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

