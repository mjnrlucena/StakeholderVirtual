import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="app-title">Página não encontrada</h1>
      <p className="app-subtitle">O endereço acessado não existe.</p>
      <Link to="/" className="btn-primary px-4 py-2 text-sm">
        Voltar para o chat
      </Link>
    </div>
  );
}
