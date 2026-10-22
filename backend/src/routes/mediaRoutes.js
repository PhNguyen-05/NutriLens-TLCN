const express = require('express');
const mongoose = require('mongoose');
const { getBucket } = require('../services/mediaStorage');

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Không tìm thấy tệp' });
  }

  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getBucket();
    const file = await bucket.find({ _id: id }).next();
    if (!file) return res.status(404).json({ message: 'Không tìm thấy tệp' });

    res.setHeader('Content-Type', file.contentType || file.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const downloadStream = bucket.openDownloadStream(id);
    downloadStream.on('error', (error) => {
      if (res.headersSent) return res.destroy(error);
      return next(error);
    });
    return downloadStream.pipe(res);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
