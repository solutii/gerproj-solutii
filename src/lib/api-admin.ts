import { apiGet, apiJson } from "@/lib/api";
import type {
  AlteracaoConsultor,
  AlteracaoTarefa,
  ConsultorAdmin,
  HistoricoResposta,
  ListaDeTarefas,
  ResultadoAlteracao,
  TarefaAdmin,
} from "@/types/admin";
import type { DashboardResposta } from "@/types/admin-dashboard";
import type { PainelResposta } from "@/types/painel";

// Rotas /api/admin (só administrador).

const JSON_HEADERS = { "Content-Type": "application/json" };

export function buscarConsultoresAdmin(busca: string, somenteAtivos: boolean) {
  return apiGet<ConsultorAdmin[]>(`/api/admin/consultores?busca=${encodeURIComponent(busca)}&ativos=${somenteAtivos ? 1 : 0}`, {
    mensagemPadrao: "Não foi possível carregar os consultores.",
  });
}

export function buscarTarefasAdmin(busca: string, somenteAtivas: boolean, pagina: number) {
  return apiGet<ListaDeTarefas>(`/api/admin/tarefas?busca=${encodeURIComponent(busca)}&ativas=${somenteAtivas ? 1 : 0}&pagina=${pagina}`, {
    mensagemPadrao: "Não foi possível carregar as tarefas.",
  });
}

export function buscarHistoricoAdmin(mes: string, busca: string) {
  return apiGet<HistoricoResposta>(`/api/admin/historico?mes=${encodeURIComponent(mes)}&busca=${encodeURIComponent(busca)}`, {
    mensagemPadrao: "Não foi possível carregar o histórico.",
  });
}

export function atualizarConsultorAdmin(codigo: number, alteracao: AlteracaoConsultor) {
  return apiJson<ResultadoAlteracao<ConsultorAdmin>>(`/api/admin/consultores/${codigo}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(alteracao),
    mensagemPadrao: "Não foi possível salvar as alterações do consultor.",
  });
}

export function atualizarTarefaAdmin(codigo: number, alteracao: AlteracaoTarefa) {
  return apiJson<ResultadoAlteracao<TarefaAdmin>>(`/api/admin/tarefas/${codigo}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(alteracao),
    mensagemPadrao: "Não foi possível salvar as alterações da tarefa.",
  });
}

// Dashboard (só leitura). `atualizar` ignora o cache de 2 minutos do servidor.
export function buscarDashboardAdmin(mes: string, atualizar = false) {
  return apiGet<DashboardResposta>(`/api/admin/dashboard?mes=${encodeURIComponent(mes)}${atualizar ? "&atualizar=1" : ""}`, {
    mensagemPadrao: "Não foi possível carregar o dashboard.",
  });
}

// O Meu Painel de um consultor, visto pelo administrador.
export function buscarPainelDoConsultorAdmin(codigo: number, mes: string) {
  return apiGet<{ consultor: { codigo: number; nome: string }; painel: PainelResposta }>(
    `/api/admin/dashboard/consultor/${codigo}?mes=${encodeURIComponent(mes)}`,
    { mensagemPadrao: "Não foi possível carregar o painel do consultor." },
  );
}
