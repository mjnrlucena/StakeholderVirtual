import { ArrowUp } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { FeedbackButton } from "./FeedbackButton";

interface ChatInputProps {
  onSend: (pergunta: string) => void;
  onFeedback: () => void;
  disabled?: boolean;
}

const MAX_HEIGHT_PX = 200;

export function ChatInput({ onSend, onFeedback, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/90 to-transparent pb-4 pt-6">
      <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4">
        <div className="composer flex items-end gap-2 rounded-3xl px-4 py-2.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Pergunte algo ao stakeholder…"
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
          />
          <FeedbackButton onClick={onFeedback} disabled={disabled} />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || value.trim().length === 0}
            aria-label="Enviar"
            className="send-btn mb-0.5"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  );
}
