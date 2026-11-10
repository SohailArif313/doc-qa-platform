"use client";
import dynamic from "next/dynamic";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useState, useRef, useEffect } from "react";
import { UploadCloud, Send, Bot, User, Loader2, FileText, Sparkles, Moon, Sun, Square, Plus, Menu, MessageSquare, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadPdf, streamMessage, fetchChatHistory, fetchChatSessions, Source } from "@/lib/api";


interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface Session {
  session_id: string;
  title: string;
}

const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

export default function ChatPage() {
  const { getToken, userId, isLoaded } = useAuth();
  
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number>(1);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasDocument, setHasDocument] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // New States for Sidebar and Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const isTypingRef = useRef(false);
  const isStreamCompleteRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Sessions on Mount
  useEffect(() => {
    const loadSessions = async () => {
      if (!isLoaded || !userId) return;
      try {
        const token = await getToken();
        if (!token) return;
        const data = await fetchChatSessions(token);
        setSessions(data);
        
        if (data.length > 0) {
          setActiveSessionId(data[0].session_id);
        } else {
          startNewChat();
        }
      } catch (error) {
        console.error("Failed to load sessions", error);
      }
    };
    loadSessions();
  }, [isLoaded, userId]);

  // 2. Load History when Active Session Changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!activeSessionId || !isLoaded) return;
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) return;
        const history = await fetchChatHistory(activeSessionId, token); // Fixed Argument Order
        setMessages(history);
        if (history.length > 0) setHasDocument(true);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, [activeSessionId, isLoaded]);

  const startNewChat = () => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
    setHasDocument(false);
    setInput("");
  };

  const typeWriterEffect = () => {
    if (isTypingRef.current) return;
    isTypingRef.current = true;

    const type = () => {
      if (bufferRef.current.length > 0) {
        const char = bufferRef.current[0];
        bufferRef.current = bufferRef.current.slice(1);

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex]?.role === "assistant") {
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              content: newMessages[lastIndex].content + char,
            };
          }
          return newMessages;
        });
        typingTimeoutRef.current = setTimeout(type, 5); 
      } else {
        isTypingRef.current = false;
        if (isStreamCompleteRef.current) setIsLoading(false);
      }
    };
    type();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await uploadPdf(file, token);
      setHasDocument(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I have successfully processed **"${file.name}"**. You can now ask me questions.` },
      ]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    bufferRef.current = "";
    isTypingRef.current = false;
    isStreamCompleteRef.current = true;
    setIsLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    bufferRef.current = "";
    isTypingRef.current = false;
    isStreamCompleteRef.current = false;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const token = await getToken();
    
    await streamMessage(
      userMessage,
      activeSessionId, // Passed Session ID correctly
      (chunk) => {
        bufferRef.current += chunk;
        typeWriterEffect();
      },
      (sources) => {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex]?.role === "assistant") {
            newMessages[lastIndex] = { ...newMessages[lastIndex], sources };
          }
          return newMessages;
        });
      },
      (error) => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        bufferRef.current = "";
        isTypingRef.current = false;
        isStreamCompleteRef.current = true;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex]?.role === "assistant") {
            newMessages[lastIndex] = { ...newMessages[lastIndex], content: `Error: ${error}` };
          }
          return newMessages;
        });
        setIsLoading(false);
      },
      async () => {
        isStreamCompleteRef.current = true;
        if (!isTypingRef.current && bufferRef.current.length === 0) setIsLoading(false);
        
        // Refresh session list to show new chat title in sidebar
        const currentToken = await getToken();
        if (currentToken) {
          const updatedSessions = await fetchChatSessions(currentToken);
          setSessions(updatedSessions);
        }
      },
      abortControllerRef.current.signal,
      token || ""
    );
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950' : 'bg-[#fafafa]'}`}>
      
      {/* SIDEBAR */}
      <div className={`shrink-0 transition-all duration-300 flex flex-col border-r border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 ${isSidebarOpen ? 'w-64' : 'w-0 md:w-16'} overflow-hidden`}>
        <div className="p-4 flex items-center justify-between">
          <Button onClick={startNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start px-3">
            <Plus className="h-4 w-4 mr-2" />
            {isSidebarOpen && <span>New Chat</span>}
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => setActiveSessionId(s.session_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors flex items-center ${
                activeSessionId === s.session_id 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2 shrink-0 opacity-70" />
              {isSidebarOpen && <span className="truncate">{s.title || "New Chat"}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 px-4 md:px-6 py-4 flex items-center justify-between z-20 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight hidden sm:block">Doc QA Platform</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full border-slate-200 dark:border-slate-700 dark:bg-slate-800">
              {isDarkMode ? <Sun className="h-4 w-4 text-slate-300" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </Button>
            
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9 border border-slate-200 dark:border-slate-700 shadow-sm" } }} />

            <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Processing PDF...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">
                    {hasDocument ? "Upload New" : "Upload PDF"}
                  </span>
                </>
              )}
            </Button>

          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto z-10">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {messages.length === 0 && (
              <div className="text-center mt-32 animate-fade-in-up">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">How can I help you today?</h2>
                <p className="text-slate-500 dark:text-slate-400">Upload a PDF document to start analyzing.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 animate-fade-in-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                  <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                      msg.role === "user" 
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm" 
                        : "bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl rounded-tl-sm overflow-hidden"
                    }`}>
                    {msg.role === "assistant" && msg.content === "" ? (
                      <div className="flex items-center gap-2 h-6 px-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      </div>
                    ) : (
                      <div className={`prose prose-sm sm:prose-base dark:prose-invert max-w-none ${msg.role === "user" ? "prose-invert" : ""}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && msg.content !== "" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.sources.map((src, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            // Debug log to check if URL exists
                            console.log("Source clicked:", src); 
                            
                            if (src.file_url) {
                              setSelectedPdfUrl(src.file_url);
                              setSelectedPdfPage(src.page + 1);
                            } else {
                              alert("PDF URL is missing. Did you configure Supabase Storage in the backend?");
                            }
                          }}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-md flex items-center border shadow-sm transition-colors ${
                            src.file_url 
                              ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700" 
                              : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                          {src.file} <span className="mx-1 text-slate-300 dark:text-slate-600">|</span> Page {src.page + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border border-purple-400 flex items-center justify-center shrink-0 shadow-sm">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </div>

                {/* Input Area */}
        <div className="shrink-0 bg-[#fafafa] dark:bg-slate-950 pt-4 pb-6 px-4 border-t border-slate-200/50 dark:border-slate-800/50 z-20">
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700 p-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/20">
              
              {/* NEW TEXTAREA  */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && hasDocument && !isLoading) {
                      // Trigger form submit
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                        form.dispatchEvent(submitEvent);
                      }
                    }
                  }
                }}
                placeholder={hasDocument ? "Ask a question..." : "Please upload a PDF first..."}
                disabled={!hasDocument || isLoading}
                rows={1}
                className="w-full bg-transparent border-0 focus:ring-0 resize-none outline-none text-[15px] dark:text-slate-200 py-3 px-3 max-h-40 min-h-[44px] overflow-y-auto"
                style={{ height: 'auto' }}
              />

              {isLoading ? (
                <Button type="button" onClick={stopGeneration} className="h-11 w-11 shrink-0 rounded-xl bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-md mb-0.5">
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button type="submit" disabled={!hasDocument || !input.trim()} className="h-11 w-11 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md mb-0.5">
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              )}
            </form>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">
              Doc QA Platform can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
      {/* PDF VIEWER MODAL */}
      {selectedPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <FileText className="h-5 w-5 text-blue-500" />
                Document Viewer
              </h3>
              <button 
                onClick={() => setSelectedPdfUrl(null)} 
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* PDF Render Area */}
            <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-4 flex justify-center">
              <Document 
                file={selectedPdfUrl} 
                onLoadError={(e) => console.error("PDF Error:", e)}
                loading={<div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" /> Loading PDF...</div>}
              >
                <Page 
                  pageNumber={selectedPdfPage} 
                  renderTextLayer={true} 
                  className="shadow-lg max-w-full" 
                />
              </Document>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}