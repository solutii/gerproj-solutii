import { formatarNumero } from "@/utils/painel/horas";
import type { RegistroDeHistorico } from "@/types/admin";

// Como o histórico do painel é mostrado: nomes dos campos em português e valores
// legíveis (SIM/NAO -> Sim/Não, datas em dd/mm/aaaa, limites com "h").

const ROTULOS: Record<string, string> = {
  permiteApontarNoPassado: "Apontar no passado",
  dataLimite: "Data-limite",
  jornada: "Jornada diária",
  permiteExceder: "Liberar estouro do limite",
  limiteMensalHoras: "Limite mensal",
  horasContratadas: "Horas contratadas",
};

export const rotuloDoCampo = (campo: string) => ROTULOS[campo] ?? campo;

export function formatarValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return campo === "limiteMensalHoras" ? "sem limite" : "(vazio)";

  if (valor === "SIM") return "Sim";
  if (valor === "NAO") return "Não";
  if (campo === "dataLimite" && typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
  if ((campo === "limiteMensalHoras" || campo === "horasContratadas") && typeof valor === "number") return `${formatarNumero(valor)}h`;

  return String(valor);
}

export type LinhaDeMudanca = { campo: string; antes: string; depois: string };

// Uma linha por campo alterado: "Jornada diária: 08:48 → 09:00"
export function mudancasDoRegistro(registro: Pick<RegistroDeHistorico, "antes" | "depois">): LinhaDeMudanca[] {
  const campos = Array.from(new Set([...Object.keys(registro.antes), ...Object.keys(registro.depois)]));

  return campos.map((campo) => ({
    campo: rotuloDoCampo(campo),
    antes: formatarValor(campo, registro.antes[campo]),
    depois: formatarValor(campo, registro.depois[campo]),
  }));
}

// Data e hora em Brasília
export function dataHoraBR(ts: string): string {
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
}

export const TEXTO_DA_SITUACAO: Record<RegistroDeHistorico["situacao"], string> = {
  confirmada: "Confirmada",
  falhou: "Não aplicada",
  "nao-confirmada": "Sem confirmação",
};

// "2026-10" -> "outubro de 2026"
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);

  return new Date(Date.UTC(ano, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}
