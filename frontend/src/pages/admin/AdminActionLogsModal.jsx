import { useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

const actionLabels = {
  lock_user: 'Khóa tài khoản',
  unlock_user: 'Mở khóa tài khoản',
  approve_post: 'Duyệt bài viết',
  delete_food: 'Xóa món ăn',
  hide_post: 'Ẩn bài viết',
  remove_post: 'Gỡ bài viết',
  reject_request: 'Từ chối yêu cầu',
}

function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return ''
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl
  return `${axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '')}${avatarUrl}`
}

export default function AdminActionLogsModal({ isOpen, onClose, embedded = false }) {
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
    if (!isOpen) return undefined
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLogsLoading(true)
      setLogsError('')
      try {
        const { data } = await axiosInstance.get('/admin/users/action-logs', {
          params: { from: logFrom, to: logTo, action: logAction, adminId: logAdmin, search: logSearch, page: logPage, limit: 10 },
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
  }, [isOpen, logFrom, logTo, logAction, logAdmin, logSearch, logPage])

  if (!isOpen) return null

  if (embedded) {
    return (
      <div className="admin-action-log-page">
        <section className="admin-action-log-panel" aria-label="Lịch sử thao tác của Admin">
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
    )
  }

  return (
    <div className="user-modal-backdrop action-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="user-modal action-log-modal" role="dialog" aria-modal="true" aria-labelledby="action-log-title">
        <header className="action-log-heading">
          <div><span className="action-log-heading-icon"><i className="bi bi-clock-history" /></span><div><h2 id="action-log-title">Lịch sử thao tác của Admin</h2><p>Xem chi tiết các thao tác quản lý tài khoản, bao gồm khóa, mở khóa, cập nhật thông tin và các hành động khác.</p></div></div>
          <button aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
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
  )
}