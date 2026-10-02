// Trava por chave: duas execuções com a MESMA chave rodam uma depois da outra;
// chaves diferentes seguem em paralelo.
//
// Para que serve (ver services/transacao.ts, gravarEmSerie): as gravações que
// criam números novos (OS, histórico do chamado) rodam uma por vez dentro do
// processo. Sem isso, dois consultores gravando no mesmo instante leem o mesmo
// "próximo número" e o driver do Firebird (node-firebird) perde uma das
// gravações em silêncio ou chega a lançar exceção no meio de uma resposta de
// rede. Serializar evita a colisão na origem; o clique duplo no mesmo horário
// também passa a ser visto como conflito (a segunda espera a primeira
// confirmar).
//
// Limite conhecido: vale dentro de UM processo do Node (é como o sistema roda
// hoje, pm2/next start com uma instância). O sistema legado em Delphi grava no
// mesmo banco fora desta trava: para esse caso existe a confirmação depois do
// commit (gravar, opção `confirmar`). O estado fica em globalThis porque o Next
// empacota cada rota separadamente: um Map em variável de módulo seria uma
// cópia por rota.

type MapaDeTravas = Map<string, Promise<unknown>>;

const global = globalThis as unknown as { __gerprojTravas?: MapaDeTravas };

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// `esperaMaximaMs`: quanto tempo vale esperar quem está na frente. Se a gravação
// da frente travar (ex.: banco esperando um bloqueio do Delphi), a fila NÃO
// fica parada para sempre: passado esse tempo a próxima segue.
export async function comTrava<T>(
  chave: string,
  trabalho: () => Promise<T>,
  { esperaMaximaMs = 45_000 }: { esperaMaximaMs?: number } = {},
): Promise<T> {
  const mapa = (global.__gerprojTravas ??= new Map());
  const anterior = mapa.get(chave) ?? Promise.resolve();

  // roda depois da anterior terminar (dando certo ou não) ou do tempo máximo
  const minha = Promise.race([anterior, esperar(esperaMaximaMs)]).then(trabalho, trabalho);
  const marcador = minha.then(
    () => undefined,
    () => undefined,
  );

  mapa.set(chave, marcador);

  try {
    return await minha;
  } finally {
    // ninguém entrou na fila depois de mim: libera a memória
    if (mapa.get(chave) === marcador) mapa.delete(chave);
  }
}
