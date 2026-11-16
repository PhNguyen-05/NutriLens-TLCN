import { useCallback, useEffect, useState } from 'react'
import axiosInstance from '../../../api/axiosInstance'

export default function FoodGroupManagementModal({
  isOpen,
  onClose,
  onGroupsChanged,
}) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  // Create new group
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Rename group
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [renaming, setRenaming] = useState(false)

  // Delete / Merge group
  const [deletingGroup, setDeletingGroup] = useState(null)
  const [targetGroup, setTargetGroup] = useState('Khác')
  const [deleting, setDeleting] = useState(false)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data } = await axiosInstance.get('/admin/foods/groups')
      if (data.success && Array.isArray(data.data)) {
        setGroups(data.data)
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách nhóm món ăn')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchGroups()
      setEditingGroupId(null)
      setDeletingGroup(null)
      setActionSuccessMsg('')
    }
  }, [isOpen, fetchGroups])

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreating(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.post('/admin/foods/groups', {
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || null,
      })
      setActionSuccessMsg(data.message)
      setNewGroupName('')
      setNewGroupDesc('')
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Tạo nhóm món ăn thất bại')
    } finally {
      setCreating(false)
    }
  }

  const handleStartRename = (group) => {
    setEditingGroupId(group._id)
    setEditName(group.name)
    setEditDesc(group.description || '')
    setErrorMsg('')
    setActionSuccessMsg('')
    setDeletingGroup(null)
  }

  const handleSaveRename = async (id) => {
    if (!editName.trim()) return
    setRenaming(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.put(`/admin/foods/groups/${id}`, {
        newName: editName.trim(),
        description: editDesc.trim() || null,
      })
      setActionSuccessMsg(data.message)
      setEditingGroupId(null)
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đổi tên nhóm thất bại')
    } finally {
      setRenaming(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return
    setDeleting(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.delete(`/admin/foods/groups/${deletingGroup._id}`, {
        data: { targetGroup },
      })
      setActionSuccessMsg(data.message)
      setDeletingGroup(null)
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Xóa nhóm thất bại')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  const mergeTargetOptions = groups.filter((g) => g._id !== deletingGroup?._id)

  return (
    <div
      className="user-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="user-modal fgm-modal" role="dialog" aria-modal="true">
        <header className="fgm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="fgm-header-icon">
              <i className="bi bi-tags-fill" />
            </span>
            <div>
              <h2>Quản lý nhóm danh mục món ăn</h2>
              <small style={{ color: '#7a92a8' }}>
                Chuẩn hóa, đổi tên và gộp các nhóm món ăn trong toàn hệ thống
              </small>
            </div>
          </div>
          <button className="fm-close" aria-label="Đóng" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="fgm-body">
          {errorMsg && (
            <div className="fgm-alert fgm-alert--err">
              <i className="bi bi-exclamation-triangle-fill" /> {errorMsg}
            </div>
          )}
          {actionSuccessMsg && (
            <div className="fgm-alert fgm-alert--success">
              <i className="bi bi-check-circle-fill" /> {actionSuccessMsg}
            </div>
          )}

          {/* Form thêm nhóm mới */}
          <form className="fgm-add-box" onSubmit={handleCreateGroup}>
            <div className="fgm-add-inputs">
              <div style={{ flex: '1.2' }}>
                <input
                  className="fm-input"
                  placeholder="Tên nhóm mới (VD: Món chay, Đồ ăn dặm...)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>
              <div style={{ flex: '1.8' }}>
                <input
                  className="fm-input"
                  placeholder="Mô tả nhóm (tùy chọn)..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <button
              type="submit"
              className="frm-btn frm-btn--review"
              disabled={creating || !newGroupName.trim()}
            >
              {creating ? <span className="food-spinner-inline" /> : <i className="bi bi-plus-lg" />}
              <span>Thêm nhóm</span>
            </button>
          </form>

          {/* Khung xác nhận xóa / gộp nhóm */}
          {deletingGroup && (
            <div className="fgm-delete-confirm-box">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <i
                  className="bi bi-exclamation-octagon-fill"
                  style={{ fontSize: 20, color: '#dc2626', marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#991b1b', fontSize: 13.5 }}>
                    Xác nhận xóa / gộp nhóm: "{deletingGroup.name}"
                  </strong>
                  <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#475569' }}>
                    Nhóm này đang có <b>{deletingGroup.foodCount}</b> món ăn. Chọn nhóm mới để hệ thống tự động
                    chuyển toàn bộ các món này sang:
                  </p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="fm-select"
                      style={{ maxWidth: 280 }}
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                    >
                      {mergeTargetOptions.map((g) => (
                        <option key={g._id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="frm-btn frm-btn--reject"
                      style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Đang xử lý...' : `Xóa nhóm & Chuyển ${deletingGroup.foodCount} món`}
                    </button>
                    <button
                      type="button"
                      className="frm-btn frm-btn--detail"
                      onClick={() => setDeletingGroup(null)}
                      disabled={deleting}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bảng danh sách các nhóm */}
          <div className="fgm-table-wrap">
            <table className="fgm-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Tên nhóm</th>
                  <th style={{ width: '16%' }}>Số lượng món</th>
                  <th style={{ width: '38%' }}>Mô tả</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 30, color: '#7a92a8' }}>
                      <span className="food-spinner" style={{ marginRight: 8 }} /> Đang tải danh sách nhóm...
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 20, color: '#7a92a8' }}>
                      Chưa có nhóm món ăn nào.
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => {
                    const isEditing = editingGroupId === group._id
                    return (
                      <tr key={group._id} className={isEditing ? 'fgm-tr--editing' : ''}>
                        {/* Tên nhóm */}
                        <td>
                          {isEditing ? (
                            <input
                              className="fm-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              style={{ height: 32, fontSize: 13 }}
                            />
                          ) : (
                            <strong style={{ color: '#102a43', fontSize: 13.5 }}>{group.name}</strong>
                          )}
                        </td>

                        {/* Số lượng món */}
                        <td>
                          <span className="fgm-count-pill" title={`${group.foodCount} món ăn thuộc nhóm này`}>
                            <b>{group.foodCount}</b> món
                          </span>
                        </td>

                        {/* Mô tả nhóm */}
                        <td>
                          {isEditing ? (
                            <input
                              className="fm-input"
                              placeholder="Mô tả nhóm..."
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              style={{ height: 32, fontSize: 12.5 }}
                            />
                          ) : (
                            <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.45 }}>
                              {group.description || (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có mô tả</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td style={{ textAlign: 'right' }}>
                          {isEditing ? (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="frm-btn frm-btn--review"
                                style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                                onClick={() => handleSaveRename(group._id)}
                                disabled={renaming || !editName.trim()}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                className="frm-btn frm-btn--detail"
                                style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                                onClick={() => setEditingGroupId(null)}
                                disabled={renaming}
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="fgm-action-btn"
                                onClick={() => handleStartRename(group)}
                                title="Đổi tên nhóm (tự động cập nhật toàn bộ món ăn thuộc nhóm)"
                              >
                                <i className="bi bi-pencil" /> Đổi tên
                              </button>
                              <button
                                type="button"
                                className="fgm-action-btn fgm-action-btn--delete"
                                onClick={() => {
                                  setDeletingGroup(group)
                                  setTargetGroup(group.name === 'Khác' ? 'Cơm & Xôi' : 'Khác')
                                }}
                                title="Xóa nhóm và gộp món ăn sang nhóm khác"
                              >
                                <i className="bi bi-trash3" /> Xóa
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="fgm-footer">
          <small style={{ color: '#7a92a8' }}>
            Tổng cộng <b>{groups.length}</b> nhóm danh mục trong hệ thống
          </small>
          <button type="button" className="frm-btn frm-btn--detail" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  )
}
