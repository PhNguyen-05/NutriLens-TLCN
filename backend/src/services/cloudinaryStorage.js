const crypto = require('crypto');

function isCloudinaryConfigured() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  return Boolean(cloudName && apiKey && apiSecret);
}

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Thiếu cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET');
  }
  if (!/^[a-z0-9-]+$/i.test(cloudName)) {
    throw new Error('CLOUDINARY_CLOUD_NAME không hợp lệ');
  }

  return { cloudName, apiKey, apiSecret };
}

async function uploadFileToCloudinary(file, folder) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Tệp tải lên không có dữ liệu hợp lệ');
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const formData = new FormData();
  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'upload');
  formData.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
    },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Cloudinary trả về phản hồi không hợp lệ');
  }

  if (!response.ok || !result.secure_url) {
    const error = new Error(result.error?.message || 'Không thể tải tệp lên Cloudinary');
    error.status = 502;
    throw error;
  }

  return result.secure_url;
}

function extractPublicIdFromCloudinaryUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.includes('res.cloudinary.com')) return null;
  // Cloudinary URL format: .../upload/(transforms/)?(v\d+/)?(folder/public_id)(.ext)?
  const match = imageUrl.match(/\/upload\/(?:[a-zA-Z0-9_-]+,[a-zA-Z0-9_,-]+\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:[?#].*)?$/i);
  if (!match || !match[1]) return null;
  return match[1];
}

/**
 * Xóa ảnh trên Cloudinary để tránh rác bộ nhớ (Orphaned images)
 * @param {string} imageUrl URL ảnh trên Cloudinary
 * @returns {Promise<boolean>}
 */
async function deleteFileFromCloudinary(imageUrl) {
  if (!isCloudinaryConfigured() || !imageUrl) return false;
  try {
    const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
    if (!publicId) return false;

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });

    const result = await response.json().catch(() => null);
    return result?.result === 'ok';
  } catch (err) {
    console.warn('[cloudinaryStorage] Không thể xóa ảnh trên Cloudinary:', err.message);
    return false;
  }
}

module.exports = {
  uploadFileToCloudinary,
  deleteFileFromCloudinary,
  isCloudinaryConfigured,
  extractPublicIdFromCloudinaryUrl,
};
