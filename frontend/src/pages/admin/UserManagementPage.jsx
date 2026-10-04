import { useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'

const initialSummary = { total: 0, active: 0, locked: 0 }
const lockReasons = [
  ['spam_ai_lens', 'Liên tục spam ảnh không phù hợp món ăn vào hệ thống AI Lens (>5 lần)'],
  ['community_violation', 'Vi phạm quy định cộng đồng'],
  ['abusive_content', 'Đăng tải nội dung xúc phạm hoặc gây hại'],
  ['fake_account', 'Tạo tài khoản giả mạo hoặc gian lận'],
  ['other', 'Lý do khác'],
]

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1
  return age >= 0 ? age : null
}

function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return ''
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl
  return `${axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '')}${avatarUrl}`
}

function formatMetric(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'
}

function getGoalLabel(goal) {
  return ({
    lose_weight: 'Giảm cân',
    maintain_weight: 'Duy trì cân nặng',
    gain_weight: 'Tăng cân',
    eat_healthier: 'Ăn uống lành mạnh',
  })[goal] || 'Chưa thiết lập'
}

function getGoalDescription(goal) {
  return ({
    lose_weight: 'Theo dõi lượng calo và duy trì thói quen vận động để hướng tới cân nặng mục tiêu.',
    maintain_weight: 'Duy trì cân nặng và thói quen ăn uống lành mạnh theo mục tiêu cá nhân.',
    gain_weight: 'Theo dõi dinh dưỡng và duy trì chế độ ăn phù hợp để hướng tới cân nặng mục tiêu.',
    eat_healthier: 'Xây dựng thói quen ăn uống cân bằng và phù hợp với tình trạng sức khỏe.',
  })[goal] || 'Người dùng chưa thiết lập mục tiêu dinh dưỡng.'
}

export default function UserManagementPage() {
  const { user: admin } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [authProvider, setAuthProvider] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [summary, setSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedUser, setSelectedUser] = useState(null)
  const [lockTarget, setLockTarget] = useState(null)
  const [lockReason, setLockReason] = useState('')
  const [lockDurationDays, setLockDurationDays] = useState(14)
  const [lockNote, setLockNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await axiosInstance.get('/admin/users', {
          params: { search, status, authProvider, page, limit },
          signal: controller.signal,
        })
        setUsers(data.data || [])
        setPagination(data.pagination || { page, total: 0, totalPages: 0 })
        setSummary(data.summary || initialSummary)
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Không thể tải danh sách người dùng, vui lòng thử lại')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 250 : 0)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [search, status, authProvider, page, limit, refreshKey])

  function changeSearch(value) {
    setSearch(value)
    setPage(1)
  }

  async function openDetails(user) {
    setActionError('')
    try {
      const { data } = await axiosInstance.get(`/admin/users/${user._id}`)
      setSelectedUser({ ...data.data, mode: 'details' })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải thông tin chi tiết, vui lòng thử lại')
    }
  }

  function openStatusDialog(user) {
    setActionError('')
    setLockReason(lockReasons[0][0])
    setLockDurationDays(14)
    setLockNote('')
    if (user.status === 'locked') {
      setSelectedUser({ ...user, mode: 'unlock' })
      setLockTarget(null)
    } else {
      setSelectedUser(null)
      setLockTarget(user)
    }
  }

  async function saveStatus() {
    const targetUser = lockTarget || selectedUser
    const isLocking = targetUser?.status !== 'locked'

    if (isLocking && !lockReasons.some(([value]) => value === lockReason)) {
      setActionError('Vui lòng nhập lý do khóa tài khoản')
      return
    }

    setSaving(true)
    setActionError('')
    try {
      await axiosInstance.patch(`/admin/users/${targetUser._id}/status`, {
        status: isLocking ? 'locked' : 'active',
        lockReason: isLocking ? lockReasons.find(([value]) => value === lockReason)?.[1] : undefined,
        lockDurationDays: isLocking ? lockDurationDays : undefined,
        lockNote: isLocking ? lockNote.trim() : undefined,
      })

      setSelectedUser(null)
      setLockTarget(null)
      setLockReason('')
      setLockNote('')

      const { data } = await axiosInstance.get('/admin/users', { params: { search, status, authProvider, page, limit } })
      setUsers(data.data || [])
      setPagination(data.pagination || { page, total: 0, totalPages: 0 })
      setSummary(data.summary || initialSummary)
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  const startIndex = pagination.total ? (page - 1) * limit + 1 : 0
  const endIndex = Math.min(page * limit, pagination.total)

  return (
    <section className="user-management">
      <div className="user-summary">
        <article><span className="summary-icon"><i className="bi bi-people-fill" /></span><div><small>Tổng tài khoản</small><strong>{summary.total.toLocaleString('vi-VN')}</strong></div></article>
        <article><span className="summary-icon active"><i className="bi bi-person-check-fill" /></span><div><small>Đang hoạt động</small><strong>{summary.active.toLocaleString('vi-VN')}</strong></div></article>
        <article><span className="summary-icon locked"><i className="bi bi-lock-fill" /></span><div><small>Đã khóa</small><strong>{summary.locked.toLocaleString('vi-VN')}</strong></div></article>
      </div>

      <div className="user-list-panel">
        <div className="user-list-tools">
          <label className="user-search"><i className="bi bi-search" /><input value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Tìm theo tên, email..." aria-label="Tìm theo tên hoặc email" /></label>
          <label className="user-filter"><i className="bi bi-record-circle" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái"><option value="all">Trạng thái: Tất cả</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option><option value="pending">Chờ xác thực</option></select></label>
          <label className="user-filter"><i className="bi bi-shield-check" /><select value={authProvider} onChange={(event) => { setAuthProvider(event.target.value); setPage(1) }} aria-label="Phương thức xác thực"><option value="all">Xác thực: Tất cả</option><option value="local">Email/Pass</option><option value="google">Google</option></select></label>
        </div>

        {error ? <div className="user-state error" role="alert"><i className="bi bi-exclamation-circle" /><span>{error}</span><button onClick={() => { setError(''); setRefreshKey((key) => key + 1) }}>Thử lại</button></div> : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead><tr><th>Người dùng</th><th>Email</th><th>Giới tính</th><th>Trạng thái</th><th>Xác thực</th><th>Ngày tham gia</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="user-table-message"><span className="user-spinner" /> Đang tải danh sách...</td></tr> : users.length === 0 ? <tr><td colSpan="7" className="user-table-message">Không tìm thấy kết quả phù hợp</td></tr> : users.map((listedUser) => (
                  <tr key={listedUser._id}>
                    <td><div className="user-identity"><span className="user-avatar">{listedUser.avatarUrl ? <img src={getAvatarUrl(listedUser.avatarUrl)} alt="" /> : listedUser.fullName?.charAt(0)?.toUpperCase()}</span><span><strong>{listedUser.fullName}</strong><small>#{listedUser._id.slice(-6).toUpperCase()}</small></span></div></td>
                    <td className="user-email">{listedUser.email}</td>
                    <td><span className={`gender-pill ${listedUser.gender === 'female' ? 'female' : ''}`}>{listedUser.gender === 'female' ? 'Nữ' : listedUser.gender === 'male' ? 'Nam' : '—'}</span></td>
                    <td><span className={`status-pill ${listedUser.status}`}><i />{listedUser.status === 'locked' ? 'Đã khóa' : listedUser.status === 'pending' ? 'Chờ xác thực' : 'Hoạt động'}</span></td>
                    <td className="provider-cell"><i className={`bi ${listedUser.authProvider === 'google' ? 'bi-google google-icon' : 'bi-envelope'}`} />{listedUser.authProvider === 'google' ? 'Google' : 'Email/Pass'}</td>
                    <td className="user-date">{formatDate(listedUser.createdAt)}</td>
                    <td><div className="user-row-actions"><button className={`user-status-action ${listedUser.status === 'locked' ? 'unlock' : ''}`} onClick={() => openStatusDialog(listedUser)}><i className={`bi ${listedUser.status === 'locked' ? 'bi-unlock-fill' : 'bi-lock-fill'}`} />{listedUser.status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}</button><button className="user-action" onClick={() => openDetails(listedUser)}>Chi tiết<i className="bi bi-chevron-right" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="user-pagination"><span>{pagination.total ? `Hiển thị ${startIndex}–${endIndex} / ${pagination.total.toLocaleString('vi-VN')} người dùng` : '0 người dùng'}</span><div><button aria-label="Trang trước" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><i className="bi bi-chevron-left" /></button>{Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, index) => {
          const firstPage = Math.max(1, Math.min(page - 2, pagination.totalPages - 4))
          const pageNumber = firstPage + index
          return <button key={pageNumber} className={pageNumber === page ? 'current' : ''} disabled={loading} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
        })}<button aria-label="Trang sau" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}><i className="bi bi-chevron-right" /></button></div></footer>
      </div>

      {selectedUser && (
        <div className="user-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null) }}>
          <section className={selectedUser.mode === 'details' ? 'user-modal user-detail-modal' : 'user-modal'} role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            {selectedUser.mode === 'details' ? (
              <div className="user-detail-panel">
                <header className="user-detail-header">
                  <div className="user-detail-heading"><span className="detail-card-icon"><i className="bi bi-person-vcard-fill" /></span><h2>Chi tiết người dùng</h2></div>
                  <button aria-label="Đóng" onClick={() => setSelectedUser(null)}><i className="bi bi-x-lg" /></button>
                </header>

                <div className="user-detail-body">
                  <section className="detail-profile-banner">
                    <span className="user-avatar large">{selectedUser.avatarUrl ? <img src={getAvatarUrl(selectedUser.avatarUrl)} alt="" /> : selectedUser.fullName?.charAt(0)?.toUpperCase()}</span>
                    <div className="detail-profile-identity">
                      <strong>{selectedUser.fullName || '—'}</strong>
                      <span className="user-detail-id">#{selectedUser._id?.slice(-6).toUpperCase()}</span>
                      <span className="detail-profile-contact"><i className="bi bi-envelope" />{selectedUser.email || '—'}<i className={`bi ${selectedUser.authProvider === 'google' ? 'bi-google google-icon' : 'bi-shield-lock'}`} />{selectedUser.authProvider === 'google' ? 'Google' : 'Email'}</span>
                      <span className={`detail-profile-status ${selectedUser.status === 'locked' ? 'locked' : ''}`}><i />{selectedUser.status === 'locked' ? 'Đã khóa' : selectedUser.status === 'pending' ? 'Chờ xác thực' : 'Đang hoạt động'}</span>
                    </div>
                    <div className="detail-profile-facts">
                      <div><i className="bi bi-calendar-date" /><span><small>Ngày sinh</small><strong>{selectedUser.dateOfBirth ? new Intl.DateTimeFormat('vi-VN').format(new Date(selectedUser.dateOfBirth)) : '—'}</strong></span></div>
                      <div><i className="bi bi-person" /><span><small>Giới tính</small><strong>{selectedUser.gender === 'female' ? 'Nữ' : selectedUser.gender === 'male' ? 'Nam' : '—'}</strong></span></div>
                    </div>
                  </section>

                  <div className="user-detail-sections">
                    <section className="detail-card personal-card">
                      <div className="detail-card-header"><span className="detail-card-icon"><i className="bi bi-person-lines-fill" /></span><h3>Thông tin cá nhân</h3></div>
                      <div className="detail-grid">
                        <div className="detail-field"><label>Họ và tên</label><span>{selectedUser.fullName || '—'}</span></div>
                        <div className="detail-field"><label>Email</label><span>{selectedUser.email || '—'}</span></div>
                        <div className="detail-field"><label>Ngày sinh</label><span>{selectedUser.dateOfBirth ? new Intl.DateTimeFormat('vi-VN').format(new Date(selectedUser.dateOfBirth)) : '—'}</span></div>
                        <div className="detail-field"><label>Giới tính</label><span>{selectedUser.gender === 'female' ? 'Nữ' : selectedUser.gender === 'male' ? 'Nam' : '—'}</span></div>
                      </div>
                    </section>

                    <section className="detail-card health-card">
                      <div className="detail-card-header"><span className="detail-card-icon success"><i className="bi bi-heart-pulse-fill" /></span><h3>Hồ sơ sức khỏe</h3></div>
                      <div className="metric-grid">
                        <div className="metric-box"><span>Chiều cao</span><strong>{formatMetric(selectedUser.heightCm)}{selectedUser.heightCm != null ? ' cm' : ''}</strong><i className="bi bi-rulers" /></div>
                        <div className="metric-box"><span>Cân nặng</span><strong>{formatMetric(selectedUser.currentWeightKg)}{selectedUser.currentWeightKg != null ? ' kg' : ''}</strong><i className="bi bi-bag-heart-fill" /></div>
                        <div className="metric-box"><span>BMI</span><strong>{formatMetric(selectedUser.healthMetrics?.bmi ?? selectedUser.bmi, 1)}</strong><small>{selectedUser.healthMetrics?.bmiCategory || ''}</small></div>
                        <div className="metric-box"><span>BMR</span><strong>{formatMetric(selectedUser.healthMetrics?.bmr ?? selectedUser.bmr)}{selectedUser.healthMetrics?.bmr || selectedUser.bmr ? ' kcal/ngày' : ''}</strong><i className="bi bi-fire" /></div>
                        <div className="metric-box"><span>TDEE</span><strong>{formatMetric(selectedUser.healthMetrics?.tdee ?? selectedUser.tdee)}{selectedUser.healthMetrics?.tdee || selectedUser.tdee ? ' kcal/ngày' : ''}</strong><i className="bi bi-lightning-charge-fill" /></div>
                      </div>
                    </section>
                  </div>

                  <section className="goal-card">
                    <div className="detail-card-header"><span className="detail-card-icon goal-icon"><i className="bi bi-bullseye" /></span><h3>Mục tiêu dinh dưỡng</h3></div>
                    <div className="goal-card-content"><div><small>Mục tiêu hiện tại</small><strong>{getGoalLabel(selectedUser.nutritionGoal?.goal || selectedUser.healthGoal)}</strong></div><p>{getGoalDescription(selectedUser.nutritionGoal?.goal || selectedUser.healthGoal)}{selectedUser.nutritionGoal?.calorieTarget ? ` Mục tiêu năng lượng: ${formatMetric(selectedUser.nutritionGoal.calorieTarget)} kcal/ngày.` : ''}</p></div>
                  </section>

                  <section className="history-card">
                    <div className="history-card-header"><span className="detail-card-icon history"><i className="bi bi-calendar-week-fill" /></span><h3>Lịch sử hoạt động gần đây (7 ngày)</h3></div>
                    <div className="activity-summary-grid">
                      <article><span className="activity-icon meals"><i className="bi bi-fork-knife" /></span><div><small>Số bữa ăn đã ghi nhận</small><strong>{selectedUser.activitySummary?.mealCount ?? '—'}</strong><span>Trong 7 ngày qua</span></div></article>
                      <article><span className="activity-icon workouts"><i className="bi bi-person-walking" /></span><div><small>Số buổi tập đã ghi nhận</small><strong>{selectedUser.activitySummary?.workoutCount ?? '—'}</strong><span>Trong 7 ngày qua</span></div></article>
                      <article><span className="activity-icon recent"><i className="bi bi-clock-history" /></span><div><small>Hoạt động gần nhất</small><strong>{selectedUser.activitySummary?.lastActivity || 'Chưa ghi nhận'}</strong><span>{selectedUser.activitySummary?.lastActivityAt ? formatDate(selectedUser.activitySummary.lastActivityAt) : '—'}</span></div></article>
                    </div>
                    <div className="activity-details-grid">
                      <div className="activity-log-panel"><h4><i className="bi bi-list-check" />Chi tiết theo từng ngày (7 ngày gần nhất)</h4><div className="activity-log-head"><span>Ngày</span><span>Bữa ăn</span><span>Bài tập</span></div>{(selectedUser.activitySummary?.days || []).length ? selectedUser.activitySummary.days.map((day) => <div className="activity-log-row" key={day.date}><span>{formatDate(day.date)}</span><span>{day.meals ?? '—'}</span><span>{day.workouts ?? '—'}</span></div>) : <p className="activity-empty">Chưa có dữ liệu bữa ăn hoặc bài tập trong 7 ngày gần nhất.</p>}</div>
                      <div className="activity-note-panel"><h4><i className="bi bi-journal-text" />Ghi chú thêm</h4><p>{selectedUser.medicalConditions || selectedUser.allergies || 'Không có ghi chú đặc biệt.'}</p></div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="user-modal-content">
                <header>
                  <h2 id="user-modal-title">Mở khóa tài khoản</h2>
                  <button aria-label="Đóng" onClick={() => setSelectedUser(null)}><i className="bi bi-x-lg" /></button>
                </header>
                <p>Bạn có chắc muốn mở khóa tài khoản {selectedUser.fullName}?</p>
                {actionError && <p className="user-action-error" role="alert">{actionError}</p>}
                <div className="user-modal-actions"><button onClick={() => { setSelectedUser(null); setActionError('') }}>Hủy bỏ</button><button className="user-modal-primary" disabled={saving} onClick={saveStatus}>{saving ? 'Đang xử lý...' : 'Xác nhận mở khóa'}</button></div>
              </div>
            )}
          </section>
        </div>
      )}

      {lockTarget && (
        <div className="user-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLockTarget(null) }}>
          <section className="user-modal user-lock-modal" role="dialog" aria-modal="true" aria-labelledby="user-lock-title">
            <header className="user-lock-header">
              <span className="user-lock-icon"><i className="bi bi-lock-fill" /></span>
              <div><h2 id="user-lock-title">Khóa tài khoản người dùng</h2><p>Vô hiệu hóa ngay các phiên đăng nhập JWT hiện hành</p></div>
              <button aria-label="Đóng" onClick={() => setLockTarget(null)}><i className="bi bi-x-lg" /></button>
            </header>
            <div className="user-lock-content">
              <div className="user-lock-person">
                <span className="user-avatar large">{lockTarget.avatarUrl ? <img src={getAvatarUrl(lockTarget.avatarUrl)} alt="" /> : lockTarget.fullName?.charAt(0)?.toUpperCase()}</span>
                <div><strong>{lockTarget.fullName}</strong><small>#{lockTarget._id.slice(-6).toUpperCase()}</small><span>{lockTarget.email}{getAge(lockTarget.dateOfBirth) !== null ? ` · ${getAge(lockTarget.dateOfBirth)} tuổi` : ''}</span></div>
              </div>

              <label className="lock-field-label" htmlFor="lock-reason">Lý do khóa <b>*</b></label>
              <select id="lock-reason" className="lock-reason-select" value={lockReason} onChange={(event) => setLockReason(event.target.value)}>
                {lockReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>

              <span className="lock-field-label">Thời hạn áp dụng</span>
              <div className="lock-duration-options" role="group" aria-label="Thời hạn khóa">
                {[[7, '7 ngày'], [14, '14 ngày'], [0, 'Vĩnh viễn']].map(([days, label]) => <button key={days} type="button" className={Number(lockDurationDays) === days ? 'selected' : ''} onClick={() => setLockDurationDays(days)}>{label}</button>)}
              </div>

              <label className="lock-field-label" htmlFor="lock-note">Ghi chú (tùy chọn)</label>
              <textarea id="lock-note" className="lock-note" value={lockNote} onChange={(event) => setLockNote(event.target.value)} placeholder="Nhập thêm ghi chú..." rows="2" />

              <div className="lock-audit"><i className="bi bi-info-circle" /><div><strong>Thông tin audit</strong><span>Người thực hiện: {admin?.fullName || 'Admin'} ({admin?.email || 'Không có email'})</span><span>Thời gian khóa: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</span><span>Lý do: {lockReasons.find(([value]) => value === lockReason)?.[1]}</span></div></div>
              {actionError && <p className="user-action-error" role="alert">{actionError}</p>}
              <div className="user-modal-actions"><button onClick={() => { setLockTarget(null); setActionError('') }}>Hủy bỏ</button><button className="user-lock-confirm" disabled={saving} onClick={saveStatus}>{saving ? 'Đang xử lý...' : 'Xác nhận khóa'}</button></div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
