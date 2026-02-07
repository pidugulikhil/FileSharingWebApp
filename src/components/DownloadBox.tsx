import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LinkIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { downloadFile, fetchFileInfo } from '../utils/fileUtils';
import { FileInfo } from '../types';

interface DownloadBoxProps {
  onDownloadComplete: () => void;
  prefillId?: string | null;
}

const DownloadBox: React.FC<DownloadBoxProps> = ({ onDownloadComplete, prefillId }) => {
  const [downloadId, setDownloadId] = useState('');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRequestRef = useRef(0);

  useEffect(() => {
    if (prefillId) {
      setDownloadId(prefillId);
    }
  }, [prefillId]);

  useEffect(() => {
    setFileInfo(null);
    setInfoError(null);
  }, [downloadId]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const requestFileInfo = useCallback(async (id: string, options: { silent?: boolean } = {}) => {
    const token = ++previewRequestRef.current;
    setIsFetchingInfo(true);
    if (!options.silent) {
      setInfoError(null);
    }

    try {
      const info = await fetchFileInfo(id);
      if (previewRequestRef.current !== token) return;
      setFileInfo(info);
      setInfoError(null);
      if (!options.silent) {
        toast.success('File details ready');
      }
    } catch (error) {
      if (previewRequestRef.current !== token) return;
      const message = (error as Error).message || 'Unable to fetch file details';
      setFileInfo(null);
      setInfoError(message);
      if (!options.silent) {
        toast.error(message);
      }
    } finally {
      if (previewRequestRef.current === token) {
        setIsFetchingInfo(false);
      }
    }
  }, [fetchFileInfo]);

  const handlePreview = () => {
    const id = downloadId.trim();
    if (!id) {
      toast.error('Enter a File ID to preview');
      return;
    }
    requestFileInfo(id);
  };

  useEffect(() => {
    previewRequestRef.current += 1;
    setIsFetchingInfo(false);

    const trimmed = downloadId.trim();
    if (!trimmed) {
      setFileInfo(null);
      setInfoError(null);
      return;
    }

    const handle = setTimeout(() => {
      requestFileInfo(trimmed, { silent: true });
    }, 600);

    return () => {
      clearTimeout(handle);
    };
  }, [downloadId, requestFileInfo]);

  const handleDownload = async () => {
    if (!downloadId.trim()) {
      toast.error('Please enter a valid File ID');
      return;
    }
    if (!fileInfo) {
      toast.info('Preview the file first to confirm details');
      return;
    }

    setIsDownloading(true);

    try {
      const success = await downloadFile(downloadId.trim());
      
      if (success) {
        toast.success('File downloaded successfully!');
        onDownloadComplete();
      } else {
        toast.error('Download failed. The link may be invalid or expired.');
      }
    } catch (error) {
      toast.error('An error occurred during download');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="download-panel surface-card interactive-card">
      <div className="download-header">
        <div className="download-icon">
          <LinkIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="eyebrow-text">Quick pull</p>
          <h3>Download with your File ID</h3>
          <p className="download-subcopy">Files stay live 24h . </p>
        </div>
      </div>

      <div className="download-input-grid">
        <input
          id="download-id"
          type="text"
          value={downloadId}
          onChange={(e) => setDownloadId(e.target.value)}
          placeholder="Enter File ID"
          className="download-input"
        />
        <div className="download-actions">
          <button
            disabled={isFetchingInfo || !downloadId.trim()}
            className="download-cta secondary interactive-cta"
            onClick={handlePreview}
          >
            {isFetchingInfo ? 'Loading…' : 'Preview'}
          </button>
          <button
            disabled={isDownloading || !fileInfo}
            className="download-cta interactive-cta"
            onClick={handleDownload}
          >
            {isDownloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>

      <p className="download-helper">Need the ID? It appears right after each upload and you can share it anywhere.</p>
      {infoError && <p className="download-error">{infoError}</p>}

      {fileInfo && (
        <div className="download-preview-card">
          <div className="download-preview-grid">
            <div>
              <p className="meta-label">File name</p>
              <p className="meta-value">{fileInfo.filename}</p>
            </div>
            <div>
              <p className="meta-label">Size</p>
              <p className="meta-value">{formatBytes(fileInfo.size)}</p>
            </div>
            <div>
              <p className="meta-label">Expires</p>
              <p className="meta-value">{new Date(fileInfo.expiresAt).toLocaleString()}</p>
            </div>
          </div>

          {fileInfo.isZip && fileInfo.zipContents && fileInfo.zipContents.length > 0 && (
            <div className="zip-preview">
              <p className="meta-label">ZIP contents ({fileInfo.zipContents.length}{fileInfo.zipTruncated ? '+' : ''})</p>
              <div className="zip-list">
                {fileInfo.zipContents.map((entry) => (
                  <div key={entry.name} className="zip-item">
                    <span>{entry.name}</span>
                    <span>{formatBytes(entry.size)}</span>
                  </div>
                ))}
              </div>
              {fileInfo.zipTruncated && (
                <p className="zip-footnote">Showing first 200 files · download to see the full archive.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DownloadBox;