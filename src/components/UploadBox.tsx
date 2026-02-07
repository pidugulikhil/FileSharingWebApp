import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, FileImage, X, Folder } from 'lucide-react';
import { toast } from 'react-toastify';
import ProgressBar from './ProgressBar';
import { uploadFile, generatePreview, revokePreview, getFileType, uploadFolder } from '../utils/fileUtils';
import { FileWithPreview, UploadProgress, UploadResult } from '../types';

interface UploadBoxProps {
  onUploadComplete: (result: UploadResult) => void;
}

const UploadBox: React.FC<UploadBoxProps> = ({ onUploadComplete }) => {
  const uploadSuccessToastId = 'toast-upload-success';
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ name: string; files: File[]; size: number } | null>(null);
  const [selectionMode, setSelectionMode] = useState<'file' | 'folder'>('file');
  const [uploadStatus, setUploadStatus] = useState<UploadProgress>({
    progress: 0,
    isUploading: false,
    isComplete: false,
    isError: false
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    const hasDirectoryEntries = acceptedFiles.some(
      file => (file as File & { webkitRelativePath?: string }).webkitRelativePath
    );

    if (selectionMode === 'file') {
      if (hasDirectoryEntries) {
        toast.error('Switch to folder mode to upload directories.');
        return;
      }

      const file = generatePreview(acceptedFiles[0]);
      setSelectedFile(file);
      setSelectedFolder(null);

      const audio = new Audio('/drop-sound.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
      toast.success('File selected successfully!');
      return;
    }

    if (!hasDirectoryEntries) {
      toast.error('Use single file mode for individual files.');
      return;
    }

    const firstPath = (acceptedFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
    const folderName = firstPath ? firstPath.split('/')[0] : acceptedFiles[0].name.replace(/\.[^.]+$/, '') || 'Folder';
    const totalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    setSelectedFolder({ name: folderName || 'Folder', files: acceptedFiles, size: totalSize });
    setSelectedFile(null);
    toast.success('Folder added successfully!');
  }, [selectionMode]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    maxFiles: selectionMode === 'folder' ? 256 : 1,
    multiple: selectionMode === 'folder',
    maxSize: 100 * 1024 * 1024, // 100MB per file
  });

  const inputProps = getInputProps(
    selectionMode === 'folder'
      ? ({ webkitdirectory: 'true', directory: 'true' } as any)
      : {}
  );

  const handleStartUpload = async () => {
    if (!selectedFile && !selectedFolder) return;
    
    setUploadStatus({
      progress: 0,
      isUploading: true,
      isComplete: false,
      isError: false
    });

    const progressInterval = setInterval(() => {
      setUploadStatus(prev => {
        if (prev.progress >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return {
          ...prev,
          progress: Math.min(prev.progress + Math.random() * 10, 95)
        };
      });
    }, 300);

    try {
      let result: UploadResult;
      if (selectedFolder) {
        result = await uploadFolder(selectedFolder.files, selectedFolder.name);
      } else if (selectedFile) {
        result = await uploadFile(selectedFile);
      } else {
        throw new Error('No file selected');
      }

      clearInterval(progressInterval);
      setUploadStatus({
        progress: 100,
        isUploading: false,
        isComplete: true,
        isError: false,
        fileUrl: result.downloadUrl
      });

      onUploadComplete(result);
      toast.dismiss(uploadSuccessToastId);
      toast.success('Upload completed successfully!', { toastId: uploadSuccessToastId });
    } catch (error) {
      clearInterval(progressInterval);
      setUploadStatus({
        progress: 0,
        isUploading: false,
        isComplete: false,
        isError: true
      });
      toast.error((error as Error).message || 'Upload failed. Please try again.');
    }
  };

  const handleClearFile = () => {
    if (selectedFile) {
      revokePreview(selectedFile);
    }
    setSelectedFile(null);
    setSelectedFolder(null);
    setUploadStatus({
      progress: 0,
      isUploading: false,
      isComplete: false,
      isError: false
    });
  };

  const handleModeChange = (mode: 'file' | 'folder') => {
    if (mode === selectionMode) return;
    if (uploadStatus.isUploading) {
      toast.info('Please wait for the current upload to finish.');
      return;
    }
    handleClearFile();
    setSelectionMode(mode);
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      if (selectedFile) {
        revokePreview(selectedFile);
      }
    };
  }, [selectedFile]);

  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  // Get the border color based on drag state
  const getBorderColor = () => {
    if (isDragAccept) return 'border-green-400';
    if (isDragReject) return 'border-red-400';
    if (isDragActive) return 'border-blue-400';
    return 'border-slate-200';
  };

  // Render preview based on file type
  const renderPreview = () => {
    if (selectedFolder) {
      return (
        <div className="muted-card rounded-lg p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-200/60 flex items-center justify-center">
              <Folder className="w-8 h-8 text-blue-700" />
            </div>
            <div>
              <p className="text-base font-semibold">
                {selectedFolder.name} (folder)
              </p>
              <p className="text-sm opacity-80">
                {selectedFolder.files.length} items · {formatSize(selectedFolder.size)}
              </p>
              <p className="text-xs uppercase tracking-wide opacity-60 mt-1">
                Will be zipped automatically
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!selectedFile) return null;

    const fileType = getFileType(selectedFile);

    if (fileType === 'image' && selectedFile.preview) {
      return (
        <div className="relative w-full h-48 overflow-hidden rounded-lg">
          <img 
            src={selectedFile.preview} 
            alt={selectedFile.name} 
            className="w-full h-full object-contain" 
          />
        </div>
      );
    }

    return (
      <div className="muted-card flex items-center justify-center w-full h-48 rounded-lg">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            {fileType === 'pdf' ? (
              <File className="w-16 h-16 text-red-400" />
            ) : fileType === 'video' ? (
              <FileImage className="w-16 h-16 text-blue-400" />
            ) : fileType === 'audio' ? (
              <FileImage className="w-16 h-16 text-green-400" />
            ) : (
              <File className="w-16 h-16 text-gray-400" />
            )}
          </div>
          <p className="text-sm font-medium truncate max-w-xs">{selectedFile.name}</p>
          <p className="text-xs text-gray-500">
            {formatSize(selectedFile.size)}
          </p>
        </div>
      </div>
    );
  };

  const hasSelection = Boolean(selectedFile || selectedFolder);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="selection-toggle">
        <button
          type="button"
          className={`tab-button ${selectionMode === 'file' ? 'active' : ''}`}
          onClick={() => handleModeChange('file')}
          disabled={uploadStatus.isUploading}
        >
          Single File
        </button>
        <button
          type="button"
          className={`tab-button ${selectionMode === 'folder' ? 'active' : ''}`}
          onClick={() => handleModeChange('folder')}
          disabled={uploadStatus.isUploading}
        >
          Folder
        </button>
      </div>

      {!hasSelection ? (
        <div
          className={`surface-card interactive-card p-8 mb-6 ${getBorderColor()} border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300`}
          {...getRootProps()}
        >
          <input {...inputProps} />

          <div className="space-y-4">
            <Upload className="mx-auto h-16 w-16 text-primary" />
            
            <h3 className="text-xl font-medium">
              {isDragActive
                ? 'Release to drop'
                : selectionMode === 'file'
                ? 'Select a single file'
                : 'Select an entire folder'}
            </h3>
            
            <p className="text-gray-400">
              {selectionMode === 'file' ? 'Drag & drop or browse for one file.' : 'Drop or browse a folder to zip automatically.'}
            </p>
            
            <p className="text-sm text-gray-500">
              Max 100MB per file · folders zip automatically
            </p>
          </div>
        </div>
      ) : (
        <div className="surface-card interactive-card p-6 mb-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              {selectedFolder ? `${selectedFolder.name} (folder)` : selectedFile?.name || 'Selected'}
            </h3>
            <button 
              onClick={handleClearFile}
              className="p-1 rounded-full hover:bg-gray-700 transition-colors"
              disabled={uploadStatus.isUploading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {renderPreview()}
          
          {uploadStatus.isUploading || uploadStatus.isComplete || uploadStatus.isError ? (
            <ProgressBar 
              progress={uploadStatus.progress} 
              isComplete={uploadStatus.isComplete}
              isError={uploadStatus.isError}
            />
          ) : (
            <button
              className="upload-primary"
              onClick={handleStartUpload}
            >
              Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadBox;