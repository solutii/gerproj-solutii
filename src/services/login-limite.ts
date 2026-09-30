// Limite de tentativas de login (contra adivinhação de senha), em memória.
//
// - Por IP + usuário: 5 falhas em 15 minutos bloqueiam essa combinação por 15
//   minutos (o bloqueio por combinação evita que um atacante trave o login de
//   outra pessoa apenas digitando o nome dela de outro IP).
// - Por IP: 40 falhas em 15 minutos bloqueiam o IP (varredura de vários
//   usuários de um mesmo lugar).
// Login certo zera o contador da combinação IP + usuário.
//
// Guardado em globalThis pra sobreviver ao hot-reload em dev. É por processo:
// vale pro servidor único do GerProj; reiniciar o servidor zera os contadores.

export const JANELA_MS = 15 * 60 * 1000;
export const MAX_FALHAS_USUARIO = 5;
export const MAX_FALHAS_IP = 40;

type Registro = { falhas: number[] };

const global = globalThis as unknown as { loginFalhas?: Map<string, Registro> };
const falhas = (global.loginFalhas ??= new Map<string, Registro>());

function falhasRecentes(chave: string, agora: number): number[] {
  const recentes = (falhas.get(chave)?.falhas ?? []).filter((t) => agora - t < JANELA_MS);

  if (recentes.length) falhas.set(chave, { falhas: recentes });
  else falhas.delete(chave);

  return recentes;
}

const chaveUsuario = (ip: string, usuario: string) => `u|${ip}|${usuario.trim().toUpperCase()}`;
const chaveIp = (ip: string) => `i|${ip}`;

// Minutos que faltam para liberar (0 = liberado).
export function minutosDeBloqueio(ip: string, usuario: string, agora: number = Date.now()): number {
  const limites: [string, number][] = [
    [chaveUsuario(ip, usuario), MAX_FALHAS_USUARIO],
    [chaveIp(ip), MAX_FALHAS_IP],
  ];

  let restanteMs = 0;

  for (const [chave, max] of limites) {
    const recentes = falhasRecentes(chave, agora);
    if (recentes.length >= max) {
      // Libera JANELA_MS depois da falha que atingiu o limite.
      restanteMs = Math.max(restanteMs, recentes[max - 1] + JANELA_MS - agora);
    }
  }

  return restanteMs > 0 ? Math.ceil(restanteMs / 60000) : 0;
}

export function registrarFalhaLogin(ip: string, usuario: string, agora: number = Date.now()): void {
  for (const chave of [chaveUsuario(ip, usuario), chaveIp(ip)]) {
    falhas.set(chave, { falhas: [...falhasRecentes(chave, agora), agora] });
  }
}

export function registrarLoginOk(ip: string, usuario: string): void {
  falhas.delete(chaveUsuario(ip, usuario));
}

// IP de quem chamou: primeiro endereço do X-Forwarded-For (quando há proxy) ou
// X-Real-IP; sem nenhum dos dois, um valor fixo (limite vale pra todos juntos).
export function ipDaRequisicao(headers: Record<string, unknown> | undefined): string {
  const encaminhado = String(headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
  const real = String(headers?.["x-real-ip"] ?? "").trim();

  return encaminhado || real || "desconhecido";
}

export function limparLoginFalhas(): void {
  falhas.clear();
}
