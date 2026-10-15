import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_LABEL } from "@/lib/roles";
import { alterarTurmaDoUsuario, listarTurmasAdmin, listarUsuariosAdmin } from "@/services/api";
import type { Turma, UsuarioAdmin } from "@/types/auth";

const selectCls =
  "w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60";

const SEM_TURMA = "__sem_turma__";

/** Professor e superadmin: turma e equipe de cada pessoa cadastrada. */
export function CadastrosPage() {
  const [filtro, setFiltro] = useState("");

  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: listarUsuariosAdmin });
  const { data: turmas } = useQuery({ queryKey: ["admin-turmas"], queryFn: listarTurmasAdmin });

  // Já vem ordenado pelos cadastros mais recentes.
  const visiveis = (users ?? []).filter((u) =>
    !filtro ? true : filtro === SEM_TURMA ? u.turmas.length === 0 : u.turmas.some((t) => t.id === filtro),
  );

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-20">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Cadastros: turmas e equipes</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Troque a turma ou a equipe de qualquer pessoa cadastrada. Quem estiver em mais de uma turma escolhe
            qual usar depois do login; os logs vão só para a turma escolhida.{" "}
            <Link to="/admin" className="text-[var(--accent)]">
              Voltar ao hub
            </Link>
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Filtrar por turma"
            className={`${selectCls} sm:w-auto sm:max-w-sm`}
          >
            <option value="">Todas as turmas</option>
            {turmas?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
            <option value={SEM_TURMA}>Sem turma</option>
          </select>
          {users && (
            <span className="text-xs text-[var(--text-secondary)]">
              {visiveis.length} {visiveis.length === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </div>

        {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
        {!isLoading && visiveis.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">Ninguém cadastrado com esse filtro.</p>
        )}

        <ul className="flex flex-col gap-2">
          {visiveis.map((u) => (
            <UserRow key={u.id} user={u} turmas={turmas ?? []} />
          ))}
        </ul>
      </div>
    </div>
  );
}

type Par = { turmaId: string; equipeId: string | null };

function UserRow({ user, turmas }: { user: UsuarioAdmin; turmas: Turma[] }) {
  const queryClient = useQueryClient();
  const [adicionando, setAdicionando] = useState(false);

  const principal: Par | null = user.turma ? { turmaId: user.turma.id, equipeId: user.equipe?.id ?? null } : null;
  const outras: Par[] = user.outras.map((o) => ({ turmaId: o.turma.id, equipeId: o.equipe?.id ?? null }));

  const { mutate, isPending, isError } = useMutation({
    mutationFn: (v: { principal: Par | null; outras: Par[] }) =>
      alterarTurmaDoUsuario(user.id, v.principal?.turmaId ?? null, v.principal?.equipeId ?? null, v.outras),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-turmas"] });
    },
  });

  // Turmas que a pessoa já tem, menos a do próprio par (não dá para repetir turma).
  const usadas = [principal, ...outras].flatMap((p) => (p ? [p.turmaId] : []));
  const livres = (atual?: string) => turmas.filter((t) => t.id === atual || !usadas.includes(t.id));
  const trocarOutra = (i: number, par: Par | null) =>
    mutate({ principal, outras: par ? outras.map((o, j) => (j === i ? par : o)) : outras.filter((_, j) => j !== i) });
  const nome = user.nome ?? user.email;

  return (
    <li className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--text-primary)]">
          {user.nome ?? <span className="text-[var(--text-secondary)]">Sem nome</span>}
          {user.role !== "ALUNO" && (
            <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">
              {ROLE_LABEL[user.role]}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          Cadastro em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
        </p>
        {isError && <p className="text-xs text-[var(--danger)]">Falha ao salvar.</p>}
      </div>

      <TurmaEquipeSelects
        par={principal}
        turmas={livres(principal?.turmaId)}
        todas={turmas}
        vazio="Sem turma"
        disabled={isPending}
        rotulo={nome}
        // Trocar a turma principal substitui a anterior; as outras continuam.
        onChange={(par) => mutate({ principal: par, outras: par ? outras : [] })}
      />

      {principal && (
        <>
          {outras.map((o, i) => (
            <div key={o.turmaId} className="contents">
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <span className="text-[11px] text-[var(--text-secondary)]">Outra turma</span>
                <button
                  type="button"
                  onClick={() => trocarOutra(i, null)}
                  disabled={isPending}
                  title="Tirar desta turma"
                  aria-label={`Tirar ${nome} desta turma`}
                  className="icon-btn h-7 w-7"
                >
                  <X size={14} />
                </button>
              </div>
              <TurmaEquipeSelects
                par={o}
                turmas={livres(o.turmaId)}
                todas={turmas}
                disabled={isPending}
                rotulo={nome}
                onChange={(par) => trocarOutra(i, par)}
              />
            </div>
          ))}

          {adicionando && (
            <div className="contents">
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <span className="text-[11px] text-[var(--text-secondary)]">Nova turma</span>
                <button
                  type="button"
                  onClick={() => setAdicionando(false)}
                  title="Cancelar"
                  aria-label="Cancelar"
                  className="icon-btn h-7 w-7"
                >
                  <X size={14} />
                </button>
              </div>
              <TurmaEquipeSelects
                par={null}
                turmas={livres()}
                todas={turmas}
                vazio="Escolha a turma"
                disabled={isPending}
                rotulo={nome}
                onChange={(par) => {
                  if (!par) return;
                  setAdicionando(false);
                  mutate({ principal, outras: [...outras, par] });
                }}
              />
            </div>
          )}

          {!adicionando && livres().length > 0 && (
            <div className="flex items-center gap-2 md:col-span-3">
              <span className="text-[11px] text-[var(--text-secondary)]">Adicionar aluno em outra turma</span>
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                disabled={isPending}
                title="Adicionar aluno em outra turma"
                aria-label={`Adicionar ${nome} em outra turma`}
                className="icon-btn h-7 w-7 border border-[var(--border)]"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

/** Par de selects turma + equipe (a equipe só lista as da turma escolhida). */
function TurmaEquipeSelects({
  par,
  turmas,
  todas,
  vazio,
  disabled,
  rotulo,
  onChange,
}: {
  par: Par | null;
  /** Turmas oferecidas no select (sem as que a pessoa já tem). */
  turmas: Turma[];
  /** Todas as turmas, para achar as equipes. */
  todas: Turma[];
  /** Texto da opção vazia; sem ele, não dá para deixar a turma vazia. */
  vazio?: string;
  disabled: boolean;
  rotulo: string;
  onChange: (par: Par | null) => void;
}) {
  const equipes = todas.find((t) => t.id === par?.turmaId)?.equipes ?? [];

  return (
    <>
      <select
        value={par?.turmaId ?? ""}
        onChange={(e) => onChange(e.target.value ? { turmaId: e.target.value, equipeId: null } : null)}
        disabled={disabled}
        aria-label={`Turma de ${rotulo}`}
        className={selectCls}
      >
        {(vazio || !par) && (
          <option value="" disabled={!vazio}>
            {vazio ?? "Escolha a turma"}
          </option>
        )}
        {turmas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>

      <select
        value={par?.equipeId ?? ""}
        onChange={(e) => par && onChange({ turmaId: par.turmaId, equipeId: e.target.value || null })}
        disabled={disabled || !par || equipes.length === 0}
        aria-label={`Equipe de ${rotulo}`}
        className={selectCls}
      >
        <option value="">{!par ? "Escolha a turma antes" : equipes.length ? "Sem equipe" : "Turma sem equipes"}</option>
        {equipes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </>
  );
}
