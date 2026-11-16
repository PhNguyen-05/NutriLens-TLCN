import { useCallback, useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import FoodRequestReviewModal from '../../components/admin/food-request/FoodRequestReviewModal'
import FoodRequestRejectModal from '../../components/admin/food-request/FoodRequestRejectModal'
import FoodRequestDetailModal from '../../components/admin/food-request/FoodRequestDetailModal'
import {
  PAGE_SIZE,
  getImageUrl,
  formatDateDisplay,
  Toast,
} from '../../components/admin/food-request/foodRequestConstants'

export default function FoodRequestManagementPage() {
  const [requests, setRequests] = useState([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  // Modals state
  const [reviewRequestId, setReviewRequestId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  // Load food requests
  const loadRequests = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const { data } = await axiosInstance.get('/admin/food-requests', {
        params: {
          search: search.trim(),
          status: statusFilter,
          sort: sortBy,
          page,
          limit: PAGE_SIZE,
        },
      })
      setRequests(data.data || [])
      setSummary(data.summary || { total: 0, pending: 0, approved: 0, rejected: 0 })
      setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
    } catch (err) {
      setListError(err.response?.data?.message || 'Không thể tải danh sách yêu cầu bổ sung món')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, sortBy, page])

  useEffect(() => {
    const timer = setTimeout(loadRequests, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [loadRequests, search])

  // Handlers for modal callbacks
  const handleApprovedSuccess = (msg) => {
    setReviewRequestId(null)
    showToast(msg, 'success')
    loadRequests()
  }

  const handleRejectedSuccess = (msg) => {
    setRejectTarget(null)
    setReviewRequestId(null)
    showToast(msg, 'success')
    loadRequests()
  }

  // Range info for pagination
  const startIdx = (pagination.page - 1) * pagination.limit + 1
  const endIdx = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <div className="frm-shell">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPI Cards Row */}
      <section className="fdm-kpi-row" aria-label="Thống kê yêu cầu bổ sung món">
        <article className="fdm-kpi">
          <div className="fdm-kpi-icon frm-kpi-icon--all">
            <i className="bi bi-folder2-open" />
          </div>
          <div>
            <p>Tổng yêu cầu</p>
            <strong>{summary.total.toLocaleString('vi-VN')}</strong>
          </div>
        </article>

        <article className="fdm-kpi">
          <div className="fdm-kpi-icon frm-kpi-icon--pending">
            <i className="bi bi-clock-history" />
          </div>
          <div>
            <p>Chờ phê duyệt</p>
            <strong style={{ color: '#d97706' }}>{summary.pending.toLocaleString('vi-VN')}</strong>
          </div>
        </article>

        <article className="fdm-kpi">
          <div className="fdm-kpi-icon frm-kpi-icon--approved">
            <i className="bi bi-check-circle" />
          </div>
          <div>
            <p>Đã duyệt</p>
            <strong style={{ color: '#059669' }}>{summary.approved.toLocaleString('vi-VN')}</strong>
          </div>
        </article>

        <article className="fdm-kpi">
          <div className="fdm-kpi-icon frm-kpi-icon--rejected">
            <i className="bi bi-x-circle" />
          </div>
          <div>
            <p>Đã từ chối</p>
            <strong style={{ color: '#dc2626' }}>{summary.rejected.toLocaleString('vi-VN')}</strong>
          </div>
        </article>
      </section>

      {/* Filters Bar */}
      <section className="fdm-filters" aria-label="Bộ lọc yêu cầu">
        <div className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Tìm theo món, mã REQ, người gửi..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          {search && (
            <button
              className="fdm-search-clear"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
            >
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        <label className="fdm-filter-select">
          <i className="bi bi-funnel" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái ({summary.total})</option>
            <option value="pending">Chờ duyệt ({summary.pending})</option>
            <option value="approved">Đã duyệt ({summary.approved})</option>
            <option value="rejected">Đã từ chối ({summary.rejected})</option>
          </select>
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-sort-down" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
          >
            <option value="newest">Mới nhất gửi trước</option>
            <option value="oldest">Cũ nhất gửi trước</option>
            <option value="name_asc">Tên món A → Z</option>
            <option value="name_desc">Tên món Z → A</option>
          </select>
        </label>

        <button
          type="button"
          className="frm-btn frm-btn--detail"
          onClick={loadRequests}
          title="Tải lại danh sách"
          style={{ height: 38 }}
        >
          <i className="bi bi-arrow-clockwise" /> Làm mới
        </button>

        <span className="fdm-result-count">
          Tổng cộng: <b>{pagination.total}</b> yêu cầu
        </span>
      </section>

      {/* Table Panel */}
      <section className="fdm-panel" aria-label="Danh sách yêu cầu bổ sung món">
        <div className="fdm-table-scroll">
          <table className="fdm-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Mã YC</th>
                <th style={{ minWidth: 220 }}>Món đề xuất</th>
                <th style={{ minWidth: 200 }}>Người gửi</th>
                <th style={{ width: 140 }}>Thời gian gửi</th>
                <th className="fdm-th-center" style={{ width: 150 }}>
                  Dinh dưỡng đề xuất
                </th>
                <th className="fdm-th-center" style={{ width: 130 }}>
                  Trạng thái
                </th>
                <th className="fdm-th-center" style={{ width: 170 }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="fdm-td-msg">
                    <span className="food-spinner" style={{ marginRight: 8 }} />
                    Đang tải danh sách yêu cầu...
                  </td>
                </tr>
              ) : listError ? (
                <tr>
                  <td colSpan="7" className="fdm-td-msg" style={{ color: '#dc2626' }}>
                    <i className="bi bi-exclamation-triangle" style={{ marginRight: 6 }} />
                    {listError}
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="fdm-td-msg">
                    <div className="fdm-td-empty">
                      <i className="bi bi-inbox" style={{ fontSize: 24, color: '#9cb3c4' }} />
                      <span>Không có yêu cầu bổ sung món nào phù hợp với bộ lọc.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((item) => {
                  return (
                    <tr key={item._id}>
                      {/* Mã yêu cầu */}
                      <td>
                        <span className="frm-code-tag">{item.requestCode || 'REQ'}</span>
                      </td>

                      {/* Món đề xuất */}
                      <td>
                        <div className="fdm-food-cell">
                          {item.imageUrl ? (
                            <img
                              className="fdm-food-thumb"
                              src={getImageUrl(item.imageUrl)}
                              alt={item.foodName}
                              style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: '#eef4fa',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#91a7ba',
                                flexShrink: 0,
                              }}
                            >
                              <i className="bi bi-cup-hot" style={{ fontSize: 18 }} />
                            </div>
                          )}
                          <div className="fdm-food-info">
                            <strong>{item.foodName}</strong>
                            <small>
                              {item.requestType === 'reopen'
                                ? 'Đề nghị mở lại món'
                                : item.foodGroup || 'Chưa phân loại'}
                            </small>
                          </div>
                        </div>
                      </td>

                      {/* Người gửi */}
                      <td>
                        <div className="frm-user-cell">
                          <div className="frm-user-avatar">
                            {item.userId?.avatarUrl ? (
                              <img src={getImageUrl(item.userId.avatarUrl)} alt="" />
                            ) : (
                              item.userId?.fullName?.charAt(0)?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="frm-user-meta">
                            <strong>{item.userId?.fullName || 'Người dùng'}</strong>
                            <small>{item.userId?.email || '—'}</small>
                          </div>
                        </div>
                      </td>

                      {/* Thời gian gửi */}
                      <td style={{ fontSize: 12, color: '#557288' }}>
                        {formatDateDisplay(item.createdAt)}
                      </td>

                      {/* Dinh dưỡng sơ bộ */}
                      <td className="fdm-td-center">
                        {item.requestType === 'reopen' ? (
                          <span style={{ fontSize: 11.5, color: '#b66b18', fontWeight: 700 }}>
                            Đề nghị mở lại món đang ẩn
                          </span>
                        ) : item.calories !== null && item.calories !== undefined ? (
                          <div style={{ fontSize: 12 }}>
                            <strong style={{ color: '#00875f' }}>{item.calories} kcal</strong>
                            <div style={{ fontSize: 11, color: '#7a92a8' }}>
                              {item.servingLabel || `${item.servingSize || 100}g`}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>
                            Chưa có calo
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="fdm-td-center">
                        {item.status === 'pending' && (
                          <span className="frm-badge frm-badge--pending">
                            <i className="bi bi-circle-fill" /> Chờ duyệt
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="frm-badge frm-badge--approved">
                            <i className="bi bi-check-circle-fill" /> Đã duyệt
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="frm-badge frm-badge--rejected">
                            <i className="bi bi-x-circle-fill" /> Từ chối
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="fdm-td-center">
                        <div className="frm-action-group" style={{ justifyContent: 'center' }}>
                          {item.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className="frm-btn frm-btn--review"
                                onClick={() => setReviewRequestId(item._id)}
                                title="Xem xét và duyệt"
                              >
                                <i className="bi bi-clipboard-check" /> Duyệt
                              </button>
                              <button
                                type="button"
                                className="frm-btn frm-btn--reject"
                                onClick={() => setRejectTarget(item)}
                                title="Từ chối yêu cầu"
                              >
                                <i className="bi bi-x-circle" /> Từ chối
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="frm-btn frm-btn--detail"
                              onClick={() => setDetailTarget(item)}
                              title="Xem chi tiết"
                            >
                              <i className="bi bi-eye" /> Chi tiết
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang (10 món/trang) */}
        {!loading && !listError && pagination.totalPages > 0 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">
              Hiển thị {startIdx}–{endIdx} / {pagination.total.toLocaleString('vi-VN')} yêu cầu
            </span>
            <div className="fdm-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu">
                <i className="bi bi-chevron-double-left" />
              </button>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Trang trước">
                <i className="bi bi-chevron-left" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const first = Math.max(1, Math.min(page - 3, pagination.totalPages - 6))
                const pNum = first + i
                return (
                  <button
                    key={pNum}
                    className={pNum === page ? 'active' : ''}
                    onClick={() => setPage(pNum)}
                  >
                    {pNum}
                  </button>
                )
              })}
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                title="Trang sau"
              >
                <i className="bi bi-chevron-right" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(pagination.totalPages)}
                title="Trang cuối"
              >
                <i className="bi bi-chevron-double-right" />
              </button>
            </div>
          </footer>
        )}
      </section>

      {/* Review & Approve Modal */}
      {reviewRequestId && (
        <FoodRequestReviewModal
          requestId={reviewRequestId}
          onClose={() => setReviewRequestId(null)}
          onApproved={handleApprovedSuccess}
          onOpenReject={(target) => {
            setReviewRequestId(null)
            setRejectTarget(target)
          }}
        />
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <FoodRequestRejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={handleRejectedSuccess}
        />
      )}

      {/* View Detail Modal */}
      {detailTarget && (
        <FoodRequestDetailModal
          request={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  )
}
