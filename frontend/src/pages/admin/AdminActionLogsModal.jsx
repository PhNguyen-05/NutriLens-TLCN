import { useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

const TABS = [
  { id: 'all', label: 'Tất cả phân hệ', icon: 'bi-grid-1x2-fill' },
  { id: 'FoodItem', label: 'Danh mục món ăn', icon: 'bi-egg-fried' },
  { id: 'Request', label: 'Yêu cầu bổ sung món', icon: 'bi-patch-plus-fill' },
  { id: 'Exercise', label: 'Bài tập thể chất', icon: 'bi-person-walking' },
  { id: 'Post', label: 'Blog y khoa', icon: 'bi-journal-text' },
  { id: 'User', label: 'Tài khoản người dùng', icon: 'bi-people-fill' },
]

const MODULE_ACTIONS = {
  FoodItem: [
    { value: 'create_food', label: 'Thêm món ăn' },
    { value: 'update_food', label: 'Cập nhật món ăn' },
    { value: 'hide_food', label: 'Ẩn món ăn' },
    { value: 'show_food', label: 'Hiển thị món ăn' },
    { value: 'delete_food', label: 'Xóa món ăn' },
  ],
  Request: [
    { value: 'approve_request', label: 'Duyệt yêu cầu món' },
    { value: 'reject_request', label: 'Từ chối yêu cầu' },
  ],
  Exercise: [
    { value: 'create_exercise', label: 'Thêm bài tập' },
    { value: 'update_exercise', label: 'Cập nhật bài tập' },
    { value: 'hide_exercise', label: 'Ẩn bài tập' },
    { value: 'show_exercise', label: 'Hiển thị bài tập' },
    { value: 'delete_exercise', label: 'Xóa bài tập' },
  ],
  Post: [
    { value: 'create_post', label: 'Tạo bài viết' },
    { value: 'update_post', label: 'Cập nhật bài viết' },
    { value: 'publish_post', label: 'Xuất bản bài viết' },
    { value: 'hide_post', label: 'Ẩn bài viết' },
    { value: 'draft_post', label: 'Chuyển về nháp' },
    { value: 'delete_post', label: 'Xóa bài viết' },
  ],
  User: [
    { value: 'lock_user', label: 'Khóa tài khoản' },
    { value: 'unlock_user', label: 'Mở khóa tài khoản' },
  ],
}

const actionLabels = {
  lock_user: 'Khóa tài khoản',
  unlock_user: 'Mở khóa tài khoản',
  approve_post: 'Duyệt bài viết',
  create_food: 'Thêm món ăn',
  update_food: 'Cập nhật món ăn',
  hide_food: 'Ẩn món ăn',
  show_food: 'Hiển thị món ăn',
  delete_food: 'Xóa món ăn',
  create_exercise: 'Thêm bài tập',
  update_exercise: 'Cập nhật bài tập',
  hide_exercise: 'Ẩn bài tập',
  show_exercise: 'Hiển thị bài tập',
  delete_exercise: 'Xóa bài tập',
  create_post: 'Tạo bài viết',
  update_post: 'Cập nhật bài viết',
  publish_post: 'Xuất bản bài viết',
  hide_post: 'Ẩn bài viết',
  draft_post: 'Chuyển về nháp',
  delete_post: 'Xóa bài viết',
  remove_post: 'Gỡ bài viết',
  reject_request: 'Từ chối yêu cầu',
  approve_request: 'Duyệt yêu cầu món',
}

function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return ''
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl
  return `${axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '')}${avatarUrl}`
}

function formatDateDisplay(dateValue) {
  const [year, month, day] = dateValue.split('-')
  return year && month && day ? `${day}/${month}/${year}` : ''
}

function getActionTypeAndIcon(actionType) {
  switch (actionType) {
    case 'lock_user':
    case 'delete_food':
    case 'delete_exercise':
    case 'delete_post':
    case 'remove_post':
      return {
        type: 'lock',
        icon: ['delete_food', 'delete_exercise', 'delete_post', 'remove_post'].includes(actionType)
          ? 'bi-trash-fill'
          : 'bi-lock-fill',
      }
    case 'unlock_user':
    case 'create_food':
    case 'create_exercise':
    case 'create_post':
    case 'show_food':
    case 'show_exercise':
    case 'publish_post':
    case 'approve_post':
    case 'approve_request':
      return {
        type: 'unlock',
        icon: actionType === 'approve_request'
          ? 'bi-check-circle-fill'
          : ['create_food', 'create_exercise', 'create_post'].includes(actionType)
          ? 'bi-plus-circle-fill'
          : ['show_food', 'show_exercise', 'publish_post', 'approve_post'].includes(actionType)
          ? 'bi-eye-fill'
          : 'bi-unlock-fill',
      }
    case 'reject_request':
      return { type: 'lock', icon: 'bi-x-circle-fill' }
    case 'hide_food':
    case 'hide_exercise':
    case 'hide_post':
      return { type: 'lock', icon: 'bi-eye-slash-fill' }
    case 'draft_post':
      return { type: 'update', icon: 'bi-file-earmark-text' }
    case 'update_food':
    case 'update_exercise':
    case 'update_post':
      return { type: 'update', icon: 'bi-pencil-square' }
    default:
      return { type: 'update', icon: 'bi-gear-fill' }
  }
}

export default function AdminActionLogsModal({ isOpen, onClose, embedded = false }) {
  const [targetTab, setTargetTab] = useState('all')
  const [tabCounts, setTabCounts] = useState({ all: 0, FoodItem: 0, Request: 0, Exercise: 0, Post: 0, User: 0 })
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
          params: {
            from: logFrom,
            to: logTo,
            targetType: targetTab,
            action: logAction,
            adminId: logAdmin,
            search: logSearch,
            page: logPage,
            limit: 10,
          },
          signal: controller.signal,
        })
        setActionLogs(data.data || [])
        setLogAdmins(data.admins || [])
        setLogPagination(data.pagination || { page: logPage, total: 0, totalPages: 0 })
        if (data.counts) {
          setTabCounts(data.counts)
        }
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
  }, [isOpen, logFrom, logTo, targetTab, logAction, logAdmin, logSearch, logPage])

  if (!isOpen) return null

  const handleTabChange = (tabId) => {
    if (tabId === targetTab) return
    setTargetTab(tabId)
    setLogAction('all')
    setLogPage(1)
  }

  const searchPlaceholder = targetTab === 'FoodItem'
    ? 'Tìm theo tên món ăn, mã món FOD, lý do...'
    : targetTab === 'Request'
    ? 'Tìm theo tên món, mã yêu cầu REQ, người gửi...'
    : targetTab === 'Exercise'
    ? 'Tìm theo tên bài tập, cường độ, MET, lý do...'
    : targetTab === 'Post'
    ? 'Tìm theo tiêu đề bài viết, chuyên mục, lý do...'
    : targetTab === 'User'
    ? 'Tìm theo họ tên, email, lý do...'
    : 'Tìm kiếm theo tên người dùng, món ăn, bài tập, bài viết, lý do...'

  const renderActionOptions = () => {
    if (targetTab !== 'all' && MODULE_ACTIONS[targetTab]) {
      const currentTab = TABS.find((t) => t.id === targetTab)
      return (
        <>
          <option value="all">Tất cả hành động ({currentTab?.label || ''})</option>
          {MODULE_ACTIONS[targetTab].map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </>
      )
    }

    return (
      <>
        <option value="all">Tất cả hành động</option>
        <optgroup label="Danh mục món ăn">
          {MODULE_ACTIONS.FoodItem.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
        <optgroup label="Yêu cầu bổ sung món">
          {MODULE_ACTIONS.Request.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
        <optgroup label="Bài tập thể chất">
          {MODULE_ACTIONS.Exercise.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
        <optgroup label="Blog y khoa">
          {MODULE_ACTIONS.Post.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
        <optgroup label="Tài khoản người dùng">
          {MODULE_ACTIONS.User.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
      </>
    )
  }

  const renderTableRows = () => {
    if (logsLoading) return <tr><td colSpan="6" className="action-log-empty"><span className="user-spinner" />Đang tải lịch sử...</td></tr>
    if (logsError) return <tr><td colSpan="6" className="action-log-empty error">{logsError}</td></tr>
    if (actionLogs.length === 0) return <tr><td colSpan="6" className="action-log-empty">Không có thao tác nào trong khoảng thời gian này.</td></tr>

    return actionLogs.map((log) => {
      const { type, icon } = getActionTypeAndIcon(log.actionType)
      const timestamp = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.createdAt))
      return (
        <tr key={log._id}>
          <td>{timestamp}</td>
          <td><span className={`action-log-action ${type}`}><i className={`bi ${icon}`} />{actionLabels[log.actionType] || log.actionType}</span></td>
          <td>
            <span className="action-log-target">
              {log.targetType === 'User'
                ? 'Tài khoản thường'
                : log.targetType === 'FoodItem'
                ? 'Danh mục món ăn'
                : log.targetType === 'Exercise'
                ? 'Danh mục bài tập'
                : log.targetType === 'Request'
                ? 'Yêu cầu bổ sung món'
                : log.targetType === 'Post'
                ? 'Blog y khoa'
                : log.targetType}
            </span>
          </td>
          <td><div className="action-log-admin"><span className="action-log-avatar">{log.admin?.avatarUrl ? <img src={getAvatarUrl(log.admin.avatarUrl)} alt="" /> : log.admin?.fullName?.charAt(0)?.toUpperCase() || 'A'}</span><span>{log.admin?.fullName || 'Admin'}</span></div></td>
          <td>
            {log.reason || '—'}
            {log.target?.fullName && <small className="action-log-target-user">Tài khoản: {log.target.fullName} · {log.target.email}</small>}
            {log.targetFood && <small className="action-log-target-user">Món ăn: {log.targetFood.name} {log.targetFood.foodCode ? `(${log.targetFood.foodCode})` : ''}</small>}
            {log.targetRequest && <small className="action-log-target-user">Yêu cầu: {log.targetRequest.foodName} {log.targetRequest.requestCode ? `(${log.targetRequest.requestCode})` : ''}{log.targetRequest.userId?.fullName ? ` · Người gửi: ${log.targetRequest.userId.fullName}` : ''}</small>}
            {log.targetExercise && <small className="action-log-target-user">Bài tập: {log.targetExercise.name} {log.targetExercise.categoryName ? `(${log.targetExercise.categoryName})` : ''} · {log.targetExercise.met} MET {log.targetExercise.intensity ? `· Cường độ: ${log.targetExercise.intensity}` : ''}</small>}
            {log.targetPost && <small className="action-log-target-user">Bài viết: {log.targetPost.title} {log.targetPost.category ? `(${log.targetPost.category})` : ''} · Trạng thái: {log.targetPost.status || '—'}</small>}
          </td>
          <td><span className="action-log-note">{log.note || (log.actionType === 'unlock_user' ? 'Đã xác minh yêu cầu mở khóa' : '—')}</span>{log.evidence?.map((file) => <a className="action-log-evidence" key={file.url} href={getAvatarUrl(file.url)} target="_blank" rel="noreferrer"><i className="bi bi-paperclip" />{file.originalName}</a>)}</td>
        </tr>
      )
    })
  }

  const tabsMarkup = (
    <div className="action-log-tabs" role="tablist" aria-label="Lọc nhanh phân hệ">
      {TABS.map((tab) => {
        const count = tabCounts[tab.id] ?? 0
        const isActive = targetTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`action-log-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <i className={`bi ${tab.icon}`} />
            <span>{tab.label}</span>
            <span className="action-log-tab-badge">
              {count.toLocaleString('vi-VN')}
            </span>
          </button>
        )
      })}
    </div>
  )

  const filtersMarkup = (
    <div className="action-log-filters">
      <label className="action-log-date"><i className="bi bi-calendar3" /><span className="action-log-date-field"><span>{formatDateDisplay(logFrom)}</span><input type="date" value={logFrom} max={logTo} aria-label="Ngày bắt đầu" onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => { setLogFrom(event.target.value); setLogPage(1) }} /></span><span>→</span><span className="action-log-date-field"><span>{formatDateDisplay(logTo)}</span><input type="date" value={logTo} min={logFrom} aria-label="Ngày kết thúc" onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => { setLogTo(event.target.value); setLogPage(1) }} /></span><i className="bi bi-chevron-down action-log-date-chevron" /></label>
      <label className="action-log-select"><i className="bi bi-person-gear" /><select value={logAction} onChange={(event) => { setLogAction(event.target.value); setLogPage(1) }} aria-label="Lọc hành động">{renderActionOptions()}</select></label>
      <label className="action-log-select"><i className="bi bi-shield-check" /><select value={logAdmin} onChange={(event) => { setLogAdmin(event.target.value); setLogPage(1) }} aria-label="Lọc người thực hiện"><option value="all">Tất cả người thực hiện</option>{logAdmins.map((logAdminUser) => <option key={logAdminUser._id} value={logAdminUser._id}>{logAdminUser.fullName}</option>)}</select></label>
      <label className="action-log-search"><i className="bi bi-search" /><input value={logSearch} onChange={(event) => { setLogSearch(event.target.value); setLogPage(1) }} placeholder={searchPlaceholder} aria-label="Tìm kiếm trong lịch sử thao tác" /></label>
    </div>
  )

  const paginationMarkup = (
    <footer className="action-log-footer"><span>Tổng cộng: {logPagination.total.toLocaleString('vi-VN')} bản ghi</span><div><button aria-label="Trang trước" disabled={logPage <= 1 || logsLoading} onClick={() => setLogPage((current) => current - 1)}><i className="bi bi-chevron-left" /></button><span>{logPagination.totalPages ? `${logPage} / ${logPagination.totalPages}` : '0 / 0'}</span><button aria-label="Trang sau" disabled={logPage >= logPagination.totalPages || logsLoading} onClick={() => setLogPage((current) => current + 1)}><i className="bi bi-chevron-right" /></button></div></footer>
  )

  if (embedded) {
    return (
      <div className="admin-action-log-page">
        <section className="admin-action-log-panel" aria-label="Lịch sử thao tác của Admin">
          {tabsMarkup}
          {filtersMarkup}
          <div className="action-log-table-wrap">
            <table className="action-log-table">
              <thead><tr><th>Thời gian</th><th>Hành động</th><th>Loại đối tượng</th><th>Người thực hiện</th><th>Lý do / Nội dung</th><th>Ghi chú / Minh chứng</th></tr></thead>
              <tbody>{renderTableRows()}</tbody>
            </table>
          </div>
          {paginationMarkup}
        </section>
      </div>
    )
  }

  return (
    <div className="user-modal-backdrop action-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="user-modal action-log-modal" role="dialog" aria-modal="true" aria-labelledby="action-log-title">
        <header className="action-log-heading">
          <div><span className="action-log-heading-icon"><i className="bi bi-clock-history" /></span><div><h2 id="action-log-title">Lịch sử thao tác của Admin</h2><p>Xem chi tiết các thao tác quản lý tài khoản, danh mục món ăn, danh mục bài tập, blog y khoa và nội dung hệ thống.</p></div></div>
          <button aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>

        {tabsMarkup}
        {filtersMarkup}

        <div className="action-log-table-wrap">
          <table className="action-log-table">
            <thead><tr><th>Thời gian</th><th>Hành động</th><th>Loại đối tượng</th><th>Người thực hiện</th><th>Lý do / Nội dung</th><th>Ghi chú / Minh chứng</th></tr></thead>
            <tbody>{renderTableRows()}</tbody>
          </table>
        </div>

        {paginationMarkup}
      </section>
    </div>
  )
}
