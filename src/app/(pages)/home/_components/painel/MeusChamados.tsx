import type { PainelResposta } from "@/types/painel";
import Tooltip from "@/components/tooltip";
import Cartao from "./Cartao";

type Props = {
  dados: PainelResposta;
  onIrParaChamado: (codChamado: number) => void;
};

const COR_STATUS: Record<string, string> = {
  ATRIBUIDO: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  "EM ATENDIMENTO": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  STANDBY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "AGUARDANDO VALIDACAO": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
};

const NOME_STATUS: Record<string, string> = {
  ATRIBUIDO: "Atribuído",
  "EM ATENDIMENTO": "Em atendimento",
  STANDBY: "StandBy",
  "AGUARDANDO VALIDACAO": "Aguardando validação",
};

const linha =
  "w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-700/60 outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]";

export default function MeusChamados({ dados, onIrParaChamado }: Props) {
  const { porStatus, maisAntigos, aguardandoValidacao } = dados.chamados;
  const total = porStatus.reduce((s, p) => s + p.quantidade, 0);

  return (
    <Cartao titulo="Meus chamados em aberto" subtitulo="Situação de hoje · clique para abrir o chamado">
      {total === 0 ? (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhum chamado em aberto.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5" aria-label="Chamados por status">
            {porStatus.map((p) => (
              <li
                key={p.status}
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${COR_STATUS[p.status] ?? COR_STATUS.ATRIBUIDO}`}
              >
                {p.quantidade} · {NOME_STATUS[p.status] ?? p.status}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aguardando validação do cliente ({aguardandoValidacao.length})
            </h4>
            {aguardandoValidacao.length === 0 ? (
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Nenhum chamado aguardando o cliente.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {aguardandoValidacao.map((c) => (
                  <li key={c.codChamado}>
                    <Tooltip content={`Abrir o chamado #${c.codChamado} na aba Chamados`} className="relative flex w-full">
                    <button type="button" className={linha} onClick={() => onIrParaChamado(c.codChamado)}>
                      <span className="font-bold text-slate-800 dark:text-white">#{c.codChamado}</span> · {c.cliente}
                      <span className="block truncate text-slate-500 dark:text-slate-400">{c.assunto}</span>
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        há {c.diasAguardando} {c.diasAguardando === 1 ? "dia" : "dias"} aguardando — vale cobrar
                      </span>
                    </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mais antigos em aberto
            </h4>
            <ul className="flex flex-col gap-1.5">
              {maisAntigos.map((c) => (
                <li key={c.codChamado}>
                  <Tooltip content={`Abrir o chamado #${c.codChamado} na aba Chamados`} className="relative flex w-full">
                    <button type="button" className={linha} onClick={() => onIrParaChamado(c.codChamado)}>
                      <span className="font-bold text-slate-800 dark:text-white">#{c.codChamado}</span> · {c.cliente}
                      <span className="block truncate text-slate-500 dark:text-slate-400">{c.assunto}</span>
                      <span className="font-semibold">
                        aberto há {c.diasAberto} {c.diasAberto === 1 ? "dia" : "dias"} · {NOME_STATUS[c.status] ?? c.status}
                      </span>
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Cartao>
  );
}
