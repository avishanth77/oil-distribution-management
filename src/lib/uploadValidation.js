// Shared validation for user-supplied document uploads (invoices, receipts).
// Files are read as base64 data URLs and stored inline, so an unvalidated
// upload is both a stored-XSS vector (e.g. an SVG carrying script) and a way
// to exhaust the browser's localStorage quota.

// Only image and PDF types are accepted. Notably absent: SVG, which can carry
// executable script when opened directly in a new tab.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']);

// Keeps base64 growth inside both the localStorage quota and a sane row size.
export const MAX_UPLOAD_BYTES = 1_500_000;

export function validateUpload(file) {
  if (!file) {
    return { ok: false, error: 'No file selected.' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = (MAX_UPLOAD_BYTES / 1_000_000).toFixed(1);
    return { ok: false, error: `File is too large. Maximum size is ${limitMb} MB.` };
  }

  if (file.size === 0) {
    return { ok: false, error: 'The selected file is empty.' };
  }

  const mime = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  // Both checks must pass: a spoofed .pdf name with a text/html MIME type is
  // exactly the case an extension-only check would miss.
  if (!ALLOWED_MIME_TYPES.has(mime) || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: 'Unsupported file type. Upload a JPG, PNG, WEBP, HEIC, or PDF document.',
    };
  }

  return { ok: true };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}
