import React, { useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { REPORT_REASONS } from './communityUtils'

export default function ReportPostModal({
  postId,
  onClose,
  onSuccess,
  onError,
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [evidencePreview, setEvidencePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')

  if (!postId) return null

  const handleSelectEvidence = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorText('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP...)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorText('Dung lượng ảnh bằng chứng không được vượt quá 5MB')
      return
    }

    if (evidencePreview) {
      URL.revokeObjectURL(evidencePreview)
    }

    setEvidenceFile(file)
    setEvidencePreview(URL.createObjectURL(file))
    setErrorText('')
    e.target.value = ''
  }

  const handleRemoveEvidence = () => {
    setEvidenceFile(null)
    if (evidencePreview) {
      URL.revokeObjectURL(evidencePreview)
    }
    setEvidencePreview(null)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!reason) {
      setErrorText('Vui lòng chọn lý do báo cáo')
      return
    }

    setIsSubmitting(true)
    setErrorText('')

    try {
      const formData = new FormData()
      formData.append('reason', reason)
      if (note) formData.append('note', note)
      if (evidenceFile) {
        formData.append('evidenceImage', evidenceFile)
      }

      await axiosInstance.post(`/community/posts/${postId}/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      onSuccess?.(postId, 'Báo cáo thành công')
      handleClose()
    } catch (err) {
      console.error('[ReportPostModal] Lỗi báo cáo:', err)
      const status = err.response?.status
      const msg = err.response?.data?.message

      if (status === 409) {
        onError?.(msg || 'Bạn đã báo cáo bài đăng này')
        onSuccess?.(postId) // Vẫn đánh dấu là đã reported
        handleClose()
      } else if (status === 400) {
        setErrorText(msg || 'Vui lòng chọn lý do báo cáo')
      } else if (status === 404) {
        onError?.(msg || 'Bài đăng không còn tồn tại')
        handleClose()
      } else {
        setErrorText(msg || 'Không thể gửi báo cáo, vui lòng thử lại')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (evidencePreview) {
      URL.revokeObjectURL(evidencePreview)
    }
    onClose?.()
  }

  return (
    <div
      className="community-modal-backdrop"
      onClick={() => !isSubmitting && handleClose()}
    >
      <div
        className="community-modal"
        style={{
          maxWidth: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-report-post-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="community-modal-header" style={{ flexShrink: 0 }}>
          <h3 id="modal-report-post-title">
            <i className="bi bi-flag-fill" style={{ color: '#ea580c', marginRight: '8px' }} />
            Báo cáo vi phạm bài đăng
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            title="Đóng"
            disabled={isSubmitting}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            className="community-modal-body"
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '16px 20px',
            }}
          >
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '10px', lineHeight: 1.4 }}>
              Vui lòng chọn lý do bài đăng này vi phạm tiêu chuẩn cộng đồng để quản trị viên kiểm duyệt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: reason === r ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                    background: reason === r ? '#fff7ed' : '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: reason === r ? '#9a3412' : '#334155',
                    fontWeight: reason === r ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => {
                      setReason(e.target.value)
                      setErrorText('')
                    }}
                    disabled={isSubmitting}
                    style={{ accentColor: '#ea580c' }}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="report-note-input"
                style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
              >
                Ghi chú chi tiết (không bắt buộc):
              </label>
              <textarea
                id="report-note-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mô tả cụ thể vi phạm nếu có..."
                maxLength={500}
                rows={2}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* ĐÍNH KÈM ẢNH BẰNG CHỨNG */}
            <div>
              <label
                style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
              >
                Ảnh bằng chứng vi phạm (không bắt buộc, tối đa 5MB):
              </label>

              {evidencePreview ? (
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <img
                    src={evidencePreview}
                    alt="Bằng chứng"
                    style={{ maxHeight: '120px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveEvidence}
                    disabled={isSubmitting}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    color: '#64748b',
                    background: '#f8fafc',
                  }}
                >
                  <i className="bi bi-paperclip" style={{ fontSize: '16px' }} />
                  <span>Chọn tệp ảnh đính kèm</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSelectEvidence}
                    disabled={isSubmitting}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {errorText && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="bi bi-exclamation-circle-fill" />
                <span>{errorText}</span>
              </div>
            )}
          </div>

          <div
            className="community-modal-footer"
            style={{ flexShrink: 0, padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}
          >
            <button
              type="button"
              className="community-btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="community-btn-primary"
              style={{ background: '#ea580c', borderColor: '#ea580c' }}
              disabled={isSubmitting || !reason}
            >
              {isSubmitting ? (
                <>
                  <i className="bi bi-arrow-repeat spin" /> Đang gửi...
                </>
              ) : (
                <>
                  <i className="bi bi-flag-fill" /> Gửi báo cáo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
