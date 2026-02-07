export interface FileWithPreview extends File {
  preview?: string;
}

export interface UploadProgress {
  progress: number;
  isUploading: boolean;
  isComplete: boolean;
  isError: boolean;
  fileUrl?: string;
}

export interface UploadResult {
  id: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
  size: number;
}

export interface FileInfo {
  id: string;
  filename: string;
  size: number;
  expiresAt: string;
  uploadedAt: string;
  isZip: boolean;
  zipContents?: Array<{ name: string; size: number }>;
  zipTruncated?: boolean;
}

export interface SocialLink {
  name: string;
  url: string;
  icon: string;
}