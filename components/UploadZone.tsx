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
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Currently only JPG, PNG, and WEBP images are supported for client-side processing.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB
      alert('File is too large. Please upload an image under 10MB.');
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
        relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all duration-300
        ${isDragging 
          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
          : 'border-gray-300 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-600 bg-gray-50 dark:bg-gray-800/50'}
        ${isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept="image/jpeg, image/png, image/webp"
        onChange={handleFileInput}
        disabled={isLoading}
      />
      
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center h-full cursor-pointer">
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-full shadow-sm mb-4">
          <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Upload Handwritten Note
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
          Drag & drop or click to upload. Supports JPG, PNG.
        </p>
        <span className="text-xs text-teal-600 font-medium bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full">
          AI Powered OCR
        </span>
      </label>
    </div>
  );
};

export default UploadZone;