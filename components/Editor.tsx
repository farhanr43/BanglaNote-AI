import React, { useState } from 'react';
import Button from './Button';
import { AIActionType } from '../types';

interface EditorProps {
  text: string;
  setText: (text: string) => void;
  onAIAction: (type: AIActionType) => void;
  isProcessing: boolean;
}

const Editor: React.FC<EditorProps> = ({ text, setText, onAIAction, isProcessing }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = (format: 'txt' | 'doc') => {
    const element = document.createElement("a");
    let file: Blob;
    let extension: string;

    if (format === 'doc') {
      // HTML wrapper with explicit charset for Bangla support
      const htmlContent = `
        <!DOCTYPE html>
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Export HTML To Doc</title>
        </head>
        <body>
          ${text.replace(/\n/g, '<br/>')}
        </body>
        </html>
      `;
      file = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
      extension = 'doc';
    } else {
      // Plain text with utf-8 charset
      file = new Blob([text], { type: 'text/plain;charset=utf-8' });
      extension = 'txt';
    }

    element.href = URL.createObjectURL(file);
    element.download = `BanglaNote_Export.${extension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setIsDownloadOpen(false);
  };

  const handlePdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print as PDF');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>BanglaNote Export</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Noto Sans Bengali', sans-serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
            margin: 0;
            padding: 2cm;
          }
          @page {
            size: A4;
            margin: 0;
          }
          .content {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <div class="content">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <script>
          document.fonts.ready.then(() => {
            window.print();
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setIsDownloadOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        
        {/* Left Side: AI Tools - Flex wrap enables multi-line buttons on mobile without slider */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 hidden lg:inline-block">AI Tools</span>
          <Button 
            variant="ghost" 
            className="text-xs !px-2 !py-1.5 whitespace-nowrap" 
            onClick={() => onAIAction(AIActionType.GRAMMAR)}
            disabled={isProcessing}
          >
            Fix Grammar
          </Button>
          <Button 
            variant="ghost" 
            className="text-xs !px-2 !py-1.5 whitespace-nowrap" 
            onClick={() => onAIAction(AIActionType.FORMAT)}
            disabled={isProcessing}
          >
            Format Note
          </Button>
          <Button 
            variant="ghost" 
            className="text-xs !px-2 !py-1.5 whitespace-nowrap" 
            onClick={() => onAIAction(AIActionType.SUMMARY)}
            disabled={isProcessing}
          >
            Summarize
          </Button>
          <Button 
            variant="ghost" 
            className="text-xs !px-2 !py-1.5 whitespace-nowrap" 
            onClick={() => onAIAction(AIActionType.TRANSLATE)}
            disabled={isProcessing}
          >
            Translate
          </Button>
        </div>
        
        {/* Right Side: Actions - Aligned to end on desktop, wraps naturally on mobile */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start sm:border-l sm:border-gray-300 sm:dark:border-gray-600 sm:pl-3">
          <Button 
            variant="secondary" 
            className="!py-1.5 !px-3 text-xs"
            onClick={handleCopy}
          >
             {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
          </Button>
          
          <div className="relative">
            <Button 
              variant="primary" 
              className="!py-1.5 !px-3 text-xs"
              onClick={() => setIsDownloadOpen(!isDownloadOpen)}
            >
              Download
            </Button>
            
            {/* Click-away listener overlay */}
            {isDownloadOpen && (
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsDownloadOpen(false)} 
              />
            )}

            {/* Dropdown Menu */}
            {isDownloadOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 z-40 animate-in fade-in zoom-in-95 duration-100">
                <button 
                  onClick={() => handleDownload('txt')} 
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-gray-700 first:rounded-t-md transition-colors"
                >
                  As .txt
                </button>
                <button 
                  onClick={() => handleDownload('doc')} 
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors"
                >
                  As .doc
                </button>
                <button 
                  onClick={handlePdf} 
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 last:rounded-b-md transition-colors"
                >
                  As PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Area */}
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-full p-6 resize-none focus:outline-none bg-transparent text-gray-800 dark:text-gray-200 font-bengali text-lg md:text-xl leading-relaxed"
          placeholder="Extracted text will appear here. You can edit it directly."
          disabled={isProcessing}
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"></div>
              <p className="mt-4 text-teal-700 dark:text-teal-300 font-medium animate-pulse">Processing with AI...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Editor;