import React from 'react';

interface ProgressBarProps {
  progress: number;
  isComplete: boolean;
  isError: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, isComplete, isError }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const getProgressColor = () => {
    if (isError) return 'var(--danger-color)';
    if (isComplete) return 'var(--success-color)';
    return 'var(--primary-color)';
  };

  const statusLabel = isError ? 'Upload Failed' : isComplete ? 'Upload Complete' : 'Uploading…';

  return (
    <div className="w-full mb-6">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium">{statusLabel}</span>
        <span className="text-sm font-medium">{Math.round(clampedProgress)}%</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: getProgressColor(),
            boxShadow: `0 0 10px ${getProgressColor()}`,
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;