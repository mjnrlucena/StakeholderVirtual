import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="mb-5 text-center text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
