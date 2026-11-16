import { getImageUrl, formatDateDisplay } from './foodRequestConstants'

export default function FoodRequestDetailModal({ request, onClose }) {
  const isReopenRequest = request.requestType === 'reopen'
  const feedbackReasons = {
    reopen: 'Đề nghị mở lại món ăn',
    nutrition: 'Thông tin dinh dưỡng chưa chính xác',
    name_image: 'Tên món ăn hoặc hình ảnh chưa chính xác',
    other: 'Khác',
  }

  return (
    <div
      className="user-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="user-modal"
        style={{ width: 'min(580px, calc(100vw - 32px))' }}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <h2>{isReopenRequest ? 'Chi tiết đề nghị mở lại món' : 'Chi tiết yêu cầu món ăn'}</h2>
            <small style={{ color: '#7a92a8' }}>
              Mã: <strong>{request.requestCode || 'REQ'}</strong> • Trạng thái:{' '}
              {request.status === 'approved'
                ? 'Đã duyệt'
                : request.status === 'rejected'
                ? 'Đã từ chối'
                : 'Chờ duyệt'}
            </small>
          </div>
          <button aria-label="Đóng" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {request.imageUrl ? (
              <img
                src={getImageUrl(request.imageUrl)}
                alt={request.foodName}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 10,
                  objectFit: 'cover',
                  border: '1px solid #dce8f2',
                }}
              />
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 10,
                  background: '#f0f5fa',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#90a4b8',
                }}
              >
                <i className="bi bi-cup-hot" style={{ fontSize: 24 }} />
              </div>
            )}
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#162e43' }}>{request.foodName}</h3>
              {isReopenRequest ? (
                <div style={{ fontSize: 12, color: '#688297' }}>
                  Lý do: <b>{feedbackReasons[request.feedbackReason] || 'Khác'}</b>
                  {request.note && <div style={{ marginTop: 3 }}>Nội dung: {request.note}</div>}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#688297' }}>
                    Nhóm: <b>{request.foodGroup || 'Chưa phân loại'}</b> • Khẩu phần:{' '}
                    <b>{request.servingLabel || `${request.servingSize || 100}g`}</b>
                  </div>
                  <div style={{ fontSize: 12, color: '#00875f', fontWeight: 700, marginTop: 2 }}>
                    {request.calories !== null ? `${request.calories} kcal / 100g` : 'Chưa có thông tin Calo'}
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e7eff5',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <div>
                Người đề xuất: <strong>{request.userId?.fullName || 'N/A'}</strong>
              </div>
              <div>
                Email: <strong>{request.userId?.email || 'N/A'}</strong>
              </div>
              <div>
                Ngày gửi: <strong>{formatDateDisplay(request.createdAt)}</strong>
              </div>
              <div>
                Người duyệt: <strong>{request.reviewedBy?.fullName || 'Admin'}</strong>
              </div>
            </div>
          </div>

          {request.status === 'rejected' && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '12px 14px',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                <i className="bi bi-x-circle-fill" style={{ marginRight: 6 }} />
                Lý do từ chối:
              </div>
              <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>
                {request.rejectionReason || 'Không có lý do cụ thể'}
              </div>
            </div>
          )}

          {request.status === 'approved' && request.approvedFoodId && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '12px 14px',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: 6 }} />
                {isReopenRequest ? 'Món ăn đã được kích hoạt lại:' : 'Món ăn chính thức trong danh mục:'}
              </div>
              <div style={{ fontSize: 12.5, color: '#047857' }}>
                Mã món: <strong>{request.approvedFoodId.foodCode}</strong> — {request.approvedFoodId.name} (
                {request.approvedFoodId.calories} kcal)
              </div>
            </div>
          )}

          {request.adminNote && (
            <div
              style={{
                fontSize: 12,
                color: '#5b758b',
                background: '#f4f7fa',
                padding: '8px 12px',
                borderRadius: 6,
              }}
            >
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
