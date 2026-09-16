import { SquarePen } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { iniciarNovaConversa } from "@/services/api";

export function NewChatButton() {
  const resetChat = useChatStore((state) => state.resetChat);

  async function handleNovoChat() {
    await iniciarNovaConversa(); // limpa a sessão Flask e libera novo PDF
    resetChat(); // limpa tela e localStorage
  }

  return (
    <button
      type="button"
      onClick={handleNovoChat}
      title="Novo chat"
      aria-label="Novo chat"
      className="icon-btn"
    >
      <SquarePen size={18} />
    </button>
  );
}