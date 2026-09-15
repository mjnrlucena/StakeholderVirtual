import { SquarePen } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";

export function NewChatButton() {
  const resetChat = useChatStore((state) => state.resetChat);

  return (
    <button
      type="button"
      onClick={resetChat}
      title="Novo chat"
      aria-label="Novo chat"
      className="icon-btn"
    >
      <SquarePen size={18} />
    </button>
  );
}
