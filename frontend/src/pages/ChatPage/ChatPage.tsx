import { useMutation } from "@tanstack/react-query";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { enviarPergunta } from "@/services/api";
import { useChatStore } from "@/store/useChatStore";
import type { ChatMessage } from "@/types/chat";

function novoId() {
  return crypto.randomUUID();
}

export function ChatPage() {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);

  const { mutate: perguntar, isPending } = useMutation({
    mutationFn: enviarPergunta,
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: novoId(),
        role: "assistant",
        content: data.resposta,
        dataHora: data.data_hora,
      };
      addMessage(assistantMessage);
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: novoId(),
        role: "assistant",
        content:
          "Não consegui falar com o stakeholder agora. Verifique se o backend está no ar e tente novamente.",
        dataHora: new Date().toLocaleString("pt-BR"),
      };
      addMessage(errorMessage);
    },
  });

  function handleSend(pergunta: string) {
    const userMessage: ChatMessage = {
      id: novoId(),
      role: "user",
      content: pergunta,
      dataHora: new Date().toLocaleString("pt-BR"),
    };
    addMessage(userMessage);
    perguntar(pergunta);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="app-card my-4 flex flex-1 flex-col overflow-hidden">
        <ChatWindow messages={messages} isSending={isPending} />
        <ChatInput onSend={handleSend} disabled={isPending} />
      </div>
    </div>
  );
}
