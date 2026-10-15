import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "accent" (padrão) usa o azul do tema; "danger" usa o vermelho, para ações destrutivas. */
  tone?: "accent" | "danger";
  /** Ícone do círculo no topo. Se omitido, usa um ícone padrão conforme o tom. */
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Modal de confirmação que segue o tema global (variáveis de global.css,
 * claro/escuro pela classe "dark" no <html>) e funciona só pelo teclado:
 * - o foco vai para o botão de confirmar ao abrir (Enter confirma); no tom
 *   "danger" o foco inicial fica em Cancelar, para um Enter distraído não
 *   executar a ação destrutiva;
 * - Esc cancela e Tab/Shift+Tab ficam presos dentro do modal;
 * - ao fechar, o foco volta para o elemento que o abriu.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "accent",
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  // Mantém a versão mais recente do callback sem reexecutar o efeito principal.
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    (tone === "danger" ? cancelRef : confirmRef).current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons || buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, tone]);

  if (!open) return null;

  const isDanger = tone === "danger";

  const iconWrapClass = isDanger
    ? "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]"
    : "bg-[var(--accent-soft)] text-[var(--accent)]";

  const confirmClass = isDanger
    ? "bg-[var(--danger)] text-[var(--accent-contrast)] hover:opacity-90"
    : "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role={isDanger ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[var(--background)] p-6 text-[var(--text-primary)] shadow-2xl transition duration-150 starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
      >
        <div className="flex items-start gap-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
            {icon ?? (isDanger ? <AlertIcon /> : <QuestionIcon />)}
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}