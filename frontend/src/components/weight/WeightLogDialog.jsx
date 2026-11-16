import React from 'react'
import { getLocalDateValue, formatLogDate } from '../../constants/healthConstants'

export default function WeightLogDialog({
  open,
  onClose,
  weightModalRef,
  weightForm,
  setWeightForm,
  weightError,
  setWeightError,
  weightDiffWarning,
  setWeightDiffWarning,
  confirmOverwrite,
  setConfirmOverwrite,
  savingWeight,
  handleSaveWeight,
}) {
  if (!open) return null

  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={weightModalRef}
        className="hp-weight-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="hp-weight-modal__header">
          <div>
            <span>Theo dõi tiến trình</span>
            <h2 id="wt-dialog-title">Ghi nhận cân nặng</h2>
          </div>
          <button
            type="button"
            className="hp-weight-modal__close"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSaveWeight(false)
          }}
          noValidate
        >
          <div className={`hp-field ${weightError.field === 'weight' ? 'is-invalid' : ''}`}>
            <label htmlFor="wt-weightInput">Cân nặng (kg)</label>
            <div className="hp-unit-input">
              <input
                id="wt-weightInput"
                type="number"
                min="20"
                max="300"
                step="0.1"
                inputMode="decimal"
                placeholder="ví dụ: 62.5"
                autoFocus
                value={weightForm.weightKg}
                onChange={(e) => {
                  setWeightForm((c) => ({ ...c, weightKg: e.target.value }))
                  setWeightError({ field: '', message: '' })
                  setConfirmOverwrite(false)
                  setWeightDiffWarning(false)
                }}
              />
              <span>kg</span>
            </div>
            {weightError.field === 'weight' && (
              <span className="hp-field__error">{weightError.message}</span>
            )}
          </div>

          <div className={`hp-field ${weightError.field === 'date' ? 'is-invalid' : ''}`}>
            <label htmlFor="wt-dateInput">Ngày ghi nhận</label>
            <input
              id="wt-dateInput"
              type="date"
              max={getLocalDateValue()}
              value={weightForm.recordedDate}
              onChange={(e) => {
                setWeightForm((c) => ({ ...c, recordedDate: e.target.value }))
                setWeightError({ field: '', message: '' })
                setConfirmOverwrite(false)
                setWeightDiffWarning(false)
              }}
            />
            {weightError.field === 'date' && (
              <span className="hp-field__error">{weightError.message}</span>
            )}
          </div>

          {/* Cảnh báo mềm chênh lệch (3-5 kg trong 1 ngày) */}
          {weightDiffWarning && (
            <div className="hp-advice-note hp-advice-note--warning" style={{ margin: '12px 0' }}>
              <i className="bi bi-exclamation-triangle-fill" />
              <div>
                Số cân bạn nhập (<strong>{weightForm.weightKg} kg</strong>) chênh lệch <b>{weightDiffWarning.diffKg} kg</b> so với lần ghi nhận gần nhất ({weightDiffWarning.lastWeight} kg).
                Bạn có chắc chắn số liệu này là chính xác?
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="wt-btn-inline wt-btn-inline--confirm"
                    onClick={() => handleSaveWeight(true)}
                    disabled={savingWeight}
                  >
                    Đúng, tiếp tục lưu
                  </button>
                  <button
                    type="button"
                    className="wt-btn-inline"
                    onClick={() => setWeightDiffWarning(false)}
                  >
                    Kiểm tra lại
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm ghi đè ngày cũ & hiển thị số lần sửa */}
          {confirmOverwrite && (
            <div className="hp-weight-modal__confirm" role="alert">
              <i className="bi bi-exclamation-circle" />
              <div>
                <p style={{ margin: 0 }}>
                  Bạn đã có bản ghi cân nặng ngày{' '}
                  <strong>{formatLogDate(weightForm.recordedDate)}</strong>. Bạn có muốn cập nhật lại thành <strong>{weightForm.weightKg} kg</strong> không?
                </p>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  <i className="bi bi-arrow-repeat" /> Đã cập nhật: <b>{confirmOverwrite.currentUpdateCount || 0}/5 lần</b>
                  {confirmOverwrite.remainingUpdates <= 0 ? (
                    <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '6px' }}>
                      (Đã hết lượt sửa hôm nay)
                    </span>
                  ) : (
                    <span style={{ color: '#059669', marginLeft: '6px' }}>
                      (Còn <b>{confirmOverwrite.remainingUpdates}</b> lần sửa hôm nay)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="hp-weight-modal__cancel"
                  onClick={() => setConfirmOverwrite(false)}
                  disabled={savingWeight}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="hp-weight-modal__save"
                  onClick={() => handleSaveWeight(true)}
                  disabled={savingWeight || (confirmOverwrite.remainingUpdates <= 0)}
                >
                  Cập nhật
                </button>
              </div>
            </div>
          )}

          {!confirmOverwrite && !weightDiffWarning && (
            <div className="hp-weight-modal__actions">
              <button
                type="button"
                className="hp-weight-modal__cancel"
                onClick={onClose}
                disabled={savingWeight}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="hp-weight-modal__save"
                disabled={savingWeight}
              >
                {savingWeight ? 'Đang lưu…' : 'Lưu bản ghi'}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
