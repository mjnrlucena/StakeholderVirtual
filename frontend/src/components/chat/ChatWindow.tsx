import { Briefcase } from "lucide-react";
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
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-secondary)]">
          <Briefcase size={20} />
        </div>
        <p className="max-w-sm text-[15px] text-[var(--text-secondary)]">
          Comece a entrevista perguntando ao stakeholder sobre o sistema que
          ele precisa. Quando terminar, use o botão Feedback para receber a
          avaliação da entrevista.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isSending && (
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-secondary)]">
            <Briefcase size={15} />
          </div>
          <span className="text-[15px] text-[var(--text-secondary)]">
            Digitando…
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
