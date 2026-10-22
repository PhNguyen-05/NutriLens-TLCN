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

module.exports = { uploadFileToCloudinary };
