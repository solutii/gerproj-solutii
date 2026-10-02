"use client";

import { useState } from "react";
import { useHistoricoAdmin } from "@/hooks/queries/admin";
import { useDebounce } from "@/hooks/useDebounce";
import { dataHoraBR, mudancasDoRegistro, nomeDoMes, TEXTO_DA_SITUACAO } from "@/utils/admin-historico";
import type { RegistroDeHistorico } from "@/types/admin";
import EstadoDaLista from "./EstadoDaLista";
import { campo, campoBusca, cartao, selo } from "./estilos";

const mesAtual = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

const SELO_DA_SITUACAO: Record<RegistroDeHistorico["situacao"], string> = {
  confirmada: selo.sim,
  falhou: selo.erro,
  "nao-confirmada": selo.alerta,
};

export default function HistoricoAba() {
  const [mes, setMes] = useState(mesAtual);
  const [busca, setBusca] = useState("");

  const termo = useDebounce(busca.trim());
  const consulta = useHistoricoAdmin(mes, termo);
  const historico = consulta.data;
  const registros = historico?.registros ?? [];

  // meses com arquivo + o mês atual (mesmo sem nada ainda)
  const meses = Array.from(new Set([mesAtual(), ...(historico?.mesesDisponiveis ?? [])])).sort().reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <select aria-label="Mês do histórico" className={`${campo} !w-auto cursor-pointer`} value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {nomeDoMes(m)}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Filtrar histórico por consultor, tarefa ou administrador"
          placeholder="Filtrar por consultor, tarefa ou administrador..."
          className={campoBusca}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {historico &&
        (historico.integridade.ok ? (
          <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-400">
            Histórico íntegro: nenhuma linha foi alterada ou apagada neste mês.
          </p>
        ) : (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">
              ATENÇÃO: o histórico deste mês foi alterado depois de gravado. Não confie nas linhas abaixo até verificar o arquivo no servidor.
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs font-medium text-red-700 dark:text-red-300">
              {historico.integridade.problemas.map((p, i) => (
                <li key={i}>
                  {p.arquivo}, linha {p.linha}: {p.motivo}
                </li>
              ))}
            </ul>
          </div>
        ))}

      <section className={cartao}>
        <EstadoDaLista
          carregando={consulta.isPending}
          erro={consulta.isError && !historico ? consulta.error : null}
          vazio={registros.length === 0}
          textoVazio="Nenhuma alteração registrada neste mês."
          onTentarDeNovo={() => void consulta.refetch()}
        >
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {registros.map((r) => (
              <li key={r.hash} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{dataHoraBR(r.ts)}</span>
                  <span className={SELO_DA_SITUACAO[r.situacao]}>{TEXTO_DA_SITUACAO[r.situacao]}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    por {r.ator.nome} ({r.ator.login}) · IP {r.ator.ip}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {r.alvo.tipo === "consultor" ? "Consultor" : "Tarefa"} #{r.alvo.codigo} · {r.alvo.nome}
                </p>
                <ul className="flex flex-col gap-0.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {mudancasDoRegistro(r).map((m) => (
                    <li key={m.campo}>
                      <span className="font-semibold">{m.campo}:</span> {m.antes} → <span className="font-bold text-slate-800 dark:text-white">{m.depois}</span>
                    </li>
                  ))}
                </ul>
                {r.erro && <p className="text-xs font-medium text-red-600 dark:text-red-300">Motivo: {r.erro}</p>}
              </li>
            ))}
          </ul>
        </EstadoDaLista>
      </section>
    </div>
  );
}
