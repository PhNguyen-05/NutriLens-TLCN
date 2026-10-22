const mongoose = require('mongoose');
const Food = require('../models/Food');

async function getFoodImage(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Không tìm thấy ảnh món ăn' });
    }

    const food = await Food.findById(id).select('imageData imageContentType');
    if (!food?.imageData) return res.status(404).json({ message: 'Không tìm thấy ảnh món ăn' });

    const imageBuffer = Buffer.from(food.imageData);
    res.setHeader('Content-Type', food.imageContentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(imageBuffer.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.end(imageBuffer);
  } catch (error) {
    console.error('[getFoodImage] Lỗi:', error.message);
    return res.status(500).json({ message: 'Không thể tải ảnh món ăn' });
  }
}

module.exports = { getFoodImage };
