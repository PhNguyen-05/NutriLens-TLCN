/**
 * FoodScanPage.jsx
 * UC13 — Nhận diện món ăn qua ảnh và thêm vào nhật ký bữa ăn.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toLocaleDateString('sv-SE') // 'YYYY-MM-DD' theo locale Sweden
}

function roundN(v, n = 1) {
  return v == null ? 0 : Math.round(Number(v) * 10 ** n) / 10 ** n
}

const MEAL_LABELS = {
  breakfast: 'Bữa sáng',
  lunch:     'Bữa trưa',
  dinner:    'Bữa tối',
  snack:     'Ăn vặt',
}

const EMPTY_FOOD_REQUEST_FORM = {
  name: '',
  imageUrl: '',
  caloriesPer100g: '',
  proteinPer100g: '',
  carbPer100g: '',
  fatPer100g: '',
  note: '',
}

function nutritionPer100g(value, servingSize) {
  if (value == null || value === '') return ''
  const baseServing = Number(servingSize) || 100
  if (!baseServing) return ''
  return String(roundN((Number(value) / baseServing) * 100, 1))
}

function buildFoodRequestDraft(result, selectedPrediction) {
  const nutrition = result?.nutrition || {}
  return {
    ...EMPTY_FOOD_REQUEST_FORM,
    name: selectedPrediction?.name || nutrition.foodName || '',
    imageUrl: nutrition.imageUrl || '',
    caloriesPer100g: nutritionPer100g(nutrition.calories, nutrition.servingSize),
    proteinPer100g: nutritionPer100g(nutrition.protein, nutrition.servingSize),
    carbPer100g: nutritionPer100g(nutrition.carbs, nutrition.servingSize),
    fatPer100g: nutritionPer100g(nutrition.fat, nutrition.servingSize),
  }
}

function isPreviewableImageUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  if (!apiOrigin) return url
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`
}

const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024

async function decodeFoodImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Không thể đọc ảnh này. Hãy chọn ảnh JPG hoặc PNG.'))
      element.src = url
    })
    return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function prepareScanImage(file) {
  if (!file || (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|avif|heic)$/i.test(file.name))) {
    throw new Error('Vui lòng chọn một tệp hình ảnh.')
  }

  const supportedType = ['image/jpeg', 'image/png'].includes(file.type)
  if (supportedType && file.size <= MAX_SCAN_IMAGE_BYTES) return file

  const decoded = await decodeFoodImage(file)
  try {
    const maxDimension = 1800
    let scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height))
    const qualities = [0.9, 0.84, 0.78, 0.7, 0.64]

    for (const quality of qualities) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(decoded.width * scale))
      canvas.height = Math.max(1, Math.round(decoded.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Trình duyệt không thể xử lý ảnh này.')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_SCAN_IMAGE_BYTES) {
        return new File([blob], `nutrilens-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
      }
      scale *= 0.82
    }

    throw new Error('Ảnh quá lớn để xử lý. Hãy chọn ảnh có dung lượng thấp hơn.')
  } finally {
    decoded.release()
  }
}

function readImagePreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Không thể mở ảnh đã chọn.'))
    reader.readAsDataURL(file)
  })
}

function formatRequestDate(value) {
  if (!value) return 'Vừa gửi'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function splitRequestDate(value) {
  if (!value) return { date: 'Vừa gửi', time: '' }
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date),
  }
}

function formatRequestNutrition(request) {
  const items = [
    ['Calories', request.caloriesPer100g, 'kcal'],
    ['Protein', request.proteinPer100g, 'g'],
    ['Carb', request.carbPer100g, 'g'],
    ['Fat', request.fatPer100g, 'g'],
  ].filter(([, value]) => value != null && value !== '')

  return items.length
    ? items.map(([label, value, unit]) => `${label} ${roundN(value, 1)}${unit}`).join(' · ')
    : 'Chưa cung cấp dinh dưỡng'
}

function requestStatusClass(status) {
  if (status === 'Đã duyệt') return 'approved'
  if (status === 'Từ chối') return 'rejected'
  return 'pending'
}

function FoodRequestImage({ request, className }) {
  const imageSrc = resolveMediaUrl(request?.imageUrl)
  return (
    <span className={className}>
      {imageSrc ? <img src={imageSrc} alt={request.name} /> : <i className="bi bi-image" />}
    </span>
  )
}

function FoodRequestDetailModal({ request, onClose }) {
  if (!request) return null

  const submittedAt = splitRequestDate(request.createdAt)
  const reviewedAt = splitRequestDate(request.reviewedAt)
  const imageSrc = resolveMediaUrl(request.imageUrl)
  const adminNote = request.rejectReason || (request.status === 'Đã duyệt' ? 'Món ăn đã được bổ sung vào danh mục.' : 'Chưa có phản hồi')

  return (
    <div className="fs-request-detail-overlay" role="presentation" onMouseDown={onClose}>
      <article
        className="fs-request-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-request-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="fs-request-detail-header">
          <div>
            <span>Yêu cầu đã gửi</span>
            <h2 id="food-request-detail-title">{request.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết yêu cầu">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className={`fs-request-detail-photo ${imageSrc ? 'has-image' : ''}`}>
          {imageSrc ? <img src={imageSrc} alt={`Ảnh minh họa ${request.name}`} /> : <><i className="bi bi-image" /><span>Yêu cầu này chưa có ảnh minh họa.</span></>}
        </div>

        <section className="fs-request-detail-summary">
          <div>
            <small>Ngày gửi</small>
            <strong>{submittedAt.date}</strong>
            {submittedAt.time && <span>{submittedAt.time}</span>}
          </div>
          <div>
            <small>Trạng thái</small>
            <em className={`fs-request-status-pill ${requestStatusClass(request.status)}`}>{request.status}</em>
          </div>
          <div>
            <small>Cập nhật</small>
            <strong>{request.reviewedAt ? reviewedAt.date : 'Chưa duyệt'}</strong>
            {request.reviewedAt && reviewedAt.time && <span>{reviewedAt.time}</span>}
          </div>
        </section>

        <dl className="fs-request-detail-list">
          <div><dt>Dinh dưỡng/100g</dt><dd>{formatRequestNutrition(request)}</dd></div>
          <div><dt>Ghi chú của bạn</dt><dd>{request.note || 'Không có ghi chú'}</dd></div>
          <div><dt>Phản hồi Admin</dt><dd>{adminNote}</dd></div>
        </dl>
      </article>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thanh confidence với màu động */
function ConfidenceBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  const tone = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low'
  return (
    <div className={`fs-confidence ${tone}`}>
      <span className="fs-confidence-track"><i style={{ width: `${pct}%` }} /></span>
      <strong>{pct}%</strong>
    </div>
  )
}

/** Bảng dinh dưỡng */
function NutritionTable({ nutrition, servings }) {
  if (!nutrition) return null
  const s = servings || 1
  const rows = [
    { label: 'Calories', value: roundN(nutrition.calories * s), unit: 'kcal', tone: 'calories', icon: 'bi-fire' },
    { label: 'Carbohydrate', value: roundN(nutrition.carbs * s), unit: 'g', tone: 'carbs', icon: 'bi-flower1' },
    { label: 'Protein', value: roundN(nutrition.protein * s), unit: 'g', tone: 'protein', icon: 'bi-circle-fill' },
    { label: 'Fat', value: roundN(nutrition.fat * s), unit: 'g', tone: 'fat', icon: 'bi-droplet-fill' },
  ]
  return (
    <div className="fs-macro-grid">
      {rows.map((row) => (
        <article className={`fs-macro-card ${row.tone}`} key={row.label}>
          <span><i className={`bi ${row.icon}`} />{row.label}</span>
          <strong>{row.value}<small> {row.unit}</small></strong>
          <small>{row.tone === 'calories' ? 'Năng lượng' : row.label === 'Protein' ? 'Chất đạm' : row.label === 'Fat' ? 'Chất béo' : 'Tinh bột'}</small>
        </article>
      ))}
    </div>
  )
}

function FoodRequestPanel({
  form,
  feedback,
  imageInputRef,
  imagePreview,
  sentRequests,
  requestsLoading,
  requestsError,
  hasMoreRequests,
  isEditing,
  submitting,
  onBack,
  onChange,
  onImageChange,
  onImageClear,
  onImageDrop,
  onOpenRequestsPage,
  onSubmit,
}) {
  const previewImage = imagePreview || (isPreviewableImageUrl(form.imageUrl) ? form.imageUrl : null)
  const hasNutrition = ['caloriesPer100g', 'proteinPer100g', 'carbPer100g', 'fatPer100g'].some((key) => form[key])
  const nutritionPreview = [
    ['Calories', form.caloriesPer100g, 'kcal'],
    ['Protein', form.proteinPer100g, 'g'],
    ['Carbohydrate', form.carbPer100g, 'g'],
    ['Chất béo', form.fatPer100g, 'g'],
  ].filter(([, value]) => value)

  return (
    <section className="fs-request-page">
      <section className="fs-request-hero">
        <div className="fs-request-hero-main">
          <span className="fs-request-hero-icon"><i className="bi bi-plus-circle-fill" /></span>
          <div>
            <h1>{isEditing ? 'Chỉnh sửa yêu cầu món ăn' : 'Yêu cầu bổ sung món ăn mới'}</h1>
            <p>Gửi thông tin món ăn chưa có trong danh mục để Admin xem xét bổ sung.</p>
          </div>
        </div>
        <button className="fs-request-back-button" type="button" onClick={onBack}>
          <i className="bi bi-arrow-left" />
          Quay lại
        </button>
      </section>

      {feedback && (
        <div className={`fs-alert ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          <i className={`bi ${feedback.type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`} />
          {feedback.text}
        </div>
      )}

      <section className="fs-request-grid">
        <form className="fs-panel fs-request-form" onSubmit={onSubmit}>
          <section className="fs-request-section">
            <div className="fs-request-section-heading">
              <span>1</span>
              <div>
                <h2>Thông tin món ăn</h2>
              </div>
            </div>
            <label className="fs-request-field">
              <span>Tên món ăn <b>*</b></span>
              <input
                value={form.name}
                onChange={(event) => onChange('name', event.target.value)}
                placeholder="Ví dụ: Bún chả Hà Nội"
                required
              />
              <small>Chỉ tên món ăn là bắt buộc.</small>
            </label>
          </section>

          <section className="fs-request-section">
            <div className="fs-request-section-heading">
              <span>2</span>
              <div>
                <h2>Ảnh minh họa <em>(Tùy chọn)</em></h2>
              </div>
            </div>
            <div
              className={`fs-request-upload ${previewImage ? 'has-image' : ''}`}
              onDrop={onImageDrop}
              onDragOver={(event) => event.preventDefault()}
            >
              {previewImage ? (
                <img src={previewImage} alt={form.name ? `Ảnh minh họa ${form.name}` : 'Ảnh minh họa món ăn'} />
              ) : (
                <>
                  <span><i className="bi bi-image" /></span>
                  <strong>Kéo thả ảnh vào đây hoặc chọn ảnh từ thiết bị</strong>
                  <small>Định dạng JPG, PNG, WEBP | Tối đa 5MB</small>
                </>
              )}
              <div className="fs-request-upload-actions">
                {previewImage && <button type="button" onClick={onImageClear}><i className="bi bi-x-circle" />Gỡ ảnh</button>}
                <button type="button" onClick={() => imageInputRef.current?.click()}><i className="bi bi-upload" />Chọn ảnh</button>
              </div>
            </div>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onImageChange} />
            <label className="fs-request-field">
              <span>URL ảnh minh họa</span>
              <input
                value={form.imageUrl}
                onChange={(event) => onChange('imageUrl', event.target.value)}
                placeholder="https://..."
              />
            </label>
          </section>

          <section className="fs-request-section">
            <div className="fs-request-section-heading">
              <span>3</span>
              <div>
                <h2>Thông tin dinh dưỡng trên 100g <em>(Tùy chọn)</em></h2>
              </div>
            </div>
            <div className="fs-request-nutrition-grid">
              <label className="fs-request-field">
                <span>Năng lượng (kcal)</span>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={form.caloriesPer100g} onChange={(event) => onChange('caloriesPer100g', event.target.value)} placeholder="Ví dụ: 120" />
              </label>
              <label className="fs-request-field">
                <span>Protein (g)</span>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={form.proteinPer100g} onChange={(event) => onChange('proteinPer100g', event.target.value)} placeholder="Ví dụ: 5.2" />
              </label>
              <label className="fs-request-field">
                <span>Carbohydrate (g)</span>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={form.carbPer100g} onChange={(event) => onChange('carbPer100g', event.target.value)} placeholder="Ví dụ: 18.6" />
              </label>
              <label className="fs-request-field">
                <span>Chất béo (g)</span>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={form.fatPer100g} onChange={(event) => onChange('fatPer100g', event.target.value)} placeholder="Ví dụ: 3.4" />
              </label>
            </div>
            <p className="fs-request-hint"><i className="bi bi-info-circle" />Bạn có thể để trống các giá trị chưa biết, Admin sẽ bổ sung khi duyệt.</p>
          </section>

          <section className="fs-request-section">
            <div className="fs-request-section-heading">
              <span>4</span>
              <div>
                <h2>Ghi chú cho Admin <em>(Tùy chọn)</em></h2>
              </div>
            </div>
            <label className="fs-request-field">
              <textarea
                value={form.note}
                onChange={(event) => onChange('note', event.target.value.slice(0, 500))}
                placeholder="Thông tin bổ sung về món ăn nếu có..."
                rows={4}
              />
              <small>{form.note.length}/500</small>
            </label>
          </section>

          <footer className="fs-request-form-footer">
            <span><i className="bi bi-info-circle" />Chỉ tên món ăn là bắt buộc.</span>
            <div>
              <button className="fs-button secondary" type="button" onClick={onBack}>Hủy</button>
              <button className="fs-button primary" type="submit" disabled={submitting}>
                {isEditing ? (submitting ? 'Đang cập nhật...' : 'Cập nhật') : <><i className={`bi ${submitting ? 'bi-hourglass-split' : 'bi-send-fill'}`} />{submitting ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}</>}
              </button>
            </div>
          </footer>
        </form>

        <aside className="fs-request-side">
          <article className="fs-panel fs-request-preview">
            <h2>Xem trước yêu cầu</h2>
            <div className={`fs-request-preview-image ${previewImage ? 'has-image' : ''}`}>
              {previewImage ? <img src={previewImage} alt="" /> : <><i className="bi bi-image" /><span>Ảnh món ăn chưa được thêm</span></>}
            </div>
            <dl className="fs-request-preview-list">
              <div><dt><i className="bi bi-bookmark" />Tên món ăn:</dt><dd>{form.name || 'Chưa nhập'}</dd></div>
              <div><dt><i className="bi bi-fork-knife" />Dinh dưỡng/100g:</dt><dd>{hasNutrition ? nutritionPreview.map(([label, value, unit]) => `${label} ${value}${unit}`).join(' · ') : 'Chưa cung cấp'}</dd></div>
              <div><dt><i className="bi bi-clock" />Trạng thái:</dt><dd><span>Chờ duyệt</span></dd></div>
            </dl>
          </article>

          <article className="fs-panel fs-request-history">
            <div className="fs-request-history-head">
              <h2><i className="bi bi-send-check-fill" />Các yêu cầu đã gửi</h2>
              {hasMoreRequests && (
                <button type="button" onClick={() => onOpenRequestsPage()}>Xem tất cả</button>
              )}
            </div>
            {requestsLoading ? (
              <div className="fs-request-history-state"><span className="fs-mini-spinner" />Đang tải yêu cầu...</div>
            ) : requestsError ? (
              <div className="fs-request-history-state error"><i className="bi bi-exclamation-circle" />{requestsError}</div>
            ) : sentRequests.length ? (
              <div className="fs-request-history-list">
                {sentRequests.slice(0, 3).map((request) => {
                  return (
                    <article className="fs-request-history-item" key={request._id}>
                      <div className="fs-request-history-top">
                        <FoodRequestImage request={request} className="fs-request-history-thumb" />
                        <div>
                          <strong>{request.name}</strong>
                          <small>{formatRequestDate(request.createdAt)}</small>
                        </div>
                        <em className={`fs-request-status-pill ${requestStatusClass(request.status)}`}>{request.status}</em>
                      </div>
                      <p>{formatRequestNutrition(request)}</p>
                      {request.rejectReason && <small className="fs-request-reject-reason">Lý do: {request.rejectReason}</small>}
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="fs-request-history-state"><i className="bi bi-inbox" />Chưa có yêu cầu nào được gửi.</div>
            )}
          </article>
        </aside>
      </section>
    </section>
  )
}

function FoodRequestListPage({
  requests,
  requestsTotal,
  loading,
  error,
  onBack,
  onRefresh,
  onSelectRequest,
  onEditRequest,
  onDeleteRequest,
  deletingRequestId,
  onCloseDetail,
  selectedRequest,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')

  const requestStats = {
    total: requestsTotal || requests.length,
    pending: requests.filter((request) => request.status === 'Chờ duyệt').length,
    approved: requests.filter((request) => request.status === 'Đã duyệt').length,
    rejected: requests.filter((request) => request.status === 'Từ chối').length,
  }

  const filteredRequests = [...requests]
    .filter((request) => {
      const matchesQuery = request.name.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter
      return matchesQuery && matchesStatus
    })
    .sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime()
      const right = new Date(b.createdAt || 0).getTime()
      return sortOrder === 'oldest' ? left - right : right - left
    })

  return (
    <section className="fs-request-list-page">
      <div className="fs-request-list-breadcrumb">
        <button type="button" onClick={onBack} aria-label="Quay lại"><i className="bi bi-arrow-left" /></button>
        <span>Trang chủ</span>
        <i className="bi bi-chevron-right" />
        <strong>Yêu cầu bổ sung món ăn</strong>
      </div>

      <section className="fs-request-list-hero">
        <div>
          <h1>Yêu cầu bổ sung món ăn của tôi</h1>
          <p>Theo dõi trạng thái các yêu cầu bạn đã gửi về món ăn chưa có trong danh mục.</p>
          <p>Chúng tôi sẽ thông báo khi có cập nhật từ quản trị viên.</p>
        </div>
        <div className="fs-request-list-illustration">
          <i className="bi bi-clipboard2-pulse" />
          <span><i className="bi bi-plus-lg" /></span>
        </div>
      </section>

      <section className="fs-request-stat-grid">
        <article><span className="list"><i className="bi bi-card-checklist" /></span><div><small>Tổng yêu cầu</small><strong>{requestStats.total}</strong><em>Tất cả yêu cầu đã gửi</em></div></article>
        <article><span className="pending"><i className="bi bi-clock" /></span><div><small>Chờ duyệt</small><strong>{requestStats.pending}</strong><em>Đang được xem xét</em></div></article>
        <article><span className="approved"><i className="bi bi-check-circle-fill" /></span><div><small>Đã duyệt</small><strong>{requestStats.approved}</strong><em>Đã được bổ sung vào hệ thống</em></div></article>
        <article><span className="rejected"><i className="bi bi-x-circle-fill" /></span><div><small>Từ chối</small><strong>{requestStats.rejected}</strong><em>Không được chấp thuận</em></div></article>
      </section>

      <section className="fs-panel fs-request-list-panel">
        <div className="fs-request-list-controls">
          <label className="fs-request-list-search"><i className="bi bi-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm theo tên món ăn..." /></label>
          <label className="fs-request-list-select"><i className="bi bi-funnel" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="Chờ duyệt">Chờ duyệt</option><option value="Đã duyệt">Đã duyệt</option><option value="Từ chối">Từ chối</option></select></label>
          <label className="fs-request-list-select"><i className="bi bi-calendar3" /><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
        </div>

        {loading ? (
          <div className="fs-request-list-state"><span className="fs-mini-spinner" />Đang tải yêu cầu...</div>
        ) : error ? (
          <div className="fs-request-list-state error"><i className="bi bi-exclamation-circle" />{error}<button type="button" onClick={onRefresh}>Thử lại</button></div>
        ) : filteredRequests.length ? (
          <>
            <div className="fs-request-list-table-wrap">
              <table className="fs-request-list-table">
                <thead>
                  <tr>
                    <th>Tên món ăn</th>
                    <th>Ảnh minh họa</th>
                    <th>Ngày gửi</th>
                    <th>Dinh dưỡng (nếu có)</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú từ Admin</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request, index) => {
                    const submittedAt = splitRequestDate(request.createdAt)
                    return (
                      <tr key={request._id}>
                        <td><strong>{request.name}</strong><small>{`#FR${String(index + 1).padStart(3, '0')}`}</small></td>
                        <td><FoodRequestImage request={request} className="fs-request-table-image" /></td>
                        <td><span className="fs-request-table-date">{submittedAt.date}<small>{submittedAt.time}</small></span></td>
                        <td>{formatRequestNutrition(request)}</td>
                        <td><em className={`fs-request-status-pill ${requestStatusClass(request.status)}`}>{request.status}</em></td>
                        <td>{request.rejectReason || (request.status === 'Đã duyệt' ? 'Món ăn đã được bổ sung vào danh mục.' : 'Chưa có phản hồi')}</td>
                        <td>
                          <div className="fs-request-row-actions">
                            <button className="fs-request-table-detail" type="button" onClick={() => onSelectRequest(request)}><i className="bi bi-eye" />Xem chi tiết</button>
                            {request.status === 'Chờ duyệt' && <>
                              <button className="fs-request-table-edit" type="button" onClick={() => onEditRequest(request)}><i className="bi bi-pencil-square" />Sửa</button>
                              <button className="fs-request-table-delete" type="button" onClick={() => onDeleteRequest(request)} disabled={deletingRequestId === request._id}>
                                <i className={`bi ${deletingRequestId === request._id ? 'bi-hourglass-split' : 'bi-trash3'}`} />{deletingRequestId === request._id ? 'Đang xóa...' : 'Xóa'}
                              </button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <footer className="fs-request-list-footer">
              <span>Tổng cộng: {filteredRequests.length} yêu cầu</span>
              <div><button type="button" aria-label="Trang trước"><i className="bi bi-chevron-left" /></button><strong>1</strong><button type="button" aria-label="Trang sau"><i className="bi bi-chevron-right" /></button></div>
            </footer>
          </>
        ) : (
          <div className="fs-request-list-state"><i className="bi bi-inbox" />Không có yêu cầu phù hợp với bộ lọc hiện tại.</div>
        )}
      </section>
      <FoodRequestDetailModal request={selectedRequest} onClose={onCloseDetail} />
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FoodScanPage() {
  const location = useLocation()
  const transferStateRef = useRef(location.state)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const requestImageInputRef = useRef(null)
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const canOpenCamera = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  // Ảnh preview
  const [preview, setPreview]     = useState(null)   // data URL
  const [fileObj, setFileObj]     = useState(null)   // File object
  const [preparingImage, setPreparingImage] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(() => Boolean(location.state?.openFoodCamera))
  const [cameraLoading, setCameraLoading] = useState(() => Boolean(location.state?.openFoodCamera && canOpenCamera))
  const [cameraError, setCameraError] = useState(() => location.state?.openFoodCamera && !canOpenCamera
    ? 'Trình duyệt chưa hỗ trợ camera trực tiếp. Bạn có thể chọn ảnh từ thiết bị.'
    : null)

  // Kết quả AI
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState(null)   // { recognized, predictions, nutrition, message }
  const [scanError, setScanError] = useState(null)

  // Form thêm vào nhật ký
  const [selectedPred, setSelectedPred] = useState(0)   // index trong predictions
  const [servings, setServings]         = useState(1)
  const [date, setDate]                 = useState(todayString)
  const [mealType, setMealType]         = useState('lunch')
  const [foodQuery, setFoodQuery] = useState('')
  const [foodMatches, setFoodMatches] = useState([])
  const [foodSearchLoading, setFoodSearchLoading] = useState(true)
  const [foodSearchError, setFoodSearchError] = useState(null)

  // Trạng thái lưu nhật ký
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)  // { type:'success'|'error', text }
  const [mealLogs, setMealLogs] = useState([])
  const [dailyTotals, setDailyTotals] = useState(null)
  const [logsLoading, setLogsLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  // Form yêu cầu bổ sung món ăn
  const [requestMode, setRequestMode] = useState(false)
  const [requestForm, setRequestForm] = useState(EMPTY_FOOD_REQUEST_FORM)
  const [requestImagePreview, setRequestImagePreview] = useState(null)
  const [requestImageFile, setRequestImageFile] = useState(null)
  const [requestListMode, setRequestListMode] = useState(false)
  const [editingRequestId, setEditingRequestId] = useState(null)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [deletingRequestId, setDeletingRequestId] = useState(null)
  const [requestFeedback, setRequestFeedback] = useState(null)
  const [sentRequests, setSentRequests] = useState([])
  const [requestsTotal, setRequestsTotal] = useState(0)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestsError, setRequestsError] = useState(null)
  const [requestsExpanded, setRequestsExpanded] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  const firstName = user?.fullName?.split(' ')[0] || 'bạn'
  const selectedPrediction = result?.predictions?.[selectedPred]
  const targetCalories = Number(profile?.nutritionGoal?.calorieTarget || 2000)

  async function searchFoodLibrary(query = '') {
    setFoodSearchLoading(true)
    setFoodSearchError(null)
    try {
      const { data } = await axiosInstance.get('/food/search', { params: { query } })
      setFoodMatches(data.foods || [])
    } catch {
      setFoodMatches([])
      setFoodSearchError('Không thể tải thư viện món ăn. Vui lòng thử lại.')
    } finally {
      setFoodSearchLoading(false)
    }
  }

  function selectManualFood(food) {
    setResult({
      recognized: true,
      manual: true,
      predictions: [{ slug: food.slug, name: food.name, confidence: null }],
      nutrition: {
        foodSlug: food.slug,
        foodName: food.name,
        description: food.description,
        imageUrl: food.imageUrl,
        servingSize: food.servingSize,
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        fiber: food.fiber,
        sodium: food.sodium,
      },
    })
    setSelectedPred(0)
    setPreview(null)
    setFileObj(null)
    setScanError(null)
    setSaveMsg(null)
    setServings(1)
    setCameraOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const loadMealLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const { data } = await axiosInstance.get('/food/meal-logs', { params: { date } })
      setMealLogs(data.logs || [])
      setDailyTotals(data.totals || null)
    } catch {
      setMealLogs([])
      setDailyTotals(null)
    } finally {
      setLogsLoading(false)
    }
  }, [date])

  const loadFoodRequests = useCallback(async (expanded = requestsExpanded) => {
    setRequestsLoading(true)
    setRequestsError(null)
    try {
      const { data } = await axiosInstance.get('/food/requests', {
        params: { limit: expanded ? 50 : 3 },
      })
      setSentRequests(data.requests || [])
      setRequestsTotal(Number(data.total || 0))
    } catch {
      setSentRequests([])
      setRequestsTotal(0)
      setRequestsError('Không thể tải danh sách yêu cầu đã gửi.')
    } finally {
      setRequestsLoading(false)
    }
  }, [requestsExpanded])

  useEffect(() => {
    let isActive = true
    axiosInstance.get('/profile')
      .then(({ data }) => { if (isActive) setProfile(data.profile || null) })
      .catch(() => { if (isActive) setProfile(null) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMealLogs()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMealLogs])

  useEffect(() => {
    let isActive = true
    axiosInstance.get('/food/search')
      .then(({ data }) => { if (isActive) { setFoodMatches(data.foods || []); setFoodSearchLoading(false) } })
      .catch(() => { if (isActive) { setFoodSearchError('Không thể tải thư viện món ăn. Vui lòng thử lại.'); setFoodSearchLoading(false) } })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!requestMode) return undefined
    const timer = window.setTimeout(() => {
      loadFoodRequests(requestsExpanded)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadFoodRequests, requestMode, requestsExpanded])

  useEffect(() => {
    if (!cameraOpen) return undefined

    let cancelled = false
    let stream = null
    const videoElement = cameraVideoRef.current
    if (!navigator.mediaDevices?.getUserMedia) return undefined

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((cameraStream) => {
        stream = cameraStream
        if (cancelled) {
          cameraStream.getTracks().forEach((track) => track.stop())
          return
        }
        cameraStreamRef.current = cameraStream
        if (videoElement) {
          videoElement.srcObject = cameraStream
          videoElement.play().catch(() => {})
        }
        setCameraLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setCameraLoading(false)
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraError('Bạn chưa cấp quyền sử dụng camera. Hãy cho phép camera trong trình duyệt hoặc chọn ảnh từ thiết bị.')
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setCameraError('Không tìm thấy camera trên thiết bị này. Bạn có thể chọn ảnh từ thiết bị.')
        } else {
          setCameraError('Không thể mở camera. Hãy kiểm tra quyền truy cập hoặc chọn ảnh từ thiết bị.')
        }
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (cameraStreamRef.current === stream) cameraStreamRef.current = null
      if (videoElement) videoElement.srcObject = null
    }
  }, [cameraOpen])

  useEffect(() => {
    if (!cameraOpen) return undefined
    const handleCameraKeyDown = (event) => {
      if (event.key === 'Escape') setCameraOpen(false)
    }
    window.addEventListener('keydown', handleCameraKeyDown)
    return () => window.removeEventListener('keydown', handleCameraKeyDown)
  }, [cameraOpen])

  // ── Handlers ──

  const handleSelectedImage = useCallback(async (file) => {
    if (!file) return
    setPreparingImage(true)
    setScanError(null)
    setSaveMsg(null)
    try {
      const preparedFile = await prepareScanImage(file)
      const imagePreview = await readImagePreview(preparedFile)
      setResult(null)
      setSelectedPred(0)
      setFileObj(preparedFile)
      setPreview(imagePreview)
    } catch (error) {
      setScanError(error.message || 'Không thể xử lý ảnh. Hãy thử chọn ảnh JPG hoặc PNG.')
    } finally {
      setPreparingImage(false)
    }
  }, [])

  useEffect(() => {
    const transfer = transferStateRef.current
    if (!transfer?.scanImageFile && !transfer?.openFoodCamera) return undefined

    transferStateRef.current = null
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })

    if (transfer.scanImageFile) {
      window.setTimeout(() => handleSelectedImage(transfer.scanImageFile), 0)
    }

    return undefined
  }, [handleSelectedImage, location.hash, location.pathname, location.search, navigate])

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    handleSelectedImage(file)
  }, [handleSelectedImage])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    handleSelectedImage(file)
  }, [handleSelectedImage])

  const openCamera = () => {
    const canOpenCamera = Boolean(navigator.mediaDevices?.getUserMedia)
    setCameraError(canOpenCamera ? null : 'Trình duyệt chưa hỗ trợ camera trực tiếp. Bạn có thể chọn ảnh từ thiết bị.')
    setCameraLoading(canOpenCamera)
    setCameraOpen(true)
  }

  const closeCamera = () => setCameraOpen(false)

  const captureCameraImage = () => {
    const video = cameraVideoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('Camera chưa sẵn sàng. Vui lòng đợi hình ảnh xuất hiện rồi chụp lại.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Không thể chụp ảnh trên trình duyệt này.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Không thể tạo ảnh. Hãy thử chụp lại.')
        return
      }
      const capturedImage = new File([blob], `nutrilens-camera-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
      setCameraOpen(false)
      handleSelectedImage(capturedImage)
    }, 'image/jpeg', 0.92)
  }

  const handleScan = async () => {
    if (!fileObj) return
    setScanning(true); setResult(null); setScanError(null); setSaveMsg(null)
    try {
      const form = new FormData()
      form.append('file', fileObj)
      const { data } = await axiosInstance.post('/food/scan', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      })
      setResult(data)
      setSelectedPred(0)
    } catch (err) {
      setScanError(err.response?.data?.message || 'Không thể kết nối tới server. Vui lòng thử lại.')
    } finally {
      setScanning(false)
    }
  }

  const handleAddLog = async () => {
    if (!result?.recognized) return
    const pred = result.predictions[selectedPred]
    setSaving(true); setSaveMsg(null)
    try {
      const payload = new FormData()
      payload.append('foodSlug', pred.slug)
      payload.append('foodName', pred.name)
      payload.append('confidence', pred.confidence ?? '')
      payload.append('servings', String(Number(servings)))
      payload.append('date', date)
      payload.append('mealType', mealType)
      if (fileObj) payload.append('image', fileObj)
      else if (result.nutrition?.imageUrl) payload.append('imageUrl', result.nutrition.imageUrl)

      await axiosInstance.post('/food/meal-logs', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSaveMsg({ type: 'success', text: `Đã thêm "${pred.name}" vào nhật ký ${MEAL_LABELS[mealType]} ngày ${date}!` })
      await loadMealLogs()
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.response?.data?.message || 'Lưu thất bại, vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPreview(null); setFileObj(null); setResult(null)
    setScanError(null); setSaveMsg(null); setSelectedPred(0)
    setCameraOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const openFoodRequest = () => {
    const draft = buildFoodRequestDraft(result, selectedPrediction)
    const shouldCarryScannedImage = Boolean(fileObj && preview)
    setRequestForm(draft)
    setRequestImagePreview(shouldCarryScannedImage ? preview : (draft.imageUrl || null))
    setRequestImageFile(shouldCarryScannedImage ? fileObj : null)
    setRequestListMode(false)
    setRequestFeedback(null)
    setSelectedRequest(null)
    setRequestsExpanded(false)
    setRequestMode(true)
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  const handleRequestChange = (field, value) => {
    setRequestForm((current) => ({ ...current, [field]: value }))
    if (requestFeedback?.type === 'error') setRequestFeedback(null)
  }

  const loadRequestImagePreview = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setRequestFeedback({ type: 'error', text: 'Vui lòng chọn đúng định dạng ảnh.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setRequestFeedback({ type: 'error', text: 'Ảnh minh họa không được vượt quá 5MB.' })
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setRequestImagePreview(event.target.result)
      setRequestImageFile(file)
      setRequestFeedback(null)
    }
    reader.readAsDataURL(file)
  }

  const handleRequestImageChange = (event) => {
    loadRequestImagePreview(event.target.files?.[0])
  }

  const clearRequestImage = () => {
    setRequestImagePreview(null)
    setRequestImageFile(null)
    setRequestForm((current) => ({ ...current, imageUrl: '' }))
    if (requestImageInputRef.current) requestImageInputRef.current.value = ''
  }

  const handleRequestImageDrop = (event) => {
    event.preventDefault()
    loadRequestImagePreview(event.dataTransfer.files?.[0])
  }

  const openRequestsPage = (request = null) => {
    setRequestMode(true)
    setRequestListMode(true)
    setRequestsExpanded(true)
    setSelectedRequest(request)
    loadFoodRequests(true)
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  const handleEditFoodRequest = (request) => {
    if (request.status !== 'Chờ duyệt') return
    setRequestForm({
      name: request.name || '',
      imageUrl: request.imageUrl || '',
      caloriesPer100g: request.caloriesPer100g ?? '',
      proteinPer100g: request.proteinPer100g ?? '',
      carbPer100g: request.carbPer100g ?? '',
      fatPer100g: request.fatPer100g ?? '',
      note: request.note || '',
    })
    setRequestImagePreview(resolveMediaUrl(request.imageUrl))
    setRequestImageFile(null)
    setEditingRequestId(request._id)
    setRequestListMode(false)
    setRequestMode(true)
    setRequestsExpanded(false)
    setRequestFeedback(null)
    setSelectedRequest(null)
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  const handleDeleteFoodRequest = async (request) => {
    if (request.status !== 'Chờ duyệt' || !window.confirm(`Bạn có chắc muốn xóa yêu cầu “${request.name}” không?`)) return
    setDeletingRequestId(request._id)
    setRequestsError(null)
    try {
      await axiosInstance.delete(`/food/requests/${request._id}`)
      if (selectedRequest?._id === request._id) setSelectedRequest(null)
      await loadFoodRequests(true)
    } catch (err) {
      setRequestsError(err.response?.data?.message || 'Không thể xóa yêu cầu. Vui lòng thử lại.')
    } finally {
      setDeletingRequestId(null)
    }
  }

  const handleFoodRequestSubmit = async (event) => {
    event.preventDefault()
    const name = requestForm.name.trim()
    if (!name) {
      setRequestFeedback({ type: 'error', text: 'Vui lòng nhập tên món ăn cần bổ sung.' })
      return
    }

    const isUpdatingRequest = Boolean(editingRequestId)
    setRequestSubmitting(true)
    setRequestFeedback(null)
    try {
      const payload = new FormData()
      payload.append('name', name)
      payload.append('imageUrl', requestForm.imageUrl.trim())
      payload.append('caloriesPer100g', requestForm.caloriesPer100g)
      payload.append('proteinPer100g', requestForm.proteinPer100g)
      payload.append('carbPer100g', requestForm.carbPer100g)
      payload.append('fatPer100g', requestForm.fatPer100g)
      payload.append('note', requestForm.note.trim())
      if (requestImageFile) payload.append('image', requestImageFile)

      const requestConfig = {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
      const { data } = isUpdatingRequest
        ? await axiosInstance.patch(`/food/requests/${editingRequestId}`, payload, requestConfig)
        : await axiosInstance.post('/food/requests', payload, requestConfig)
      if (!isUpdatingRequest) {
        setRequestFeedback({ type: 'success', text: 'Đã gửi yêu cầu bổ sung món ăn. Trạng thái hiện tại: Chờ duyệt.' })
      }
      setRequestImageFile(null)
      if (data.request?.imageUrl) {
        setRequestForm((current) => ({ ...current, imageUrl: data.request.imageUrl }))
        setRequestImagePreview(resolveMediaUrl(data.request.imageUrl))
      }
      if (isUpdatingRequest) {
        setSentRequests((current) => current.map((request) => (
          request._id === editingRequestId ? data.request : request
        )))
        setEditingRequestId(null)
        setRequestsExpanded(true)
        setRequestFeedback(null)
        setSelectedRequest(null)
        setRequestListMode(true)
        setRequestMode(true)
      }
      await loadFoodRequests(isUpdatingRequest ? true : requestsExpanded)
    } catch (err) {
      setRequestFeedback({
        type: 'error',
        text: err.response?.data?.message || (isUpdatingRequest ? 'Không thể cập nhật yêu cầu, vui lòng thử lại.' : 'Không thể gửi yêu cầu, vui lòng thử lại.'),
      })
    } finally {
      setRequestSubmitting(false)
    }
  }

  // ── Render ──
  const dailyCalories = Number(dailyTotals?.calories || 0)
  const calorieProgress = Math.min(100, Math.round((dailyCalories / targetCalories) * 100))
  const recentMeals = [...mealLogs].reverse().slice(0, 3)
  const hasMoreRequests = requestsTotal > 3 || requestsExpanded

  return (
    <div className="dashboard-shell foodscan-shell">
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard"><span><i className="bi bi-leaf-fill" /></span>NutriLens</Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <Link className="active" to="/food-scan">Nhận diện &amp; Đồ ăn</Link>
          <Link to="/dashboard">Luyện tập</Link>
          <Link to="/weight-tracker">Chỉ số &amp; Xu hướng</Link>
          <Link to="/dashboard">Cộng đồng</Link>
          <Link to="/dashboard">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <span className="dashboard-search"><i className="bi bi-search" />Tra cứu thực phẩm, món ăn...</span>
          <button className="foodscan-bell" type="button" aria-label="Thông báo"><i className="bi bi-bell" /></button>
          <div className="profile-menu">
            <button className="dashboard-avatar" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" title="Mở menu tài khoản">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : firstName.charAt(0).toUpperCase()}
            </button>
            {profileOpen && <div className="profile-dropdown" role="menu">
              <div className="profile-name">Xin chào, {firstName}</div>
              <button className="profile-link" onClick={() => navigate('/profile')} role="menuitem"><i className="bi bi-person-circle" /> Hồ sơ cá nhân</button>
              <button className="profile-link" onClick={() => navigate('/weight-tracker')} role="menuitem"><i className="bi bi-activity" /> Tiến trình cân nặng</button>
              <button onClick={handleLogout} role="menuitem"><i className="bi bi-box-arrow-right" /> Đăng xuất</button>
            </div>}
          </div>
        </div>
      </header>

      <main className="dashboard-main foodscan-main">
        {requestMode ? requestListMode ? (
          <FoodRequestListPage
            requests={sentRequests}
            requestsTotal={requestsTotal}
            loading={requestsLoading}
            error={requestsError}
            onBack={() => { setRequestListMode(false); setSelectedRequest(null) }}
            onRefresh={() => loadFoodRequests(true)}
            selectedRequest={selectedRequest}
            onSelectRequest={setSelectedRequest}
            onEditRequest={handleEditFoodRequest}
            onDeleteRequest={handleDeleteFoodRequest}
            deletingRequestId={deletingRequestId}
            onCloseDetail={() => setSelectedRequest(null)}
          />
        ) : (
          <FoodRequestPanel
            form={requestForm}
            feedback={requestFeedback}
            imageInputRef={requestImageInputRef}
            imagePreview={requestImagePreview}
            sentRequests={sentRequests}
            requestsLoading={requestsLoading}
            requestsError={requestsError}
            hasMoreRequests={hasMoreRequests}
            isEditing={Boolean(editingRequestId)}
            submitting={requestSubmitting}
            onBack={() => {
              if (editingRequestId) {
                setRequestListMode(true)
                setRequestFeedback(null)
              } else {
                setRequestMode(false)
              }
            }}
            onChange={handleRequestChange}
            onImageChange={handleRequestImageChange}
            onImageClear={clearRequestImage}
            onImageDrop={handleRequestImageDrop}
            onOpenRequestsPage={openRequestsPage}
            onSubmit={handleFoodRequestSubmit}
          />
        ) : (
          <>
        <section className="fs-page-heading">
          <span className="fs-page-icon"><i className="bi bi-camera-fill" /></span>
          <div>
            <h1>Nhận Diện &amp; Phân Tích Món Ăn</h1>
            <p>Tải lên hoặc chụp ảnh món ăn, hệ thống AI sẽ tự động nhận diện tên món và cung cấp thông tin dinh dưỡng chi tiết.</p>
          </div>
          <span className="fs-system-status"><i className="bi bi-cpu-fill" /><span><strong>CÔNG NGHỆ AI (CNN)</strong><small>Nhận diện chính xác · Nhanh chóng · Đáng tin cậy</small></span></span>
        </section>

        {(scanError || saveMsg?.type === 'error') && <div className="fs-alert error" role="alert"><i className="bi bi-exclamation-triangle-fill" />{scanError || saveMsg?.text}</div>}
        {saveMsg?.type === 'success' && <div className="fs-alert success" role="status"><i className="bi bi-check-circle-fill" />{saveMsg.text}</div>}

        <section className="fs-workspace">
          <article className="fs-panel fs-upload-panel">
            <div className="fs-upload-tabs">
              <button type="button" className={!cameraOpen ? 'active' : ''} onClick={() => fileInputRef.current?.click()}><i className="bi bi-upload" />Tải ảnh lên</button>
              <button type="button" className={cameraOpen ? 'active' : ''} onClick={openCamera}><i className="bi bi-camera-video" />Mở camera</button>
              {preview && <button type="button" className="fs-reset-button" onClick={reset} aria-label="Xóa ảnh"><i className="bi bi-trash3" /></button>}
            </div>
            <div className="fs-upload-grid">
              <div
                className={`fs-dropzone fs-upload-frame ${preview ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={preview ? 'Chọn ảnh khác' : 'Chọn hoặc kéo ảnh món ăn vào đây'}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click() } }}
              >
                {preview ? <>
                  <img className="fs-upload-frame-image" src={preview} alt="Ảnh món ăn đã chọn" />
                  {scanning && <div className="fs-scanning-overlay"><span className="fs-scan-ring" /><strong>AI đang phân tích ảnh...</strong></div>}
                </> : <>
                  <span className="fs-upload-cloud"><i className="bi bi-cloud-arrow-up" /></span>
                  <strong>Kéo và thả ảnh vào đây</strong><span>hoặc</span>
                  <span className="fs-choose-file">Chọn ảnh từ máy</span>
                  <small>Ảnh JPG, PNG, WEBP · ảnh lớn được tự tối ưu</small>
                </>}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(event) => { handleFileChange(event); setCameraOpen(false) }} hidden />
            <div className="fs-upload-actions">
              {preview && <button type="button" className="fs-button secondary" onClick={() => fileInputRef.current?.click()}><i className="bi bi-arrow-repeat" />Đổi ảnh</button>}
              <button type="button" className="fs-button primary" onClick={handleScan} disabled={!fileObj || scanning || preparingImage}>
                <i className={`bi ${scanning || preparingImage ? 'bi-hourglass-split' : 'bi-search'}`} />{preparingImage ? 'Đang xử lý ảnh...' : scanning ? 'Đang nhận diện...' : 'Nhận diện món ăn'}
              </button>
            </div>
          </article>

          <article className="fs-panel fs-top-results">
            <div className="fs-panel-heading"><h2><i className="bi bi-patch-check-fill" />Top 3 kết quả đáng tin cậy nhất</h2><span>AI đề xuất</span></div>
            {result?.manual ? <div className="fs-empty-ranking"><span><i className="bi bi-search" /></span><strong>Đã chọn từ thư viện món ăn</strong><p>Kết quả tra cứu thủ công đang hiển thị bên dưới.</p></div> : result?.predictions?.length ? <div className="fs-prediction-list">
              {result.predictions.slice(0, 3).map((prediction, index) => <button type="button" className={`fs-prediction ${selectedPred === index && result.recognized ? 'selected' : ''}`} key={prediction.slug || prediction.name} onClick={() => result.recognized && setSelectedPred(index)} disabled={!result.recognized}>
                <span className="fs-prediction-rank">{index + 1}</span>
                <span className="fs-prediction-info"><strong>{prediction.name}</strong><ConfidenceBar value={prediction.confidence} /></span>
                {selectedPred === index && result.recognized && <i className="bi bi-check-circle-fill fs-prediction-check" />}
              </button>)}
            </div> : <div className="fs-empty-ranking"><span><i className="bi bi-stars" /></span><strong>Chưa có kết quả nhận diện</strong><p>Tải ảnh món ăn để AI phân tích và xếp hạng các gợi ý phù hợp.</p></div>}
            <div className="fs-top-results-foot"><i className="bi bi-info-circle" />Độ tin cậy được tính theo mức độ phù hợp của hình ảnh.</div>
          </article>
        </section>

        <section className="fs-content-grid">
          <div className="fs-main-column">
            <article className="fs-panel fs-manual-search">
              <div className="fs-panel-heading"><div><h2><i className="bi bi-question-circle-fill" />Món ăn nhận diện chưa chính xác?</h2><p>Tra cứu và chọn món ăn từ thư viện NutriLens.</p></div></div>
              <form className="fs-manual-search-form" onSubmit={(event) => { event.preventDefault(); searchFoodLibrary(foodQuery) }}>
                <label className="fs-manual-search-input"><i className="bi bi-search" /><input type="search" value={foodQuery} onChange={(event) => setFoodQuery(event.target.value)} placeholder="Nhập tên món cần tìm (ví dụ: Bún chả, Cơm tấm...)" aria-label="Tìm món ăn trong thư viện" /></label>
                <button className="fs-button primary" type="submit" disabled={foodSearchLoading}><i className={`bi ${foodSearchLoading ? 'bi-hourglass-split' : 'bi-search'}`} />{foodSearchLoading ? 'Đang tìm...' : 'Tìm kiếm'}</button>
              </form>
              {foodSearchError && <p className="fs-manual-search-error" role="alert">{foodSearchError}</p>}
              <div className="fs-quick-searches"><strong>{foodQuery ? 'Kết quả tìm kiếm:' : 'Gợi ý nhanh:'}</strong>{foodMatches.length ? foodMatches.map((food) => <button type="button" key={food.slug} onClick={() => selectManualFood(food)}>{food.name}{food.calories != null && <small>{roundN(food.calories, 0)} kcal</small>}</button>) : <span>{foodSearchLoading ? 'Đang tải món ăn...' : 'Không tìm thấy món phù hợp.'}</span>}</div>
            </article>

            <article className="fs-panel fs-recognition-panel">
              <div className="fs-panel-heading"><h2><i className={`bi ${result?.recognized ? 'bi-check-circle-fill' : 'bi-camera-fill'}`} />Kết quả nhận diện</h2>{result?.recognized && <span className="fs-recognized-tag">{result.manual ? 'Tra cứu thủ công' : 'Đã xác nhận AI'}</span>}</div>
              {result?.recognized && selectedPrediction ? <div className="fs-recognition-result">
                {preview && <img className="fs-result-image" src={preview} alt={selectedPrediction.name} />}
                <div className="fs-result-copy">
                  <div className="fs-result-title"><h3>{selectedPrediction.name}</h3><span className="fs-vietnam-food">{result.manual ? 'Thư viện món ăn' : 'Món ăn Việt Nam'}</span></div>
                  <p>{result.nutrition?.description || (result.nutrition ? `${result.nutrition.servingSize || 0}g · ${roundN(result.nutrition.calories)} kcal mỗi khẩu phần` : 'AI đã tìm thấy món ăn phù hợp trong cơ sở dữ liệu.')}</p>
                  {!result.manual && <ConfidenceBar value={selectedPrediction.confidence} />}
                </div>
              </div> : result ? <div className="fs-result-empty"><span className="fs-result-empty-icon"><i className="bi bi-exclamation-circle" /></span><div><strong>{result.message || 'Chưa nhận diện được món ăn'}</strong><p>{result.predictions?.length ? 'Hãy chọn lại ảnh rõ hơn hoặc kiểm tra các gợi ý bên cạnh.' : 'Hãy thử ảnh có ánh sáng tốt, nhìn rõ toàn bộ món ăn.'}</p></div></div> : <div className="fs-result-empty"><span className="fs-result-empty-icon"><i className="bi bi-stars" /></span><div><strong>Kết quả phân tích sẽ xuất hiện ở đây</strong><p>Chọn ảnh món ăn và bắt đầu nhận diện để xem tên món cùng độ tin cậy của AI.</p></div></div>}
            </article>

            <article className="fs-panel fs-nutrition-panel" id="fs-nutrition">
              <div className="fs-panel-heading"><div><h2><i className="bi bi-journal-medical" />Thông tin dinh dưỡng (ước tính)</h2><p>Giá trị dinh dưỡng thay đổi theo khẩu phần thực tế.</p></div></div>
              {result?.recognized && result.nutrition ? <>
                <div className="fs-nutrition-controls">
                  <fieldset className="fs-meal-selector"><legend>Bữa ăn áp dụng</legend><div>{Object.entries(MEAL_LABELS).map(([value, label]) => <button type="button" key={value} className={mealType === value ? 'active' : ''} onClick={() => setMealType(value)}>{label}</button>)}</div></fieldset>
                  <label className="fs-nutrition-field"><span>Thời gian ghi nhận</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                  <label className="fs-nutrition-field"><span>Khẩu phần ăn</span><select value={servings} onChange={(event) => setServings(Number(event.target.value))}>{[0.5, 1, 1.5, 2, 3].map((value) => <option key={value} value={value}>{value} khẩu phần ({Math.round((result.nutrition.servingSize || 0) * value)}g)</option>)}</select></label>
                </div>
                <NutritionTable nutrition={result.nutrition} servings={servings} />
                {result.nutrition.fiber != null && <div className="fs-nutrition-note"><i className="bi bi-lightbulb-fill" /><span><strong>Đánh giá dinh dưỡng</strong>Món ăn cung cấp năng lượng và các nhóm chất theo khẩu phần đã chọn.</span></div>}
              </> : <div className="fs-nutrition-empty"><i className="bi bi-bar-chart-line" /><span>{result?.recognized ? 'Chưa có dữ liệu dinh dưỡng cho món này trong hệ thống.' : 'Nhận diện món ăn để xem calories, protein, carbohydrate và chất béo.'}</span></div>}
            </article>
            {result?.recognized && result.nutrition && <div className="fs-nutrition-actions">
              <button type="button" className="fs-request-food-button" onClick={openFoodRequest}><i className="bi bi-patch-plus" />Yêu cầu bổ sung món ăn</button>
              <button type="button" className="fs-button primary" onClick={handleAddLog} disabled={saving}><i className={`bi ${saving ? 'bi-hourglass-split' : 'bi-journal-plus'}`} />{saving ? 'Đang lưu...' : 'Thêm vào nhật ký bữa ăn'}</button>
            </div>}

            <article className="fs-panel fs-recent-meals">
              <div className="fs-panel-heading"><div><h2><i className="bi bi-clock-history" />Nhật ký bữa ăn gần đây</h2><p>Các món bạn đã ghi nhận trong ngày {date.split('-').reverse().join('/')}</p></div><Link to={`/meal-diary?date=${date}`}>Xem chi tiết <i className="bi bi-arrow-right" /></Link></div>
              {logsLoading ? <div className="fs-log-empty"><span className="fs-mini-spinner" />Đang tải nhật ký...</div> : recentMeals.length ? <div className="fs-recent-list">
                {recentMeals.map((log) => <div className="fs-recent-item" key={log._id}>
                  <span className="fs-recent-thumb">{log.imageUrl ? <img src={resolveMediaUrl(log.imageUrl)} alt={log.foodName} onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <i className="bi bi-egg-fried" />}</span>
                  <div><strong>{log.foodName}</strong><small>{MEAL_LABELS[log.mealType] || 'Bữa ăn'} · {log.servings || 1} khẩu phần</small></div>
                  <span className="fs-recent-kcal">{roundN((log.nutrition?.calories || 0) * (log.servings || 1))} kcal</span>
                </div>)}
              </div> : <div className="fs-log-empty"><i className="bi bi-journal-check" />Chưa có món ăn nào được ghi nhận trong ngày này.</div>}
            </article>
          </div>

          <aside className="fs-side-column">
            <article className="fs-panel fs-detail-panel">
              <div className="fs-panel-heading"><h2><i className="bi bi-info-square-fill" />Thông tin chi tiết</h2></div>
              <dl>
                <div><dt>Tên món ăn</dt><dd>{selectedPrediction?.name || result?.nutrition?.foodName || 'Chưa nhận diện'}</dd></div>
                {result?.manual ? <div><dt>Nguồn dữ liệu</dt><dd>Thư viện NutriLens</dd></div> : <div><dt>Độ tin cậy AI</dt><dd>{selectedPrediction ? `${roundN(selectedPrediction.confidence, 0)}%` : '—'}</dd></div>}
                <div><dt>Khẩu phần cơ sở</dt><dd>{result?.nutrition?.servingSize ? `${result.nutrition.servingSize}g` : '—'}</dd></div>
                <div><dt>Loại bữa ăn</dt><dd>{result?.recognized ? MEAL_LABELS[mealType] || '—' : '—'}</dd></div>
              </dl>
              <div className="fs-data-source"><i className="bi bi-shield-check" />Thông tin được đối chiếu với cơ sở dữ liệu dinh dưỡng NutriLens.</div>
            </article>

            <article className="fs-panel fs-calorie-panel">
              <div className="fs-panel-heading"><h2><i className="bi bi-speedometer2" />Giá trị dinh dưỡng theo ngày</h2><span>ước tính</span></div>
              <div className="fs-calorie-summary">
                <div className="fs-calorie-ring" style={{ '--food-progress': `${calorieProgress}%` }}><span><strong>{roundN(dailyCalories, 0)}</strong><small>kcal</small><em>{calorieProgress}%</em></span></div>
                <p>Đã nạp trong ngày<strong>{roundN(dailyCalories, 0)} / {targetCalories.toLocaleString('vi-VN')} kcal</strong><small>{profile?.nutritionGoal?.calorieTarget ? 'Theo mục tiêu dinh dưỡng cá nhân' : 'Mục tiêu tham chiếu 2.000 kcal'}</small></p>
              </div>
              <div className="fs-calorie-progress"><i style={{ width: `${calorieProgress}%` }} /></div>
              <Link to="/profile" className="fs-text-button">Xem chi tiết mục tiêu <i className="bi bi-arrow-right" /></Link>
            </article>

            <div className="fs-encouragement"><span><i className="bi bi-heart-fill" /></span><p><strong>Bạn đang lựa chọn rất tốt!</strong>Hãy duy trì thói quen ghi nhận để theo dõi dinh dưỡng chính xác hơn.</p></div>
          </aside>
        </section>
          </>
        )}
      </main>
      <footer className="dashboard-footer"><span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b>© 2026 NutriLens Health Inc. Dinh dưỡng chính xác bắt đầu từ hiểu rõ bữa ăn.</span><span className="footer-links">Điều khoản dịch vụ · Chính sách bảo mật · Trung tâm hỗ trợ</span></footer>
      {cameraOpen && <div className="fs-camera-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCamera() }}>
        <section className="fs-camera-modal" role="dialog" aria-modal="true" aria-labelledby="fs-camera-title">
          <header className="fs-camera-header">
            <span><i className="bi bi-camera-video-fill" /></span>
            <div><h2 id="fs-camera-title">Chụp ảnh món ăn</h2><p>Đặt món ăn trong khung hình rồi chụp để nhận diện.</p></div>
            <button type="button" onClick={closeCamera} aria-label="Đóng camera"><i className="bi bi-x-lg" /></button>
          </header>
          <div className="fs-camera-stage">
            <video ref={cameraVideoRef} autoPlay playsInline muted aria-label="Hình ảnh trực tiếp từ camera" />
            {!cameraError && <span className="fs-camera-frame" aria-hidden="true" />}
            {cameraLoading && <div className="fs-camera-state"><span className="fs-scan-ring" /><strong>Đang mở camera...</strong></div>}
            {cameraError && <div className="fs-camera-state fs-camera-error" role="alert"><i className="bi bi-camera-video-off-fill" /><strong>Không mở được camera trực tiếp</strong><p>{cameraError}</p></div>}
          </div>
          <div className="fs-camera-actions">
            <button type="button" className="fs-button secondary" onClick={() => { closeCamera(); window.setTimeout(() => fileInputRef.current?.click(), 0) }}><i className="bi bi-images" />Chọn ảnh có sẵn</button>
            <button type="button" className="fs-button primary" onClick={captureCameraImage} disabled={cameraLoading || Boolean(cameraError)}><i className="bi bi-camera-fill" />Chụp ảnh</button>
          </div>
          {cameraError && <button type="button" className="fs-camera-fallback" onClick={() => { closeCamera(); window.setTimeout(() => cameraInputRef.current?.click(), 0) }}><i className="bi bi-phone" />Thử camera của thiết bị</button>}
        </section>
      </div>}
    </div>
  )
}

