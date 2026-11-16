import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import FoodDetailModal from '../../components/admin/food/FoodDetailModal'
import FoodFormModal from '../../components/admin/food/FoodFormModal'
import FoodGroupManagementModal from '../../components/admin/food/FoodGroupManagementModal'
import ConfirmModal from '../../components/admin/food/ConfirmModal'
import {
  DEFAULT_FOOD_GROUPS,
  PAGE_SIZE,
  getImageUrl,
} from '../../components/admin/food/foodConstants'

export default function FoodManagementPage() {
  const [foods, setFoods] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, hidden: 0 })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Modals
  const [formMode, setFormMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupsList, setGroupsList] = useState([])

  const [hideTarget, setHideTarget] = useState(null)
  const [hideSaving, setHideSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteResult, setDeleteResult] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

  function showToast(message, type = 'success') {
    clearTimeout(toastRef.current)
    setToast({ message, type })
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  // Tải danh sách nhóm món ăn từ server
  const loadGroups = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/admin/foods/groups')
      if (data.success && Array.isArray(data.data)) {
        setGroupsList(data.data)
      }
    } catch (err) {
      console.error('Không thể tải nhóm món ăn:', err)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups, refreshKey])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true)
      setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/foods', {
          params: { search, status: statusFilter, foodGroup: groupFilter, sort: sortBy, page, limit: PAGE_SIZE },
          signal: ctrl.signal,
        })
        setFoods(data.data || [])
        setPagination(data.pagination || { page, total: 0, totalPages: 0 })
        setSummary(data.summary || { total: 0, active: 0, hidden: 0 })
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setListError(err.response?.data?.message || 'Không thể tải danh sách, vui lòng thử lại')
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, search ? 280 : 0)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [search, statusFilter, groupFilter, sortBy, page, refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  function handleSaved(msg) {
    setFormMode(null)
    setEditTarget(null)
    showToast(msg)
    refresh()
  }

  // Thu thập danh sách các nhóm hiện có (ưu tiên từ API, fallback DB foods)
  const existingGroups = useMemo(() => {
    if (groupsList.length > 0) {
      return groupsList.map((g) => g.name)
    }
    const set = new Set([...DEFAULT_FOOD_GROUPS])
    for (const f of foods) {
      if (f.foodGroup) set.add(f.foodGroup)
    }
    return Array.from(set)
  }, [groupsList, foods])

  // ── Hide ──
  async function executeHide(food) {
    setHideSaving(true)
    try {
      await axiosInstance.patch(`/admin/foods/${food._id}/status`, { status: 'hidden' })
      showToast('Ẩn món ăn thành công')
      setHideTarget(null)
      setDeleteTarget(null)
      setDeleteResult(null)
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại', 'error')
      setHideTarget(null)
    } finally {
      setHideSaving(false)
    }
  }

  async function executeShow(food) {
    try {
      await axiosInstance.patch(`/admin/foods/${food._id}/status`, { status: 'active' })
      showToast('Hiển thị lại món ăn thành công')
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại', 'error')
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      await axiosInstance.delete(`/admin/foods/${deleteTarget._id}`)
      showToast('Xóa món ăn thành công')
      setDeleteTarget(null)
      setDeleteResult(null)
      refresh()
    } catch (err) {
      const { refCount, canHide } = err.response?.data || {}
      if (err.response?.status === 409 && refCount !== undefined) {
        setDeleteResult({ refCount, canHide, message: err.response.data.message })
      } else {
        showToast(err.response?.data?.message || 'Thao tác thất bại', 'error')
        setDeleteTarget(null)
      }
    } finally {
      setDeleteSaving(false)
    }
  }

  const si = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const ei = Math.min(page * PAGE_SIZE, pagination.total)

  return (
    <div className="fdm-shell">
      {/* Toast */}
      {toast && (
        <div className={`fdm-toast ${toast.type === 'error' ? 'fdm-toast--err' : ''}`} role="alert">
          <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />
          {toast.message}
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="fdm-kpi-row">
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--all">
            <i className="bi bi-grid-1x2-fill" />
          </span>
          <div>
            <p>Tổng danh mục</p>
            <strong>{summary.total.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--active">
            <i className="bi bi-check-circle-fill" />
          </span>
          <div>
            <p>Đang hiển thị</p>
            <strong>{summary.active.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--hidden">
            <i className="bi bi-eye-slash-fill" />
          </span>
          <div>
            <p>Đã ẩn</p>
            <strong>{summary.hidden.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
        <div className="fdm-kpi-actions">
          <button
            type="button"
            className="fdm-group-btn"
            onClick={() => setShowGroupModal(true)}
            title="Quản lý danh mục nhóm món ăn (Thêm, đổi tên, gộp/xóa nhóm)"
          >
            <i className="bi bi-tags-fill" /> Quản lý nhóm
          </button>
          <button className="fdm-add-btn" onClick={() => setFormMode('add')}>
            <i className="bi bi-plus-circle-fill" /> Thêm món ăn mới
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="fdm-filters">
        <label className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên món ăn..."
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
            <option value="active">Đang sử dụng</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-tags-fill" />
          <select
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả nhóm</option>
            {existingGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-sort-alpha-down" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
          >
            <option value="newest">Mới nhất (Mặc định)</option>
            <option value="a-z">Tên món: A → Z</option>
            <option value="z-a">Tên món: Z → A</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>

        <span className="fdm-result-count">
          {!loading && `${pagination.total.toLocaleString('vi-VN')} kết quả`}
        </span>
      </div>

      {/* ── Table panel ── */}
      <div className="fdm-panel">
        {listError ? (
          <div className="fdm-state-msg fdm-state-msg--err">
            <i className="bi bi-exclamation-octagon-fill" />
            <span>{listError}</span>
            <button
              onClick={() => {
                setListError('')
                refresh()
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
                  <th className="fdm-th-center" style={{ width: 44 }}>
                    #
                  </th>
                  <th>Món ăn</th>
                  <th>Nhóm</th>
                  <th className="fdm-th-center">Mã món</th>
                  <th className="fdm-th-center">Năng lượng (kcal/100g)</th>
                  <th className="fdm-th-center">Protein</th>
                  <th className="fdm-th-center">Carbs</th>
                  <th className="fdm-th-center">Fat</th>
                  <th className="fdm-th-center">KP (g)</th>
                  <th className="fdm-th-center">Trạng thái</th>
                  <th className="fdm-th-center" style={{ width: 140 }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" className="fdm-td-msg">
                      <span className="food-spinner" />
                      Đang tải danh sách...
                    </td>
                  </tr>
                ) : foods.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="fdm-td-msg fdm-td-empty">
                      <i className="bi bi-inbox" />
                      <span>Không tìm thấy món ăn phù hợp</span>
                    </td>
                  </tr>
                ) : (
                  foods.map((food, idx) => {
                    const isHidden = (food.status || 'active') === 'hidden'
                    return (
                      <tr key={food._id} className={isHidden ? 'fdm-row--dim' : ''}>
                        <td className="fdm-td-center fdm-td-idx">{si + idx}</td>
                        <td>
                          <div className="fdm-food-cell">
                            <span className="fdm-thumb">
                              {food.imageUrl ? (
                                <img
                                  src={getImageUrl(food.imageUrl)}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <span>🍽</span>
                              )}
                            </span>
                            <div className="fdm-food-info">
                              <strong>{food.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="fdm-group-chip">{food.foodGroup || '—'}</span>
                        </td>
                        <td className="fdm-td-center">
                          <code className="fdm-code">{food.foodCode || '—'}</code>
                        </td>
                        <td className="fdm-td-center fdm-td-num fdm-num--cal">{food.calories} kcal</td>
                        <td className="fdm-td-center fdm-td-num fdm-num--pro">{food.protein}g</td>
                        <td className="fdm-td-center fdm-td-num fdm-num--carb">{food.carbs}g</td>
                        <td className="fdm-td-center fdm-td-num fdm-num--fat">{food.fat}g</td>
                        <td className="fdm-td-center fdm-td-num">{food.servingSize}g</td>
                        <td className="fdm-td-center">
                          <span
                            className={`fdm-status ${
                              isHidden ? 'fdm-status--hidden' : 'fdm-status--active'
                            }`}
                          >
                            <i />
                            {isHidden ? 'Đã ẩn' : 'Đang hiển thị'}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <div className="fdm-actions fdm-actions--center">
                            <button
                              className="fdm-btn fdm-btn--view"
                              onClick={() => setDetailTarget(food)}
                              title="Xem chi tiết"
                            >
                              <i className="bi bi-eye" />
                            </button>
                            <button
                              className="fdm-btn fdm-btn--edit"
                              onClick={() => {
                                setEditTarget(food)
                                setFormMode('edit')
                              }}
                              title="Chỉnh sửa"
                            >
                              <i className="bi bi-pencil-fill" />
                            </button>
                            {isHidden ? (
                              <button
                                className="fdm-btn fdm-btn--show"
                                onClick={() => executeShow(food)}
                                title="Hiển thị lại cho người dùng"
                                aria-label={`Hiển thị lại ${food.name} cho người dùng`}
                              >
                                <i className="bi bi-eye-fill" />
                              </button>
                            ) : (
                              <button
                                className="fdm-btn fdm-btn--hide"
                                onClick={() => setHideTarget(food)}
                                title="Ẩn món đang hiển thị khỏi người dùng"
                                aria-label={`Ẩn ${food.name} khỏi người dùng`}
                              >
                                <i className="bi bi-eye-slash-fill" />
                              </button>
                            )}
                            <button
                              className="fdm-btn fdm-btn--del"
                              onClick={() => {
                                setDeleteTarget(food)
                                setDeleteResult(null)
                              }}
                              title="Xóa"
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

        {/* Pagination */}
        {!loading && !listError && pagination.totalPages > 0 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">
              Hiển thị {si}–{ei} / {pagination.total.toLocaleString('vi-VN')} món ăn
            </span>
            <div className="fdm-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu">
                <i className="bi bi-chevron-double-left" />
              </button>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <i className="bi bi-chevron-left" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const f = Math.max(1, Math.min(page - 3, pagination.totalPages - 6))
                const pn = f + i
                return (
                  <button key={pn} className={pn === page ? 'active' : ''} onClick={() => setPage(pn)}>
                    {pn}
                  </button>
                )
              })}
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
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

      {/* ─── Detail Modal (Xem chi tiết) ─── */}
      {detailTarget && (
        <FoodDetailModal
          food={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(food) => {
            setDetailTarget(null)
            setEditTarget(food)
            setFormMode('edit')
          }}
        />
      )}

      {/* ─── Form Modal (Thêm / Sửa) ─── */}
      {formMode && (
        <FoodFormModal
          mode={formMode}
          editTarget={editTarget}
          totalFoods={summary.total}
          allExistingGroups={existingGroups}
          onClose={() => {
            setFormMode(null)
            setEditTarget(null)
          }}
          onSaved={handleSaved}
        />
      )}

      {/* ─── Hide Confirm ─── */}
      {hideTarget && (
        <ConfirmModal
          title="Ẩn món ăn"
          icon="bi bi-eye-slash-fill"
          iconClass="fci--warn"
          body={
            <>
              Ẩn <strong>"{hideTarget.name}"</strong> sẽ ngừng hiển thị trong tìm kiếm và kết quả AI Lens. Dữ liệu
              lịch sử MealLog của người dùng vẫn được giữ nguyên. Tiếp tục?
            </>
          }
          confirmLabel={
            <>
              <i className="bi bi-eye-slash" />
              Xác nhận ẩn
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
          title="Xóa vĩnh viễn món ăn"
          icon="bi bi-trash3-fill"
          iconClass="fci--danger"
          body={
            <>
              Bạn có chắc muốn xóa vĩnh viễn <strong>"{deleteTarget.name}"</strong>? Hệ thống sẽ kiểm tra xem món
              này có trong nhật ký bữa ăn không trước khi xóa.
            </>
          }
          confirmLabel={
            <>
              <i className="bi bi-trash3" />
              Xóa vĩnh viễn
            </>
          }
          confirmClass="fca--danger"
          loading={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ─── Cannot Delete (đang được tham chiếu) ─── */}
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
                <i className="bi bi-eye-slash" />
                Ẩn thay vì xóa
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

      {/* ─── Food Group Management Modal ─── */}
      {showGroupModal && (
        <FoodGroupManagementModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onGroupsChanged={() => {
            loadGroups()
            refresh()
          }}
        />
      )}
    </div>
  )
}
