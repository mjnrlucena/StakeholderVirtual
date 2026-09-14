import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isFeedback = message.role === "feedback";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--bubble-user-bg)] text-[var(--bubble-user-text)]"
            : "bg-[var(--bubble-assistant-bg)] text-[var(--bubble-assistant-text)] border border-[var(--card-border)]"
        } ${isFeedback ? "border-2 border-[var(--title)]" : ""}`}
      >
        {isFeedback && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--title)]">
            Feedback
          </p>
        )}
        <p className="text-[15px] leading-relaxed">{message.content}</p>
        <p
          className={`mt-1 text-[11px] ${
            isUser ? "text-[var(--bubble-user-text)]/70" : "text-[var(--card-extra)]"
          }`}
        >
          {message.dataHora}
        </p>
      </div>
    </div>
  );
}
