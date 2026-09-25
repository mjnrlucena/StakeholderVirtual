import { SquarePen } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reiniciarChat } from "@/services/api";

interface NewChatButtonProps {
  projectId: string;
}

/**
 * Botão "novo chat" — agora escopado a um projeto: reinicia só o chat
 * daquele projeto (apaga as mensagens), não afeta os demais.
 */
export function NewChatButton({ projectId }: NewChatButtonProps) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => reiniciarChat(projectId),
    onSuccess: () => {
      queryClient.setQueryData(["chat", projectId], (old: any) => ({ ...old, messages: [] }));
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      title="Novo chat (apaga as mensagens deste projeto)"
      aria-label="Novo chat"
      className="icon-btn"
    >
      <SquarePen size={18} />
    </button>
  );
}
