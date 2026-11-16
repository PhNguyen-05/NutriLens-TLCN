import { useState } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import { QUICK_REJECT_REASONS } from './foodRequestConstants'

export default function FoodRequestRejectModal({
  request,
  onClose,
  onRejected,
}) {
  const isReopenRequest = request.requestType === 'reopen'
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
      onRejected(
        isReopenRequest
          ? 'Đã từ chối đề nghị mở lại món ăn thành công'
          : 'Đã từ chối yêu cầu bổ sung món ăn thành công'
      )
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại')
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
      <section className="user-modal frm-reject-modal" role="dialog" aria-modal="true">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: '#dc2626' }}>
              <i className="bi bi-x-circle-fill" />
            </span>
            <div>
              <h2>{isReopenRequest ? 'Từ chối đề nghị mở lại món' : 'Từ chối yêu cầu bổ sung món'}</h2>
              <small style={{ color: '#7a92a8' }}>
                Món: <strong>{request.foodName}</strong> ({request.requestCode || 'REQ'})
              </small>
            </div>
          </div>
          <button aria-label="Đóng" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errorMsg && (
            <div
              style={{
                padding: '9px 13px',
                borderRadius: 8,
                background: '#fee2e2',
                color: '#b91c1c',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="bi bi-exclamation-circle-fill" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#2b4760',
                display: 'block',
                marginBottom: 5,
              }}
            >
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
              onChange={(e) => {
                setReason(e.target.value)
                setErrorMsg('')
              }}
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
