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
    onSuccess: (data: { resposta: any; data_hora: any; }, pergunta: string) => {
      const isFeedback = pergunta.trim().toLowerCase() === "sair";
      const assistantMessage: ChatMessage = {
        id: novoId(),
        role: isFeedback ? "feedback" : "assistant",
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

  function handleFeedback() {
    handleSend("sair");
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto pt-16 pb-36">
        <ChatWindow messages={messages} isSending={isPending} />
      </div>
      <ChatInput
        onSend={handleSend}
        onFeedback={handleFeedback}
        disabled={isPending}
      />
    </div>
  );
}
