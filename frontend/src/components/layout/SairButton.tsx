import { LogOut } from "lucide-react";

/**
 * Botão "Sair" — no futuro deve disparar a solicitação de feedback
 * (ver services/api.ts -> solicitarFeedback), encerrando a entrevista.
 * Por pedido explícito, por enquanto ele existe apenas visualmente,
 * sem nenhuma ação associada.
 */
export function SairButton() {
  return (
    <button
      type="button"
      disabled
      title="Em breve"
      className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
    >
      <LogOut size={18} />
      Sair
    </button>
  );
}
