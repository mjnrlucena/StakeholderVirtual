import { SquarePen } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { criarSessao } from "@/services/api";

interface NewChatButtonProps {
  projectId: string;
}

/**
 * Botão "nova sessão": cria outra sessão no projeto e entra nela. As
 * anteriores continuam salvas na barra lateral de sessões.
 */
export function NewChatButton({ projectId }: NewChatButtonProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { mutate, isPending } = useMutation({
    mutationFn: () => criarSessao(projectId),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
      navigate(`/projetos/${projectId}/${session.id}`);
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      title="Nova sessão (as anteriores continuam salvas)"
      aria-label="Nova sessão"
      className="icon-btn"
    >
      <SquarePen size={18} />
    </button>
  );
}
