/**
 * adminFoodGroupController.js
 * Quản lý nhóm món ăn (Food Groups): danh sách, tạo mới, đổi tên (cascade) và xóa/gộp nhóm.
 */

const Food = require('../models/Food');
const FoodGroup = require('../models/FoodGroup');
const FoodRequest = require('../models/FoodRequest');
const AdminActionLog = require('../models/AdminActionLog');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/admin/foods/groups
 * Danh sách nhóm món ăn kèm thống kê số lượng món thuộc mỗi nhóm.
 * Tối ưu hóa: Dùng $slice trực tiếp trong pipeline MongoDB để lấy mẫu tên món ăn.
 */
async function listFoodGroups(_req, res) {
  try {
    const groups = await FoodGroup.find({}).sort({ displayOrder: 1, name: 1 }).lean();

    // Tối ưu hóa Aggregation: gom nhóm và $slice tối đa 5 món ngay trong DB pipeline
    const counts = await Food.aggregate([
      {
        $group: {
          _id: '$foodGroup',
          count: { $sum: 1 },
          allSampleFoods: { $addToSet: '$name' },
        },
      },
      {
        $project: {
          count: 1,
          sampleFoods: { $slice: ['$allSampleFoods', 5] },
        },
      },
    ]);

    const countMap = new Map();
    counts.forEach((c) => {
      countMap.set(c._id || 'Khác', {
        count: c.count,
        sampleFoods: c.sampleFoods || [],
      });
    });

    const data = groups.map((g) => {
      const stats = countMap.get(g.name) || { count: 0, sampleFoods: [] };
      return {
        _id: g._id,
        name: g.name,
        description: g.description,
        displayOrder: g.displayOrder,
        isStandard: g.isStandard,
        foodCount: stats.count,
        sampleFoods: stats.sampleFoods,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[listFoodGroups] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách nhóm món ăn' });
  }
}

/**
 * POST /api/admin/foods/groups
 * Tạo mới nhóm món ăn
 */
async function createFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tên nhóm món ăn không được để trống' });
    }
    const cleanName = name.trim();
    const existing = await FoodGroup.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ message: `Nhóm món ăn "${existing.name}" đã tồn tại` });
    }

    const maxOrder = await FoodGroup.findOne({}).sort({ displayOrder: -1 }).lean();
    const nextOrder = (maxOrder?.displayOrder || 0) + 1;

    const newGroup = await FoodGroup.create({
      name: cleanName,
      description: description?.trim() || null,
      displayOrder: nextOrder,
      isStandard: false,
    });

    await AdminActionLog.create({
      adminId,
      actionType: 'create_food',
      targetType: 'FoodItem',
      targetId: newGroup._id,
      reason: `Tạo nhóm món ăn mới "${cleanName}"`,
      note: `ID nhóm: ${newGroup._id}`,
    });

    return res.status(201).json({
      success: true,
      message: `Tạo nhóm món ăn "${cleanName}" thành công`,
      data: newGroup,
    });
  } catch (err) {
    console.error('[createFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Tạo nhóm món ăn thất bại' });
  }
}

/**
 * PUT /api/admin/foods/groups/:id
 * Đổi tên nhóm và đồng bộ hàng loạt (cascade update) sang Food & FoodRequest
 */
async function renameFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { newName, description } = req.body;
    if (!newName || !newName.trim()) {
      return res.status(400).json({ message: 'Tên nhóm mới không được để trống' });
    }
    const cleanNew = newName.trim();

    const group = await FoodGroup.findById(id);
    if (!group) return res.status(404).json({ message: 'Nhóm món ăn không tồn tại' });

    const oldName = group.name;

    // Kiểm tra tên trùng lặp
    if (cleanNew.toLowerCase() !== oldName.toLowerCase()) {
      const dup = await FoodGroup.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanNew)}$`, 'i') } });
      if (dup) return res.status(409).json({ message: `Tên nhóm "${cleanNew}" đã tồn tại` });
    }

    group.name = cleanNew;
    if (description !== undefined) group.description = description?.trim() || null;
    await group.save();

    // Cascade update to Food and FoodRequest collections
    const foodRes = await Food.updateMany({ foodGroup: oldName }, { $set: { foodGroup: cleanNew } });
    const reqRes = await FoodRequest.updateMany({ foodGroup: oldName }, { $set: { foodGroup: cleanNew } });

    await AdminActionLog.create({
      adminId,
      actionType: 'update_food',
      targetType: 'FoodItem',
      targetId: group._id,
      reason: `Đổi tên nhóm món ăn từ "${oldName}" thành "${cleanNew}"`,
      note: `Cập nhật ${foodRes.modifiedCount} món ăn và ${reqRes.modifiedCount} yêu cầu`,
    });

    return res.status(200).json({
      success: true,
      message: `Đổi tên nhóm thành "${cleanNew}" thành công (${foodRes.modifiedCount} món ăn được đồng bộ)`,
      data: group,
      modifiedFoods: foodRes.modifiedCount,
    });
  } catch (err) {
    console.error('[renameFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Đổi tên nhóm thất bại' });
  }
}

/**
 * DELETE /api/admin/foods/groups/:id
 * Xóa nhóm món ăn và gộp/chuyển món ăn sang nhóm đích
 */
async function deleteFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { targetGroup = 'Khác' } = req.body;

    const group = await FoodGroup.findById(id);
    if (!group) return res.status(404).json({ message: 'Nhóm món ăn không tồn tại' });

    const groupName = group.name;
    const cleanTarget = (targetGroup && targetGroup.trim()) || 'Khác';

    if (groupName.toLowerCase() === cleanTarget.toLowerCase()) {
      return res.status(400).json({ message: 'Nhóm chuyển đổi phải khác nhóm cần xóa' });
    }

    // Chuyển toàn bộ món thuộc nhóm cũ sang targetGroup
    const foodRes = await Food.updateMany({ foodGroup: groupName }, { $set: { foodGroup: cleanTarget } });
    const reqRes = await FoodRequest.updateMany({ foodGroup: groupName }, { $set: { foodGroup: cleanTarget } });

    await group.deleteOne();

    await AdminActionLog.create({
      adminId,
      actionType: 'delete_food',
      targetType: 'FoodItem',
      targetId: group._id,
      reason: `Xóa nhóm món ăn "${groupName}" và chuyển ${foodRes.modifiedCount} món sang nhóm "${cleanTarget}"`,
      note: `Đồng bộ ${foodRes.modifiedCount} món ăn`,
    });

    return res.status(200).json({
      success: true,
      message: `Đã xóa nhóm "${groupName}" thành công, chuyển ${foodRes.modifiedCount} món sang "${cleanTarget}"`,
      modifiedFoods: foodRes.modifiedCount,
    });
  } catch (err) {
    console.error('[deleteFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Xóa nhóm món ăn thất bại' });
  }
}

module.exports = {
  listFoodGroups,
  createFoodGroup,
  renameFoodGroup,
  deleteFoodGroup,
};
