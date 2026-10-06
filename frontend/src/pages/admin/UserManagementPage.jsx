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
const actionLabels = {
  lock_user: 'Khóa tài khoản',
  unlock_user: 'Mở khóa tài khoản',
  approve_post: 'Duyệt bài viết',
  delete_food: 'Xóa món ăn',
  hide_post: 'Ẩn bài viết',
  remove_post: 'Gỡ bài viết',
  reject_request: 'Từ chối yêu cầu',
}

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
    lose_weight: 'Duy trì cân nặng hợp lý, cải thiện sức khoẻ và thói quen ăn uống lành mạnh.',
    maintain_weight: 'Duy trì cân nặng hợp lý, cải thiện sức khoẻ và thói quen ăn uống lành mạnh.',
    gain_weight: 'Duy trì cân nặng hợp lý, cải thiện sức khoẻ và thói quen ăn uống lành mạnh.',
    eat_healthier: 'Duy trì cân nặng hợp lý, cải thiện sức khoẻ và thói quen ăn uống lành mạnh.',
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
  const [unlockReason, setUnlockReason] = useState('')
  const [unlockEvidence, setUnlockEvidence] = useState([])
  const [draggingEvidence, setDraggingEvidence] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showActionLogs, setShowActionLogs] = useState(false)
  const [logFrom, setLogFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [logTo, setLogTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [logAction, setLogAction] = useState('all')
  const [logAdmin, setLogAdmin] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [logPage, setLogPage] = useState(1)
  const [actionLogs, setActionLogs] = useState([])
  const [logAdmins, setLogAdmins] = useState([])
  const [logPagination, setLogPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

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

  useEffect(() => {
    if (!showActionLogs) return undefined
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLogsLoading(true)
      setLogsError('')
      try {
        const { data } = await axiosInstance.get('/admin/users/action-logs', {
          params: { from: logFrom, to: logTo, action: logAction, adminId: logAdmin, search: logSearch, page: logPage, limit: 7 },
          signal: controller.signal,
        })
        setActionLogs(data.data || [])
        setLogAdmins(data.admins || [])
        setLogPagination(data.pagination || { page: logPage, total: 0, totalPages: 0 })
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setLogsError(requestError.response?.data?.message || 'Không thể tải lịch sử thao tác')
        }
      } finally {
        if (!controller.signal.aborted) setLogsLoading(false)
      }
    }, logSearch ? 250 : 0)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [showActionLogs, logFrom, logTo, logAction, logAdmin, logSearch, logPage])

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
    setUnlockReason('')
    setUnlockEvidence([])
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

    if (!isLocking && !unlockReason.trim()) {
      setActionError('Vui lòng nhập lý do yêu cầu mở khóa')
      return
    }
    if (!isLocking && unlockEvidence.length === 0) {
      setActionError('Vui lòng đính kèm ít nhất một minh chứng')
      return
    }

    setSaving(true)
    setActionError('')
    try {
      if (isLocking) {
        await axiosInstance.patch(`/admin/users/${targetUser._id}/status`, {
          status: 'locked',
          lockReason: lockReasons.find(([value]) => value === lockReason)?.[1],
          lockDurationDays,
          lockNote: lockNote.trim(),
        })
      } else {
        const formData = new FormData()
        formData.append('status', 'active')
        formData.append('unlockReason', unlockReason.trim())
        unlockEvidence.forEach((file) => formData.append('evidence', file))
        await axiosInstance.patch(`/admin/users/${targetUser._id}/status`, formData, { headers: { 'Content-Type': undefined } })
      }

      setSelectedUser(null)
      setLockTarget(null)
      setLockReason('')
      setLockNote('')
      setUnlockReason('')
      setUnlockEvidence([])

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

  function addUnlockEvidence(fileList) {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    const selectedFiles = Array.from(fileList || [])
    const validFiles = []

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        setActionError('Chỉ chấp nhận tệp JPG, PNG hoặc PDF')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setActionError(`Tệp ${file.name} vượt quá giới hạn 5 MB`)
        continue
      }
      validFiles.push(file)
    }

    setUnlockEvidence((current) => [...current, ...validFiles].slice(0, 5))
    if (unlockEvidence.length + validFiles.length > 5) {
      setActionError('Bạn chỉ có thể tải lên tối đa 5 tệp')
      return
    }
    if (validFiles.length && !selectedFiles.some((file) => !allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setActionError('')
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
          <button className="action-log-open" onClick={() => { setLogPage(1); setShowActionLogs(true) }}><i className="bi bi-clock-history" />Lịch sử thao tác</button>
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
          <section className={selectedUser.mode === 'details' ? 'user-modal user-detail-modal' : 'user-modal user-unlock-modal'} role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
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
                    <div className="goal-card-content"><div><small>Mục tiêu hiện tại</small><strong>{getGoalLabel(selectedUser.nutritionGoal?.goal || selectedUser.healthGoal)}</strong></div><p>{getGoalDescription(selectedUser.nutritionGoal?.goal || selectedUser.healthGoal)}</p></div>
                  </section>

                </div>
              </div>
            ) : (
              <div className="unlock-modal-content">
                <header className="unlock-modal-header">
                  <span className="unlock-heading-icon"><i className="bi bi-unlock-fill" /></span>
                  <div><h2 id="user-modal-title">Mở khóa tài khoản</h2><p>Xác nhận yêu cầu mở khóa tài khoản của người dùng. Tài khoản sẽ được mở khóa ngay sau khi xác nhận.</p></div>
                  <button aria-label="Đóng" onClick={() => setSelectedUser(null)}><i className="bi bi-x-lg" /></button>
                </header>

                <div className="unlock-user-banner">
                  <span className="user-avatar large">{selectedUser.avatarUrl ? <img src={getAvatarUrl(selectedUser.avatarUrl)} alt="" /> : selectedUser.fullName?.charAt(0)?.toUpperCase()}</span>
                  <div className="unlock-user-identity"><strong>{selectedUser.fullName || '—'}</strong><span className="unlock-user-id">#USR-{selectedUser._id?.slice(-4).toUpperCase()}</span><span className="unlock-user-email"><i className="bi bi-envelope" />{selectedUser.email}</span></div>
                  <div className="unlock-user-fact"><i className="bi bi-calendar-date" /><span><small>Ngày sinh</small><strong>{selectedUser.dateOfBirth ? new Intl.DateTimeFormat('vi-VN').format(new Date(selectedUser.dateOfBirth)) : '—'}</strong></span></div>
                  <div className="unlock-user-fact"><i className="bi bi-person" /><span><small>Giới tính</small><strong>{selectedUser.gender === 'female' ? 'Nữ' : selectedUser.gender === 'male' ? 'Nam' : '—'}</strong></span></div>
                  <div className="unlock-current-status"><small>Trạng thái hiện tại</small><strong><i className="bi bi-lock-fill" />Đã khóa</strong></div>
                </div>

                <div className="unlock-form-panel">
                  <label className="unlock-field-label" htmlFor="unlock-reason"><b>*</b>Lý do yêu cầu mở khóa</label>
                  <div className="unlock-reason-wrap"><textarea id="unlock-reason" maxLength={500} value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder="Vui lòng nhập lý do người dùng yêu cầu mở khóa tài khoản..." rows="4" /><span>{unlockReason.length}/500</span></div>

                  <div className="unlock-evidence-heading"><label className="unlock-field-label"><b>*</b>Minh chứng</label><p>Vui lòng cung cấp ảnh chụp màn hình, hình ảnh hoặc tài liệu chứng minh (ví dụ: ảnh CMND/CCCD, email xác nhận, ...).</p></div>
                  <label className={`unlock-dropzone ${draggingEvidence ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDraggingEvidence(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingEvidence(false) }} onDrop={(event) => { event.preventDefault(); setDraggingEvidence(false); addUnlockEvidence(event.dataTransfer.files) }}>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" multiple onChange={(event) => { addUnlockEvidence(event.target.files); event.target.value = '' }} />
                    <i className="bi bi-cloud-arrow-up-fill" />
                    <strong>Kéo thả tệp vào đây hoặc nhấn để chọn</strong>
                    <span>Hỗ trợ: JPG, PNG, PDF (tối đa 5 MB/tệp, tối đa 5 tệp)</span>
                  </label>
                  {unlockEvidence.length > 0 && <ul className="unlock-file-list">{unlockEvidence.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}><i className={`bi ${file.type === 'application/pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image'}`} /><span>{file.name}<small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></span><button type="button" aria-label={`Gỡ ${file.name}`} onClick={() => { setUnlockEvidence((current) => current.filter((_, fileIndex) => fileIndex !== index)); setActionError('') }}><i className="bi bi-x-lg" /></button></li>)}</ul>}

                  <div className="unlock-notice"><i className="bi bi-info-circle" /><div><strong>Lưu ý:</strong><span>• Lý do yêu cầu mở khóa là bắt buộc.</span><span>• Vui lòng cung cấp thông tin chính xác và đầy đủ để xác minh.</span><span>• Sau khi xác nhận, tài khoản sẽ được mở khóa ngay lập tức (nếu hợp lệ).</span></div></div>
                  {actionError && <p className="user-action-error" role="alert">{actionError}</p>}
                </div>

                <div className="user-modal-actions unlock-modal-actions"><button onClick={() => { setSelectedUser(null); setActionError('') }}>Hủy</button><button className="unlock-confirm-button" disabled={saving} onClick={saveStatus}><i className="bi bi-unlock" />{saving ? 'Đang xử lý...' : 'Xác nhận mở khóa'}</button></div>
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

      {showActionLogs && (
        <div className="user-modal-backdrop action-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowActionLogs(false) }}>
          <section className="user-modal action-log-modal" role="dialog" aria-modal="true" aria-labelledby="action-log-title">
            <header className="action-log-heading">
              <div><span className="action-log-heading-icon"><i className="bi bi-clock-history" /></span><div><h2 id="action-log-title">Lịch sử thao tác của Admin</h2><p>Xem chi tiết các thao tác quản lý tài khoản, bao gồm khóa, mở khóa, cập nhật thông tin và các hành động khác.</p></div></div>
              <button aria-label="Đóng" onClick={() => setShowActionLogs(false)}><i className="bi bi-x-lg" /></button>
            </header>

            <div className="action-log-filters">
              <label className="action-log-date"><i className="bi bi-calendar3" /><input type="date" value={logFrom} max={logTo} onChange={(event) => { setLogFrom(event.target.value); setLogPage(1) }} /><span>→</span><input type="date" value={logTo} min={logFrom} onChange={(event) => { setLogTo(event.target.value); setLogPage(1) }} /><i className="bi bi-chevron-down action-log-date-chevron" /></label>
              <label className="action-log-select"><i className="bi bi-person-gear" /><select value={logAction} onChange={(event) => { setLogAction(event.target.value); setLogPage(1) }} aria-label="Lọc hành động"><option value="all">Tất cả hành động</option>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="action-log-select"><i className="bi bi-shield-check" /><select value={logAdmin} onChange={(event) => { setLogAdmin(event.target.value); setLogPage(1) }} aria-label="Lọc người thực hiện"><option value="all">Tất cả người thực hiện</option>{logAdmins.map((logAdminUser) => <option key={logAdminUser._id} value={logAdminUser._id}>{logAdminUser.fullName}</option>)}</select></label>
              <label className="action-log-search"><i className="bi bi-search" /><input value={logSearch} onChange={(event) => { setLogSearch(event.target.value); setLogPage(1) }} placeholder="Tìm kiếm theo tên người dùng, email..." aria-label="Tìm kiếm trong lịch sử thao tác" /></label>
            </div>

            <div className="action-log-table-wrap">
              <table className="action-log-table">
                <thead><tr><th>Thời gian</th><th>Hành động</th><th>Loại tài khoản</th><th>Người thực hiện</th><th>Lý do / Nội dung</th><th>Ghi chú / Minh chứng</th></tr></thead>
                <tbody>
                  {logsLoading ? <tr><td colSpan="6" className="action-log-empty"><span className="user-spinner" />Đang tải lịch sử...</td></tr> : logsError ? <tr><td colSpan="6" className="action-log-empty error">{logsError}</td></tr> : actionLogs.length === 0 ? <tr><td colSpan="6" className="action-log-empty">Không có thao tác nào trong khoảng thời gian này.</td></tr> : actionLogs.map((log) => {
                    const type = log.actionType === 'lock_user' ? 'lock' : log.actionType === 'unlock_user' ? 'unlock' : 'update'
                    const timestamp = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.createdAt))
                    return <tr key={log._id}>
                      <td>{timestamp}</td>
                      <td><span className={`action-log-action ${type}`}><i className={`bi ${type === 'lock' ? 'bi-lock-fill' : type === 'unlock' ? 'bi-unlock-fill' : 'bi-pencil-fill'}`} />{actionLabels[log.actionType] || log.actionType}</span></td>
                      <td><span className="action-log-target">{log.targetType === 'User' ? 'Tài khoản thường' : log.targetType}</span></td>
                      <td><div className="action-log-admin"><span className="action-log-avatar">{log.admin?.avatarUrl ? <img src={getAvatarUrl(log.admin.avatarUrl)} alt="" /> : log.admin?.fullName?.charAt(0)?.toUpperCase() || 'A'}</span><span>{log.admin?.fullName || 'Admin'}</span></div></td>
                      <td>{log.reason || '—'}{log.target?.fullName && <small className="action-log-target-user">Tài khoản: {log.target.fullName} · {log.target.email}</small>}</td>
                      <td><span className="action-log-note">{log.note || (log.actionType === 'unlock_user' ? 'Đã xác minh yêu cầu mở khóa' : '—')}</span>{log.evidence?.map((file) => <a className="action-log-evidence" key={file.url} href={getAvatarUrl(file.url)} target="_blank" rel="noreferrer"><i className="bi bi-paperclip" />{file.originalName}</a>)}</td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>

            <footer className="action-log-footer"><span>Tổng cộng: {logPagination.total.toLocaleString('vi-VN')} bản ghi</span><div><button aria-label="Trang trước" disabled={logPage <= 1 || logsLoading} onClick={() => setLogPage((current) => current - 1)}><i className="bi bi-chevron-left" /></button><span>{logPagination.totalPages ? `${logPage} / ${logPagination.totalPages}` : '0 / 0'}</span><button aria-label="Trang sau" disabled={logPage >= logPagination.totalPages || logsLoading} onClick={() => setLogPage((current) => current + 1)}><i className="bi bi-chevron-right" /></button></div></footer>
          </section>
        </div>
      )}
    </section>
  )
}
