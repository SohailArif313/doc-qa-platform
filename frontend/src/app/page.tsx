"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Send, Bot, User, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
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
          content: `I have processed "${file.name}". You can now ask me questions about it!`,
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

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Doc QA Platform</h1>
          <p className="text-sm text-slate-500">Unlock Insights from Your PDFs</p>
        </div>
        <div>
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
            variant={hasDocument ? "outline" : "default"}
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

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-20">
              <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg">Upload a PDF to get started.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
                <Card className={msg.role === "user" ? "bg-blue-600 text-white border-0" : "bg-white"}>
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  </CardContent>
                </Card>
                
                {/* Citations / Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-md flex items-center"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {src.file} (Page {src.page + 1})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <Card className="bg-white">
                <CardContent className="p-4 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="text-sm text-slate-500">Thinking...</span>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <form
          onSubmit={handleSendMessage}
          className="max-w-3xl mx-auto flex gap-2"
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
            className="flex-1"
          />
          <Button type="submit" disabled={!hasDocument || isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}