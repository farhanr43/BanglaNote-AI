import React, { useCallback, useState } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcess(e.target.files[0]);
    }
  }, [onFileSelect]);

  const validateAndProcess = (file: File) => {
    // Basic validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Currently only JPG, PNG, WEBP images and PDF files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB
      alert('File is too large. Please upload a file under 10MB.');
      return;
    }
    onFileSelect(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        group relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all duration-300
        ${isDragging 
          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 scale-[1.01]' 
          : 'border-gray-300 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-600 bg-gray-50 dark:bg-gray-800/50 hover:shadow-md'}
        ${isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept="image/jpeg, image/png, image/webp, application/pdf"
        onChange={handleFileInput}
        disabled={isLoading}
      />
      
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center h-full cursor-pointer">
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-full shadow-sm mb-4 animate-glow">
          <svg className="w-8 h-8 text-teal-600 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Upload Note or PDF
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
          Drag & drop or click to upload.<br/>Supports JPG, PNG, PDF.
        </p>
        <span className="text-xs text-teal-600 font-medium bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full">
          AI Powered OCR
        </span>
      </label>
    </div>
  );
};

export default UploadZone;