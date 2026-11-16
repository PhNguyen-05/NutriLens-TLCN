import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import UserFooter from '../../components/common/UserFooter'
import UserHeader from '../../components/common/UserHeader'
import {
  CreateCustomExerciseModal,
  ExerciseCatalogTab,
  ExerciseDetailLogModal,
  ExerciseEditModal,
  ExerciseHistoryTab,
  ExerciseLogModal,
  ExerciseVideoModal,
} from '../../components/exercise'
import { formatDateShort, getTodayStr } from '../../constants/exerciseConstants'
import { useAuth } from '../../hooks/useAuth'

export default function ExercisePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'catalog'

  // Tab chính
  const [activeTab, setActiveTab] = useState(initialTab) // 'catalog' | 'history'

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history' || tabParam === 'catalog') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  function switchTab(tab) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  // Dữ liệu
  const [exercises, setExercises] = useState([])
  const [loadingEx, setLoadingEx] = useState(true)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [userWeight, setUserWeight] = useState(null)
  const [todayStats, setTodayStats] = useState({ calories: 0, minutes: 0, count: 0 })
  const [toastMsg, setToastMsg] = useState(null)

  // Bộ lọc Catalog
  const [searchQ, setSearchQ] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [intensityFilter, setIntensityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default')

  // Bộ lọc History
  const [period, setPeriod] = useState('7d')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  })
  const [customEnd, setCustomEnd] = useState(getTodayStr)
  const [histCat, setHistCat] = useState('all')

  // Modals state
  const [logging, setLogging] = useState(null)
  const [detailLog, setDetailLog] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [customInitialName, setCustomInitialName] = useState('')
  const [deletingCustom, setDeletingCustom] = useState(null)
  const [isDeletingCustom, setIsDeletingCustom] = useState(false)
  const [videoExercise, setVideoExercise] = useState(null)

  function toast(type, text) {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg((p) => (p?.text === text ? null : p)), 4000)
  }

  // ─── Data Loaders ──────────────────────────────────────────────────────────

  const fetchExercises = useCallback(async () => {
    setLoadingEx(true)
    try {
      const { data } = await axiosInstance.get('/exercises')
      setExercises(data.exercises || [])
    } catch {
      toast('error', 'Không thể tải danh mục bài tập')
    } finally {
      setLoadingEx(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    axiosInstance
      .get('/profile')
      .then(({ data }) => {
        if (alive) setUserWeight(data.profile?.currentWeightKg || null)
      })
      .catch(() => {})

    fetchExercises()
    return () => {
      alive = false
    }
  }, [fetchExercises])

  const fetchTodayStats = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/exercises/logs', {
        params: { date: getTodayStr() },
      })
      setTodayStats({
        calories: data.summary?.totalCalories || 0,
        minutes: data.summary?.totalMinutes || 0,
        count: data.logs?.length || 0,
      })
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchTodayStats()
  }, [fetchTodayStats])

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const params = {}
      const today = getTodayStr()
      if (histCat !== 'all') params.category = histCat
      if (period === 'today') {
        params.date = today
      } else if (period === '7d') {
        const d = new Date()
        d.setDate(d.getDate() - 6)
        params.startDate = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
        params.endDate = today
      } else if (period === '14d') {
        const d = new Date()
        d.setDate(d.getDate() - 13)
        params.startDate = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
        params.endDate = today
      } else if (period === '30d') {
        const d = new Date()
        d.setDate(d.getDate() - 29)
        params.startDate = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
        params.endDate = today
      } else if (period === 'custom') {
        let s = customStart
        let e = customEnd
        if (s && e && s > e) {
          const t = s
          s = e
          e = t
        }
        if (s) params.startDate = s
        if (e) params.endDate = e
      }
      const { data } = await axiosInstance.get('/exercises/logs', { params })
      setLogs(data.logs || [])
      if (data.currentWeightKg && !userWeight) setUserWeight(data.currentWeightKg)
    } catch (_) {
      toast('error', 'Không thể tải lịch sử tập luyện')
    } finally {
      setLoadingLogs(false)
    }
  }, [period, customStart, customEnd, histCat, userWeight])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  function handleCustomStartChange(val) {
    setCustomStart(val)
    if (val && customEnd && val > customEnd) {
      setCustomEnd(val)
    }
  }

  function handleCustomEndChange(val) {
    setCustomEnd(val)
    if (val && customStart && val < customStart) {
      setCustomStart(val)
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  function openCreateModal(initialName = '') {
    setCustomInitialName(initialName)
    setCreatingCustom(true)
  }

  async function confirmDeleteLog() {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const { data } = await axiosInstance.delete(`/exercises/logs/${deleting._id}`)
      toast('success', data.message || 'Xóa bài tập thành công')
      setDeleting(null)
      fetchTodayStats()
      fetchLogs()
    } catch (e) {
      toast('error', e.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại')
      if (e.response?.status === 404) {
        setDeleting(null)
        fetchLogs()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  async function confirmDeleteCustom() {
    if (!deletingCustom) return
    setIsDeletingCustom(true)
    try {
      const { data } = await axiosInstance.delete(`/exercises/custom/${deletingCustom._id}`)
      toast('success', data.message || 'Xóa bài tập cá nhân thành công')
      setDeletingCustom(null)
      fetchExercises()
    } catch (e) {
      toast('error', e.response?.data?.message || 'Không thể xóa bài tập, vui lòng thử lại')
    } finally {
      setIsDeletingCustom(false)
    }
  }

  const myCustomCount = useMemo(
    () => exercises.filter((e) => e.isCustom).length,
    [exercises]
  )

  const histSummary = useMemo(
    () => ({
      calories: logs.reduce((s, l) => s + (l.caloriesBurned || 0), 0),
      minutes: logs.reduce((s, l) => s + (l.durationMinutes || 0), 0),
      sessions: logs.length,
    }),
    [logs]
  )

  return (
    <div className="dashboard-shell foodscan-shell ex-shell">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`ex-toast ex-toast--${toastMsg.type}`} role="alert">
          <i
            className={`bi ${
              toastMsg.type === 'success'
                ? 'bi-check-circle-fill'
                : 'bi-exclamation-triangle-fill'
            }`}
          />
          <span>{toastMsg.text}</span>
          <button type="button" onClick={() => setToastMsg(null)}>
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* Header */}
      <UserHeader />

      <main className="ex-main">
        {/* Page Heading */}
        <section className="fs-page-heading" style={{ marginBottom: 20 }}>
          <span className="fs-page-icon">
            <i className="bi bi-activity" />
          </span>
          <div>
            <h1>Luyện Tập &amp; Vận Động</h1>
            <p>
              Ghi nhận bài tập, ước tính lượng calories tiêu hao và theo dõi lịch sử rèn luyện thể chất.
            </p>
          </div>
        </section>

        {/* Warning missing weight */}
        {(!userWeight || userWeight <= 0) && (
          <div className="ex-missing-weight-bar">
            <i className="bi bi-exclamation-circle-fill" />
            <p>
              Hệ thống cần thông tin <strong>cân nặng</strong> để ước tính lượng calories tiêu hao.
            </p>
            <Link to="/profile">Cập nhật hồ sơ sức khỏe →</Link>
          </div>
        )}

        {/* KPI hôm nay */}
        <section className="ex-kpi-row">
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--fire">
              <i className="bi bi-fire" />
            </div>
            <div>
              <span className="ex-kpi-label">Calories tiêu hao hôm nay</span>
              <strong className="ex-kpi-value">
                {todayStats.calories.toLocaleString('vi-VN')} <small>kcal</small>
              </strong>
            </div>
          </article>
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--time">
              <i className="bi bi-stopwatch" />
            </div>
            <div>
              <span className="ex-kpi-label">Thời gian tập hôm nay</span>
              <strong className="ex-kpi-value">
                {todayStats.minutes} <small>phút</small>
              </strong>
            </div>
          </article>
          <article className="ex-kpi-card">
            <div className="ex-kpi-icon ex-kpi-icon--count">
              <i className="bi bi-activity" />
            </div>
            <div>
              <span className="ex-kpi-label">Số bài tập đã hoàn thành</span>
              <strong className="ex-kpi-value">
                {todayStats.count} <small>bài</small>
              </strong>
            </div>
          </article>
          <article className="ex-kpi-card ex-kpi-card--weight">
            <div className="ex-kpi-icon ex-kpi-icon--weight">
              <i className="bi bi-person-badge" />
            </div>
            <div>
              <span className="ex-kpi-label">Cân nặng dùng tính calo</span>
              {userWeight ? (
                <strong className="ex-kpi-value">
                  {userWeight} <small>kg</small>
                </strong>
              ) : (
                <span className="ex-kpi-missing">Chưa thiết lập</span>
              )}
            </div>
          </article>
        </section>

        {/* ── Tabs Navigation ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            className={`ex-btn ${activeTab === 'catalog' ? 'ex-btn--primary' : 'ex-btn--ghost'}`}
            onClick={() => switchTab('catalog')}
          >
            <i className="bi bi-grid" /> Danh mục bài tập
          </button>
          <button
            type="button"
            className={`ex-btn ${activeTab === 'history' ? 'ex-btn--primary' : 'ex-btn--ghost'}`}
            onClick={() => switchTab('history')}
          >
            <i className="bi bi-clock-history" /> Lịch sử tập luyện ({logs.length})
          </button>
        </div>

        {/* ── Tab 1: Catalog ── */}
        {activeTab === 'catalog' && (
          <ExerciseCatalogTab
            exercises={exercises}
            loadingEx={loadingEx}
            userWeight={userWeight}
            searchQ={searchQ}
            onSearchChange={setSearchQ}
            catFilter={catFilter}
            onCatFilterChange={setCatFilter}
            intensityFilter={intensityFilter}
            onIntensityFilterChange={setIntensityFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            myCustomCount={myCustomCount}
            onOpenLog={(ex) => setLogging(ex)}
            onOpenCreate={openCreateModal}
            onOpenVideo={(ex) => setVideoExercise(ex)}
            onDeleteCustom={(ex) => setDeletingCustom(ex)}
          />
        )}

        {/* ── Tab 2: History ── */}
        {activeTab === 'history' && (
          <ExerciseHistoryTab
            logs={logs}
            loadingLogs={loadingLogs}
            period={period}
            onPeriodChange={setPeriod}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={handleCustomStartChange}
            onCustomEndChange={handleCustomEndChange}
            histCat={histCat}
            onHistCatChange={setHistCat}
            histSummary={histSummary}
            onDetail={(log) => setDetailLog(log)}
            onEdit={(log) => setEditing(log)}
            onDelete={(log) => setDeleting(log)}
            onGoToCatalog={() => switchTab('catalog')}
          />
        )}
      </main>

      {/* ── Modals ── */}

      {/* Modal: Ghi nhận bài tập */}
      {logging && (
        <ExerciseLogModal
          logging={logging}
          userWeight={userWeight}
          onClose={() => setLogging(null)}
          onSaved={(msg) => {
            toast('success', msg)
            fetchTodayStats()
            fetchLogs()
          }}
          onError={(msg) => toast('error', msg)}
        />
      )}

      {/* Modal: Chỉnh sửa nhật ký bài tập (hỗ trợ sửa cân nặng!) */}
      {editing && (
        <ExerciseEditModal
          editing={editing}
          exercises={exercises}
          userWeight={userWeight}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast('success', msg)
            fetchTodayStats()
            fetchLogs()
          }}
          onError={(msg) => toast('error', msg)}
          onNotFound={() => {
            fetchLogs()
          }}
        />
      )}

      {/* Modal: Chi tiết nhật ký */}
      {detailLog && (
        <ExerciseDetailLogModal
          detailLog={detailLog}
          onClose={() => setDetailLog(null)}
          onEdit={(log) => setEditing(log)}
        />
      )}

      {/* Modal: Xem Video YouTube */}
      {videoExercise && (
        <ExerciseVideoModal
          videoExercise={videoExercise}
          userWeight={userWeight}
          onClose={() => setVideoExercise(null)}
          onLogThisExercise={(target) => setLogging(target)}
        />
      )}

      {/* Modal: Tạo bài tập cá nhân mới */}
      <CreateCustomExerciseModal
        isOpen={creatingCustom}
        initialName={customInitialName}
        userWeight={userWeight}
        onClose={() => setCreatingCustom(false)}
        onCreated={async (newExercise, msg) => {
          toast('success', msg)
          await fetchExercises()
          if (newExercise) {
            setLogging(newExercise)
          }
        }}
      />

      {/* Modal: Xác nhận xóa nhật ký */}
      {deleting && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog ex-dialog--confirm">
            <div className="ex-confirm-icon">
              <i className="bi bi-trash3" />
            </div>
            <h3>Xóa bản ghi bài tập?</h3>
            <p>
              Xóa <strong>{deleting.exerciseName}</strong> ({deleting.durationMinutes} phút) ngày{' '}
              {formatDateShort(deleting.date)}? Thao tác này sẽ cập nhật lại tổng calories tiêu hao và không thể hoàn tác.
            </p>
            <div className="ex-dialog-foot ex-dialog-foot--center">
              <button
                type="button"
                className="ex-btn ex-btn--ghost"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="ex-btn ex-btn--danger"
                onClick={confirmDeleteLog}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" /> Đang xóa...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3" /> Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa bài tập cá nhân */}
      {deletingCustom && (
        <div className="ex-overlay" role="dialog" aria-modal="true">
          <div className="ex-dialog ex-dialog--confirm">
            <div className="ex-confirm-icon">
              <i className="bi bi-trash3" />
            </div>
            <h3>Xóa bài tập cá nhân?</h3>
            <p>
              Bạn có chắc chắn muốn xóa bài tập <strong>"{deletingCustom.name}"</strong> khỏi danh mục cá nhân?
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
              Lưu ý: Các bản ghi bạn đã tập bài này trước đó trong lịch sử vẫn sẽ được giữ nguyên.
            </p>
            <div className="ex-dialog-foot ex-dialog-foot--center">
              <button
                type="button"
                className="ex-btn ex-btn--ghost"
                onClick={() => setDeletingCustom(null)}
                disabled={isDeletingCustom}
              >
                Hủy
              </button>
              <button
                type="button"
                className="ex-btn ex-btn--danger"
                onClick={confirmDeleteCustom}
                disabled={isDeletingCustom}
              >
                {isDeletingCustom ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" /> Đang xóa...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3" /> Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  )
}
