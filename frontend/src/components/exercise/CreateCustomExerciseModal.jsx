import { useEffect, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { calcCalories } from '../../constants/exerciseConstants'

export default function CreateCustomExerciseModal({
  isOpen,
  initialName = '',
  userWeight = null,
  onClose,
  onCreated,
}) {
  const [customForm, setCustomForm] = useState({
    name: '',
    category: 'cardio',
    intensity: 'Trung bình',
    description: '',
    defaultDurationMinutes: 30,
    imageUrl: '',
    youtubeUrl: '',
  })
  const [customImgTab, setCustomImgTab] = useState('upload') // 'upload' | 'url'
  const [customErr, setCustomErr] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setCustomForm({
        name: initialName || '',
        category: 'cardio',
        intensity: 'Trung bình',
        description: '',
        defaultDurationMinutes: 30,
        imageUrl: '',
        youtubeUrl: '',
      })
      setCustomImgTab('upload')
      setCustomErr('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [isOpen, initialName])

  if (!isOpen) return null

  function handleCustomImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCustomErr('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setCustomErr('Dung lượng ảnh không được vượt quá 10MB')
      return
    }
    setCustomErr('')

    const reader = new FileReader()
    reader.onload = (evt) => {
      const img = new Image()
      img.onload = () => {
        const MAX_SIZE = 800
        let width = img.width
        let height = img.height
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82)
        setCustomForm((p) => ({ ...p, imageUrl: compressedDataUrl }))
      }
      img.onerror = () => {
        setCustomErr('Không thể đọc tệp hình ảnh, vui lòng thử lại.')
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!customForm.name || !customForm.name.trim()) {
      setCustomErr('Vui lòng nhập tên bài tập')
      return
    }
    setSavingCustom(true)
    setCustomErr('')
    try {
      const { data } = await axiosInstance.post('/exercises/custom', customForm)
      onCreated(data.exercise, data.message || 'Tạo bài tập cá nhân thành công')
      onClose()
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể tạo bài tập, vui lòng thử lại'
      setCustomErr(msg)
    } finally {
      setSavingCustom(false)
    }
  }

  const previewMet =
    customForm.intensity === 'Nhẹ' ? 3.5 : customForm.intensity === 'Cao' ? 8.5 : 6.0
  const previewCal = calcCalories(
    previewMet,
    userWeight || 60,
    Number(customForm.defaultDurationMinutes) || 30
  )

  return (
    <div className="ex-overlay" role="dialog" aria-modal="true">
      <div className="ex-dialog">
        <div className="ex-dialog-head">
          <div>
            <small>Danh mục cá nhân</small>
            <h3>Thêm bài tập mới</h3>
          </div>
          <button
            type="button"
            className="ex-dialog-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="ex-dialog-body">
          {/* Tên bài tập */}
          <div className="ex-field">
            <label>
              Tên bài tập <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Đá cầu, Nhảy hiện đại, Pilates, Leo núi..."
              maxLength={100}
              value={customForm.name}
              onChange={(e) => {
                setCustomForm((p) => ({ ...p, name: e.target.value }))
                setCustomErr('')
              }}
              autoFocus
            />
          </div>

          {/* Thể loại */}
          <div className="ex-field">
            <label>Thể loại</label>
            <select
              className="ex-select"
              value={customForm.category}
              onChange={(e) => setCustomForm((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="cardio">Cardio &amp; Vận động</option>
              <option value="strength">Sức mạnh &amp; Gym</option>
              <option value="flexibility">Yoga &amp; Thư giãn</option>
              <option value="sports">Thể thao</option>
            </select>
          </div>

          {/* Mức độ cường độ */}
          <div className="ex-field">
            <label>Cường độ vận động</label>
            <div className="ex-custom-intensities">
              {[
                { id: 'Nhẹ', label: 'Nhẹ', met: 3.5, desc: 'Vận động nhẹ nhàng, thư thả' },
                { id: 'Trung bình', label: 'Trung bình', met: 6.0, desc: 'Vừa phải, toát mồ hôi' },
                { id: 'Cao', label: 'Cao', met: 8.5, desc: 'Vận động nặng, đốt nhiều calo' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  className={`ex-intensity-btn ${customForm.intensity === lvl.id ? 'active' : ''}`}
                  onClick={() => setCustomForm((p) => ({ ...p, intensity: lvl.id }))}
                >
                  <div className="ex-intensity-title">
                    <strong>{lvl.label}</strong>
                    <small>~{lvl.met} MET</small>
                  </div>
                  <span>{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Thời lượng mặc định */}
          <div className="ex-field">
            <label>Thời lượng gợi ý (phút)</label>
            <input
              type="number"
              min="5"
              max="360"
              step="1"
              value={customForm.defaultDurationMinutes}
              onChange={(e) =>
                setCustomForm((p) => ({ ...p, defaultDurationMinutes: e.target.value }))
              }
            />
          </div>

          {/* Hình ảnh (Kết hợp Tải ảnh từ máy & Nhập link URL) */}
          <div className="ex-field">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <label style={{ margin: 0 }}>
                Hình ảnh bài tập <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span>
              </label>
              <div className="ex-img-mode-tabs">
                <button
                  type="button"
                  className={`ex-img-tab-btn ${customImgTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setCustomImgTab('upload')}
                >
                  <i className="bi bi-upload" /> Tải ảnh lên
                </button>
                <button
                  type="button"
                  className={`ex-img-tab-btn ${customImgTab === 'url' ? 'active' : ''}`}
                  onClick={() => setCustomImgTab('url')}
                >
                  <i className="bi bi-link-45deg" /> Nhập link URL
                </button>
              </div>
            </div>

            {customForm.imageUrl ? (
              <div className="ex-img-preview-box">
                <img
                  src={customForm.imageUrl}
                  alt="Xem trước ảnh bài tập"
                  className="ex-img-preview-thumb"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="ex-img-preview-info">
                  <strong>Đã chọn ảnh minh họa</strong>
                  <span>
                    {customForm.imageUrl.startsWith('data:')
                      ? 'Ảnh tải từ thiết bị của bạn'
                      : customForm.imageUrl}
                  </span>
                </div>
                <button
                  type="button"
                  className="ex-btn-clear-img"
                  onClick={() => {
                    setCustomForm((p) => ({ ...p, imageUrl: '' }))
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  title="Xóa ảnh này"
                >
                  <i className="bi bi-trash3" /> Xóa ảnh
                </button>
              </div>
            ) : customImgTab === 'upload' ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCustomImageUpload}
                />
                <div
                  className="ex-img-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <i className="bi bi-cloud-arrow-up" />
                  <div>
                    <strong>Bấm để chọn ảnh từ máy tính / điện thoại</strong>
                    <span>Hỗ trợ JPG, PNG, WebP (Tự động nén tối ưu)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  placeholder="Dán đường link ảnh: https://images.unsplash.com/..."
                  value={customForm.imageUrl || ''}
                  onChange={(e) => setCustomForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Đường link YouTube */}
          <div className="ex-field">
            <label>
              Đường link YouTube hướng dẫn{' '}
              <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span>
            </label>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
              value={customForm.youtubeUrl || ''}
              onChange={(e) => setCustomForm((p) => ({ ...p, youtubeUrl: e.target.value }))}
            />
          </div>

          {/* Mô tả */}
          <div className="ex-field">
            <label>
              Mô tả / Lưu ý{' '}
              <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span>
            </label>
            <input
              type="text"
              maxLength={300}
              placeholder="Ghi chú thêm về dụng cụ, cách tập..."
              value={customForm.description}
              onChange={(e) => setCustomForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          {/* Calo ước tính */}
          <div className="ex-result-simple">
            <i className="bi bi-fire" />
            <span>
              Ước tính tiêu hao:{' '}
              <strong>
                {previewCal} kcal
              </strong>{' '}
              / {Number(customForm.defaultDurationMinutes) || 30} phút
            </span>
          </div>

          {customErr && (
            <div className="ex-inline-err">
              <i className="bi bi-exclamation-circle" /> {customErr}
            </div>
          )}
        </div>

        <div className="ex-dialog-foot">
          <button
            type="button"
            className="ex-btn ex-btn--ghost"
            onClick={onClose}
            disabled={savingCustom}
          >
            Hủy
          </button>
          <button
            type="button"
            className="ex-btn ex-btn--primary"
            onClick={handleSave}
            disabled={savingCustom || !customForm.name.trim()}
          >
            {savingCustom ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> Đang lưu...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle" /> Lưu &amp; Thêm vào danh mục
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
