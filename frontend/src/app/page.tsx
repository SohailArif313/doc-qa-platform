"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Send, Bot, User, Loader2, FileText, Sparkles, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadPdf, sendMessage, Source } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasDocument, setHasDocument] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadPdf(file);
      setHasDocument(true);
      setMessages([
        {
          role: "assistant",
          content: `I have successfully processed "${file.name}". You can now ask me any questions about its content!`,
        },
      ]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await sendMessage(userMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Dark Mode
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950' : 'bg-[#fafafa]'}`}>
      
      {/* Background Gradient Orbs (Only visible in light mode) */}
      {!isDarkMode && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        </>
      )}

      {/* Header (Fixed at top) */}
      <header className="shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-20 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Doc QA Platform</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unlock Insights from Your PDFs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full border-slate-200 dark:border-slate-700 dark:bg-slate-800"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-slate-300" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </Button>

          <input
            type="file"
            accept=".pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md transition-all duration-200"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {hasDocument ? "Upload New PDF" : "Upload PDF"}
          </Button>
        </div>
      </header>

      {/* Chat Area (Scrollable) */}
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
            <div
              key={idx}
              className={`flex gap-4 animate-fade-in-up ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                <div 
                  className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                    msg.role === "user" 
                      ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm" 
                      : "bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {/* Citations / Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md flex items-center border border-slate-200 dark:border-slate-700 shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                        {src.file} <span className="mx-1 text-slate-300 dark:text-slate-600">|</span> Page {src.page + 1}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-sm">
                  <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start animate-fade-in-up">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input Area (Fixed at bottom) */}
      <div className="shrink-0 bg-[#fafafa] dark:bg-slate-950 pt-4 pb-6 px-4 border-t border-slate-200/50 dark:border-slate-800/50 z-20 transition-colors duration-300">
        <div className="max-w-3xl mx-auto relative">
          <form
            onSubmit={handleSendMessage}
            className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700 p-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                hasDocument
                  ? "Ask a question about the document..."
                  : "Please upload a PDF first..."
              }
              disabled={!hasDocument || isLoading}
              className="flex-1 border-0 shadow-none focus-visible:ring-0 text-[15px] bg-transparent dark:text-slate-200 py-6 px-4"
            />
            <Button 
              type="submit" 
              disabled={!hasDocument || isLoading || !input.trim()}
              className="h-11 w-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 shrink-0"
            >
              <Send className="h-5 w-5 ml-0.5" />
            </Button>
          </form>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3 font-medium">
            Doc QA Platform can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}