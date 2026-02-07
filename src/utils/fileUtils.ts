import JSZip from 'jszip';
import { FileWithPreview, UploadResult, FileInfo } from '../types';

const resolveDefaultBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      return 'http://localhost:80/server/fileShare.php';
    }
    return `${window.location.origin.replace(/\/$/, '')}/server/fileShare.php`;
  }
  return import.meta.env.DEV ? 'http://localhost:80/server/fileShare.php' : '/server/fileShare.php';
};

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || resolveDefaultBaseUrl();

const getEndpoint = () => {
  if (rawBaseUrl.endsWith('.php')) return rawBaseUrl;
  return `${rawBaseUrl.replace(/\/$/, '')}/fileShare.php`;
};

const handleApiResponse = async (response: Response): Promise<UploadResult> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Upload failed. Please try again.');
  }
  return payload.data as UploadResult;
};

const sendToServer = async (file: File | Blob, filename: string): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('file', file, filename);

  const response = await fetch(getEndpoint(), {
    method: 'POST',
    body: formData,
  });

  return handleApiResponse(response);
};

// Upload a single file directly to the backend
export const uploadFile = async (file: File): Promise<UploadResult> => {
  return sendToServer(file, file.name);
};

// Zip folder contents and upload as a single archive
export const uploadFolder = async (files: File[], folderLabel?: string): Promise<UploadResult> => {
  const zip = new JSZip();
  files.forEach((file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const entryName = relativePath && relativePath.length > 0
      ? relativePath
      : `${folderLabel || 'folder'}/${file.name}`;
    zip.file(entryName, file);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = `${folderLabel || 'folder'}.zip`;
  return sendToServer(blob, safeName);
};

// Download a shared file by ID
export const downloadFile = async (id: string): Promise<boolean> => {
  const response = await fetch(`${getEndpoint()}?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error('Download failed. The link may be invalid or expired.');
  }

  const blob = await response.blob();
  const filename = response.headers.get('X-Fileshare-Filename') || `FileShareV1-${id}`;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

export const fetchFileInfo = async (id: string): Promise<FileInfo> => {
  const response = await fetch(`${getEndpoint()}?info=1&id=${encodeURIComponent(id)}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await response.text();
    throw new Error('Server preview support is missing. Deploy the latest server/fileShare.php.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Unable to fetch file details.');
  }
  return payload.data as FileInfo;
};

// Get file type for preview
export const getFileType = (file: File): string => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('text/')) return 'text';
  if (file.type.includes('pdf')) return 'pdf';
  return 'other';
};

// Generate a preview URL for the file if possible
export const generatePreview = (file: File): FileWithPreview => {
  const fileWithPreview = file as FileWithPreview;
  
  if (file.type.startsWith('image/')) {
    fileWithPreview.preview = URL.createObjectURL(file);
  }
  
  return fileWithPreview;
};

// Clean up preview URLs to prevent memory leaks
export const revokePreview = (file: FileWithPreview): void => {
  if (file.preview) {
    URL.revokeObjectURL(file.preview);
  }
};