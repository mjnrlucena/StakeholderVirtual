import { Send } from "lucide-react";
import { type FormEvent, useState } from "react";

interface ChatInputProps {
  onSend: (pergunta: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-[var(--divider)] px-4 py-3"
    >
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Digite sua pergunta para o stakeholder…"
        disabled={disabled}
        className="input-base px-4 py-3"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <Send size={18} />
      </button>
    </form>
  );
}
