import { NextResponse, type NextRequest } from "next/server";
import { ErroDeRegra } from "./erro-regra";
import {
  recursoDaRequisicao,
  validarPosseChamado,
  validarPosseCliente,
} from "./os/regras-apontamento";

// Resposta padrão quando a permissão falha: 401 sem sessão, 403 nos demais
// casos, sempre com { error } pra tela mostrar o motivo.
export function respostaSemPermissao(error: unknown): NextResponse {
  const message = error instanceof ErroDeRegra ? error.message : "Acesso negado.";

  if (!(error instanceof ErroDeRegra)) console.error("[permissao]", error);

  return NextResponse.json(
    { error: message },
    { status: message === "Não autenticado" ? 401 : 403 },
  );
}

// Código de chamado só com dígitos -- barra valores como "../x" que viram
// caminho de pasta nos anexos.
export function codChamadoNumerico(valor: unknown): string {
  const texto = String(valor ?? "").trim();

  if (!/^\d{1,12}$/.test(texto)) throw new ErroDeRegra("Código de chamado inválido.");

  return texto;
}

export type ResultadoPermissao =
  | { ok: true; recurso: number }
  | { ok: false; resposta: NextResponse };

// Só o consultor logado, sem olhar chamado/cliente (usado nas listas e nas
// áreas de atuação, onde o consultor sempre é o da sessão).
export async function exigirSessao(req: NextRequest): Promise<ResultadoPermissao> {
  try {
    return { ok: true, recurso: await recursoDaRequisicao(req) };
  } catch (error) {
    return { ok: false, resposta: respostaSemPermissao(error) };
  }
}

// Consultor logado + o chamado precisa ser dele.
export async function exigirChamadoDoConsultor(
  req: NextRequest,
  codChamado: unknown,
): Promise<ResultadoPermissao> {
  try {
    const recurso = await recursoDaRequisicao(req);
    await validarPosseChamado(recurso, codChamadoNumerico(codChamado));

    return { ok: true, recurso };
  } catch (error) {
    return { ok: false, resposta: respostaSemPermissao(error) };
  }
}

// Consultor logado + o cliente precisa ter chamado atribuído a ele.
export async function exigirClienteDoConsultor(
  req: NextRequest,
  codCliente: unknown,
): Promise<ResultadoPermissao> {
  try {
    const recurso = await recursoDaRequisicao(req);
    await validarPosseCliente(recurso, codCliente as number | string);

    return { ok: true, recurso };
  } catch (error) {
    return { ok: false, resposta: respostaSemPermissao(error) };
  }
}
