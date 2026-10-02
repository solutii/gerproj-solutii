import { apiGet, apiPost } from "@/lib/api";
import type { ChamadosType } from "@/types/chamados";
import type { TaskType } from "@/types/tarefa";

// Todas as rotas /api que a Home usa, num lugar só. Quem decide cache e
// atualização são os hooks em src/hooks/queries; aqui só há a chamada em si.

type Opcoes = { signal?: AbortSignal };

// ─── Leituras (viram queries com cache) ─────────────────────────────────────

export async function buscarChamados(recurso: number | string, { signal }: Opcoes = {}): Promise<ChamadosType[]> {
  const lista = await apiGet<ChamadosType[]>(`/api/call/list?recurso=${encodeURIComponent(String(recurso))}`, {
    signal,
    mensagemPadrao: "Não foi possível carregar os chamados.",
  });

  return Array.isArray(lista) ? lista : [];
}

export async function buscarTarefas(recurso: number | string, { signal }: Opcoes = {}): Promise<TaskType[]> {
  const lista = await apiGet<TaskType[]>(`/api/os/list?recurso=${encodeURIComponent(String(recurso))}`, {
    signal,
    mensagemPadrao: "Não foi possível carregar as tarefas.",
  });

  return Array.isArray(lista) ? lista : [];
}

// De onde vem a lista de OS exibida: de um chamado, de uma tarefa ou de uma data.
export type AlvoOs =
  | { tipo: "chamado"; codigo: number }
  | { tipo: "tarefa"; codigo: number | string }
  | { tipo: "data"; data: string };

export async function buscarOs(alvo: AlvoOs, recurso: number | string, { signal }: Opcoes = {}): Promise<any[]> {
  const mensagemPadrao = "Não foi possível carregar as OS.";
  let lista: any;

  if (alvo.tipo === "tarefa") {
    lista = await apiPost("/api/os/list-for-trf", { tarefa: alvo.codigo, data: "", recurso }, { signal, mensagemPadrao });
  } else {
    lista = await apiPost(
      "/api/os/list",
      {
        chamado: alvo.tipo === "chamado" ? alvo.codigo : undefined,
        data: alvo.tipo === "data" ? alvo.data : "",
        recurso,
      },
      { signal, mensagemPadrao },
    );
  }

  return Array.isArray(lista) ? lista : [];
}

// Registro do consultor com a permissão e a data-limite de apontamento.
export type PeriodoBruto = { PERMAPO_RECURSO: string; DTLIMITE_RECURSO: string };

export async function buscarPeriodo(recurso: number | string, { signal }: Opcoes = {}): Promise<PeriodoBruto> {
  const lista = await apiPost<PeriodoBruto[]>("/api/os/valid", { recurso }, {
    signal,
    mensagemPadrao: "Não foi possível carregar o período de apontamento.",
  });

  if (!Array.isArray(lista) || !lista[0]) throw new Error("Período de apontamento não encontrado.");

  return lista[0];
}

export type Area = {
  COD_AREA: number;
  NOME_AREA: string;
  ATIVO_AREA: string;
  CHAMADO_AREA: string;
  OBS_RECAREA?: string;
  SELECTED?: string; // '0' ou '1'
};

export async function buscarAreas(recurso: number | string, { signal }: Opcoes = {}): Promise<Area[]> {
  const lista = await apiPost<Area[]>("/api/area", { COD_RECURSO: recurso }, {
    signal,
    mensagemPadrao: "Não foi possível carregar as áreas de atuação.",
  });

  return Array.isArray(lista) ? lista : [];
}

// ─── Consultas imediatas (sempre frescas, sem cache) ────────────────────────
// Conferências feitas no instante do clique, antes de gravar: um resultado
// guardado de antes poderia deixar passar um apontamento que estoura o limite.

export function validarHorasTarefa(args: { tarefa: number | string; date: string; startTime: string; endTime: string }) {
  return apiPost<number[]>("/api/os/valid-hours", {
    chamado: args.tarefa,
    date: args.date,
    startTime: args.startTime,
    endTime: args.endTime,
  });
}

export function validarHorasChamado(args: { chamado: number; date: string; startTime: string; endTime: string }) {
  return apiPost<number[]>("/api/call/valid-hours", args);
}

export function buscarTarefaDoApontamento(codigo: number | string | undefined) {
  return apiPost("/api/get-task", { COD_CHAMADO: codigo });
}

export function listarTarefasParaChamado(chamado: ChamadosType) {
  return apiPost<any[]>("/api/call/task", { chamado });
}

export async function listarClassificacoes(chamado: ChamadosType) {
  const lista = await apiPost<any[]>("/api/call/classificacao", { chamado });

  return Array.isArray(lista) ? lista : [];
}

// ─── Gravações (viram mutations) ────────────────────────────────────────────

export function iniciarChamado(codChamado: number) {
  return apiPost(`/api/call/start?codChamado=${codChamado}`, undefined, {
    mensagemPadrao: "Não foi possível iniciar o chamado.",
  });
}

export function alterarStatusChamado(args: { codChamado: number; status: string; email: string | null }) {
  return apiPost(
    `/api/call/change-status?codChamado=${args.codChamado}&status=${encodeURIComponent(args.status)}&email=${encodeURIComponent(args.email ?? "")}`,
    undefined,
    { mensagemPadrao: "Não foi possível alterar o status do chamado." },
  );
}

export function vincularTarefaAoChamado(args: { codChamado: number | undefined; codTarefa: number | string | null }) {
  return apiPost("/api/insert-task", { COD_CHAMADO: args.codChamado, COD_TAREFA: args.codTarefa });
}

export function vincularClassificacaoAoChamado(args: { codChamado: number | undefined; codClassificacao: number | string | null }) {
  return apiPost("/api/insert-classificacao", {
    COD_CHAMADO: args.codChamado,
    COD_CLASSIFICACAO: args.codClassificacao,
  });
}

export function registrarApontamento(corpo: Record<string, unknown>) {
  return apiPost("/api/os/apoint", corpo, {
    mensagemPadrao: "Não foi possível registrar o apontamento. Tente novamente.",
  });
}

export function colocarEmStandby(corpo: Record<string, unknown>) {
  return apiPost("/api/call/standby", corpo, {
    mensagemPadrao: "Não foi possível colocar o chamado em standby. Tente novamente.",
  });
}

export function salvarAcesso(corpo: { descricao: string; cliente: unknown }) {
  return apiPost("/api/acesso", corpo, { mensagemPadrao: "Não foi possível salvar os dados de acesso." });
}

export function excluirOs(codOs: number) {
  return apiPost("/api/os/delete", { codOs }, { mensagemPadrao: "Não foi possível excluir o apontamento." });
}

export function atualizarOs(corpo: Record<string, unknown>) {
  return apiPost("/api/os/update", corpo, { mensagemPadrao: "Não foi possível salvar as alterações da OS." });
}

export function salvarAreas(itens: Array<{ COD_RECURSO: string | number; COD_AREA: number; OBS_RECAREA: string }>) {
  return apiPost("/api/recarea", itens, { mensagemPadrao: "Não foi possível salvar as áreas de atuação." });
}

// Anexo: a rota responde { success, message }, mesmo em erro de negócio.
export async function anexarArquivo(args: { codChamado: number; arquivo: File }): Promise<{ success: boolean; message?: string }> {
  const formData = new FormData();
  formData.append("file", args.arquivo);
  formData.append("codChamado", String(args.codChamado));

  const resposta = await fetch(`/api/upload/?codChamado=${args.codChamado}`, { method: "POST", body: formData });
  const json = await resposta.json().catch(() => null);

  return json ?? { success: false };
}

// Anexos do chamado em .zip; sem anexos a rota não devolve zip (null).
export async function baixarAnexos(codChamado: number): Promise<Blob | null> {
  const resposta = await fetch(`/api/arquivos?codChamado=${codChamado}`);

  if (!(resposta.headers.get("Content-Type") ?? "").includes("zip")) return null;

  return resposta.blob();
}
