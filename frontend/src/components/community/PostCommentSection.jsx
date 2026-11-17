import React, { useState } from 'react'
import { resolveMediaUrl, formatRelativeTime, renderFormattedContent } from './communityUtils'

export default function PostCommentSection({
  post,
  user,
  onAddComment,
  onEditComment,
  onRequestDeleteComment,
  onViewAuthor,
  onSelectTag,
}) {
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  const commentsList = post.comments || []
  const firstName = user?.fullName ? user.fullName.split(' ').pop() : 'Bạn'

  const handleSend = async () => {
    const trimmed = commentText.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(post._id, trimmed)
      setCommentText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (c) => {
    setEditingCommentId(c._id)
    setEditingCommentText(c.content || '')
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  const handleSaveEdit = async (commentId) => {
    const trimmed = editingCommentText.trim()
    if (!trimmed || isEditSubmitting) return

    setIsEditSubmitting(true)
    try {
      await onEditComment(post._id, commentId, trimmed)
      setEditingCommentId(null)
      setEditingCommentText('')
    } finally {
      setIsEditSubmitting(false)
    }
  }

  return (
    <div className="comments-section">
      {/* FORM GỬI BÌNH LUẬN */}
      <div className="comment-input-box">
        {user?.avatarUrl ? (
          <img
            src={resolveMediaUrl(user.avatarUrl)}
            alt={user.fullName}
            className="avatar-xs"
          />
        ) : (
          <div className="avatar-xs-fallback">
            {firstName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="comment-field-wrap">
          <input
            type="text"
            placeholder="Viết bình luận của bạn..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend()
              }
            }}
          />
          <button
            type="button"
            className="comment-send-btn"
            disabled={!commentText.trim() || isSubmitting}
            onClick={handleSend}
            title="Gửi bình luận"
          >
            {isSubmitting ? (
              <i className="bi bi-arrow-repeat spin" />
            ) : (
              <i className="bi bi-send-fill" />
            )}
          </button>
        </div>
      </div>

      {/* DANH SÁCH BÌNH LUẬN */}
      {commentsList.length > 0 && (
        <div className="comments-list">
          {commentsList.map((c, index) => {
            const cAuthor = c.authorId || {}
            const cAvatar = resolveMediaUrl(cAuthor.avatarUrl)
            const cInitial = (cAuthor.fullName || 'U').charAt(0).toUpperCase()
            const currentUserId = user?.id || user?._id
            const isCommentAuthor =
              currentUserId &&
              String(cAuthor._id || cAuthor) === String(currentUserId)
            const isPostAuthor =
              currentUserId &&
              String(post.authorId?._id || post.authorId) === String(currentUserId)
            const canDeleteComment =
              isCommentAuthor || isPostAuthor || user?.role === 'admin'
            const isEditing = editingCommentId === c._id

            return (
              <div className="comment-item" key={c._id || index}>
                {cAvatar ? (
                  <img
                    src={cAvatar}
                    alt={cAuthor.fullName}
                    className="avatar-xs post-author-avatar-clickable"
                    onClick={() => onViewAuthor?.(cAuthor)}
                    title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                  />
                ) : (
                  <div
                    className="avatar-xs-fallback post-author-avatar-clickable"
                    onClick={() => onViewAuthor?.(cAuthor)}
                    title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                  >
                    {cInitial}
                  </div>
                )}

                {isEditing ? (
                  <div className="comment-edit-wrap">
                    <input
                      type="text"
                      className="comment-edit-input"
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(c._id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      autoFocus
                    />
                    <div className="comment-edit-actions">
                      <button
                        type="button"
                        className="btn-comment-cancel"
                        onClick={handleCancelEdit}
                        disabled={isEditSubmitting}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="btn-comment-save"
                        onClick={() => handleSaveEdit(c._id)}
                        disabled={isEditSubmitting || !editingCommentText.trim()}
                      >
                        {isEditSubmitting ? (
                          <i className="bi bi-arrow-repeat spin" />
                        ) : (
                          'Lưu'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-body-wrap">
                    <div className="comment-bubble">
                      <div
                        className="comment-author-name comment-author-name-clickable"
                        onClick={() => onViewAuthor?.(cAuthor)}
                        title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                      >
                        {cAuthor.fullName || 'Thành viên'}
                      </div>
                      <div className="comment-content">
                        {renderFormattedContent(c.content, onSelectTag)}
                      </div>
                    </div>
                    <div className="comment-footer-actions">
                      <span className="comment-time">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                      {c.isEdited && (
                        <span
                          className="comment-edited-tag"
                          title={
                            c.editedAt
                              ? `Chỉnh sửa lúc ${formatRelativeTime(c.editedAt)}`
                              : 'Đã chỉnh sửa'
                          }
                        >
                          · (Đã chỉnh sửa)
                        </span>
                      )}
                      {isCommentAuthor && (
                        <button
                          type="button"
                          className="comment-action-text-btn"
                          onClick={() => handleStartEdit(c)}
                        >
                          Chỉnh sửa
                        </button>
                      )}
                      {canDeleteComment && (
                        <button
                          type="button"
                          className="comment-action-text-btn comment-action-delete"
                          onClick={() => onRequestDeleteComment?.(post._id, c)}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
