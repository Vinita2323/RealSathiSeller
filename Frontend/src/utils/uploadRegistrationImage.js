import API from '../services/api';

/**
 * Compress a data-URL or Blob for document uploads, then POST multipart
 * /api/upload so registration payment requests stay small (avoids nginx 413).
 * Supports images (jpg/png/webp/gif) and PDF documents.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — matches backend multer limit

export const dataUrlToBlob = (dataUrl) => {
  const parts = String(dataUrl).split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(parts[1] || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const isPdfValue = (value) => {
  if (!value) return false;
  if (typeof value === 'string') {
    return (
      value.startsWith('data:application/pdf') ||
      /\.pdf(\?|$)/i.test(value)
    );
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    if (value.type === 'application/pdf') return true;
    if (typeof File !== 'undefined' && value instanceof File && /\.pdf$/i.test(value.name || '')) {
      return true;
    }
  }
  return false;
};

const isImageValue = (value) => {
  if (!value) return false;
  if (typeof value === 'string') {
    return value.startsWith('data:image/');
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    if (value.type && value.type.startsWith('image/')) return true;
    if (typeof File !== 'undefined' && value instanceof File) {
      return /\.(jpe?g|png|webp|gif|svg)$/i.test(value.name || '');
    }
  }
  return false;
};

export const compressImageFile = (fileOrBlob, { maxWidth = 1280, quality = 0.72 } = {}) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('Could not compress image'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image. Use JPG, PNG, WEBP, or PDF.'));
    };
    img.src = objectUrl;
  });

const postMultipart = async (blob, filename, folder) => {
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB)`);
  }
  const formData = new FormData();
  formData.append('image', blob, filename);
  const response = await API.post(`/upload?folder=${folder}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const url = response?.data?.imageUrl || response?.data?.filePath || '';
  if (!url) throw new Error('Image upload did not return a URL');
  return url;
};

export const uploadRegistrationImage = async (value, folder = 'misc', compressOptions = {}) => {
  if (!value) return '';

  // Already a hosted URL — nothing to upload
  if (typeof value === 'string') {
    if (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/uploads/')
    ) {
      return value;
    }
  }

  // PDF — upload as-is (cannot compress via canvas)
  if (isPdfValue(value)) {
    let blob;
    let filename = `doc-${Date.now()}.pdf`;
    if (typeof value === 'string' && value.startsWith('data:')) {
      blob = dataUrlToBlob(value);
    } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
      blob = value;
      if (typeof File !== 'undefined' && value instanceof File && value.name) {
        filename = value.name.replace(/[^\w.\-]+/g, '_');
        if (!/\.pdf$/i.test(filename)) filename = `${filename}.pdf`;
      }
    } else {
      return '';
    }
    return postMultipart(blob, filename, folder);
  }

  // Image data-URL or Blob/File
  if (!isImageValue(value) && !(typeof value === 'string' && value.startsWith('data:image/'))) {
    const name =
      typeof File !== 'undefined' && value instanceof File
        ? value.name
        : 'file';
    throw new Error(
      `"${name}" is not a supported type. Please upload JPG, PNG, WEBP, GIF, or PDF.`
    );
  }

  let rawBlob;
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    rawBlob = dataUrlToBlob(value);
  } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
    rawBlob = value;
  } else {
    return '';
  }

  const compressOpts = {
    maxWidth: compressOptions.maxWidth ?? 1280,
    quality: compressOptions.quality ?? 0.72,
  };

  let compressed;
  try {
    compressed = await compressImageFile(rawBlob, compressOpts);
  } catch (err) {
    // Fallback: upload original image bytes if canvas compress fails (e.g. some HEIC→jpeg paths)
    if (rawBlob.type && rawBlob.type.startsWith('image/') && !/heic|heif/i.test(rawBlob.type)) {
      const ext = (rawBlob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      return postMultipart(rawBlob, `doc-${Date.now()}.${ext}`, folder);
    }
    throw err;
  }

  return postMultipart(compressed, `doc-${Date.now()}.jpg`, folder);
};
