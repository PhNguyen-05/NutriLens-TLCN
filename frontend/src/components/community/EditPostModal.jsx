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

export default function EditPostModal({
  post,
  user,
  onClose,
  onPostUpdated,
  onError,
}) {
  const [editContent, setEditContent] = useState('')
  const [editTag, setEditTag] = useState('Chia sẻ chung')
  const [editSelectedImageFile, setEditSelectedImageFile] = useState(null)
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState('')
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  // Nutrition state
  const [editShowNutritionInputs, setEditShowNutritionInputs] = useState(false)
  const [editNutrition, setEditNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })

  // Mention autocomplete state
  const [mentionData, setMentionData] = useState({ users: [], tags: [] })
  const [editShowMentionMenu, setEditShowMentionMenu] = useState(false)
  const [editMentionQuery, setEditMentionQuery] = useState('')
  const [editMentionStartIndex, setEditMentionStartIndex] = useState(0)
  const [editMentionCursorIndex, setEditMentionCursorIndex] = useState(0)
  const [editActiveMentionIndex, setEditActiveMentionIndex] = useState(0)

  const editFileInputRef = useRef(null)
  const editTextareaRef = useRef(null)
  const editMentionMenuRef = useRef(null)

  const firstName = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(-1)[0]
    : 'bạn'

  // Initialize state from post
  useEffect(() => {
    if (post) {
      setEditContent(post.content || '')
      setEditTag(post.tag || 'Chia sẻ chung')
      setEditSelectedImageFile(null)
      setEditImagePreviewUrl(post.imageUrl ? resolveMediaUrl(post.imageUrl) : '')
      setEditRemoveImage(false)
      setEditShowMentionMenu(false)
      setEditMentionQuery('')
      setEditActiveMentionIndex(0)
      setFeedbackError('')

      const postNutr = post.nutrition || {}
      const hasNutr = Boolean(
        postNutr.calories != null ||
        postNutr.protein != null ||
        postNutr.carbs != null ||
        postNutr.fat != null
      )
      setEditNutrition({
        calories: postNutr.calories != null ? String(postNutr.calories) : '',
        protein: postNutr.protein != null ? String(postNutr.protein) : '',
        carbs: postNutr.carbs != null ? String(postNutr.carbs) : '',
        fat: postNutr.fat != null ? String(postNutr.fat) : '',
      })
      setEditShowNutritionInputs(hasNutr)
    }
  }, [post])

  // Load mention suggestions
  useEffect(() => {
    if (!post) return
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
        console.error('[EditPostModal] Lỗi tải mention suggestions:', err)
      })

    return () => {
      isActive = false
    }
  }, [post])

  // Click outside to close mention dropdown
  useEffect(() => {
    function handleClickOutsideEdit(e) {
      if (
        editMentionMenuRef.current &&
        !editMentionMenuRef.current.contains(e.target) &&
        editTextareaRef.current &&
        !editTextareaRef.current.contains(e.target)
      ) {
        setEditShowMentionMenu(false)
      }
    }

    if (editShowMentionMenu) {
      document.addEventListener('mousedown', handleClickOutsideEdit)
      return () => document.removeEventListener('mousedown', handleClickOutsideEdit)
    }
  }, [editShowMentionMenu])

  const filteredEditMentions = useMemo(() => {
    if (!editShowMentionMenu) return []
    const normQuery = normalizeVietnamese(editMentionQuery)

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
  }, [editShowMentionMenu, editMentionQuery, mentionData])

  function handleCancel() {
    setEditContent('')
    setEditSelectedImageFile(null)
    if (editImagePreviewUrl && editImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreviewUrl)
    }
    setEditImagePreviewUrl('')
    setEditRemoveImage(false)
    setEditShowMentionMenu(false)
    setEditMentionQuery('')
    setEditShowNutritionInputs(false)
    setEditNutrition({ calories: '', protein: '', carbs: '', fat: '' })
    setFeedbackError('')
    onClose?.()
  }

  function validateAndSetEditImage(file) {
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
    setEditSelectedImageFile(file)
    setEditRemoveImage(false)
    const preview = URL.createObjectURL(file)
    setEditImagePreviewUrl(preview)
  }

  function handleEditFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    validateAndSetEditImage(file)
  }

  function handleEditFileDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    validateAndSetEditImage(file)
  }

  function handleRemoveEditImage() {
    setEditSelectedImageFile(null)
    if (editImagePreviewUrl && editImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreviewUrl)
    }
    setEditImagePreviewUrl('')
    setEditRemoveImage(true)
  }

  function checkEditMentionTrigger(text, cursor) {
    const textBefore = text.slice(0, cursor)
    const match = textBefore.match(/(?:^|\s)@([^\n\r@]{0,25})$/)
    if (match) {
      const atSymbolOffset = match[0].indexOf('@')
      const atIndex = match.index + atSymbolOffset
      const query = match[1]

      if (query.split(/\s+/).length <= 2) {
        setEditShowMentionMenu(true)
        setEditMentionQuery(query)
        setEditMentionStartIndex(atIndex)
        setEditMentionCursorIndex(cursor)
        setEditActiveMentionIndex(0)
        return
      }
    }
    setEditShowMentionMenu(false)
  }

  function handleEditTextareaChange(e) {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setEditContent(value)
    if (feedbackError) setFeedbackError('')
    checkEditMentionTrigger(value, cursor)
  }

  function handleEditTextareaCursorMove(e) {
    checkEditMentionTrigger(e.target.value, e.target.selectionStart)
  }

  function handleEditTextareaKeyDown(e) {
    if (!editShowMentionMenu || filteredEditMentions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setEditActiveMentionIndex((prev) => (prev + 1) % filteredEditMentions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setEditActiveMentionIndex(
        (prev) => (prev - 1 + filteredEditMentions.length) % filteredEditMentions.length
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selectedItem = filteredEditMentions[editActiveMentionIndex]
      if (selectedItem) {
        handleSelectEditMention(selectedItem)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditShowMentionMenu(false)
    }
  }

  function handleSelectEditMention(item) {
    const before = editContent.slice(0, editMentionStartIndex)
    const after = editContent.slice(editMentionCursorIndex)
    const mentionText = `@${item.text} `
    const nextContent = `${before}${mentionText}${after}`

    setEditContent(nextContent)
    setEditShowMentionMenu(false)

    if (item.type === 'tag') {
      setEditTag(item.text)
    }

    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus()
        const newPos = editMentionStartIndex + mentionText.length
        editTextareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 10)
  }

  function handleInsertEditQuickTag(tagName) {
    const tagText = `@${tagName} `
    let nextContent = editContent
    if (!nextContent) {
      nextContent = tagText
    } else if (nextContent.endsWith(' ')) {
      nextContent += tagText
    } else {
      nextContent += ' ' + tagText
    }
    setEditContent(nextContent)
    setEditTag(tagName)
    setEditShowMentionMenu(false)
    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus()
        const len = nextContent.length
        editTextareaRef.current.setSelectionRange(len, len)
      }
    }, 10)
  }

  async function handleSubmitEditPost(e) {
    if (e) e.preventDefault()
    if (!post) return

    const trimmed = editContent.trim()
    if (!trimmed) {
      setFeedbackError('Nội dung bài viết không được để trống')
      return
    }

    setEditSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('content', trimmed)
      formData.append('tag', editTag || 'Chia sẻ chung')
      if (editRemoveImage) {
        formData.append('removeImage', 'true')
      } else if (editSelectedImageFile) {
        formData.append('image', editSelectedImageFile)
      }

      const hasEditNutrition = Boolean(
        editNutrition.calories !== '' ||
        editNutrition.protein !== '' ||
        editNutrition.carbs !== '' ||
        editNutrition.fat !== ''
      )
      if (hasEditNutrition) {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: editNutrition.calories !== '' ? Number(editNutrition.calories) : null,
            protein: editNutrition.protein !== '' ? Number(editNutrition.protein) : null,
            carbs: editNutrition.carbs !== '' ? Number(editNutrition.carbs) : null,
            fat: editNutrition.fat !== '' ? Number(editNutrition.fat) : null,
          })
        )
      } else {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          })
        )
      }

      const { data } = await axiosInstance.put(`/community/posts/${post._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      handleCancel()
      onPostUpdated?.(data.post, data.message || 'Cập nhật bài viết thành công')
    } catch (err) {
      console.error('[EditPostModal] Lỗi cập nhật bài:', err)
      const msg = err.response?.data?.message || 'Không thể cập nhật bài viết, vui lòng thử lại'
      setFeedbackError(msg)
      onError?.(msg)
    } finally {
      setEditSubmitting(false)
    }
  }

  if (!post) return null

  return (
    <div className="community-modal-backdrop" onClick={handleCancel}>
      <div
        className="community-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-edit-post-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="community-modal-header">
          <h3 id="modal-edit-post-title">
            <i className="bi bi-pencil-square" style={{ color: '#059669', marginRight: '8px' }} />
            Chỉnh sửa bài viết
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleCancel}
            title="Đóng"
            disabled={editSubmitting}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmitEditPost} className="community-modal-body">
          {/* THÔNG TIN TÁC GIẢ BÀI VIẾT */}
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
                <i className="bi bi-pencil-fill" /> Đang chỉnh sửa nội dung
              </div>
            </div>
          </div>

          {/* CHỌN CHỦ ĐỀ CHO BÀI VIẾT */}
          <div className="modal-tag-selector">
            <label htmlFor="edit-post-tag-select">
              <i className="bi bi-tag-fill" /> Chọn chủ đề bài viết:
            </label>
            <select
              id="edit-post-tag-select"
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              disabled={editSubmitting}
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
                    onClick={() => handleInsertEditQuickTag(tag)}
                    title={`Bấm để chèn @${tag}`}
                    disabled={editSubmitting}
                  >
                    <i className="bi bi-at" />{tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              ref={editTextareaRef}
              rows={5}
              placeholder="Cập nhật nội dung bài viết... Gõ @ để gắn thẻ thành viên hoặc chủ đề..."
              value={editContent}
              onChange={handleEditTextareaChange}
              onKeyDown={handleEditTextareaKeyDown}
              onClick={handleEditTextareaCursorMove}
              onKeyUp={handleEditTextareaCursorMove}
              disabled={editSubmitting}
              autoFocus
            />

            {/* POPUP MENU GỢI Ý KHI GÕ @ */}
            {editShowMentionMenu && (
              <div className="mention-dropdown-menu" ref={editMentionMenuRef}>
                <div className="mention-dropdown-header">
                  <div className="mention-header-title">
                    <i className="bi bi-at" /> Gợi ý gắn thẻ {editMentionQuery ? `cho "${editMentionQuery}"` : ''}
                  </div>
                  <button
                    type="button"
                    className="mention-dropdown-close"
                    onClick={() => setEditShowMentionMenu(false)}
                    title="Đóng menu gợi ý (Esc)"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>

                <div className="mention-dropdown-body">
                  {filteredEditMentions.length === 0 ? (
                    <div className="mention-empty-hint">
                      <i className="bi bi-search" /> Không tìm thấy gợi ý phù hợp
                    </div>
                  ) : (
                    filteredEditMentions.map((item, index) => {
                      const isActive = index === editActiveMentionIndex
                      return (
                        <div
                          key={`edit-${item.type}-${item.id}`}
                          className={`mention-item ${isActive ? 'is-active' : ''}`}
                          onMouseEnter={() => setEditActiveMentionIndex(index)}
                          onClick={() => handleSelectEditMention(item)}
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
            {editImagePreviewUrl ? (
              <div className="modal-image-preview-box">
                <img src={editImagePreviewUrl} alt="Xem trước ảnh minh họa" />
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={handleRemoveEditImage}
                  title="Gỡ ảnh minh họa"
                  disabled={editSubmitting}
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              </div>
            ) : (
              <div
                className="modal-upload-trigger"
                onClick={() => editFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleEditFileDrop}
              >
                <i className="bi bi-image" />
                <div>
                  <strong>Thêm hoặc thay đổi ảnh minh họa</strong>
                  <small>Hỗ trợ JPG, PNG, WEBP tối đa 5MB</small>
                </div>
              </div>
            )}

            <input
              ref={editFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleEditFileSelected}
              disabled={editSubmitting}
            />
          </div>

          {/* ĐÍNH KÈM THÔNG SỐ DINH DƯỠNG */}
          {!editShowNutritionInputs ? (
            <button
              type="button"
              className="nutrition-toggle-btn"
              onClick={() => setEditShowNutritionInputs(true)}
              disabled={editSubmitting}
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
                    setEditShowNutritionInputs(false)
                    setEditNutrition({ calories: '', protein: '', carbs: '', fat: '' })
                  }}
                  disabled={editSubmitting}
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
                  <label htmlFor="edit-calories">
                    <i className="bi bi-fire" style={{ color: '#ea580c' }} /> Calo (kcal)
                  </label>
                  <input
                    id="edit-calories"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="VD: 420"
                    value={editNutrition.calories}
                    onChange={(e) => setEditNutrition((prev) => ({ ...prev, calories: e.target.value }))}
                    disabled={editSubmitting}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="edit-protein">🥩 Protein (g)</label>
                  <input
                    id="edit-protein"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 35"
                    value={editNutrition.protein}
                    onChange={(e) => setEditNutrition((prev) => ({ ...prev, protein: e.target.value }))}
                    disabled={editSubmitting}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="edit-carbs">🍚 Carbs (g)</label>
                  <input
                    id="edit-carbs"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 40"
                    value={editNutrition.carbs}
                    onChange={(e) => setEditNutrition((prev) => ({ ...prev, carbs: e.target.value }))}
                    disabled={editSubmitting}
                  />
                </div>
                <div className="nutrition-input-col">
                  <label htmlFor="edit-fat">🥑 Fat (g)</label>
                  <input
                    id="edit-fat"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="VD: 12"
                    value={editNutrition.fat}
                    onChange={(e) => setEditNutrition((prev) => ({ ...prev, fat: e.target.value }))}
                    disabled={editSubmitting}
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
              disabled={editSubmitting}
            >
              Hủy thay đổi
            </button>
            <button
              type="submit"
              className="community-btn-primary"
              disabled={editSubmitting || !editContent.trim()}
            >
              {editSubmitting ? (
                <>
                  <i className="bi bi-arrow-repeat spin" /> Đang lưu...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" /> Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
