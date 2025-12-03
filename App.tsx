import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadZone from './components/UploadZone';
import Editor from './components/Editor';
import History from './components/History';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import FeedbackModal from './components/FeedbackModal';
import AdminPanel from './components/AdminPanel';
import { ProcessingStatus, AIActionType, HistoryItem, FeedbackItem } from './types';
import { processImage, transformText, fileToGenerativePart } from './services/geminiService';
import { MOCK_HISTORY_KEY } from './constants';

const FEEDBACK_STORAGE_KEY = 'banglanote_feedback';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [extractedText, setExtractedText] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'HOME' | 'PRIVACY' | 'TERMS' | 'ADMIN'>('HOME');
  
  // Feedback States
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);

  // Theme Toggling
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Load History & Feedback
  useEffect(() => {
    const savedHistory = localStorage.getItem(MOCK_HISTORY_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedFeedback = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (savedFeedback) {
      try {
        setFeedbackList(JSON.parse(savedFeedback));
      } catch (e) {
        console.error("Failed to parse feedback", e);
      }
    }
  }, []);

  const saveToHistory = (text: string) => {
    if (!text.trim()) return;
    
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      previewText: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      fullText: text,
      date: new Date().toISOString()
    };
    
    const newHistory = [newItem, ...history].slice(0, 5); // Keep last 5
    setHistory(newHistory);
    localStorage.setItem(MOCK_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const handleFileSelect = async (file: File) => {
    setStatus(ProcessingStatus.UPLOADING);
    setExtractedText("");
    
    try {
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setOriginalImage(objectUrl);

      // Convert to Base64 for API
      const base64Data = await fileToGenerativePart(file);
      
      setStatus(ProcessingStatus.PROCESSING);
      
      // Call Gemini API
      const text = await processImage(base64Data, file.type);
      
      setExtractedText(text);
      saveToHistory(text);
      setStatus(ProcessingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      alert("Failed to process image. Please try again.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleAIAction = async (action: AIActionType) => {
    if (!extractedText) return;
    
    const previousText = extractedText;
    setStatus(ProcessingStatus.PROCESSING);
    
    try {
      const newText = await transformText(extractedText, action);
      setExtractedText(newText);
      setStatus(ProcessingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      alert("AI Processing failed.");
      setExtractedText(previousText); // Revert
      setStatus(ProcessingStatus.IDLE);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(MOCK_HISTORY_KEY);
  };

  const resetAppState = () => {
    setStatus(ProcessingStatus.IDLE);
    setExtractedText("");
    setOriginalImage(null);
    setCurrentView('HOME');
  };

  const handleFeedbackSubmit = (name: string, message: string) => {
    const newFeedback: FeedbackItem = {
      id: Date.now().toString(),
      name,
      message,
      date: new Date().toISOString()
    };
    const updatedList = [newFeedback, ...feedbackList];
    setFeedbackList(updatedList);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updatedList));
    
    // Return to homepage
    setCurrentView('HOME');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header 
        isDark={isDark} 
        toggleTheme={() => setIsDark(!isDark)} 
        onLogoClick={resetAppState}
        onFeedbackClick={() => setIsFeedbackOpen(true)}
      />
      
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {currentView === 'HOME' && (
          <>
            {/* Intro Section */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl mb-4 leading-tight">
                Convert <span className="text-teal-600 block sm:inline">Bangla Handwritten</span> Notes to Digital Text
              </h1>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Upload your class notes or documents. Our AI will extract the text, fix grammar, and help you summarize or translate it instantly.
              </p>
            </div>

            {/* 
                Main Layout: 
                Mobile: Flex Column (stacks vertically) 
                Desktop: Grid 3 columns 
            */}
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
              {/* Left Column: Upload & Preview */}
              <div className="lg:col-span-1 space-y-6 order-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1">
                  <UploadZone 
                    onFileSelect={handleFileSelect} 
                    isLoading={status === ProcessingStatus.PROCESSING || status === ProcessingStatus.UPLOADING} 
                  />
                </div>

                {originalImage && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Original Note</h3>
                    <div className="relative rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 w-full max-h-[300px] lg:h-auto flex items-center justify-center">
                       <img src={originalImage} alt="Uploaded Note" className="max-w-full max-h-64 object-contain" />
                    </div>
                  </div>
                )}

                <History 
                  history={history} 
                  onSelect={(item) => setExtractedText(item.fullText)} 
                  onClear={clearHistory}
                />
              </div>

              {/* Right Column: Editor */}
              {/* Mobile: Tall height 70vh, Desktop: Fills screen (calc 100vh - header/padding) */}
              <div className="lg:col-span-2 order-2 h-[70vh] min-h-[600px] lg:h-[calc(100vh-8rem)]">
                 <Editor 
                    text={extractedText} 
                    setText={setExtractedText} 
                    onAIAction={handleAIAction}
                    isProcessing={status === ProcessingStatus.PROCESSING}
                 />
              </div>
            </div>
          </>
        )}

        {currentView === 'PRIVACY' && <PrivacyPolicy />}
        {currentView === 'TERMS' && <TermsOfService />}
        {currentView === 'ADMIN' && <AdminPanel feedbackList={feedbackList} />}

      </main>

      <Footer onNavigate={setCurrentView} />

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default App;