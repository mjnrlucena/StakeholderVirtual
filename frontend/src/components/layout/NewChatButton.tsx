import { MessageSquarePlus } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";

export function NewChatButton() {
  const resetChat = useChatStore((state) => state.resetChat);

  return (
    <button
      type="button"
      onClick={resetChat}
      className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
    >
      <MessageSquarePlus size={18} />
      Novo chat
    </button>
  );
}
