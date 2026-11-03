const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface Source {
  file: string;
  page: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  model: string;
}

export async function uploadPdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to upload PDF");
  }
  return response.json();
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get answer");
  }
  return response.json();
}



export async function streamMessage(
  message: string,
  onChunk: (text: string) => void,
  onSources: (sources: Source[]) => void,
  onError: (error: string) => void,
  onComplete: () => void,
  signal?: AbortSignal // <-- Naya parameter
) {
  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal, // <-- Yahan pass kiya
    });

    if (!response.ok) throw new Error("Failed to stream response");

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === "text") onChunk(data.content);
          else if (data.type === "sources") onSources(data.content);
        } catch (e) {
          console.error("Error parsing stream line:", e);
        }
      }
    }
    onComplete();
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("Stream aborted by user");
      onComplete(); // Treat abort as completion
    } else {
      onError(error.message);
    }
  }
}