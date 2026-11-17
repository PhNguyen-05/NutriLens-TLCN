import React from 'react'
import PostCommentSection from './PostCommentSection'
import {
  TAG_COLOR_MAP,
  resolveMediaUrl,
  formatRelativeTime,
  renderFormattedContent,
} from './communityUtils'

export default function PostCard({
  post,
  user,
  feedMode,
  isCommentsOpen,
  onToggleLike,
  onToggleComments,
  onOpenEditModal,
  onPromptDeletePost,
  onOpenReportModal,
  onViewAuthor,
  onSelectTag,
  onSetLightboxImage,
  onAddComment,
  onEditComment,
  onRequestDeleteComment,
}) {
  const tagMeta = TAG_COLOR_MAP[post.tag] || {
    icon: 'bi-tag',
    text: '#059669',
    bg: '#ecfdf5',
  }
  const author = post.authorId || {}
  const isAuthor = user?.id && String(author._id) === String(user.id)
  const isAdmin = user?.role === 'admin'
  const authorAvatar = resolveMediaUrl(author.avatarUrl)
  const authorInitial = (author.fullName || 'U').charAt(0).toUpperCase()
  const isPostLiked = Boolean(post.isLiked)
  const commentsList = post.comments || []
  const postImageUrl = resolveMediaUrl(post.imageUrl)

  return (
    <article
      className="community-card post-card"
      key={post._id}
      id={`post-${post._id}`}
    >
      {/* HEADER BÀI VIẾT */}
      <div className="post-header">
        <div className="post-author-wrap">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={author.fullName}
              className="avatar-sm post-author-avatar-clickable"
              onClick={() => onViewAuthor?.(author)}
              title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
            />
          ) : (
            <div
              className="avatar-sm-fallback post-author-avatar-clickable"
              onClick={() => onViewAuthor?.(author)}
              title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
            >
              {authorInitial}
            </div>
          )}

          <div className="post-author-info">
            <div className="post-author-name-row">
              <strong
                className="post-author-name-clickable"
                onClick={() => onViewAuthor?.(author)}
                title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
              >
                {author.fullName || 'Thành viên'}
              </strong>
              {author.role === 'admin' && (
                <span className="author-badge-admin" title="Quản trị viên">
                  <i className="bi bi-patch-check-fill" /> Admin
                </span>
              )}
              <span
                className="post-tag-badge"
                style={{ backgroundColor: tagMeta.bg, color: tagMeta.text }}
              >
                <i className={`bi ${tagMeta.icon}`} /> {post.tag}
              </span>

              {/* UC36: Trạng thái bài đăng cá nhân (Công khai / Đã bị ẩn) */}
              {(feedMode === 'mine' || isAuthor) && post.status === 'hidden' && (
                <span
                  className="post-status-badge post-status-hidden"
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Bài viết đã bị quản trị viên ẩn do vi phạm quy định"
                >
                  <i className="bi bi-eye-slash-fill" /> Đã bị ẩn
                </span>
              )}
              {(feedMode === 'mine' || isAuthor) && post.status === 'published' && (
                <span
                  className="post-status-badge post-status-published"
                  style={{
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Bài viết hiển thị công khai trên cộng đồng"
                >
                  <i className="bi bi-check-circle-fill" /> Công khai
                </span>
              )}
            </div>
            <span className="post-time" title={post.createdAt}>
              <i className="bi bi-clock" /> {formatRelativeTime(post.createdAt)}
              {post.isEdited && (
                <span
                  className="post-edited-indicator"
                  title={
                    post.editedAt
                      ? `Chỉnh sửa lúc ${formatRelativeTime(post.editedAt)}`
                      : 'Đã chỉnh sửa'
                  }
                >
                  · (Đã chỉnh sửa)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* MENU TÙY CHỌN (CHỈNH SỬA & XÓA BÀI NẾU LÀ TÁC GIẢ HOẶC ADMIN) */}
        {(isAuthor || isAdmin) && (
          <div className="post-header-actions">
            <button
              type="button"
              className="post-action-icon-btn post-edit-btn"
              title="Chỉnh sửa bài viết"
              onClick={() => onOpenEditModal?.(post)}
            >
              <i className="bi bi-pencil-square" />
            </button>
            <button
              type="button"
              className="post-action-icon-btn post-delete-btn"
              title="Xóa bài viết"
              onClick={() => onPromptDeletePost?.(post)}
            >
              <i className="bi bi-trash" />
            </button>
          </div>
        )}
      </div>

      {/* NỘI DUNG VĂN BẢN */}
      <div className="post-body">
        <p className="post-text">{renderFormattedContent(post.content, onSelectTag)}</p>

        {/* HUY HIỆU DINH DƯỠNG / MACRO PILL ĐẶC TRƯNG NUTRILENS */}
        {post.nutrition &&
          (post.nutrition.calories != null ||
            post.nutrition.protein != null ||
            post.nutrition.carbs != null ||
            post.nutrition.fat != null) && (
            <div className="post-macro-pill-bar" title="Thông số dinh dưỡng của món ăn">
              <span className="macro-tag macro-tag-badge">
                <i className="bi bi-shield-check" /> Dinh dưỡng
              </span>
              {post.nutrition.calories != null && (
                <span className="macro-tag macro-cal">
                  <i className="bi bi-fire" /> <strong>{post.nutrition.calories}</strong> kcal
                </span>
              )}
              {post.nutrition.protein != null && (
                <span className="macro-tag macro-pro">
                  🥩 <strong>{post.nutrition.protein}g</strong> Protein
                </span>
              )}
              {post.nutrition.carbs != null && (
                <span className="macro-tag macro-carb">
                  🍚 <strong>{post.nutrition.carbs}g</strong> Carbs
                </span>
              )}
              {post.nutrition.fat != null && (
                <span className="macro-tag macro-fat">
                  🥑 <strong>{post.nutrition.fat}g</strong> Fat
                </span>
              )}
            </div>
          )}
      </div>

      {/* HÌNH ẢNH MINH HỌA (NẾU CÓ) */}
      {postImageUrl && (
        <div
          className="post-image-container"
          onClick={() => onSetLightboxImage?.(postImageUrl)}
          title="Nhấn để phóng to ảnh"
        >
          <img
            src={postImageUrl}
            alt="Ảnh đính kèm bài viết"
            loading="lazy"
          />
        </div>
      )}

      {/* THỐNG KÊ TƯƠNG TÁC */}
      <div className="post-stats-row">
        <span className="stats-likes">
          <i className="bi bi-heart-fill" style={{ color: '#ef4444' }} /> {post.likeCount || 0} tim
        </span>
        <span
          className="stats-comments"
          onClick={() => onToggleComments?.(post._id)}
        >
          {post.commentCount || commentsList.length} bình luận
        </span>
      </div>

      {/* THANH NÚT TƯƠNG TÁC (LIKE, COMMENT) */}
      <div className="post-actions-bar">
        <button
          type="button"
          className={`post-footer-btn ${isPostLiked ? 'active-like' : ''}`}
          onClick={() => onToggleLike?.(post._id)}
        >
          <i className={`bi ${isPostLiked ? 'bi-heart-fill' : 'bi-heart'}`} />
          <span>{isPostLiked ? 'Đã thả tim' : 'Thả tim'}</span>
        </button>

        <button
          type="button"
          className="post-footer-btn"
          onClick={() => onToggleComments?.(post._id)}
        >
          <i className="bi bi-chat-text" />
          <span>Bình luận</span>
        </button>

        {/* UC30: Nút báo cáo vi phạm - chỉ hiển thị khi không phải chủ bài viết */}
        {user && !isAuthor && (
          post.isReported ? (
            <button
              type="button"
              className="post-footer-btn post-footer-btn--reported"
              disabled
              title="Bạn đã gửi báo cáo bài đăng này cho quản trị viên"
              style={{
                color: '#ea580c',
                cursor: 'default',
                background: '#fff7ed',
                fontWeight: 700,
              }}
            >
              <i className="bi bi-flag-fill" style={{ color: '#ea580c' }} />
              <span>Đã báo cáo</span>
            </button>
          ) : (
            <button
              type="button"
              className="post-footer-btn post-footer-btn--report"
              onClick={() => onOpenReportModal?.(post._id)}
              title="Báo cáo bài đăng vi phạm"
            >
              <i className="bi bi-flag" />
              <span>Báo cáo</span>
            </button>
          )
        )}
      </div>

      {/* KHUNG BÌNH LUẬN (COMMENTS SECTION) */}
      {isCommentsOpen && (
        <PostCommentSection
          post={post}
          user={user}
          onAddComment={onAddComment}
          onEditComment={onEditComment}
          onRequestDeleteComment={onRequestDeleteComment}
          onViewAuthor={onViewAuthor}
          onSelectTag={onSelectTag}
        />
      )}
    </article>
  )
}
