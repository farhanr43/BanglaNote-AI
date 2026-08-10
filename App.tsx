import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadZone from './components/UploadZone';
import Editor from './components/Editor';
import History from './components/History';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import FeedbackModal from './components/FeedbackModal';
import AdminPanel from './components/AdminPanel';
import AuthModal from './components/AuthModal';
import PricingModal from './components/PricingModal';
import PricingPage from './components/PricingPage';
import StructuredPreview from './components/StructuredPreview';
import { ProcessingStatus, AIActionType, HistoryItem, AuthUser, UsageSummary, LayoutResult } from './types';
import { processImage, transformText, fileToGenerativePart, fetchUsage, CreditLimitError } from './services/ocrService';
import { authService } from './services/auth';
import { MOCK_HISTORY_KEY, MESSAGES } from './constants';
import { supabase } from './services/supabaseClient';

interface AuthModalState {
  open: boolean;
  mode: 'login' | 'signup';
  message?: string;
}

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [extractedText, setExtractedText] = useState<string>("");
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const navigate = useNavigate();

  // Auth & credits
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [authModal, setAuthModal] = useState<AuthModalState>({ open: false, mode: 'login' });
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  // Feedback States
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const refreshUsage = async () => {
    const summary = await fetchUsage();
    if (summary) setUsage(summary);
  };

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

  // Auth session + usage
  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      refreshUsage();
    });
    const unsubscribe = authService.onAuthChange((u) => {
      setUser(u);
      refreshUsage();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load History (Local Storage only for privacy)
  useEffect(() => {
    const savedHistory = localStorage.getItem(MOCK_HISTORY_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
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

  const openLoginWithMessage = (message?: string) => {
    setAuthModal({ open: true, mode: 'login', message });
  };

  const handleLimitReached = (err: CreditLimitError) => {
    if (err.isGuest) {
      openLoginWithMessage(MESSAGES.GUEST_LIMIT_REACHED);
    } else {
      setIsPricingOpen(true);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Proactive check when we already know the limit is exhausted
    if (usage && usage.remaining <= 0) {
      if (user) {
        setIsPricingOpen(true);
      } else {
        openLoginWithMessage(MESSAGES.GUEST_LIMIT_REACHED);
      }
      return;
    }

    setStatus(ProcessingStatus.UPLOADING);
    setExtractedText("");
    setLayout(null);

    try {
      const objectUrl = URL.createObjectURL(file);
      setOriginalImage(objectUrl);
      setFileType(file.type);

      const base64Data = await fileToGenerativePart(file);

      setStatus(ProcessingStatus.PROCESSING);

      const result = await processImage(base64Data, file.type);

      setExtractedText(result.text);
      setLayout(result.layout);
      if (result.summary) setUsage(result.summary);
      saveToHistory(result.text);
      setStatus(ProcessingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      if (error instanceof CreditLimitError) {
        setStatus(ProcessingStatus.ERROR);
        handleLimitReached(error);
        return;
      }
      alert(MESSAGES.OCR_FAILED);
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
      alert(MESSAGES.AI_FAILED);
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
    setLayout(null);
    setOriginalImage(null);
    setFileType("");
    navigate('/');
  };

  const handleLogout = async () => {
    await authService.signOut();
  };

  const handleFeedbackSubmit = async (name: string, message: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{ name, message }]);

      if (error) {
        throw error;
      }

      navigate('/');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please check your internet connection.');
      throw error;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        onLogoClick={resetAppState}
        onFeedbackClick={() => setIsFeedbackOpen(true)}
        user={user}
        usage={usage}
        onLogin={() => setAuthModal({ open: true, mode: 'login' })}
        onSignup={() => setAuthModal({ open: true, mode: 'signup' })}
        onLogout={handleLogout}
        onUpgrade={() => navigate('/pricing')}
      />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>

        <Route path="/" element={<>
            {/* Intro Section */}
            <div className="text-center mb-8 relative overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[320px] bg-teal-200/40 dark:bg-teal-500/10 blur-3xl rounded-full animate-floaty" />
              <div aria-hidden className="pointer-events-none absolute top-10 -left-24 w-72 h-72 bg-teal-100/50 dark:bg-teal-500/5 blur-3xl rounded-full animate-floaty" style={{ animationDelay: '2s' }} />
              <div aria-hidden className="pointer-events-none absolute -right-24 top-20 w-72 h-72 bg-cyan-100/50 dark:bg-cyan-500/5 blur-3xl rounded-full animate-floaty" style={{ animationDelay: '4s' }} />

              <h1 className="relative animate-fade-in-up text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl mb-4 leading-tight">
                Convert <span className="animate-gradient-text block sm:inline bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Bangla & English</span> Notes to Digital Text
              </h1>
              <p className="relative animate-fade-in-up text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto" style={{ animationDelay: '0.1s' }}>
                Upload your class notes, documents, or PDFs. Our AI will extract the text, fix grammar, and help you summarize or translate it instantly.
              </p>
            </div>

            <div className="animate-fade-in-up flex flex-col lg:grid lg:grid-cols-3 gap-8" style={{ animationDelay: '0.15s' }}>
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Original File</h3>
                    <div className="relative rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 w-full max-h-[400px] flex items-center justify-center">
                       {fileType === 'application/pdf' ? (
                         <div className="w-full h-64 sm:h-80">
                           <iframe
                             src={`${originalImage}#toolbar=0&navpanes=0`}
                             className="w-full h-full rounded-lg"
                             title="PDF Preview"
                           />
                         </div>
                       ) : (
                         <img
                           src={originalImage}
                           alt="Uploaded Note"
                           className="max-w-full max-h-64 object-contain"
                         />
                       )}
                    </div>
                  </div>
                )}

                <History
                  history={history}
                  onSelect={(item) => { setExtractedText(item.fullText); setLayout(null); }}
                  onClear={clearHistory}
                />
              </div>

              {/* Right Column: Editor */}
              <div className="lg:col-span-2 order-2 h-[70vh] min-h-[600px] lg:h-[calc(100vh-8rem)]">
                 <Editor
                    text={extractedText}
                    setText={setExtractedText}
                    onAIAction={handleAIAction}
                    isProcessing={status === ProcessingStatus.PROCESSING}
                    layout={layout}
                 />
              </div>
            </div>

            {/* Formatted preview (approximation of the Word output) */}
            {layout && (
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Formatted Preview
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Approximate look of the exported Word document
                  </span>
                </div>
                <div className="p-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <StructuredPreview layout={layout} />
                </div>
              </div>
            )}
          </>} />

        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/pricing" element={<PricingPage user={user} usage={usage} onRequireLogin={() => openLoginWithMessage('Please log in or create a free account to request an upgrade.')} />} />
        <Route path="/admin" element={<AdminPanel user={user} onRequireLogin={() => openLoginWithMessage('Please log in with an admin account to continue.')} />} />
        <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </main>

      <Footer />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />

      <AuthModal
        isOpen={authModal.open}
        initialMode={authModal.mode}
        message={authModal.message}
        onClose={() => setAuthModal({ open: false, mode: authModal.mode })}
        onAuthenticated={refreshUsage}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        user={user}
        usage={usage}
        onRequireLogin={() => {
          setIsPricingOpen(false);
          openLoginWithMessage('Please log in or create a free account to request an upgrade.');
        }}
      />
    </div>
  );
};

export default App;
