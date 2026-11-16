import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import {
  DEFAULT_FOOD_GROUPS,
  getImageUrl,
  formatDateDisplay,
} from './foodRequestConstants'

export default function FoodRequestReviewModal({
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
  const [confirmCalorieDiscrepancy, setConfirmCalorieDiscrepancy] = useState(false)

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
      setConfirmCalorieDiscrepancy(false)
      setErrorMsg('')
    }
  }

  // Macro percentage calculation & discrepancy checking
  const macroStats = useMemo(() => {
    const p = parseFloat(form.protein) || 0
    const f = parseFloat(form.fat) || 0
    const c = parseFloat(form.carbs) || 0
    const totalEnergy = Math.round(p * 4 + f * 9 + c * 4)
    const userCal = parseFloat(form.calories)

    let discrepancyPercent = 0
    let isDiscrepancySignificant = false

    if (totalEnergy > 0 && Number.isFinite(userCal) && userCal >= 0) {
      const diff = Math.abs(userCal - totalEnergy)
      discrepancyPercent = Math.round((diff / Math.max(totalEnergy, userCal)) * 100)
      isDiscrepancySignificant = discrepancyPercent > 25 && diff > 30
    } else if (totalEnergy === 0 && Number.isFinite(userCal) && userCal > 30) {
      isDiscrepancySignificant = true
      discrepancyPercent = 100
    }

    const pctP = totalEnergy ? Math.round(((p * 4) / totalEnergy) * 100) : 0
    const pctF = totalEnergy ? Math.round(((f * 9) / totalEnergy) * 100) : 0
    const pctC = totalEnergy ? Math.round(((c * 4) / totalEnergy) * 100) : 0

    return {
      totalEnergy,
      discrepancyPercent,
      isDiscrepancySignificant,
      p: pctP,
      f: pctF,
      c: pctC,
    }
  }, [form.protein, form.fat, form.carbs, form.calories])

  const handleApprove = async () => {
    setErrorMsg('')
    if (requestDetail?.requestType === 'reopen') {
      setSubmitting(true)
      try {
        const res = await axiosInstance.post(`/admin/food-requests/${requestId}/approve`, {
          adminNote: form.adminNote.trim() || null,
        })
        onApproved(res.data.message || 'Đã kích hoạt lại món ăn')
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Không thể kích hoạt lại món ăn')
      } finally {
        setSubmitting(false)
      }
      return
    }

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

    // Kiểm tra tính hợp lý Calo vs Macro trước khi gửi
    if (macroStats.isDiscrepancySignificant && !confirmCalorieDiscrepancy) {
      setErrorMsg(
        `Lượng Calo khai báo (${form.calories} kcal) lệch ${macroStats.discrepancyPercent}% so với nhiệt lượng tính từ Macro (~${macroStats.totalEnergy} kcal = 4×P + 4×C + 9×F). Vui lòng bấm "Tính Calo tự động" hoặc tích xác nhận số liệu này trước khi duyệt.`
      )
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
        confirmCalorieDiscrepancy,
      }

      const res = await axiosInstance.post(`/admin/food-requests/${requestId}/approve`, payload)
      onApproved(res.data.message || 'Duyệt yêu cầu thành công')
    } catch (err) {
      const resData = err.response?.data
      if (resData?.canConfirmDiscrepancy) {
        setErrorMsg(`${resData.message} (Tích vào ô xác nhận để cho phép duyệt)`)
      } else {
        setErrorMsg(resData?.message || 'Thao tác thất bại, vui lòng thử lại')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="user-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="user-modal frm-review-modal" role="dialog" aria-modal="true">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: '#009b6d' }}>
              <i className="bi bi-patch-check-fill" />
            </span>
            <div>
              <h2>
                {requestDetail?.requestType === 'reopen'
                  ? 'Xem xét đề nghị mở lại món ăn'
                  : 'Xem xét & Phê duyệt yêu cầu món ăn'}
              </h2>
              {requestDetail && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <span className="frm-code-tag">{requestDetail.requestCode || 'REQ-NEW'}</span>
                  <span className="frm-badge frm-badge--pending">
                    <i className="bi bi-circle-fill" /> Chờ phê duyệt
                  </span>
                </div>
              )}
            </div>
          </div>
          <button aria-label="Đóng" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
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
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#fee2e2',
                    color: '#b91c1c',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #fca5a5',
                  }}
                >
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
                      <div
                        className="frm-matched-chip"
                        key={f._id}
                        title={`${f.name} (${f.foodCode}) - ${f.calories} kcal/100g`}
                      >
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

              {requestDetail?.requestType === 'reopen' && (
                <section
                  style={{
                    display: 'grid',
                    gap: 12,
                    padding: 16,
                    border: '1px solid #e2e9ec',
                    borderRadius: 8,
                    background: '#f8fafb',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(requestDetail.targetFoodId?.imageUrl || requestDetail.imageUrl) && (
                      <img
                        src={getImageUrl(requestDetail.targetFoodId?.imageUrl || requestDetail.imageUrl)}
                        alt={requestDetail.foodName}
                        style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
                      />
                    )}
                    <div>
                      <strong style={{ color: '#243c43', fontSize: 16 }}>
                        {requestDetail.targetFoodId?.name || requestDetail.foodName}
                      </strong>
                      <div style={{ marginTop: 4, color: '#b66b18', fontSize: 12, fontWeight: 700 }}>
                        Món hiện đang ẩn
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#526a64', fontSize: 13 }}>
                    <strong>Lý do:</strong>{' '}
                    {{
                      reopen: 'Đề nghị mở lại món ăn',
                      nutrition: 'Thông tin dinh dưỡng chưa chính xác',
                      name_image: 'Tên món ăn hoặc hình ảnh chưa chính xác',
                      other: 'Khác',
                    }[requestDetail.feedbackReason] || 'Khác'}
                  </div>
                  <div style={{ color: '#526a64', fontSize: 13 }}>
                    <strong>Nội dung phản hồi:</strong> {requestDetail.note || 'Không có nội dung bổ sung.'}
                  </div>
                  <label className="frm-field">
                    <span>Ghi chú Admin (nội bộ)</span>
                    <input
                      value={form.adminNote}
                      onChange={(event) => setForm({ ...form, adminNote: event.target.value })}
                      placeholder="Ghi chú khi xử lý đề nghị"
                    />
                  </label>
                  <p style={{ margin: 0, color: '#71837e', fontSize: 12 }}>
                    Chỉ thao tác duyệt mới kích hoạt lại món trong danh mục.
                  </p>
                </section>
              )}

              <div
                className="frm-review-grid"
                style={requestDetail?.requestType === 'reopen' ? { display: 'none' } : undefined}
              >
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
                      <strong
                        style={{
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {requestDetail?.userId?.fullName || 'Người dùng'}
                      </strong>
                      <small
                        style={{
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
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
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
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
                      <div>
                        Calo:{' '}
                        <b style={{ color: '#00875f' }}>
                          {requestDetail?.calories !== null && requestDetail?.calories !== undefined
                            ? `${requestDetail.calories} kcal`
                            : 'Chưa có'}
                        </b>
                      </div>
                      <div>
                        Khẩu phần:{' '}
                        <b>{requestDetail?.servingLabel || `${requestDetail?.servingSize || 100}g`}</b>
                      </div>
                      <div>
                        Đạm:{' '}
                        <b>
                          {requestDetail?.protein !== null && requestDetail?.protein !== undefined
                            ? `${requestDetail.protein}g`
                            : '—'}
                        </b>
                      </div>
                      <div>
                        Béo:{' '}
                        <b>
                          {requestDetail?.fat !== null && requestDetail?.fat !== undefined
                            ? `${requestDetail.fat}g`
                            : '—'}
                        </b>
                      </div>
                      <div>
                        Đường:{' '}
                        <b>
                          {requestDetail?.carbs !== null && requestDetail?.carbs !== undefined
                            ? `${requestDetail.carbs}g`
                            : '—'}
                        </b>
                      </div>
                      <div>
                        Gửi lúc: <b>{formatDateDisplay(requestDetail?.createdAt)}</b>
                      </div>
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
                      <label>
                        Tên món ăn <span className="req">*</span>
                      </label>
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
                          <option key={g} value={g}>
                            {g}
                          </option>
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
                      <label>
                        Calo (kcal) <span className="req">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.calories}
                        onChange={(e) => {
                          setForm({ ...form, calories: e.target.value })
                          setConfirmCalorieDiscrepancy(false)
                        }}
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
                        onChange={(e) => {
                          setForm({ ...form, protein: e.target.value })
                          setConfirmCalorieDiscrepancy(false)
                        }}
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
                        onChange={(e) => {
                          setForm({ ...form, fat: e.target.value })
                          setConfirmCalorieDiscrepancy(false)
                        }}
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
                        onChange={(e) => {
                          setForm({ ...form, carbs: e.target.value })
                          setConfirmCalorieDiscrepancy(false)
                        }}
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {/* Macro Calculator & Distribution Bar in 1 compact line */}
                  <div className="frm-macro-tool">
                    <div className="frm-macro-bar-wrap">
                      <div className="frm-macro-bar-track">
                        <div
                          className="frm-macro-bar-p"
                          style={{ width: `${macroStats.p}%` }}
                          title={`Đạm: ${macroStats.p}%`}
                        />
                        <div
                          className="frm-macro-bar-c"
                          style={{ width: `${macroStats.c}%` }}
                          title={`Carbs: ${macroStats.c}%`}
                        />
                        <div
                          className="frm-macro-bar-f"
                          style={{ width: `${macroStats.f}%` }}
                          title={`Béo: ${macroStats.f}%`}
                        />
                      </div>
                      <div className="frm-macro-legend">
                        <span>
                          <i className="bi bi-circle-fill" style={{ color: '#3b82f6', fontSize: 7 }} /> Đạm:{' '}
                          <b>{macroStats.p}%</b>
                        </span>
                        <span>
                          <i className="bi bi-circle-fill" style={{ color: '#f59e0b', fontSize: 7 }} /> Carbs:{' '}
                          <b>{macroStats.c}%</b>
                        </span>
                        <span>
                          <i className="bi bi-circle-fill" style={{ color: '#ef4444', fontSize: 7 }} /> Béo:{' '}
                          <b>{macroStats.f}%</b>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="frm-macro-calc-btn"
                      onClick={handleAutoCalcCalories}
                      title="Tính calo = Đạm*4 + Carbs*4 + Béo*9"
                    >
                      <i className="bi bi-lightning-charge-fill" /> Tính Calo tự động (~{macroStats.totalEnergy} kcal)
                    </button>
                  </div>

                  {/* Cảnh báo Calo vs Macro nếu chênh lệch đáng kể */}
                  {macroStats.isDiscrepancySignificant && (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 8,
                        fontSize: 12.5,
                        color: '#92400e',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div>
                        <i className="bi bi-exclamation-triangle-fill" style={{ color: '#d97706', marginRight: 6 }} />
                        <strong>Cảnh báo độ lệch ({macroStats.discrepancyPercent}%):</strong> Calo nhập (
                        <b>{form.calories} kcal</b>) lệch so với nhiệt lượng từ Macro (~
                        <b>{macroStats.totalEnergy} kcal</b> = 4×P + 4×C + 9×F).
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#78350f' }}>
                        <input
                          type="checkbox"
                          checked={confirmCalorieDiscrepancy}
                          onChange={(e) => setConfirmCalorieDiscrepancy(e.target.checked)}
                        />
                        <span>Tôi xác nhận số liệu này là đúng thực tế (do chất xơ, cồn...)</span>
                      </label>
                    </div>
                  )}

                  {/* Image URL & Admin Note in 1 row */}
                  <div className="frm-input-grid-2">
                    <div className="frm-field">
                      <label>URL Hình ảnh</label>
                      <input
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://res.cloudinary.com/..."
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
                  <i className="bi bi-check2-circle" />{' '}
                  {requestDetail?.requestType === 'reopen'
                    ? 'Kích hoạt lại món ăn'
                    : 'Phê duyệt & Thêm vào danh mục'}
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
