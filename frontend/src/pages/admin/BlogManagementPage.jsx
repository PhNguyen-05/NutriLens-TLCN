import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'

const STATUS_OPTIONS = ['Nháp', 'Đã xuất bản', 'Đã ẩn', 'Đã xóa']
const PAGE_SIZE = 6

const EMPTY_FORM = { title: '', content: '', imageUrl: '', categoryTags: [] }

function getBlogImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).padStart(4, '0')}`
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function getStatusClass(status) {
  return ({ 'Đã xuất bản': 'published', 'Nháp': 'draft', 'Đã ẩn': 'hidden', 'Đã xóa': 'deleted' })[status] || 'draft'
}

function formatCategoryLabel(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('vi')
  return normalized ? normalized.charAt(0).toLocaleUpperCase('vi') + normalized.slice(1) : ''
}

function getExcerpt(content) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim()
  return clean.length > 88 ? `${clean.slice(0, 88)}…` : clean
}

function toIsoDateFromDisplay(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 8) return ''
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDateInput(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function getLocalDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function BlogManagementPage() {
  const { user } = useAuth()
  const authorName = user?.fullName || 'Admin NutriLens'
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState('')
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [filterDateDisplay, setFilterDateDisplay] = useState('')
  const datePickerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [formTarget, setFormTarget] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [tagInput, setTagInput] = useState('')
  const [formError, setFormError] = useState('')
  const [imageError, setImageError] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [openMenuId, setOpenMenuId] = useState(null)

  const loadPosts = useCallback(async (signal) => {
    setIsLoading(true)
    setLoadError('')
    try {
      const { data } = await axiosInstance.get('/admin/blog', { signal })
      setPosts(Array.isArray(data.data) ? data.data : [])
      setPage(1)
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') setLoadError(err.response?.data?.message || 'Không thể tải danh sách bài viết.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadPosts(controller.signal)
    return () => {
      controller.abort()
      window.clearTimeout(toastTimerRef.current)
    }
  }, [loadPosts])

  const categories = useMemo(() => [...new Set(posts.flatMap((post) => (post.categoryTags || []).map(formatCategoryLabel)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [posts])
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    return posts.filter((post) => {
      const matchesSearch = !query || [post.title, post.content, post.authorName, ...(post.categoryTags || [])].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query))
      const matchesCategory = categoryFilter === 'all' || (post.categoryTags || []).some((tag) => formatCategoryLabel(tag) === categoryFilter)
      const matchesStatus = statusFilter === 'all' ? post.status !== 'Đã xóa' : post.status === statusFilter
      const updatedDate = getLocalDateKey(post.updatedAt)
      const matchesDate = !filterDate || updatedDate === filterDate
      return matchesSearch && matchesCategory && matchesStatus && matchesDate
    }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }, [posts, search, categoryFilter, statusFilter, filterDate])

  const livePosts = posts.filter((post) => post.status !== 'Đã xóa')
  const publishedCount = livePosts.filter((post) => post.status === 'Đã xuất bản').length
  const draftCount = livePosts.filter((post) => post.status === 'Nháp').length
  const hiddenCount = livePosts.filter((post) => post.status === 'Đã ẩn').length
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const pagePosts = filteredPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedOnPage = pagePosts.length > 0 && pagePosts.every((post) => selectedIds.includes(post._id))

  function notify(message, type = 'success') {
    window.clearTimeout(toastTimerRef.current)
    setToast(message)
    setToastType(type)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3200)
  }

  function openCreate() {
    setFormTarget(null)
    setIsFormOpen(true)
    setForm(EMPTY_FORM)
    setTagInput('')
    setFormError('')
    setImageError('')
  }

  function openEdit(post) {
    setFormTarget(post)
    setIsFormOpen(true)
    setForm({ title: post.title, content: post.content, imageUrl: post.imageUrl || '', categoryTags: [...(post.categoryTags || [])] })
    setTagInput('')
    setFormError('')
    setImageError('')
  }

  function closeForm() {
    setIsFormOpen(false)
    setFormTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setImageError('')
  }

  function addTag(rawTag = tagInput) {
    const tag = formatCategoryLabel(rawTag.trim().replace(/^#/, ''))
    if (!tag || form.categoryTags.some((existing) => existing.toLocaleLowerCase('vi') === tag.toLocaleLowerCase('vi'))) {
      setTagInput('')
      return
    }
    setForm((current) => ({ ...current, categoryTags: [...current.categoryTags, tag] }))
    setTagInput('')
  }

  async function handleImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const input = event.target
    const validType = ['image/jpeg', 'image/png'].includes(file.type)
    const validExtension = /\.(jpe?g|png)$/i.test(file.name)
    if (!validType || !validExtension) {
      setImageError('Ảnh minh họa chỉ chấp nhận định dạng JPG hoặc PNG.')
      input.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Ảnh minh họa không được vượt quá 5 MB.')
      input.value = ''
      return
    }

    setIsImageUploading(true)
    setImageError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await axiosInstance.post('/admin/blog/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm((current) => ({ ...current, imageUrl: data.imageUrl }))
      setImageError('')
    } catch (err) {
      setImageError(err.response?.data?.message || 'Không thể tải ảnh lên, vui lòng thử lại.')
    } finally {
      setIsImageUploading(false)
      input.value = ''
    }
  }

  async function savePost(status = 'Nháp') {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Vui lòng nhập tiêu đề và nội dung bài viết.')
      return
    }
    if (isImageUploading) {
      setFormError('Vui lòng đợi ảnh tải lên hoàn tất.')
      return
    }

    setIsSaving(true)
    setSavingStatus(status)
    setFormError('')
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      imageUrl: form.imageUrl || null,
      categoryTags: form.categoryTags.map(formatCategoryLabel),
      status,
    }
    try {
      const response = formTarget
        ? await axiosInstance.put(`/admin/blog/${formTarget._id}`, payload)
        : await axiosInstance.post('/admin/blog', payload)
      const savedPost = response.data.data
      setPosts((current) => formTarget
        ? current.map((item) => item._id === formTarget._id ? savedPost : item)
        : [savedPost, ...current])
      setLoadError('')
      setPage(1)
      closeForm()
      notify(status === 'Đã xuất bản'
        ? (formTarget ? 'Đã cập nhật và xuất bản bài viết.' : 'Đã xuất bản bài viết.')
        : (formTarget ? 'Đã lưu bài viết dưới dạng nháp.' : 'Đã tạo bài viết nháp.'))
    } catch (err) {
      setFormError(err.response?.data?.message || 'Không thể lưu bài viết, vui lòng thử lại.')
    } finally {
      setIsSaving(false)
      setSavingStatus('')
    }
  }

  async function setPostStatus(post, status) {
    try {
      const { data } = await axiosInstance.patch(`/admin/blog/${post._id}/status`, { status })
      setPosts((current) => current.map((item) => item._id === post._id ? data.data : item))
      setLoadError('')
      setOpenMenuId(null)
      setSelectedIds((current) => current.filter((id) => id !== post._id))
      setPage(1)
      notify(`Trạng thái bài viết: ${status}.`)
    } catch (err) {
      notify(err.response?.data?.message || 'Không thể cập nhật trạng thái bài viết.', 'error')
    }
  }

  function requestDelete(post) {
    setDeleteTarget(post)
    setDeleteError('')
    setOpenMenuId(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')
    const postId = deleteTarget._id
    try {
      const { data } = await axiosInstance.delete(`/admin/blog/${postId}`)
      setPosts((current) => current.map((post) => post._id === postId ? data.data : post))
      setLoadError('')
      setSelectedIds((current) => current.filter((id) => id !== postId))
      setDetailTarget((current) => current?._id === postId ? null : current)
      setDeleteTarget(null)
      setPage(1)
      notify('Đã xóa bài viết.')
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Không thể xóa bài viết, vui lòng thử lại.')
    } finally {
      setIsDeleting(false)
    }
  }

  function toggleSelect(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function togglePageSelection() {
    setSelectedIds((current) => selectedOnPage
      ? current.filter((id) => !pagePosts.some((post) => post._id === id))
      : [...new Set([...current, ...pagePosts.map((post) => post._id)])])
  }

  async function bulkSetStatus(status) {
    const ids = [...selectedIds]
    try {
      const { data } = await axiosInstance.patch('/admin/blog/bulk-status', { ids, status })
      const updatedPosts = new Map(data.data.map((post) => [post._id, post]))
      setPosts((current) => current.map((post) => updatedPosts.get(post._id) || post))
      setLoadError('')
      setSelectedIds([])
      setPage(1)
      notify(`Đã cập nhật ${ids.length} bài viết.`)
    } catch (err) {
      notify(err.response?.data?.message || 'Không thể cập nhật các bài viết.', 'error')
    }
  }

  function resetFilters() {
    setSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setFilterDate('')
    setFilterDateDisplay('')
    setPage(1)
    setSelectedIds([])
    loadPosts()
  }

  function handleDateTextChange(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8)
    const display = digits.length > 4
      ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
    setFilterDateDisplay(display)
    setFilterDate(toIsoDateFromDisplay(digits))
    setPage(1)
  }

  function handleDatePickerChange(event) {
    const isoDate = event.target.value
    setFilterDate(isoDate)
    setFilterDateDisplay(formatDateInput(isoDate))
    setPage(1)
  }

  return (
    <div className="bm-page">
      {toast && <div className={`bm-toast ${toastType === 'error' ? 'bm-toast-error' : ''}`} role="status"><i className={`bi ${toastType === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />{toast}</div>}
      <section className="bm-heading">
        <button type="button" className="bm-primary-button" onClick={openCreate}><i className="bi bi-plus-lg" />Thêm bài viết mới</button>
      </section>

      <section className="bm-stat-grid" aria-label="Tổng quan bài viết">
        <article className="bm-stat-card bm-stat-total"><span className="bm-stat-icon"><i className="bi bi-journal-text" /></span><div><small>Tổng số bài viết</small><strong>{livePosts.length}</strong><div className="bm-stat-track"><i style={{ width: `${livePosts.length ? 100 : 0}%` }} /></div></div></article>
        <article className="bm-stat-card bm-stat-published"><span className="bm-stat-icon"><i className="bi bi-journal-check" /></span><div><small>Đã xuất bản</small><strong>{publishedCount}</strong><div className="bm-stat-track"><i style={{ width: `${livePosts.length ? (publishedCount / livePosts.length) * 100 : 0}%` }} /></div></div></article>
        <article className="bm-stat-card bm-stat-draft"><span className="bm-stat-icon"><i className="bi bi-journal-plus" /></span><div><small>Bản nháp</small><strong>{draftCount}</strong><div className="bm-stat-track"><i style={{ width: `${livePosts.length ? (draftCount / livePosts.length) * 100 : 0}%` }} /></div></div></article>
        <article className="bm-stat-card bm-stat-hidden"><span className="bm-stat-icon"><i className="bi bi-eye-slash" /></span><div><small>Đã ẩn</small><strong>{hiddenCount}</strong><div className="bm-stat-track"><i style={{ width: `${livePosts.length ? (hiddenCount / livePosts.length) * 100 : 0}%` }} /></div></div></article>
      </section>

      <section className="bm-toolbar" aria-label="Tìm kiếm và lọc bài viết">
        <label className="bm-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm theo tiêu đề, nội dung, tác giả, tag..." /></label>
        <label className="bm-select bm-category-select"><i className="bi bi-collection" /><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option value="all">Tất cả chuyên mục</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select><i className="bi bi-chevron-down bm-chevron" /></label>
        <label className="bm-select"><i className="bi bi-sliders" /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="all">Tất cả trạng thái</option>{STATUS_OPTIONS.map((status) => <option value={status} key={status}>{status}</option>)}</select><i className="bi bi-chevron-down bm-chevron" /></label>
        <div className="bm-date-range"><i className="bi bi-calendar3" /><input className="bm-date-text" aria-label="Lọc theo ngày" aria-invalid={filterDateDisplay.replace(/\D/g, '').length === 8 && !filterDate} title="Nhập ngày theo định dạng dd/mm/yyyy" type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} value={filterDateDisplay} onChange={handleDateTextChange} /><button className="bm-date-picker-button" type="button" aria-label="Mở bộ chọn ngày" onClick={() => { const picker = datePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.click() }}><i className="bi bi-chevron-down" /></button><input ref={datePickerRef} className="bm-date-native" aria-hidden="true" tabIndex={-1} type="date" value={filterDate} onChange={handleDatePickerChange} /></div>
        <button type="button" className="bm-icon-button" title="Xóa bộ lọc" aria-label="Xóa bộ lọc" onClick={resetFilters}><i className="bi bi-arrow-clockwise" /></button>
      </section>

      {selectedIds.length > 0 && <div className="bm-bulk-bar"><strong>{selectedIds.length} bài viết đã chọn</strong><span>Thao tác nhanh</span><button type="button" onClick={() => bulkSetStatus('Đã xuất bản')}><i className="bi bi-send-check" />Xuất bản</button><button type="button" onClick={() => bulkSetStatus('Đã ẩn')}><i className="bi bi-eye-slash" />Ẩn bài viết</button></div>}

      <section className="bm-table-panel">
        <div className="bm-table-scroll">
          <table className="bm-table">
            <thead><tr><th className="bm-check-cell"><input type="checkbox" checked={selectedOnPage} onChange={togglePageSelection} aria-label="Chọn tất cả bài viết trên trang" /></th><th>Tiêu đề bài viết</th><th>Chuyên mục</th><th>Tác giả</th><th>Ngày cập nhật</th><th>Trạng thái</th><th>Lượt xem</th><th className="bm-actions-head">Thao tác</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan="8"><div className="bm-loading"><i className="bi bi-arrow-repeat" />Đang tải bài viết...</div></td></tr>
                : loadError ? <tr><td colSpan="8"><div className="bm-empty"><span><i className="bi bi-exclamation-circle" /></span><strong>Không thể tải bài viết</strong><p>{loadError}</p><button type="button" onClick={() => loadPosts()}>Thử lại</button></div></td></tr>
                  : pagePosts.map((post) => <tr key={post._id} className={post.status === 'Đã xóa' ? 'bm-row-deleted' : ''}>
                <td className="bm-check-cell"><input type="checkbox" checked={selectedIds.includes(post._id)} onChange={() => toggleSelect(post._id)} aria-label={`Chọn ${post.title}`} /></td>
                <td><div className="bm-title-cell"><button type="button" className={`bm-cover bm-cover-${post.tone || 'green'}`} onClick={() => setDetailTarget(post)} aria-label={`Xem ${post.title}`}>{post.imageUrl ? <img src={getBlogImageUrl(post.imageUrl)} alt="" /> : <span>{post.cover || '📝'}</span>}</button><div className="bm-title-copy"><button type="button" className="bm-title-link" onClick={() => setDetailTarget(post)}>{post.title}</button><p>{getExcerpt(post.content)}</p><div className="bm-tags">{(post.categoryTags || []).slice(0, 2).map((tag) => <span key={tag}>#{formatCategoryLabel(tag).replace(/\s+/g, '-')}</span>)}</div></div></div></td>
                <td><span className="bm-category"><i className={`bi ${post.categoryTags?.[0]?.toLocaleLowerCase('vi').includes('vận động') ? 'bi-activity' : post.categoryTags?.[0]?.toLocaleLowerCase('vi').includes('tim mạch') ? 'bi-heart-pulse' : 'bi-leaf'}`} />{formatCategoryLabel(post.categoryTags?.[0]) || 'Chưa phân loại'}</span></td>
                <td><div className="bm-author"><span><i className="bi bi-person-fill" /></span><div><strong>{post.authorName}</strong><small>{post.authorRole || 'Quản trị viên'}</small></div></div></td>
                <td><span className="bm-updated-date">{formatDate(post.updatedAt)}</span><small className="bm-updated-time">{formatTime(post.updatedAt)}</small></td>
                <td><span className={`bm-status bm-status-${getStatusClass(post.status)}`}><i className="bi bi-circle-fill" />{post.status}</span></td>
                <td><span className="bm-view-count"><i className="bi bi-eye-fill" />{Number(post.viewCount || 0).toLocaleString('vi-VN')}</span></td>
                <td><div className="bm-row-actions"><button type="button" title="Chỉnh sửa" aria-label={`Chỉnh sửa ${post.title}`} onClick={() => openEdit(post)}><i className="bi bi-pencil" /></button><button type="button" title="Xem chi tiết" aria-label={`Xem chi tiết ${post.title}`} onClick={() => setDetailTarget(post)}><i className="bi bi-file-earmark-text" /></button>{post.status !== 'Đã xóa' && <button type="button" className="bm-delete-row-button" title="Xóa bài viết" aria-label={`Xóa bài viết ${post.title}`} onClick={() => requestDelete(post)}><i className="bi bi-trash3" /></button>}<div className="bm-more-wrap"><button type="button" title="Thao tác khác" aria-label={`Thao tác khác cho ${post.title}`} aria-expanded={openMenuId === post._id} onClick={() => setOpenMenuId((current) => current === post._id ? null : post._id)}><i className="bi bi-three-dots-vertical" /></button>{openMenuId === post._id && <div className="bm-more-menu" role="menu">
                  {post.status !== 'Đã xuất bản' && post.status !== 'Đã xóa' && <button type="button" role="menuitem" onClick={() => setPostStatus(post, 'Đã xuất bản')}><i className="bi bi-send-check" />Xuất bản</button>}
                  {post.status === 'Đã xuất bản' && <button type="button" role="menuitem" onClick={() => setPostStatus(post, 'Đã ẩn')}><i className="bi bi-eye-slash" />Ẩn bài viết</button>}
                  {post.status === 'Đã ẩn' && <button type="button" role="menuitem" onClick={() => setPostStatus(post, 'Đã xuất bản')}><i className="bi bi-eye" />Hiển thị lại</button>}
                  {post.status === 'Đã xóa' && <button type="button" role="menuitem" onClick={() => setPostStatus(post, 'Nháp')}><i className="bi bi-arrow-counterclockwise" />Khôi phục bản nháp</button>}
                </div>}</div></div></td>
              </tr>)}
              {!isLoading && !loadError && !pagePosts.length && <tr><td colSpan="8"><div className="bm-empty"><span><i className="bi bi-journal-x" /></span><strong>Không tìm thấy bài viết phù hợp</strong><p>Hãy thử thay đổi từ khóa hoặc bộ lọc của bạn.</p><button type="button" onClick={resetFilters}>Xóa bộ lọc</button></div></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="bm-pagination"><span>Hiển thị {filteredPosts.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredPosts.length)} trong tổng số {filteredPosts.length} bài viết</span><div><button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="bi bi-chevron-left" /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} className={page === pageNumber ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" aria-label="Trang tiếp" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><i className="bi bi-chevron-right" /></button></div></footer>
      </section>

      {deleteTarget && <div className="bm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setDeleteTarget(null) }}><section className="bm-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="bm-delete-title" aria-describedby="bm-delete-description"><div className="bm-confirm-icon"><i className="bi bi-trash3" /></div><h2 id="bm-delete-title">Xóa bài viết?</h2><p id="bm-delete-description">“{deleteTarget.title}” sẽ được chuyển sang trạng thái Đã xóa. Bạn có thể khôi phục bài viết từ bộ lọc trạng thái.</p>{deleteError && <p className="bm-delete-error" role="alert">{deleteError}</p>}<footer><button type="button" className="bm-secondary-button" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Hủy</button><button type="button" className="bm-primary-button bm-danger-button" disabled={isDeleting} onClick={confirmDelete}><i className={`bi ${isDeleting ? 'bi-arrow-repeat' : 'bi-trash3'}`} />{isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}</button></footer></section></div>}
      {detailTarget && <div className="bm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailTarget(null) }}><section className="bm-detail-modal" role="dialog" aria-modal="true" aria-labelledby="bm-detail-title"><header><div><span className="bm-modal-kicker">XEM TRƯỚC BÀI VIẾT</span><h2 id="bm-detail-title">Chi tiết bài viết</h2></div><button type="button" className="bm-close-button" onClick={() => setDetailTarget(null)} aria-label="Đóng"><i className="bi bi-x-lg" /></button></header><div className={`bm-detail-cover bm-cover-${detailTarget.tone || 'green'}`}>{detailTarget.imageUrl ? <img src={getBlogImageUrl(detailTarget.imageUrl)} alt="Ảnh minh họa bài viết" /> : <span>{detailTarget.cover || '📝'}</span>}</div><div className="bm-detail-meta"><span className={`bm-status bm-status-${getStatusClass(detailTarget.status)}`}><i className="bi bi-circle-fill" />{detailTarget.status}</span><span><i className="bi bi-calendar3" />{formatDate(detailTarget.publishedAt || detailTarget.updatedAt)}</span><span><i className="bi bi-eye" />{Number(detailTarget.viewCount || 0).toLocaleString('vi-VN')} lượt xem</span></div><h3>{detailTarget.title}</h3><div className="bm-detail-author"><i className="bi bi-person-circle" /><span>{detailTarget.authorName}<small>{detailTarget.authorRole}</small></span></div><div className="bm-detail-tags">{(detailTarget.categoryTags || []).map((tag) => <span key={tag}>#{formatCategoryLabel(tag)}</span>)}</div><p className="bm-detail-content">{detailTarget.content}</p><footer><button type="button" className="bm-secondary-button" onClick={() => setDetailTarget(null)}>Đóng</button><button type="button" className="bm-primary-button" onClick={() => { setDetailTarget(null); openEdit(detailTarget) }}><i className="bi bi-pencil" />Chỉnh sửa</button></footer></section></div>}
      {isFormOpen && <div className="bm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="bm-form-modal" onSubmit={(event) => { event.preventDefault(); savePost('Nháp') }} role="dialog" aria-modal="true" aria-labelledby="bm-form-title">
        <header className="bm-form-header"><span className="bm-form-header-icon"><i className="bi bi-newspaper" /></span><div className="bm-form-header-copy"><h2 id="bm-form-title">{formTarget ? 'Chỉnh sửa bài viết' : 'Tạo bài viết tin tức'}</h2><p>Soạn nội dung và thiết lập hiển thị cho bài viết mới</p></div><button type="button" className="bm-close-button" onClick={closeForm} aria-label="Đóng" disabled={isSaving}><i className="bi bi-x-lg" /></button></header>
        <div className="bm-form-scroll">
          <div className="bm-composer-layout">
            <section className="bm-composer-panel bm-content-panel">
              <header><i className="bi bi-file-earmark-text" /><h3>Nội dung bài viết</h3></header>
              <div className="bm-composer-panel-body">
                <label className="bm-field">Tiêu đề bài viết <b>*</b><input autoFocus value={form.title} maxLength={180} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Nhập tiêu đề rõ ràng, dễ tìm kiếm" required /></label>
                <label className="bm-field">Nội dung bài viết <b>*</b><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Biên soạn nội dung y khoa chính xác, dễ hiểu..." rows={14} required /></label>
                <p className="bm-composer-note"><i className="bi bi-info-circle-fill" />Vui lòng kiểm tra tính chính xác của nội dung trước khi lưu.</p>
              </div>
            </section>
            <div className="bm-composer-sidebar">
              <section className="bm-composer-panel">
                <header><i className="bi bi-gear" /><h3>Thiết lập bài viết</h3></header>
                <div className="bm-composer-panel-body">
                  <div className="bm-field"><span>Chuyên mục / thẻ</span><div className="bm-tag-input-wrap"><div className="bm-form-tags">{form.categoryTags.map((tag) => <button type="button" key={tag} onClick={() => setForm((current) => ({ ...current, categoryTags: current.categoryTags.filter((item) => item !== tag) }))}>#{formatCategoryLabel(tag)}<i className="bi bi-x" /></button>)}<input aria-label="Thêm chuyên mục hoặc thẻ" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag() } }} /></div></div></div>
                </div>
              </section>
              <section className="bm-composer-panel bm-image-panel">
                <header><i className="bi bi-image" /><h3>Ảnh đại diện</h3></header>
                <div className="bm-composer-panel-body">
                  <label className="bm-upload-box"><span><i className={`bi ${isImageUploading ? 'bi-arrow-repeat' : form.imageUrl ? 'bi-arrow-repeat' : 'bi-cloud-arrow-up'}`} /><b>{isImageUploading ? 'Đang tải ảnh...' : form.imageUrl ? 'Thay đổi ảnh đại diện' : 'Tải ảnh đại diện'}</b><small>Kéo thả ảnh hoặc chọn từ thiết bị</small><small>JPG, PNG • Tối đa 5 MB • Tỉ lệ khuyến nghị 16:9</small><em><i className="bi bi-image" />Chọn ảnh</em></span><input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={handleImage} disabled={isImageUploading || isSaving} /></label>
                  {form.imageUrl && <div className="bm-uploaded-image"><img src={getBlogImageUrl(form.imageUrl)} alt="Xem trước ảnh đại diện" /><span><strong>Ảnh đại diện</strong><small>Ảnh đã tải lên</small></span><button type="button" aria-label="Xóa ảnh đại diện" onClick={() => { setForm((current) => ({ ...current, imageUrl: '' })); setImageError('') }} disabled={isSaving}><i className="bi bi-x-lg" /></button></div>}
                  {imageError && <small className="bm-field-error">{imageError}</small>}
                </div>
              </section>
            </div>
          </div>
          {formError && <p className="bm-form-error" role="alert"><i className="bi bi-exclamation-circle" />{formError}</p>}
        </div>
        <footer><button type="button" className="bm-secondary-button" onClick={closeForm} disabled={isSaving}>Hủy</button><button type="button" className="bm-secondary-button bm-draft-button" onClick={() => savePost('Nháp')} disabled={isSaving || isImageUploading}><i className={`bi ${isSaving && savingStatus === 'Nháp' ? 'bi-arrow-repeat' : 'bi-save'}`} />{isSaving && savingStatus === 'Nháp' ? 'Đang lưu nháp...' : 'Lưu nháp'}</button><button type="button" className="bm-primary-button" onClick={() => savePost('Đã xuất bản')} disabled={isSaving || isImageUploading}><i className={`bi ${isSaving && savingStatus === 'Đã xuất bản' ? 'bi-arrow-repeat' : 'bi-send-check'}`} />{isSaving && savingStatus === 'Đã xuất bản' ? 'Đang xuất bản...' : 'Xuất bản'}</button></footer>
      </form></div>}
    </div>
  )
}
