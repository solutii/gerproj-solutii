const PADRAO = "/home";

// Destino pós-login: só aceita caminho do próprio site (nunca outro domínio).
// O middleware manda o callbackUrl como URL completa; aqui ficamos só com
// caminho + query, e se a URL for de outra origem (ou inválida) cai em /home --
// fecha o redirecionamento aberto e evita voltar pra "localhost".
export function destinoSeguro(callbackUrl: string | null | undefined, origem: string): string {
  if (!callbackUrl) return PADRAO;

  try {
    // "//dominio.com" e "\dominio.com" também seriam lidos como outro host.
    const url = new URL(callbackUrl, origem);
    if (url.origin !== origem) return PADRAO;

    const destino = url.pathname + url.search + url.hash;
    if (destino.startsWith("/api/") || destino.startsWith("/login")) return PADRAO;

    return destino;
  } catch {
    return PADRAO;
  }
}
