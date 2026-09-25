import { GraduationCap } from "lucide-react";

interface FeedbackButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FeedbackButton({ onClick, disabled }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Pedir feedback da entrevista até agora"
      className="feedback-btn"
    >
      <GraduationCap size={16} />
      Feedback
    </button>
  );
}
