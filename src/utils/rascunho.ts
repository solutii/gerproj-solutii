// Rascunho da descrição do apontamento: se o modal for fechado sem querer
// (Cancelar, X, clique fora), o texto digitado volta na próxima abertura do
// mesmo chamado/tarefa. Fica só no navegador (localStorage), vale 24 horas e
// é apagado ao gravar o apontamento e ao sair do sistema.
//
// O acesso ao localStorage pode falhar (janela anônima, dados bloqueados): nada
// aqui deve quebrar a tela, então tudo é protegido por try/catch.

const PREFIXO = "gerproj-rascunho:";
export const VALIDADE_RASCUNHO_MS = 24 * 60 * 60 * 1000;

export const chaveRascunhoTarefa = (codTarefa: number | string) => `tarefa:${codTarefa}`;
export const chaveRascunhoChamado = (codChamado: number | string) => `chamado:${codChamado}`;

function armazenamento(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Texto salvo para a chave, ou "" se não há / expirou / está ilegível.
export function lerRascunho(chave: string, agora: number = Date.now()): string {
  const storage = armazenamento();
  if (!storage) return "";

  try {
    const bruto = storage.getItem(PREFIXO + chave);
    if (!bruto) return "";

    const { texto, em } = JSON.parse(bruto) as { texto?: unknown; em?: unknown };

    if (typeof texto !== "string" || typeof em !== "number" || agora - em > VALIDADE_RASCUNHO_MS) {
      storage.removeItem(PREFIXO + chave);
      return "";
    }

    return texto;
  } catch {
    return "";
  }
}

// Texto vazio (ou só espaços) apaga o rascunho.
export function salvarRascunho(chave: string, texto: string, agora: number = Date.now()): void {
  const storage = armazenamento();
  if (!storage) return;

  try {
    if (texto.trim() === "") storage.removeItem(PREFIXO + chave);
    else storage.setItem(PREFIXO + chave, JSON.stringify({ texto, em: agora }));
  } catch {
    // armazenamento cheio ou bloqueado: sem rascunho, mas sem erro na tela
  }
}

export function descartarRascunho(chave: string): void {
  try {
    armazenamento()?.removeItem(PREFIXO + chave);
  } catch {
    // ignora
  }
}

// Logout / sessão expirada: nenhum texto do usuário fica para o próximo.
export function limparTodosRascunhos(): void {
  const storage = armazenamento();
  if (!storage) return;

  try {
    for (const chave of Object.keys(storage).filter((k) => k.startsWith(PREFIXO))) {
      storage.removeItem(chave);
    }
  } catch {
    // ignora
  }
}
