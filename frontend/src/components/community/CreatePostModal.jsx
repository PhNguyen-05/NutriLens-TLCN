import React, { useState, useEffect, useRef, useMemo } from 'react'
import axiosInstance from '../../api/axiosInstance'
import {
  COMMUNITY_TAGS,
  TAG_COLOR_MAP,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  resolveMediaUrl,
  normalizeVietnamese,
} from './communityUtils'

export default function CreatePostModal({
  isOpen,
  user,
  initialTag = 'Chia sẻ chung',
  onClose,
  onPostCreated,
  onError,
}) {
  const [postContent, setPostContent] = useState('')
  const [postTag, setPostTag] = useState(initialTag)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  // Nutrition state
  const [showNutritionInputs, setShowNutritionInputs] = useState(initialTag === 'Công thức món ăn')
  const [nutrition, setNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })

  // Mention autocomplete state
  const [mentionData, setMentionData] = useState({ users: [], tags: [] })
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(0)
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)

  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const mentionMenuRef = useRef(null)

  const firstName = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(-1)[0]
    : 'bạn'

  // Reset tag when initialTag changes
  useEffect(() => {
    if (isOpen) {
      setPostTag(initialTag)
      setShowNutritionInputs(initialTag === 'Công thức món ăn')
    }
  }, [isOpen, initialTag])

  // Load mention suggestions
  useEffect(() => {
    if (!isOpen) return
    let isActive = true
    axiosInstance
      .get('/community/mention-suggestions')
      .then(({ data }) => {
        if (!isActive) return
        setMentionData({
          users: Array.isArray(data?.users) ? data.users : [],
          tags:
            Array.isArray(data?.tags) && data.tags.length > 0
              ? data.tags
              : COMMUNITY_TAGS.filter((t) => t !== 'Tất cả'),
        })
      })
      .catch((err) => {
        console.error('[CreatePostModal] Lỗi tải mention suggestions:', err)
      })

    return () => {
      isActive = false
    }
  }, [isOpen])

  // Click outside to close mention dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target)
      ) {
        setShowMentionMenu(false)
      }
    }

    if (showMentionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMentionMenu])

  // Filter mentions
  const filteredMentions = useMemo(() => {
    if (!showMentionMenu) return []
    const normQuery = normalizeVietnamese(mentionQuery)

    const matchedUsers = (mentionData.users || [])
      .filter((u) => {
        if (!normQuery) return true
        return (
          normalizeVietnamese(u.fullName).includes(normQuery) ||
          normalizeVietnamese(u.email).includes(normQuery)
        )
      })
      .slice(0, 8)
      .map((u) => ({
        type: 'user',
        id: u.id || u._id,
        text: u.fullName,
        subtitle: u.role === 'admin' ? 'Quản trị viên' : u.email || 'Thành viên',
        avatarUrl: u.avatarUrl,
        role: u.role,
      }))

    const allTags =
      mentionData.tags && mentionData.tags.length > 0
        ? mentionData.tags
        : COMMUNITY_TAGS.filter((t) => t !== 'Tất cả')

    const matchedTags = allTags
      .filter((t) => {
        if (t === 'Tất cả') return false
        if (!normQuery) return true
        return normalizeVietnamese(t).includes(normQuery)
      })
      .map((t) => {
        const meta = TAG_COLOR_MAP[t] || {
          bg: '#ecfdf5',
          text: '#059669',
          icon: 'bi-tag',
        }
        return {
          type: 'tag',
          id: t,
          text: t,
          subtitle: 'Chủ đề bài viết',
          icon: meta.icon,
          color: meta.text,
          bg: meta.bg,
        }
      })

    return [...matchedUsers, ...matchedTags]
  }, [showMentionMenu, mentionQuery, mentionData])

  function handleCancel() {
    setPostContent('')
    setSelectedImageFile(null)
    setShowMentionMenu(false)
    setMentionQuery('')
    setShowNutritionInputs(false)
    setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl('')
    }
    setFeedbackError('')
    onClose?.()
  }

  function validateAndSetImage(file) {
    if (!file) return

    const fileType = (file.type || '').toLowerCase()
    const fileName = (file.name || '').toLowerCase()
    const hasValidMime = ALLOWED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/')
    const hasValidExt = /\.(jpe?g|png|webp|gif|jfif|bmp)$/i.test(fileName)

    if (!hasValidMime && !hasValidExt) {
      setFeedbackError('Hình ảnh không hợp lệ. Vui lòng chọn ảnh có định dạng JPG, PNG, WEBP hoặc GIF.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFeedbackError('Hình ảnh không hợp lệ. Dung lượng ảnh không được vượt quá 5MB.')
      return
    }

    setFeedbackError('')
    setSelectedImageFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreviewUrl(preview)
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    validateAndSetImage(file)
  }

  function handleFileDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    validateAndSetImage(file)
  }

  function handleRemoveImage() {
    setSelectedImageFile(null)
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl('')
    }
  }

  function detectMentionTrigger(text, cursorPos) {
    const leftText = text.slice(0, cursorPos)
    const match = /(?:^|\s)@([a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9\s]*)$/.exec(leftText)

    if (match) {
      const atIndex = match.index + (match[0].startsWith(' ') ? 1 : 0)
      const query = match[1]
      setMentionStartIndex(atIndex)
      setMentionCursorIndex(cursorPos)
      setMentionQuery(query)
      setShowMentionMenu(true)
      setActiveMentionIndex(0)
    } else {
      setShowMentionMenu(false)
    }
  }

  function handleTextareaChange(e) {
    const text = e.target.value
    const cursorPos = e.target.selectionStart
    setPostContent(text)
    detectMentionTrigger(text, cursorPos)
  }

  function handleTextareaCursorMove(e) {
    const cursorPos = e.target.selectionStart
    detectMentionTrigger(e.target.value, cursorPos)
  }

  function handleSelectMention(item) {
    const beforeAt = postContent.slice(0, mentionStartIndex)
    const afterCursor = postContent.slice(mentionCursorIndex)
    const inserted = `@${item.text} `
    const newContent = `${beforeAt}${inserted}${afterCursor}`

    setPostContent(newContent)
    setShowMentionMenu(false)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursor = mentionStartIndex + inserted.length
        textareaRef.current.setSelectionRange(newCursor, newCursor)
      }
    }, 0)
  }

  function handleInsertQuickTag(tag) {
    const tagText = `@${tag} `
    const current = postContent
    const updated = current ? `${current.trim()} ${tagText}` : tagText
    setPostContent(updated)
    setPostTag(tag)
    if (tag === 'Công thức món ăn') {
      setShowNutritionInputs(true)
    }
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(updated.length, updated.length)
      }
    }, 0)
  }

  function handleTextareaKeyDown(e) {
    if (!showMentionMenu || filteredMentions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveMentionIndex((prev) => (prev + 1) % filteredMentions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredMentions[activeMentionIndex]
      if (selected) {
        handleSelectMention(selected)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowMentionMenu(false)
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setFeedbackError('')

    const trimmedContent = postContent.trim()
    if (!trimmedContent) {
      setFeedbackError('Nội dung bài viết không được để trống')
      return
    }

    const resolvedTag = postTag || 'Chia sẻ chung'
    setSubmitLoading(true)

    try {
      const formData = new FormData()
      formData.append('content', trimmedContent)
      formData.append('tag', resolvedTag)
      if (selectedImageFile) {
        formData.append('image', selectedImageFile)
      }

      const hasNutrition = Boolean(
        nutrition.calories !== '' ||
        nutrition.protein !== '' ||
        nutrition.carbs !== '' ||
        nutrition.fat !== ''
      )
      if (hasNutrition) {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: nutrition.calories !== '' ? Number(nutrition.calories) : null,
            protein: nutrition.protein !== '' ? Number(nutrition.protein) : null,
            carbs: nutrition.carbs !== '' ? Number(nutrition.carbs) : null,
            fat: nutrition.fat !== '' ? Number(nutrition.fat) : null,
          })
        )
      }

      const { data } = await axiosInstance.post('/community/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      handleCancel()
      onPostCreated?.(data.post, data.message || 'Đăng bài thành công')
    } catch (err) {
      console.error('[CreatePostModal] Lỗi đăng bài:', err)
      const errorMsg =
        err.response?.data?.message || 'Không thể đăng bài, vui lòng thử lại'
      setFeedbackError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setSubmitLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="community-modal-backdrop" onClick={handleCancel}>
      <div
        className="community-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-create-post-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TIÊU ĐỀ MODAL */}
        <div className="community-modal-header">
          <h3 id="modal-create-post-title">Tạo bài viết</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleCancel}
            title="Hủy đăng bài"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="community-modal-body">
          {/* THÔNG TIN NGƯỜI ĐĂNG */}
          <div className="modal-user-row">
            {user?.avatarUrl ? (
              <img
                src={resolveMediaUrl(user.avatarUrl)}
                alt={user.fullName}
                className="avatar-sm"
              />
            ) : (
              <div className="avatar-sm-fallback">{firstName.charAt(0).toUpperCase()}</div>
            )}
            <div>
              <strong className="modal-user-name">{user?.fullName || 'Bạn'}</strong>
              <div className="modal-privacy-chip">
                <i className="bi bi-globe2" /> Công khai
              </div>
            </div>
          </div>

          {/* CHỌN TAG / CHỦ ĐỀ */}
          <div className="modal-tag-selector">
            <label htmlFor="post-tag-select">
              <i className="bi bi-tag-fill" /> Chọn chủ đề bài viết:
            </label>
            <select
              id="post-tag-select"
              value={postTag}
              onChange={(e) => setPostTag(e.target.value)}
            >
              {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* NHẬP NỘI DUNG BÀI VIẾT */}
          <div className="modal-textarea-wrap">
            <div className="quick-mention-bar">
              <span className="quick-mention-label">
                <i className="bi bi-magic" /> Gợi ý gắn thẻ:
              </span>
              <div className="quick-mention-chips">
                {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="quick-mention-chip"
                    onClick={() => handleInsertQuickTag(tag)}
                    title={`Bấm để chèn @${tag}`}
                  >
                    <i className="bi bi-at" />{tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={5}
              placeholder={`${firstName} ơi, bạn muốn chia sẻ điều gì về dinh dưỡng, công thức hay bài tập hôm nay? Gõ @ để gắn thẻ thành viên hoặc chủ đề...`}
              value={postContent}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              onClick={handleTextareaCursorMove}
              onKeyUp={handleTextareaCursorMove}
              autoFocus
            />

            {/* POPUP MENU GỢI Ý KHI GÕ @ */}
            {showMentionMenu && (
              <div className="mention-dropdown-menu" ref={mentionMenuRef}>
                <div className="mention-dropdown-header">
                  <div className="mention-header-title">
                    <i className="bi bi-at" /> Gợi ý gắn thẻ {mentionQuery ? `cho "${mentionQuery}"` : ''}
                  </div>
                  <button
                    type="button"
                    className="mention-dropdown-close"
                    onClick={() => setShowMentionMenu(false)}
                    title="Đóng menu gợi ý (Esc)"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>

                <div className="mention-dropdown-body">
                  {filteredMentions.length === 0 ? (
                    <div className="mention-empty-hint">
                      <i className="bi bi-search" /> Không tìm thấy gợi ý phù hợp
                    </div>
                  ) : (
                    filteredMentions.map((item, index) => {
                      const isActive = index === activeMentionIndex
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className={`mention-item ${isActive ? 'is-active' : ''}`}
                          onMouseEnter={() => setActiveMentionIndex(index)}
                          onClick={() => handleSelectMention(item)}
                        >
                          {item.type === 'user' ? (
                            <div className="mention-avatar-wrap">
                              {item.avatarUrl ? (
                                <img
                                  src={resolveMediaUrl(item.avatarUrl)}
                                  alt={item.text}
                                  className="mention-avatar"
                                />
                              ) : (
                                <div className="mention-avatar-fallback">
                                  {item.text.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="mention-tag-icon"
                              style={{ backgroundColor: item.bg, color: item.color }}
                            >
                              <i className={`bi ${item.icon}`} />
                            </div>
                          )}

                          <div className="mention-item-info">
                            <div className="mention-item-name">
                              <span className="mention-item-at">@</span>
                              <strong>{item.text}</strong>
                              {item.role === 'admin' && (
                                <span className="mention-badge-admin">Admin</span>
                              )}
                              {item.type === 'tag' && (
                                <span className="mention-badge-tag">Chủ đề</span>
                              )}
                            </div>
                            <div className="mention-item-sub">{item.subtitle}</div>
                          </div>

                          <div className="mention-item-enter-hint">
                            <i className="bi bi-arrow-return-left" />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="mention-dropdown-footer">
                  <span>
                    Dùng <strong>↑</strong> <strong>↓</strong> và <strong>Enter</strong> để chọn, <strong>Esc</strong> để thoát
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ĐÍNH KÈM HÌNH ẢNH */}
          <div className="modal-media-section">
            {imagePreviewUrl ? (
              <div className="modal-image-preview-box">
                <img src={imagePreviewUrl} alt="Xem trước ảnh minh họa" />
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={handleRemoveImage}
                  title="Gỡ ảnh minh họa"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              </div>
            ) : (
              <div
                className="modal-upload-trigger"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <i className="bi bi-image" />
                <div>
                  <strong>Thêm hình ảnh minh họa cho bài viết</strong>
                  <small>Hỗ trợ định dạng JPG, PNG, WEBP tối đa 5MB</small>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          </div>

          {/* ĐÍNH KÈM THÔNG SỐ DINH DƯỠNG */}
          {!showNutritionInputs ? (
            <button
              type="button"
              className="nutrition-toggle-btn"
              onClick={() => setShowNutritionInputs(true)}
            >
              <i className="bi bi-shield-check" />
              <span>Đính kèm thông số dinh dưỡng (Calo, Protein, Carbs, Fat)</span>
            </button>
          ) : (
            <div className="nutrition-fields-panel">
              <div className="nutrition-fields-header">
                <span>
                  <i className="bi bi-fire" /> Thông số dinh dưỡng món ăn (Tùy chọn)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNutritionInputs(false)
                    setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="bi bi-x-lg" /> Bỏ đính kèm
                </button>
              </div>
              <div className="nutrition-grid">
                <div className="nutrition-input-col">
                  <label htmlFor="create-calories">
                    <i className="bi bi-fire" style={{ color: '#ea580c' }} /> Calo (kcal)
                  </label>
                  <input
                    id="create-calories"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="VD: 420"
                    value={nutrition.calories}
                    onChange={(e) => setNutrition((prev) => ({ ...prev, calories: e.target.value }))}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="create-protein">🥩 Protein (g)</label>
                  <input
                    id="create-protein"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 35"
                    value={nutrition.protein}
                    onChange={(e) => setNutrition((prev) => ({ ...prev, protein: e.target.value }))}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="create-carbs">🍚 Carbs (g)</label>
                  <input
                    id="create-carbs"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 40"
                    value={nutrition.carbs}
                    onChange={(e) => setNutrition((prev) => ({ ...prev, carbs: e.target.value }))}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="create-fat">🥑 Fat (g)</label>
                  <input
                    id="create-fat"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 12"
                    value={nutrition.fat}
                    onChange={(e) => setNutrition((prev) => ({ ...prev, fat: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {feedbackError && (
            <div className="modal-inline-error">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{feedbackError}</span>
            </div>
          )}

          <div className="community-modal-footer">
            <button
              type="button"
              className="community-btn-secondary"
              onClick={handleCancel}
              disabled={submitLoading}
            >
              Hủy thao tác
            </button>
            <button
              type="submit"
              className="community-btn-primary"
              disabled={submitLoading || !postContent.trim()}
            >
              {submitLoading ? (
                <>
                  <i className="bi bi-arrow-repeat spin" /> Đang đăng...
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill" /> Đăng bài
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
