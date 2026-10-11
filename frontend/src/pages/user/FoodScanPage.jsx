/**
 * FoodScanPage.jsx
 * UC13 — Nhận diện món ăn qua ảnh và thêm vào nhật ký bữa ăn.
 */

import { useState, useRef, useCallback } from 'react'
import axiosInstance from '../../api/axiosInstance'

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

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thanh confidence với màu động */
function ConfidenceBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 600, minWidth: 40 }}>{pct}%</span>
    </div>
  )
}

/** Bảng dinh dưỡng */
function NutritionTable({ nutrition, servings }) {
  if (!nutrition) return null
  const s = servings || 1
  const rows = [
    { label: 'Năng lượng',    value: roundN(nutrition.calories * s), unit: 'kcal' },
    { label: 'Chất đạm',     value: roundN(nutrition.protein  * s), unit: 'g' },
    { label: 'Chất béo',     value: roundN(nutrition.fat      * s), unit: 'g' },
    { label: 'Carbohydrate', value: roundN(nutrition.carbs    * s), unit: 'g' },
    { label: 'Chất xơ',      value: roundN(nutrition.fiber    * s), unit: 'g' },
  ]
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ background: '#f3f4f6' }}>
          <th style={th}>Chất dinh dưỡng</th>
          <th style={{ ...th, textAlign: 'right' }}>Lượng ({s} khẩu phần)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderBottom: '1px solid #e5e7eb' }}>
            <td style={td}>{r.label}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
              {r.value} {r.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
const th = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }
const td = { padding: '8px 12px', color: '#4b5563' }

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FoodScanPage() {
  const fileInputRef = useRef(null)

  // Ảnh preview
  const [preview, setPreview]     = useState(null)   // data URL
  const [fileObj, setFileObj]     = useState(null)   // File object

  // Kết quả AI
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState(null)   // { recognized, predictions, nutrition, message }
  const [scanError, setScanError] = useState(null)

  // Form thêm vào nhật ký
  const [selectedPred, setSelectedPred] = useState(0)   // index trong predictions
  const [servings, setServings]         = useState(1)
  const [date, setDate]                 = useState(todayString)
  const [mealType, setMealType]         = useState('lunch')

  // Trạng thái lưu nhật ký
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)  // { type:'success'|'error', text }

  // ── Handlers ──

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null); setScanError(null); setSaveMsg(null); setSelectedPred(0)
    setFileObj(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) { fileInputRef.current.files = e.dataTransfer.files; handleFileChange({ target: { files: [file] } }) }
  }, [handleFileChange])

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
      await axiosInstance.post('/food/meal-logs', {
        foodSlug:   pred.slug,
        foodName:   pred.name,
        confidence: pred.confidence,
        servings:   Number(servings),
        date,
        mealType,
      })
      setSaveMsg({ type: 'success', text: `Đã thêm "${pred.name}" vào nhật ký ${MEAL_LABELS[mealType]} ngày ${date}!` })
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.response?.data?.message || 'Lưu thất bại, vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPreview(null); setFileObj(null); setResult(null)
    setScanError(null); setSaveMsg(null); setSelectedPred(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ──
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#111827' }}>
        🍽️ Nhận diện món ăn
      </h2>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Chụp hoặc tải ảnh món ăn để nhận diện tự động bằng AI và tra cứu dinh dưỡng.
      </p>

      {/* ── Upload zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !preview && fileInputRef.current?.click()}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: 12,
          padding: preview ? 0 : '40px 24px',
          textAlign: 'center',
          cursor: preview ? 'default' : 'pointer',
          background: preview ? 'transparent' : '#f9fafb',
          overflow: 'hidden',
          marginBottom: 16,
          transition: 'border-color 0.2s',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 10, display: 'block' }}
          />
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Kéo thả hoặc <strong>bấm vào đây</strong> để chọn ảnh</p>
            <p style={{ color: '#9ca3af', fontSize: 12 }}>Hỗ trợ: JPG, PNG · Tối đa 5MB</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* ── Buttons ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {preview && (
          <button onClick={() => fileInputRef.current?.click()} style={btnSecondary}>
            🔄 Đổi ảnh
          </button>
        )}
        <button
          onClick={handleScan}
          disabled={!fileObj || scanning}
          style={{ ...btnPrimary, opacity: (!fileObj || scanning) ? 0.6 : 1, flex: 1 }}
        >
          {scanning ? '⏳ Đang nhận diện...' : '🔍 Nhận diện món ăn'}
        </button>
        {preview && (
          <button onClick={reset} style={btnDanger}>✕</button>
        )}
      </div>

      {/* ── Lỗi scan ── */}
      {scanError && (
        <div style={{ ...alertBox, background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
          ⚠️ {scanError}
        </div>
      )}

      {/* ── Kết quả AI ── */}
      {result && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {/* Header */}
          <div style={{
            background: result.recognized ? '#f0fdf4' : '#fef9c3',
            borderBottom: '1px solid #e5e7eb',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 20 }}>{result.recognized ? '✅' : '⚠️'}</span>
            <span style={{ fontWeight: 600, color: result.recognized ? '#15803d' : '#92400e' }}>
              {result.recognized ? 'Nhận diện thành công!' : (result.message || 'Không nhận diện được')}
            </span>
          </div>

          <div style={{ padding: 16 }}>
            {/* Danh sách dự đoán */}
            {result.predictions?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                  {result.recognized ? 'Chọn món để thêm vào nhật ký:' : 'Gợi ý (độ tin cậy thấp):'}
                </p>
                {result.predictions.map((p, i) => (
                  <div
                    key={p.slug}
                    onClick={() => result.recognized && setSelectedPred(i)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      marginBottom: 6,
                      border: `2px solid ${selectedPred === i && result.recognized ? '#16a34a' : '#e5e7eb'}`,
                      background: selectedPred === i && result.recognized ? '#f0fdf4' : '#fafafa',
                      cursor: result.recognized ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {i === 0 && result.recognized && '🥇 '}{p.name}
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{p.slug}</span>
                    </div>
                    <ConfidenceBar value={p.confidence} />
                  </div>
                ))}
              </div>
            )}

            {/* Dinh dưỡng top-1 */}
            {result.recognized && result.nutrition && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
                  📊 Dinh dưỡng — {result.nutrition.foodName} ({result.nutrition.servingSize}g / khẩu phần)
                </p>
                <NutritionTable nutrition={result.nutrition} servings={servings} />
              </div>
            )}

            {result.recognized && !result.nutrition && (
              <p style={{ color: '#d97706', fontSize: 13, marginBottom: 12 }}>
                ℹ️ Chưa có dữ liệu dinh dưỡng cho món này trong hệ thống.
              </p>
            )}

            {/* Form thêm nhật ký */}
            {result.recognized && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                  📝 Thêm vào nhật ký bữa ăn
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <label style={formGroup}>
                    <span style={labelStyle}>Ngày</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
                  </label>
                  <label style={formGroup}>
                    <span style={labelStyle}>Bữa</span>
                    <select value={mealType} onChange={(e) => setMealType(e.target.value)} style={inputStyle}>
                      {Object.entries(MEAL_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label style={formGroup}>
                    <span style={labelStyle}>Số khẩu phần</span>
                    <input
                      type="number" min="0.5" max="10" step="0.5"
                      value={servings}
                      onChange={(e) => setServings(Math.max(0.5, Math.min(10, Number(e.target.value))))}
                      style={{ ...inputStyle, width: 80 }}
                    />
                  </label>
                </div>

                <button
                  onClick={handleAddLog}
                  disabled={saving}
                  style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '⏳ Đang lưu...' : '➕ Thêm vào nhật ký'}
                </button>

                {saveMsg && (
                  <div style={{
                    ...alertBox,
                    marginTop: 10,
                    background: saveMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    borderColor: saveMsg.type === 'success' ? '#86efac' : '#fca5a5',
                    color:       saveMsg.type === 'success' ? '#15803d' : '#b91c1c',
                  }}>
                    {saveMsg.type === 'success' ? '✅ ' : '❌ '}{saveMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline styles ──────────────────────────────────────────────────────────────
const base = {
  border: 'none', borderRadius: 8, padding: '10px 18px',
  fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.2s',
}
const btnPrimary   = { ...base, background: '#16a34a', color: '#fff' }
const btnSecondary = { ...base, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }
const btnDanger    = { ...base, background: '#fee2e2', color: '#b91c1c', padding: '10px 14px' }
const alertBox     = { padding: '10px 14px', borderRadius: 8, border: '1px solid', fontSize: 14 }
const formGroup    = { display: 'flex', flexDirection: 'column', gap: 4 }
const labelStyle   = { fontSize: 12, color: '#6b7280', fontWeight: 600 }
const inputStyle   = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 14, color: '#111827', background: '#fff',
}
