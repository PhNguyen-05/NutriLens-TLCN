import { useCallback, useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

const PAGE_SIZE = 10

const DEFAULT_FOOD_GROUPS = [
  'Cơm & Xôi',
  'Bún, Mì & Phở',
  'Bánh mì & Sandwich',
  'Bánh truyền thống & Dimsum',
  'Món thịt, cá & Hải sản',
  'Canh, Cháo & Súp',
  'Rau, Gỏi & Salad',
  'Ăn vặt & Đường phố',
  'Tráng miệng & Chè',
  'Đồ uống & Giải khát',
  'Khác',
]

const QUICK_REJECT_REASONS = [
  'Món ăn đã tồn tại trong danh mục chính thức',
  'Thông tin dinh dưỡng chưa chính xác / thiếu nguồn kiểm chứng',
  'Hình ảnh không rõ ràng hoặc không phù hợp tiêu chuẩn',
  'Tên món hoặc mô tả không đúng với văn hóa ẩm thực',
  'Món ăn chế biến theo công thức cá nhân, chưa mang tính đại chúng',
]

function getImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`
}

function formatDateDisplay(dateValue) {
  if (!dateValue) return '—'
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// ─── Toast Component ────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fdm-toast ${type === 'error' ? 'fdm-toast--err' : ''}`}>
      <i className={`bi ${type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`} />
      <span>{message}</span>
    </div>
  )
}

// ─── Review & Approve Modal ─────────────────────────────────────────────────
function FoodRequestReviewModal({
  requestId,
  onClose,
  onApproved,
  onOpenReject,
}) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [requestDetail, setRequestDetail] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [imgFit, setImgFit] = useState('cover')

  // Form states (Admin can edit/supplement missing fields)
  const [form, setForm] = useState({
    foodName: '',
    foodGroup: '',
    servingSize: 100,
    servingLabel: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
    imageUrl: '',
    description: '',
    adminNote: '',
  })

  // Fetch full details and duplicate check
  useEffect(() => {
    let isMounted = true
    async function fetchDetail() {
      setLoading(true)
      setErrorMsg('')
      try {
        const { data } = await axiosInstance.get(`/admin/food-requests/${requestId}`)
        if (!isMounted) return
        const reqData = data.data
        setRequestDetail(reqData)
        setDuplicateWarning(data.duplicateWarning)

        setForm({
          foodName: reqData.foodName || '',
          foodGroup: reqData.foodGroup || '',
          servingSize: reqData.servingSize || 100,
          servingLabel: reqData.servingLabel || `1 Suất (${reqData.servingSize || 100}g)`,
          calories: reqData.calories !== null && reqData.calories !== undefined ? String(reqData.calories) : '',
          protein: reqData.protein !== null && reqData.protein !== undefined ? String(reqData.protein) : '',
          fat: reqData.fat !== null && reqData.fat !== undefined ? String(reqData.fat) : '',
          carbs: reqData.carbs !== null && reqData.carbs !== undefined ? String(reqData.carbs) : '',
          imageUrl: reqData.imageUrl || '',
          description: reqData.description || '',
          adminNote: reqData.adminNote || '',
        })
      } catch (err) {
        if (!isMounted) return
        setErrorMsg(err.response?.data?.message || 'Không thể tải chi tiết yêu cầu')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchDetail()
    return () => {
      isMounted = false
    }
  }, [requestId])

  // Macro calculation helper
  const handleAutoCalcCalories = () => {
    const p = parseFloat(form.protein) || 0
    const f = parseFloat(form.fat) || 0
    const c = parseFloat(form.carbs) || 0
    const calculated = Math.round(p * 4 + c * 4 + f * 9)
    if (calculated > 0) {
      setForm((prev) => ({ ...prev, calories: String(calculated) }))
    }
  }

  // Macro percentage calculation
  const macroPcts = useMemo(() => {
    const p = parseFloat(form.protein) || 0
    const f = parseFloat(form.fat) || 0
    const c = parseFloat(form.carbs) || 0
    const totalEnergy = p * 4 + f * 9 + c * 4
    if (!totalEnergy) return { p: 0, f: 0, c: 0 }
    return {
      p: Math.round(((p * 4) / totalEnergy) * 100),
      f: Math.round(((f * 9) / totalEnergy) * 100),
      c: Math.round(((c * 4) / totalEnergy) * 100),
    }
  }, [form.protein, form.fat, form.carbs])

  const handleApprove = async () => {
    setErrorMsg('')
    // Ràng buộc Luồng ngoại lệ 7c: Thiếu Calo/100g khi Admin nhấn Duyệt
    if (
      form.calories === '' ||
      form.calories === null ||
      form.calories === undefined ||
      isNaN(Number(form.calories)) ||
      Number(form.calories) < 0
    ) {
      setErrorMsg('Vui lòng nhập đầy đủ Calo/100g trước khi duyệt')
      return
    }

    if (!form.foodName.trim()) {
      setErrorMsg('Vui lòng nhập tên món ăn')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        foodName: form.foodName.trim(),
        foodGroup: form.foodGroup.trim() || null,
        servingSize: Number(form.servingSize) || 100,
        servingLabel: form.servingLabel.trim() || `1 Suất (${form.servingSize || 100}g)`,
        calories: Number(form.calories),
        protein: form.protein !== '' ? Number(form.protein) : 0,
        fat: form.fat !== '' ? Number(form.fat) : 0,
        carbs: form.carbs !== '' ? Number(form.carbs) : 0,
        imageUrl: form.imageUrl.trim() || null,
        description: form.description.trim() || null,
        adminNote: form.adminNote.trim() || null,
      }

      const res = await axiosInstance.post(`/admin/food-requests/${requestId}/approve`, payload)
      onApproved(res.data.message || 'Duyệt yêu cầu thành công')
    } catch (err) {
      // Ngoại lệ 7d, 8d
      setErrorMsg(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="user-modal frm-review-modal" role="dialog" aria-modal="true">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: '#009b6d' }}><i className="bi bi-patch-check-fill" /></span>
            <div>
              <h2>Xem xét &amp; Phê duyệt yêu cầu món ăn</h2>
              {requestDetail && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <span className="frm-code-tag">{requestDetail.requestCode || 'REQ-NEW'}</span>
                  <span className="frm-badge frm-badge--pending"><i className="bi bi-circle-fill" /> Chờ phê duyệt</span>
                </div>
              )}
            </div>
          </div>
          <button aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>

        <div className="frm-modal-body-scroll">
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#7a92a8' }}>
              <span className="food-spinner" style={{ marginRight: 8 }} />
              Đang tải dữ liệu và kiểm tra đối chiếu món ăn...
            </div>
          ) : (
            <>
              {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #fca5a5' }}>
                  <i className="bi bi-exclamation-octagon-fill" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Duplicate Detection Alert Banner (Luồng chính 5, Luồng ngoại lệ 5b, 6b) */}
              {duplicateWarning?.isDuplicate && (
                <div className="frm-warning-banner-compact">
                  <div className="frm-warning-compact-title">
                    <i className="bi bi-exclamation-triangle-fill" />
                    <span>Món tương tự trong danh mục:</span>
                  </div>
                  <div className="frm-matched-chips">
                    {duplicateWarning.matchedFoods?.map((f) => (
                      <div className="frm-matched-chip" key={f._id} title={`${f.name} (${f.foodCode}) - ${f.calories} kcal/100g`}>
                        {f.imageUrl ? (
                          <img src={getImageUrl(f.imageUrl)} alt="" />
                        ) : (
                          <i className="bi bi-cup-hot" style={{ fontSize: 11, color: '#8aa2b4' }} />
                        )}
                        <b>{f.name}</b>
                        <small>{f.foodCode}</small>
                        <span className="cal">{f.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="frm-review-grid">
                {/* Left Column: User's original request proposal */}
                <div className="frm-proposal-card">
                  <h3 className="frm-proposal-title">
                    <span>Đề xuất từ người dùng</span>
                    <span style={{ fontSize: 10, color: '#7a92a8', fontWeight: 600 }}>Nguyên bản</span>
                  </h3>

                  {/* Submitter User Box */}
                  <div className="frm-proposal-user">
                    <div className="frm-user-avatar">
                      {requestDetail?.userId?.avatarUrl ? (
                        <img src={getImageUrl(requestDetail.userId.avatarUrl)} alt="" />
                      ) : (
                        requestDetail?.userId?.fullName?.charAt(0)?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {requestDetail?.userId?.fullName || 'Người dùng'}
                      </strong>
                      <small style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {requestDetail?.userId?.email || '—'}
                      </small>
                    </div>
                  </div>

                  {/* Food Image */}
                  <div className="frm-proposal-img-box">
                    {form.imageUrl ? (
                      <>
                        <img
                          src={getImageUrl(form.imageUrl)}
                          alt={form.foodName}
                          style={{ objectFit: imgFit }}
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                        <div className="frm-img-toolbar">
                          <button
                            type="button"
                            className="frm-img-btn"
                            onClick={() => setImgFit((prev) => (prev === 'cover' ? 'contain' : 'cover'))}
                            title={
                              imgFit === 'cover'
                                ? 'Chuyển sang xem trọn vẹn toàn bộ ảnh (không cắt)'
                                : 'Chuyển sang lấp đầy khung ảnh'
                            }
                          >
                            <i className={imgFit === 'cover' ? 'bi bi-aspect-ratio' : 'bi bi-arrows-fullscreen'} />
                            <span>{imgFit === 'cover' ? 'Xem trọn ảnh' : 'Lấp đầy'}</span>
                          </button>
                          <a
                            href={getImageUrl(form.imageUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="frm-img-btn"
                            title="Mở ảnh gốc trong tab mới"
                          >
                            <i className="bi bi-box-arrow-up-right" />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="frm-proposal-img-fallback">
                        <i className="bi bi-card-image" />
                        <span>Không kèm ảnh</span>
                      </div>
                    )}
                  </div>

                  {/* User Proposed Nutrition */}
                  <div className="frm-proposal-nutrition">
                    <div className="frm-proposal-nut-grid">
                      <div>Calo: <b style={{ color: '#00875f' }}>{requestDetail?.calories !== null && requestDetail?.calories !== undefined ? `${requestDetail.calories} kcal` : 'Chưa có'}</b></div>
                      <div>Khẩu phần: <b>{requestDetail?.servingLabel || `${requestDetail?.servingSize || 100}g`}</b></div>
                      <div>Đạm: <b>{requestDetail?.protein !== null && requestDetail?.protein !== undefined ? `${requestDetail.protein}g` : '—'}</b></div>
                      <div>Béo: <b>{requestDetail?.fat !== null && requestDetail?.fat !== undefined ? `${requestDetail.fat}g` : '—'}</b></div>
                      <div>Đường: <b>{requestDetail?.carbs !== null && requestDetail?.carbs !== undefined ? `${requestDetail.carbs}g` : '—'}</b></div>
                      <div>Gửi lúc: <b>{formatDateDisplay(requestDetail?.createdAt)}</b></div>
                    </div>
                  </div>

                  {/* User Note */}
                  {requestDetail?.description && (
                    <div className="frm-proposal-desc" title={requestDetail.description}>
                      <b>Ghi chú:</b> "{requestDetail.description}"
                    </div>
                  )}
                </div>

                {/* Right Column: Admin Edit & Approve Form */}
                <div className="frm-form-card">
                  <h3 className="frm-form-section-title">
                    <i className="bi bi-pencil-square" />
                    <span>Chuẩn hóa thông tin món ăn</span>
                  </h3>

                  <div className="frm-input-grid-2">
                    <div className="frm-field">
                      <label>Tên món ăn <span className="req">*</span></label>
                      <input
                        value={form.foodName}
                        onChange={(e) => setForm({ ...form, foodName: e.target.value })}
                        placeholder="Tên món ăn chính thức"
                      />
                    </div>
                    <div className="frm-field">
                      <label>Nhóm món ăn</label>
                      <select
                        value={form.foodGroup}
                        onChange={(e) => setForm({ ...form, foodGroup: e.target.value })}
                      >
                        <option value="">-- Chọn nhóm món --</option>
                        {DEFAULT_FOOD_GROUPS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="frm-input-grid-2">
                    <div className="frm-field">
                      <label>Định lượng (gram)</label>
                      <input
                        type="number"
                        min="1"
                        value={form.servingSize}
                        onChange={(e) => setForm({ ...form, servingSize: e.target.value })}
                        placeholder="100"
                      />
                    </div>
                    <div className="frm-field">
                      <label>Tên khẩu phần hiển thị</label>
                      <input
                        value={form.servingLabel}
                        onChange={(e) => setForm({ ...form, servingLabel: e.target.value })}
                        placeholder="VD: 1 Suất (100g), 1 Tô (350g)"
                      />
                    </div>
                  </div>

                  {/* Nutrition Fields (Luồng 6, Luồng 7c) */}
                  <div className="frm-input-grid-4">
                    <div className="frm-field frm-field--calo">
                      <label>Calo (kcal) <span className="req">*</span></label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.calories}
                        onChange={(e) => setForm({ ...form, calories: e.target.value })}
                        placeholder="Bắt buộc *"
                        className={errorMsg && !form.calories ? 'has-error' : ''}
                      />
                    </div>
                    <div className="frm-field">
                      <label>Đạm (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.protein}
                        onChange={(e) => setForm({ ...form, protein: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="frm-field">
                      <label>Béo (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.fat}
                        onChange={(e) => setForm({ ...form, fat: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="frm-field">
                      <label>Đường / Carbs (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.carbs}
                        onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {/* Macro Calculator & Distribution Bar in 1 compact line */}
                  <div className="frm-macro-tool">
                    <div className="frm-macro-bar-wrap">
                      <div className="frm-macro-bar-track">
                        <div className="frm-macro-bar-p" style={{ width: `${macroPcts.p}%` }} title={`Đạm: ${macroPcts.p}%`} />
                        <div className="frm-macro-bar-c" style={{ width: `${macroPcts.c}%` }} title={`Carbs: ${macroPcts.c}%`} />
                        <div className="frm-macro-bar-f" style={{ width: `${macroPcts.f}%` }} title={`Béo: ${macroPcts.f}%`} />
                      </div>
                      <div className="frm-macro-legend">
                        <span><i className="bi bi-circle-fill" style={{ color: '#3b82f6', fontSize: 7 }} /> Đạm: <b>{macroPcts.p}%</b></span>
                        <span><i className="bi bi-circle-fill" style={{ color: '#f59e0b', fontSize: 7 }} /> Carbs: <b>{macroPcts.c}%</b></span>
                        <span><i className="bi bi-circle-fill" style={{ color: '#ef4444', fontSize: 7 }} /> Béo: <b>{macroPcts.f}%</b></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="frm-macro-calc-btn"
                      onClick={handleAutoCalcCalories}
                      title="Tính calo = Đạm*4 + Carbs*4 + Béo*9"
                    >
                      <i className="bi bi-lightning-charge-fill" /> Tính Calo tự động
                    </button>
                  </div>

                  {/* Image URL & Admin Note in 1 row */}
                  <div className="frm-input-grid-2">
                    <div className="frm-field">
                      <label>URL Hình ảnh</label>
                      <input
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://... hoặc /uploads/foods/..."
                      />
                    </div>
                    <div className="frm-field">
                      <label>Ghi chú Admin (nội bộ)</label>
                      <input
                        value={form.adminNote}
                        onChange={(e) => setForm({ ...form, adminNote: e.target.value })}
                        placeholder="Ghi chú đối soát hoặc nguồn..."
                      />
                    </div>
                  </div>

                  <div className="frm-field">
                    <label>Mô tả món ăn chính thức</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Mô tả nguyên liệu, hương vị..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <footer className="fm-detail-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <button
              type="button"
              className="frm-btn frm-btn--reject"
              onClick={() => onOpenReject(requestDetail || { _id: requestId })}
              disabled={submitting || loading}
            >
              <i className="bi bi-x-circle" /> Từ chối yêu cầu này
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="frm-btn frm-btn--detail"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="frm-btn frm-btn--review"
              onClick={handleApprove}
              disabled={submitting || loading}
            >
              {submitting ? (
                <>
                  <span className="food-spinner-inline" /> Đang phê duyệt...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" /> Phê duyệt &amp; Thêm vào danh mục
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

// ─── Reject Modal (Luồng thay thế 6a, 7a, 8a, 9a) ───────────────────────────
function FoodRequestRejectModal({
  request,
  onClose,
  onRejected,
}) {
  const [reason, setReason] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSelectQuickReason = (text) => {
    setReason(text)
    setErrorMsg('')
  }

  const handleConfirmReject = async () => {
    const trimmed = reason.trim()
    // Luồng thay thế 7a: Hệ thống hiển thị ô nhập lý do từ chối (bắt buộc)
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập lý do từ chối trước khi tiếp tục')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      await axiosInstance.post(`/admin/food-requests/${request._id}/reject`, {
        reason: trimmed,
        adminNote: adminNote.trim() || null,
      })
      onRejected('Đã từ chối yêu cầu bổ sung món ăn thành công')
    } catch (err) {
      // Ngoại lệ 7d, 8d
      setErrorMsg(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="user-modal frm-reject-modal" role="dialog" aria-modal="true">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: '#dc2626' }}><i className="bi bi-x-circle-fill" /></span>
            <div>
              <h2>Từ chối yêu cầu bổ sung món</h2>
              <small style={{ color: '#7a92a8' }}>
                Món: <strong>{request.foodName}</strong> ({request.requestCode || 'REQ'})
              </small>
            </div>
          </div>
          <button aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errorMsg && (
            <div style={{ padding: '9px 13px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-exclamation-circle-fill" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#2b4760', display: 'block', marginBottom: 5 }}>
              Lý do từ chối mẫu (bấm để chọn nhanh):
            </label>
            <div className="frm-reject-chips">
              {QUICK_REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`frm-chip ${reason === r ? 'selected' : ''}`}
                  onClick={() => handleSelectQuickReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="frm-field">
            <label>
              <span>Lý do từ chối (bắt buộc gửi cho người dùng)</span>
              <span className="req">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setErrorMsg('') }}
              placeholder="Nhập lý do từ chối chi tiết..."
              style={{ height: 80 }}
            />
          </div>

          <div className="frm-field">
            <label>Ghi chú nội bộ Admin (tùy chọn)</label>
            <input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Ghi chú thêm chỉ hiển thị cho quản trị viên"
            />
          </div>
        </div>

        <footer className="fm-detail-footer">
          <button type="button" className="frm-btn frm-btn--detail" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </button>
          <button
            type="button"
            className="frm-btn frm-btn--reject"
            style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
            onClick={handleConfirmReject}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="food-spinner-inline" /> Đang từ chối...
              </>
            ) : (
              <>
                <i className="bi bi-slash-circle" /> Xác nhận từ chối
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Detail Modal for Approved / Rejected Requests ──────────────────────────
function FoodRequestDetailModal({ request, onClose }) {
  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="user-modal" style={{ width: 'min(580px, calc(100vw - 32px))' }} role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>Chi tiết yêu cầu món ăn</h2>
            <small style={{ color: '#7a92a8' }}>
              Mã: <strong>{request.requestCode || 'REQ'}</strong> • Trạng thái:{' '}
              {request.status === 'approved' ? 'Đã duyệt' : request.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
            </small>
          </div>
          <button aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {request.imageUrl ? (
              <img
                src={getImageUrl(request.imageUrl)}
                alt={request.foodName}
                style={{ width: 68, height: 68, borderRadius: 10, objectFit: 'cover', border: '1px solid #dce8f2' }}
              />
            ) : (
              <div style={{ width: 68, height: 68, borderRadius: 10, background: '#f0f5fa', display: 'grid', placeItems: 'center', color: '#90a4b8' }}>
                <i className="bi bi-cup-hot" style={{ fontSize: 24 }} />
              </div>
            )}
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#162e43' }}>{request.foodName}</h3>
              <div style={{ fontSize: 12, color: '#688297' }}>
                Nhóm: <b>{request.foodGroup || 'Chưa phân loại'}</b> • Khẩu phần: <b>{request.servingLabel || `${request.servingSize || 100}g`}</b>
              </div>
              <div style={{ fontSize: 12, color: '#00875f', fontWeight: 700, marginTop: 2 }}>
                {request.calories !== null ? `${request.calories} kcal / 100g` : 'Chưa có thông tin Calo'}
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e7eff5', fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <div>Người đề xuất: <strong>{request.userId?.fullName || 'N/A'}</strong></div>
              <div>Email: <strong>{request.userId?.email || 'N/A'}</strong></div>
              <div>Ngày gửi: <strong>{formatDateDisplay(request.createdAt)}</strong></div>
              <div>Người duyệt: <strong>{request.reviewedBy?.fullName || 'Admin'}</strong></div>
            </div>
          </div>

          {request.status === 'rejected' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                <i className="bi bi-x-circle-fill" style={{ marginRight: 6 }} />
                Lý do từ chối:
              </div>
              <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>{request.rejectionReason || 'Không có lý do cụ thể'}</div>
            </div>
          )}

          {request.status === 'approved' && request.approvedFoodId && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 14px', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: 6 }} />
                Món ăn chính thức trong danh mục:
              </div>
              <div style={{ fontSize: 12.5, color: '#047857' }}>
                Mã món: <strong>{request.approvedFoodId.foodCode}</strong> — {request.approvedFoodId.name} ({request.approvedFoodId.calories} kcal)
              </div>
            </div>
          )}

          {request.adminNote && (
            <div style={{ fontSize: 12, color: '#5b758b', background: '#f4f7fa', padding: '8px 12px', borderRadius: 6 }}>
              <b>Ghi chú Admin:</b> {request.adminNote}
            </div>
          )}
        </div>

        <footer className="fm-detail-footer">
          <button type="button" className="frm-btn frm-btn--detail" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────
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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          {search && (
            <button className="fdm-search-clear" onClick={() => { setSearch(''); setPage(1) }}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        <label className="fdm-filter-select">
          <i className="bi bi-funnel" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
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
            onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
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
                <th className="fdm-th-center" style={{ width: 150 }}>Dinh dưỡng đề xuất</th>
                <th className="fdm-th-center" style={{ width: 130 }}>Trạng thái</th>
                <th className="fdm-th-center" style={{ width: 170 }}>Thao tác</th>
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
                            <small>{item.foodGroup || 'Chưa phân loại'}</small>
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
                        {item.calories !== null && item.calories !== undefined ? (
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
