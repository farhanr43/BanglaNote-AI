import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadZone from './components/UploadZone';
import History from './components/History';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import FeedbackModal from './components/FeedbackModal';
import AdminPanel from './components/AdminPanel';
import AuthModal from './components/AuthModal';
import PricingModal from './components/PricingModal';
import PricingPage from './components/PricingPage';
import StepIndicator from './components/workflow/StepIndicator';
import ProcessingView from './components/workflow/ProcessingView';
import DocumentEditor from './components/workflow/DocumentEditor';
import ExportPanel from './components/workflow/ExportPanel';
import { ProcessingStatus, HistoryItem, AuthUser, UsageSummary, LayoutResult, WorkflowStep } from './types';
import { processImage, prepareFileForOCR, fetchUsage, CreditLimitError } from './services/ocrService';
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
  const [fileName, setFileName] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("Untitled Document");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [pipeline, setPipeline] = useState<'idle' | 'ocr' | 'analysis' | 'edit' | 'export'>('idle');
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
    const newHistory = [newItem, ...history].slice(0, 5);
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
    if (usage && usage.remaining <= 0) {
      if (user) setIsPricingOpen(true);
      else openLoginWithMessage(MESSAGES.GUEST_LIMIT_REACHED);
      return;
    }

    // Reset for new file
    setStatus(ProcessingStatus.UPLOADING);
    setPipeline('ocr');
    setWorkflowStep(1);
    setExtractedText("");
    setLayout(null);
    setFileName(file.name);
    setDocTitle(file.name.replace(/\.[^/.]+$/, '') || 'Untitled Document');

    try {
      const objectUrl = URL.createObjectURL(file);
      setOriginalImage(objectUrl);
      setFileType(file.type);

      const { base64: base64Data, mimeType } = await prepareFileForOCR(file);

      setStatus(ProcessingStatus.PROCESSING);
      setPipeline('ocr');

      const result = await processImage(base64Data, mimeType);

      setExtractedText(result.text);
      setLayout(result.layout);
      if (result.summary) setUsage(result.summary);
      saveToHistory(result.text);

      // Move to Format Analysis stage - brief staged UX (kept short for speed)
      setStatus(ProcessingStatus.PROCESSING);
      setPipeline('analysis');
      setWorkflowStep(2);

      // Short staged delay (was 2800ms) — enough to show "Analyzing/Reconstructing/Refining" without feeling slow
      await new Promise((r) => setTimeout(r, 850));

      setStatus(ProcessingStatus.SUCCESS);
      setPipeline('edit');
      setWorkflowStep(3);
    } catch (error: any) {
      console.error(error);
      if (error instanceof CreditLimitError) {
        setStatus(ProcessingStatus.ERROR);
        setPipeline('idle');
        handleLimitReached(error);
        return;
      }
      const msg = error?.message || MESSAGES.OCR_FAILED;
      // Surface backend reason (e.g., Gemini unavailable, timeout, invalid image)
      alert(msg.length > 220 ? msg.slice(0, 220) + '…' : msg);
      setStatus(ProcessingStatus.ERROR);
      setPipeline('idle');
      setWorkflowStep(1);
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
    setFileName("");
    setDocTitle("Untitled Document");
    setWorkflowStep(1);
    setPipeline('idle');
    navigate('/');
  };

  const handleReprocess = () => {
    if (!layout) return;
    setWorkflowStep(2);
    setPipeline('analysis');
    setTimeout(() => {
      setWorkflowStep(3);
      setPipeline('edit');
    }, 700);
  };

  const handleLayoutChange = (next: LayoutResult) => {
    setLayout(next);
    setExtractedText(next.text);
  };

  const handleLogout = async () => {
    await authService.signOut();
  };

  const handleFeedbackSubmit = async (name: string, message: string) => {
    try {
      const { error } = await supabase.from('feedback').insert([{ name, message }]);
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please check your internet connection.');
      throw error;
    }
  };

  const isProcessing = status === ProcessingStatus.PROCESSING || status === ProcessingStatus.UPLOADING;
  const hasResult = !!layout && !!extractedText;

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
            {/* Intro Section - preserved branding */}
            <div className="text-center mb-6 relative overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[560px] h-[320px] bg-teal-200/40 dark:bg-teal-500/10 blur-3xl rounded-full animate-floaty" />
              <div aria-hidden className="pointer-events-none absolute top-10 -left-24 w-72 h-72 bg-teal-100/50 dark:bg-teal-500/5 blur-3xl rounded-full animate-floaty" style={{ animationDelay: '2s' }} />
              <div aria-hidden className="pointer-events-none absolute -right-24 top-20 w-72 h-72 bg-cyan-100/50 dark:bg-cyan-500/5 blur-3xl rounded-full animate-floaty" style={{ animationDelay: '4s' }} />

              <h1 className="relative animate-fade-in-up text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl mb-3 leading-tight">
                Convert <span className="animate-gradient-text block sm:inline bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Bangla & English</span> Notes to Digital Text
              </h1>
              <p className="relative animate-fade-in-up text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto" style={{ animationDelay: '0.1s' }}>
                Upload your image — we detect text, rebuild layout, and give you an editable document you can export.
              </p>
            </div>

            {/* Workflow Step Indicator */}
            <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
              <StepIndicator currentStep={workflowStep} hasResult={hasResult} />
            </div>

            {/* Flow helper text */}
            <div className="text-center mb-6">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload Image <span className="mx-1">↓</span> OCR Processing <span className="mx-1">↓</span> Format Analysis <span className="mx-1">↓</span> Editable Document <span className="mx-1">↓</span> Export DOCX / PDF
              </p>
            </div>

            {/* STEP 1 — IMAGE OCR */}
            {workflowStep === 1 && (
              <div className="animate-fade-in-up space-y-6" style={{ animationDelay: '0.2s' }}>
                {pipeline === 'ocr' ? (
                  <ProcessingView mode="ocr" fileName={fileName} />
                ) : pipeline === 'analysis' ? (
                  <ProcessingView mode="analysis" fileName={fileName} />
                ) : (
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 border border-gray-200 dark:border-gray-700">
                        <UploadZone onFileSelect={handleFileSelect} isLoading={isProcessing} />
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">What happens in Step 1?</h3>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                          <li>Detects Bangla & English text, preserves reading order</li>
                          <li>Detects headings, paragraphs, lists, tables, alignment, spacing, bold/italic</li>
                          <li>Does not return plain text only — structure is retained</li>
                          <li>Supports JPG, PNG, WEBP, PDF • Bangla + English mixed documents</li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {originalImage && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Original File</h3>
                          <div className="relative rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 w-full max-h-[320px] flex items-center justify-center">
                             {fileType === 'application/pdf' ? (
                               <div className="w-full h-64">
                                 <iframe src={`${originalImage}#toolbar=0&navpanes=0`} className="w-full h-full rounded-lg" title="PDF Preview" />
                               </div>
                             ) : (
                               <img src={originalImage} alt="Uploaded Note" className="max-w-full max-h-64 object-contain" />
                             )}
                          </div>
                          {hasResult && (
                            <div className="mt-3 flex gap-2">
                              <button onClick={() => { setWorkflowStep(3); setPipeline('edit'); }} className="flex-1 text-xs py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg">Go to Editor →</button>
                              <button onClick={resetAppState} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">New upload</button>
                            </div>
                          )}
                        </div>
                      )}
                      <History history={history} onSelect={(item) => {
                        const fallback: LayoutResult = { text: item.fullText, blocks: item.fullText.split(/\n+/).filter(t=>t.trim()).map(t=>({type:'paragraph' as const, text:t})) };
                        setLayout(fallback);
                        setExtractedText(item.fullText);
                        setDocTitle('Restored Document');
                        setWorkflowStep(3);
                        setPipeline('edit');
                        setStatus(ProcessingStatus.SUCCESS);
                      }} onClear={clearHistory} />
                      {hasResult && (
                        <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
                          <p className="text-xs font-semibold text-teal-800 dark:text-teal-200">You have a processed document</p>
                          <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">Continue editing or jump to export.</p>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => { setWorkflowStep(3); setPipeline('edit'); }} className="flex-1 text-xs py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Edit Document</button>
                            <button onClick={() => { setWorkflowStep(4); setPipeline('export'); }} className="flex-1 text-xs py-2 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-gray-50">Export</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {status === ProcessingStatus.ERROR && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">OCR failed. Please try again.</p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">Check image quality, ensure text is visible, and file is under 10MB.</p>
                    <button onClick={() => { setStatus(ProcessingStatus.IDLE); setPipeline('idle'); }} className="mt-3 px-4 py-1.5 text-xs bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-gray-50">Try again</button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — FORMAT ANALYSIS & REFINEMENT */}
            {workflowStep === 2 && (
              <div className="space-y-6">
                <ProcessingView mode="analysis" fileName={fileName} />
                <div className="flex justify-center gap-2">
                  <button onClick={() => { setWorkflowStep(1); setPipeline('idle'); }} className="px-4 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">← Back to Upload</button>
                </div>
              </div>
            )}

            {/* STEP 3 — EDITABLE DOCUMENT VIEW */}
            {workflowStep === 3 && layout && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setWorkflowStep(1); setPipeline('idle'); }} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">← Upload</button>
                    <button onClick={handleReprocess} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">↻ Re-analyze layout</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={resetAppState} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">New document</button>
                    <button onClick={() => { setWorkflowStep(4); setPipeline('export'); }} className="px-4 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg">Export DOCX / PDF →</button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <DocumentEditor layout={layout} onChange={handleLayoutChange} documentTitle={docTitle} onTitleChange={setDocTitle} />
                  </div>
                  <div className="space-y-4">
                    {originalImage && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Original Reference</h3>
                        <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 max-h-[280px] flex items-center justify-center">
                          {fileType === 'application/pdf' ? (
                            <iframe src={`${originalImage}#toolbar=0&navpanes=0`} className="w-full h-56" title="PDF Preview" />
                          ) : (
                            <img src={originalImage} alt="Original" className="max-w-full max-h-56 object-contain" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Compare with editable preview. Layout tries to match the original.</p>
                      </div>
                    )}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Editing Tips</h4>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                        <li>Click any block to select and format</li>
                        <li>Bold / Italic / Underline, alignment, headings</li>
                        <li>Bullets & numbered lists, table row/col editing</li>
                        <li>Undo / Redo, search, zoom, page preview</li>
                        <li>Changes are preserved for export</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 empty state (no layout yet) */}
            {workflowStep === 3 && !layout && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">No document to edit yet. Please upload an image first.</p>
                <button onClick={() => setWorkflowStep(1)} className="mt-3 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">Go to Upload</button>
              </div>
            )}

            {/* STEP 4 — EXPORT */}
            {workflowStep === 4 && layout && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button onClick={() => { setWorkflowStep(3); setPipeline('edit'); }} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">← Back to Edit</button>
                  <button onClick={resetAppState} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50">Start New Document</button>
                </div>
                <ExportPanel layout={layout} title={docTitle} />
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Final Preview (read-only)</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[360px] overflow-auto font-bengali text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {layout.text || 'No text'}
                  </div>
                </div>
              </div>
            )}
            {workflowStep === 4 && !layout && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Nothing to export yet.</p>
                <button onClick={() => setWorkflowStep(1)} className="mt-3 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">Upload Document</button>
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
