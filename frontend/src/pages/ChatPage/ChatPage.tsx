import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { enviarPergunta, obterChat } from "@/services/api";

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const chatQueryKey = ["chat", projectId];

  const containerRef = useRef<HTMLDivElement>(null);
  const wasBusyRef = useRef(false);

  const { data: chat, isLoading } = useQuery({
    queryKey: chatQueryKey,
    queryFn: () => obterChat(projectId!),
    enabled: Boolean(projectId),
  });

  const { mutate: perguntar, isPending } = useMutation({
    mutationFn: (pergunta: string) => enviarPergunta(projectId!, pergunta),
    // Otimista: mostra a pergunta do usuário na hora, sem esperar o backend.
    onMutate: async (pergunta: string) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKey });
      const previous = queryClient.getQueryData(chatQueryKey);
      queryClient.setQueryData(chatQueryKey, (old: any) => ({
        chatId: old?.chatId,
        messages: [
          ...(old?.messages ?? []),
          {
            id: `optimistic-${Date.now()}`,
            role: "USER",
            content: pergunta,
            grounded: null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return { previous };
    },
    onError: (_err, _pergunta, context) => {
      if (context?.previous) queryClient.setQueryData(chatQueryKey, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKey });
    },
  });

  const isBusy = isPending;
  const hasMessages = (chat?.messages.length ?? 0) > 0;

  // Devolve o foco ao campo quando a resposta termina (sucesso ou erro).
  // Só em dispositivos com mouse: no celular, reabrir o teclado a cada
  // resposta atrapalharia a leitura.
  useEffect(() => {
    if (wasBusyRef.current && !isBusy) {
      if (window.matchMedia("(pointer: fine)").matches) {
        containerRef.current
          ?.querySelector<HTMLElement>('textarea, input[type="text"]')
          ?.focus();
      }
    }
    wasBusyRef.current = isBusy;
  }, [isBusy]);

  return (
    <div ref={containerRef} className="relative h-full">
      <div className="h-full overflow-y-auto pt-16 pb-36">
        {isLoading ? (
          <p className="pt-10 text-center text-sm text-[var(--text-secondary)]">Carregando…</p>
        ) : (
          <ChatWindow messages={chat?.messages ?? []} isSending={isPending} />
        )}
      </div>

      <ChatInput
        onSend={(pergunta) => perguntar(pergunta)}
        onFeedback={() => perguntar("sair")}
        disabled={isBusy}
        feedbackDisabled={!hasMessages}
      />
    </div>
  );
}