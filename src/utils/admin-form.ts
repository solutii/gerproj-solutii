import { formatarNumero } from "@/utils/painel/horas";
import type { AlteracaoConsultor, AlteracaoTarefa, ConsultorAdmin, TarefaAdmin } from "@/types/admin";
import { validarAlteracoesConsultor, validarAlteracoesTarefa } from "./admin-validacao";

// Lógica pura dos formulários de edição do painel: o que mudou, se está válido e
// como descrever a mudança na confirmação. (O servidor valida tudo de novo.)

export type FormConsultor = { permiteApontarNoPassado: boolean; dataLimite: string; jornada: string };
export type FormTarefa = { permiteExceder: boolean; limiteMensal: string; horasContratadas: string };

export const formDoConsultor = (c: ConsultorAdmin): FormConsultor => ({
  permiteApontarNoPassado: c.permiteApontarNoPassado,
  dataLimite: c.dataLimite ?? "",
  jornada: c.jornada,
});

export const formDaTarefa = (t: TarefaAdmin): FormTarefa => ({
  permiteExceder: t.permiteExceder,
  limiteMensal: t.limiteMensalHoras === null ? "" : String(t.limiteMensalHoras),
  horasContratadas: t.horasContratadas === null ? "" : String(t.horasContratadas).replace(".", ","),
});

// Só o que mudou em relação ao que está no banco.
export function alteracaoDoConsultor(atual: ConsultorAdmin, form: FormConsultor): AlteracaoConsultor {
  const mudou: AlteracaoConsultor = {};

  if (form.permiteApontarNoPassado !== atual.permiteApontarNoPassado) mudou.permiteApontarNoPassado = form.permiteApontarNoPassado;
  if (form.dataLimite !== (atual.dataLimite ?? "")) mudou.dataLimite = form.dataLimite;
  if (form.jornada !== atual.jornada) mudou.jornada = form.jornada;

  return mudou;
}

const horasParaNumero = (texto: string) => Number(texto.trim().replace(",", "."));

export function alteracaoDaTarefa(atual: TarefaAdmin, form: FormTarefa): AlteracaoTarefa {
  const mudou: AlteracaoTarefa = {};

  if (form.permiteExceder !== atual.permiteExceder) mudou.permiteExceder = form.permiteExceder;

  const limite = form.limiteMensal.trim() === "" ? null : Number(form.limiteMensal.trim());
  if (limite !== atual.limiteMensalHoras) mudou.limiteMensalHoras = limite as number | null;

  if (form.horasContratadas.trim() !== "") {
    const horas = horasParaNumero(form.horasContratadas);
    if (Number.isNaN(horas) || atual.horasContratadas === null || Math.abs(horas - atual.horasContratadas) >= 0.005) {
      mudou.horasContratadas = form.horasContratadas.trim(); // o servidor valida o texto
    }
  }

  return mudou;
}

export type SituacaoDoForm = { alterou: boolean; erro: string | null };

// Válido e com alguma mudança? `erro` traz a mensagem para mostrar no formulário.
export function situacaoDoConsultor(alteracao: AlteracaoConsultor, hoje: string): SituacaoDoForm {
  if (Object.keys(alteracao).length === 0) return { alterou: false, erro: null };

  const r = validarAlteracoesConsultor(alteracao, hoje);

  return { alterou: true, erro: r.ok ? null : r.erro };
}

export function situacaoDaTarefa(alteracao: AlteracaoTarefa): SituacaoDoForm {
  if (Object.keys(alteracao).length === 0) return { alterou: false, erro: null };

  const r = validarAlteracoesTarefa(alteracao);

  return { alterou: true, erro: r.ok ? null : r.erro };
}

const simNao = (v: boolean) => (v ? "Sim" : "Não");
const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "(vazio)");

// Frase da confirmação: "Apontar no passado: Não → Sim; Jornada: 08:48 → 09:00"
export function descreverAlteracaoConsultor(atual: ConsultorAdmin, a: AlteracaoConsultor): string {
  const partes: string[] = [];

  if (a.permiteApontarNoPassado !== undefined) partes.push(`Apontar no passado: ${simNao(atual.permiteApontarNoPassado)} → ${simNao(a.permiteApontarNoPassado)}`);
  if (a.dataLimite !== undefined) partes.push(`Data-limite: ${dataBR(atual.dataLimite)} → ${dataBR(a.dataLimite)}`);
  if (a.jornada !== undefined) partes.push(`Jornada: ${atual.jornada} → ${a.jornada}`);

  return partes.join("; ");
}

const limiteTexto = (v: number | null) => (v === null ? "sem limite" : `${formatarNumero(v)}h`);

export function descreverAlteracaoTarefa(atual: TarefaAdmin, a: AlteracaoTarefa): string {
  const partes: string[] = [];

  if (a.permiteExceder !== undefined) partes.push(`Liberar estouro do limite: ${simNao(atual.permiteExceder)} → ${simNao(a.permiteExceder)}`);
  if (a.limiteMensalHoras !== undefined) partes.push(`Limite mensal: ${limiteTexto(atual.limiteMensalHoras)} → ${limiteTexto(a.limiteMensalHoras)}`);
  if (a.horasContratadas !== undefined) {
    partes.push(`Horas contratadas: ${atual.horasContratadas === null ? "(vazio)" : `${formatarNumero(atual.horasContratadas)}h`} → ${formatarNumero(Number(a.horasContratadas))}h`);
  }

  return partes.join("; ");
}
