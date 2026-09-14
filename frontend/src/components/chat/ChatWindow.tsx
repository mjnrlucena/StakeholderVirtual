import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface ChatWindowProps {
  messages: ChatMessage[];
  isSending: boolean;
}

export function ChatWindow({ messages, isSending }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="app-subtitle max-w-sm">
          Comece a entrevista perguntando ao stakeholder sobre o sistema que
          ele precisa. Quando terminar, use o botão Sair para receber o
          feedback (em breve).
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isSending && (
        <div className="flex w-full justify-start">
          <div className="app-card px-4 py-3 text-sm text-[var(--card-extra)]">
            Digitando…
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
