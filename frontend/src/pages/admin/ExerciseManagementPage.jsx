import { useEffect, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import {
  ExerciseDetailModal,
  ExerciseFormModal,
} from '../../components/exercise'
import {
  ADMIN_CATEGORIES,
  DEFAULT_CATEGORY_ICONS,
} from '../../constants/exerciseConstants'

const PAGE_SIZE = 10

function getCategoryMeta(catId) {
  return ADMIN_CATEGORIES.find((c) => c.id === catId) || {
    id: catId || 'other',
    label: 'Khác',
    icon: 'bi-activity',
  }
}

function getIntensityCls(intensity) {
  if (intensity === 'Cao') return 'exm-chip--high'
  if (intensity === 'Nhẹ') return 'exm-chip--low'
  return 'exm-chip--mid'
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  icon,
  iconClass,
  body,
  cancelLabel = 'Hủy',
  confirmLabel,
  confirmClass,
  onCancel,
  onConfirm,
  loading,
  extra,
}) {
  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
    >
      <section className="fm-confirm" role="dialog" aria-modal="true">
        <header className="fm-confirm-header">
          <span className={`fm-confirm-icon ${iconClass}`}>
            <i className={icon} />
          </span>
          <h2>{title}</h2>
          <button className="fm-close" onClick={onCancel} disabled={loading}>
            <i className="bi bi-x-lg" />
          </button>
        </header>
        <div className="fm-confirm-body">{body}</div>
        {extra && <div className="fm-confirm-extra">{extra}</div>}
        <footer className="fm-confirm-footer">
          <button className="fm-btn-cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`fm-confirm-action ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="food-spinner-inline" />
                Đang xử lý...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Main Component: ExerciseManagementPage (UC25) ───────────────────────────
export default function ExerciseManagementPage() {
  const [exercises, setExercises] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    hidden: 0,
    totalLogs: 0,
    categoryCounts: {},
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [intensityFilter, setIntensityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  // Modals state
  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit' | null
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [hideTarget, setHideTarget] = useState(null)
  const [hideSaving, setHideSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  function showToast(message, type = 'success') {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500)
  }

  function triggerRefresh() {
    setRefreshKey((k) => k + 1)
  }

  // ── Hide ──
  async function executeHide(exercise) {
    if (!exercise) return
    setHideSaving(true)
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, {
        isActive: false,
      })
      showToast('Ẩn bài tập thành công')
      setHideTarget(null)
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Không thể cập nhật thông tin bài tập, vui lòng thử lại',
        'error'
      )
      setHideTarget(null)
    } finally {
      setHideSaving(false)
    }
  }

  // ── Show ──
  async function executeShow(exercise) {
    if (!exercise) return
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, {
        isActive: true,
      })
      showToast('Hiển thị bài tập thành công')
      triggerRefresh()
    } catch (err) {
      showToast(
        err.response?.data?.message ||
          'Không thể cập nhật thông tin bài tập, vui lòng thử lại',
        'error'
      )
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      await axiosInstance.delete(`/admin/exercises/${deleteTarget._id}`)
      showToast('Xóa bài tập thành công')
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      const { logCount, refCount, canHide } = err.response?.data || {}
      if (
        (err.response?.status === 400 || err.response?.status === 409) &&
        (logCount !== undefined || refCount !== undefined)
      ) {
        setDeleteResult({
          refCount: logCount ?? refCount,
          canHide: canHide !== false,
          message:
            err.response.data.message ||
            'Bài tập này đã có lượt ghi nhận từ người dùng. Hệ thống khuyến cáo bạn nên Ẩn bài tập thay vì xóa để bảo toàn dữ liệu lịch sử.',
        })
      } else {
        showToast(
          err.response?.data?.message || 'Không thể xóa bài tập, vui lòng thử lại',
          'error'
        )
        setDeleteTarget(null)
      }
    } finally {
      setDeleteSaving(false)
    }
  }

  // Fetch exercises list from server
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/exercises', {
          params: {
            search,
            category: categoryFilter,
            intensity: intensityFilter,
            status: statusFilter,
            sort: sortBy,
            page,
            limit: PAGE_SIZE,
          },
          signal: controller.signal,
        })
        setExercises(data.data || [])
        setPagination(
          data.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 1 }
        )
        setSummary(
          data.summary || {
            total: 0,
            active: 0,
            hidden: 0,
            totalLogs: 0,
            categoryCounts: {},
          }
        )
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setListError(
            err.response?.data?.message ||
              'Không thể tải danh sách bài tập, vui lòng thử lại'
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 280 : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [
    search,
    categoryFilter,
    intensityFilter,
    statusFilter,
    sortBy,
    page,
    refreshKey,
  ])

  const si = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const ei = Math.min(page * PAGE_SIZE, pagination.total)

  return (
    <div className="fdm-shell exm-shell">
      {/* Toast */}
      {toast && (
        <div
          className={`fdm-toast ${toast.type === 'error' ? 'fdm-toast--err' : ''}`}
          role="alert"
        >
          <i
            className={`bi ${
              toast.type === 'error'
                ? 'bi-exclamation-circle-fill'
                : 'bi-check-circle-fill'
            }`}
          />
          {toast.message}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="fdm-kpi-row">
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--all">
            <i className="bi bi-collection-play-fill" />
          </span>
          <div>
            <p>Tổng danh mục bài tập</p>
            <strong>{summary.total.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--active">
            <i className="bi bi-check-circle-fill" />
          </span>
          <div>
            <p>Đang hoạt động</p>
            <strong>{summary.active.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--hidden">
            <i className="bi bi-eye-slash-fill" />
          </span>
          <div>
            <p>Không hoạt động (Đã ẩn)</p>
            <strong>{summary.hidden.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span
            className="fdm-kpi-icon"
            style={{ background: '#fdf4ff', color: '#a855f7' }}
          >
            <i className="bi bi-fire" />
          </span>
          <div>
            <p>Lượt ghi nhận tập luyện</p>
            <strong>{summary.totalLogs.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi-actions">
          <button
            type="button"
            className="fdm-add-btn"
            onClick={() => {
              setModalMode('add')
              setEditTarget(null)
            }}
          >
            <i className="bi bi-plus-circle-fill" /> Thêm bài tập mới
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="fdm-filters exm-filters">
        <label className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên bài tập, mô tả..."
          />
          {search && (
            <button
              className="fdm-search-clear"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </label>

        {/* Lọc theo Nhóm */}
        <label className="fdm-filter-select">
          <i className="bi bi-tags-fill" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả thể loại</option>
            {ADMIN_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>

        {/* Lọc theo Cường độ */}
        <label className="fdm-filter-select">
          <i className="bi bi-speedometer2" />
          <select
            value={intensityFilter}
            onChange={(e) => {
              setIntensityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả cường độ</option>
            <option value="Nhẹ">Nhẹ (MET &lt; 3.0)</option>
            <option value="Trung bình">Trung bình (MET 3.0 - 6.0)</option>
            <option value="Cao">Cao (MET &gt; 6.0)</option>
          </select>
        </label>

        {/* Lọc theo Trạng thái */}
        <label className="fdm-filter-select">
          <i className="bi bi-funnel-fill" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="hidden">Không hoạt động (Đã ẩn)</option>
          </select>
        </label>

        {/* Sắp xếp */}
        <label className="fdm-filter-select">
          <i className="bi bi-sort-down" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
          >
            <option value="newest">Mới nhất (Mặc định)</option>
            <option value="a-z">Tên bài tập: A → Z</option>
            <option value="z-a">Tên bài tập: Z → A</option>
            <option value="met_desc">MET: Cao → Thấp</option>
            <option value="met_asc">MET: Thấp → Cao</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>

        <span className="fdm-result-count">
          {!loading && `${pagination.total.toLocaleString('vi-VN')} bài tập`}
        </span>
      </div>

      {/* ── Table Panel ── */}
      <div className="fdm-panel">
        {listError ? (
          <div className="fdm-state-msg fdm-state-msg--err">
            <i className="bi bi-exclamation-octagon-fill" />
            <span>{listError}</span>
            <button
              onClick={() => {
                setListError('')
                triggerRefresh()
              }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="fdm-table-scroll">
            <table className="fdm-table">
              <thead>
                <tr>
                  <th className="fdm-th-center" style={{ width: 48 }}>
                    #
                  </th>
                  <th style={{ width: '27%', minWidth: 200 }}>Bài tập thể chất</th>
                  <th style={{ width: '18%', minWidth: 140 }}>Nhóm thể loại</th>
                  <th className="fdm-th-center" style={{ width: '13%', minWidth: 105 }}>
                    Cường độ
                  </th>
                  <th className="fdm-th-center" style={{ width: '12%', minWidth: 95 }}>
                    Chỉ số MET
                  </th>
                  <th className="fdm-th-center" style={{ width: '16%', minWidth: 130 }}>
                    Trạng thái
                  </th>
                  <th className="fdm-th-center" style={{ width: 135 }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg">
                      <span className="food-spinner" /> Đang tải danh mục bài tập...
                    </td>
                  </tr>
                ) : exercises.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg fdm-td-empty">
                      <i className="bi bi-inbox" />
                      <span>Không tìm thấy bài tập phù hợp với bộ lọc hiện tại</span>
                    </td>
                  </tr>
                ) : (
                  exercises.map((ex, idx) => {
                    const isHidden = !ex.isActive
                    const cat = getCategoryMeta(ex.category)

                    return (
                      <tr key={ex._id} className={isHidden ? 'fdm-row--dim' : ''}>
                        <td className="fdm-td-center fdm-td-idx">{si + idx}</td>
                        <td>
                          <div className="fdm-food-cell">
                            {ex.imageUrl ? (
                              <img
                                src={ex.imageUrl}
                                alt=""
                                className="exm-table-thumb"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <span className="exm-icon-badge">
                                <i
                                  className={`bi ${
                                    ex.icon ||
                                    DEFAULT_CATEGORY_ICONS[ex.category] ||
                                    'bi-activity'
                                  }`}
                                />
                              </span>
                            )}
                            <div className="fdm-food-info">
                              <strong>{ex.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="fdm-group-chip">
                            <i className={`bi ${cat.icon}`} /> {ex.categoryName || cat.label}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className={`ex-chip ${getIntensityCls(ex.intensity)}`}>
                            {ex.intensity}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className="exm-met-badge">
                            MET <strong>{Number(ex.met).toFixed(1)}</strong>
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span
                            className={`fdm-status ${
                              isHidden ? 'fdm-status--hidden' : 'fdm-status--active'
                            }`}
                          >
                            <i />
                            {isHidden ? 'Không hoạt động' : 'Đang hoạt động'}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <div className="fdm-actions fdm-actions--center">
                            {/* Nút Xem chi tiết */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--view"
                              onClick={() => setDetailTarget(ex)}
                              title="Xem chi tiết bài tập"
                            >
                              <i className="bi bi-eye" />
                            </button>

                            {/* Nút Chỉnh sửa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--edit"
                              onClick={() => {
                                setEditTarget(ex)
                                setModalMode('edit')
                              }}
                              title="Chỉnh sửa thông tin"
                            >
                              <i className="bi bi-pencil-fill" />
                            </button>

                            {/* Nút Ẩn / Hiển thị */}
                            {isHidden ? (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--show"
                                onClick={() => executeShow(ex)}
                                title="Hiển thị bài tập cho người dùng"
                              >
                                <i className="bi bi-eye-fill" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--hide"
                                onClick={() => setHideTarget(ex)}
                                title="Ẩn bài tập"
                              >
                                <i className="bi bi-eye-slash-fill" />
                              </button>
                            )}

                            {/* Nút Xóa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--del"
                              onClick={() => {
                                setDeleteTarget(ex)
                                setDeleteResult(null)
                              }}
                              title="Xóa bài tập"
                            >
                              <i className="bi bi-trash3-fill" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer & Pagination ── */}
        {!loading && !listError && pagination.totalPages > 0 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">
              Hiển thị {si}–{ei} / {pagination.total.toLocaleString('vi-VN')} bài tập
            </span>
            <div className="fdm-page-btns">
              <button
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="Trang đầu"
              >
                <i className="bi bi-chevron-double-left" />
              </button>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                title="Trang trước"
              >
                <i className="bi bi-chevron-left" />
              </button>
              {Array.from(
                { length: Math.min(pagination.totalPages, 7) },
                (_, i) => {
                  const f = Math.max(
                    1,
                    Math.min(page - 3, pagination.totalPages - 6)
                  )
                  const pn = f + i
                  return (
                    <button
                      key={pn}
                      className={pn === page ? 'active' : ''}
                      onClick={() => setPage(pn)}
                    >
                      {pn}
                    </button>
                  )
                }
              )}
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
      </div>

      {/* ── Modals ── */}
      {modalMode && (
        <ExerciseFormModal
          mode={modalMode}
          editTarget={editTarget}
          onClose={() => {
            setModalMode(null)
            setEditTarget(null)
          }}
          onSaved={(msg) => {
            setModalMode(null)
            setEditTarget(null)
            showToast(msg)
            triggerRefresh()
          }}
        />
      )}

      {detailTarget && (
        <ExerciseDetailModal
          exercise={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(ex) => {
            setDetailTarget(null)
            setEditTarget(ex)
            setModalMode('edit')
          }}
          onToggleStatus={(ex) => {
            setDetailTarget(null)
            if (ex.isActive) {
              setHideTarget(ex)
            } else {
              executeShow(ex)
            }
          }}
        />
      )}

      {/* ─── Hide Confirm ─── */}
      {hideTarget && (
        <ConfirmModal
          title="Ẩn bài tập"
          icon="bi bi-eye-slash-fill"
          iconClass="fci--warn"
          body={
            <>
              Ẩn <strong>"{hideTarget.name}"</strong> sẽ ngừng hiển thị trong danh mục ghi nhận bài tập của người dùng. Dữ liệu lịch sử đã ghi nhận vẫn được giữ nguyên. Tiếp tục?
            </>
          }
          confirmLabel={
            <>
              <i className="bi bi-eye-slash" /> Xác nhận ẩn
            </>
          }
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => executeHide(hideTarget)}
        />
      )}

      {/* ─── Delete Confirm ─── */}
      {deleteTarget && !deleteResult && (
        <ConfirmModal
          title="Xóa vĩnh viễn bài tập"
          icon="bi bi-trash3-fill"
          iconClass="fci--danger"
          body={
            <>
              Bạn có chắc muốn xóa vĩnh viễn <strong>"{deleteTarget.name}"</strong>? Hệ thống sẽ kiểm tra xem bài tập này có trong nhật ký của người dùng không trước khi xóa.
            </>
          }
          confirmLabel={
            <>
              <i className="bi bi-trash3" /> Xóa vĩnh viễn
            </>
          }
          confirmClass="fca--danger"
          loading={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ─── Cannot Delete (đang có dữ liệu tham chiếu) ─── */}
      {deleteTarget && deleteResult && (
        <ConfirmModal
          title="Không thể xóa"
          icon="bi bi-shield-exclamation"
          iconClass="fci--warn"
          body={<p className="fdm-blocked-msg">{deleteResult.message}</p>}
          cancelLabel="Giữ nguyên"
          confirmLabel={
            deleteResult.canHide ? (
              <>
                <i className="bi bi-eye-slash" /> Ẩn thay vì xóa
              </>
            ) : null
          }
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteResult(null)
          }}
          onConfirm={deleteResult.canHide ? () => executeHide(deleteTarget) : null}
        />
      )}
    </div>
  )
}
