import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelLeft, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { SessionList } from "@/components/chat/SessionList";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { criarSessao, enviarPergunta, listarSessoes, obterChat } from "@/services/api";

export function ChatPage() {
  const { projectId, chatId } = useParams<{ projectId: string; chatId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmFeedbackOpen, setConfirmFeedbackOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatQueryKey = ["chat", chatId];

  // Sem sessão na URL (link antigo ou a sessão aberta foi apagada): entra na
  // mais recente ou cria a primeira.
  const resolvingRef = useRef(false);
  useEffect(() => {
    if (chatId || !projectId || resolvingRef.current) return;
    resolvingRef.current = true;
    listarSessoes(projectId)
      .then((sessions) => sessions[0] ?? criarSessao(projectId))
      .then((session) => {
        queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
        navigate(`/projetos/${projectId}/${session.id}`, { replace: true });
      })
      .catch(() => navigate("/", { replace: true }))
      .finally(() => {
        resolvingRef.current = false;
      });
  }, [chatId, projectId, navigate, queryClient]);

  const containerRef = useRef<HTMLDivElement>(null);
  const wasBusyRef = useRef(false);

  const { data: chat, isLoading } = useQuery({
    queryKey: chatQueryKey,
    queryFn: () => obterChat(projectId!, chatId!),
    enabled: Boolean(projectId && chatId),
  });

  const { mutate: perguntar, isPending } = useMutation({
    mutationFn: (pergunta: string) => enviarPergunta(projectId!, chatId!, pergunta),
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
  
  function handleConfirmFeedback() {
    setConfirmFeedbackOpen(false);
    if (!isBusy) perguntar("sair");
  }

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
    <div className="flex h-full">
      {/* Barra lateral de sessões: fixa a partir do md, gaveta no celular. */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`no-scrollbar fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] px-3 pb-4 pt-16 md:static md:z-auto md:block ${
          sidebarOpen ? "block" : "hidden"
        }`}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Sessões</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar sessões"
            className="icon-btn h-7 w-7 md:hidden"
          >
            <X size={15} />
          </button>
        </div>
        {projectId && (
          <SessionList projectId={projectId} activeChatId={chatId} onPick={() => setSidebarOpen(false)} />
        )}
      </aside>

      <div ref={containerRef} className="relative h-full min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="topbar-btn absolute left-3 top-16 z-10 bg-[var(--background)] md:hidden"
        >
          <PanelLeft size={15} />
          Sessões
        </button>

        <div className="h-full overflow-y-auto pt-28 pb-36 md:pt-16">
          {isLoading || !chatId ? (
            <p className="pt-10 text-center text-sm text-[var(--text-secondary)]">Carregando…</p>
          ) : (
            <ChatWindow messages={chat?.messages ?? []} isSending={isPending} />
          )}
        </div>

        <ChatInput
          onSend={(pergunta) => perguntar(pergunta)}
          onFeedback={() => setConfirmFeedbackOpen(true)}
          disabled={isBusy || !chatId}
          feedbackDisabled={!hasMessages}
        />
      </div>

      <ConfirmModal
        open={confirmFeedbackOpen}
        title="Pedir feedback da entrevista?"
        description="A entrevista será encerrada e você receberá o feedback sobre ela. Deseja continuar?"
        confirmLabel="Dar feedback"
        cancelLabel="Continuar conversando"
        onConfirm={handleConfirmFeedback}
        onCancel={() => setConfirmFeedbackOpen(false)}
      />
    </div>
  );
}