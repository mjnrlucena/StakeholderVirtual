import { GraduationCap } from "lucide-react";

interface FeedbackButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Antigo botão "Sair" — agora chamado de "Feedback" e funcional.
 * Ao clicar, envia a palavra "sair" no chat (mesmo gatilho que o
 * backend já usa em /pergunta para gerar a avaliação da entrevista).
 */
export function FeedbackButton({ onClick, disabled }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Encerrar a entrevista e pedir feedback"
      className="feedback-btn"
    >
      <GraduationCap size={16} />
      Feedback
    </button>
  );
}
