// Única porta de saída do navegador para as rotas /api: toda busca e gravação
// passa por aqui, então o tratamento de erro é igual em todo lugar.
//
// O `fetch` é lido no momento da chamada (e não guardado), porque o
// SessionGuard troca window.fetch para detectar sessão expirada (401).

// Erro devolvido pela API (status de erro + { error }) ou falha de rede
// (status 0). `message` já vem pronta para mostrar ao usuário.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const MENSAGEM_FALHA_REDE = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

async function lerJson(resposta: Response): Promise<any> {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

// Faz a chamada e devolve o JSON. Status de erro vira ApiError com a mensagem
// do servidor (`error`) ou `mensagemPadrao`.
export async function apiJson<T = any>(
  url: string,
  init?: RequestInit & { mensagemPadrao?: string },
): Promise<T> {
  const { mensagemPadrao, ...opcoes } = init ?? {};
  let resposta: Response;

  try {
    resposta = await fetch(url, opcoes);
  } catch (erro) {
    // cancelamento (AbortSignal) não é falha: o Query descarta
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro;

    throw new ApiError(MENSAGEM_FALHA_REDE, 0);
  }

  const json = await lerJson(resposta);

  if (!resposta.ok) {
    throw new ApiError(json?.error ?? mensagemPadrao ?? "Não foi possível concluir a operação.", resposta.status);
  }

  return json as T;
}

export function apiGet<T = any>(url: string, init?: RequestInit & { mensagemPadrao?: string }) {
  return apiJson<T>(url, init);
}

export function apiPost<T = any>(url: string, corpo?: unknown, init?: RequestInit & { mensagemPadrao?: string }) {
  return apiJson<T>(url, {
    ...init,
    method: "POST",
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
}

// Mensagem para o usuário a partir de qualquer erro capturado.
export function mensagemDoErro(erro: unknown, padrao: string): string {
  if (erro instanceof ApiError) return erro.message;

  return padrao;
}
