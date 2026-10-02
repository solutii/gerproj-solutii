import { Firebird, getConnection } from "./firebird";
import { comTrava } from "./trava";

// Gravações no Firebird, do jeito seguro, num lugar só.
//
// O que isto corrige em relação ao padrão antigo (cada serviço montava a sua
// transação "na mão"):
//   1. O número novo (COD_OS, COD_HISTCHAMADO, NUM_OS = MAX + 1) era lido FORA
//      da transação, bem antes do INSERT. Dois consultores gravando ao mesmo
//      tempo recebiam o MESMO número: o segundo esperava o primeiro e, no commit
//      dele, falhava com "violação de chave" (erro 500 na tela). Agora o número é
//      lido DENTRO da transação, logo antes de gravar, e se mesmo assim houver
//      empate a gravação inteira é refeita com número novo (comNovasTentativas).
//   2. Em algumas rotas a resposta de sucesso saía ANTES do commit terminar
//      (e a conexão era fechada em seguida). Agora o commit é aguardado.
//   3. Toda saída (sucesso, erro de regra, erro de banco) faz rollback e
//      devolve a conexão ao pool -- uma só vez, num só lugar.
//   4. ACHADO (medido no Firebird 2.1 com o node-firebird 1.1.10, sem nenhum
//      código nosso no meio): quando duas transações inserem o MESMO número ao
//      mesmo tempo, o driver devolve "sucesso" nas duas, no INSERT e no commit,
//      mas só uma linha fica no banco -- a outra é perdida em silêncio (e, se
//      houver outro comando logo depois, o driver chega a lançar uma exceção
//      dentro do tratamento da resposta de rede). Isso já acontecia antes e o
//      usuário via "gravado com sucesso". Por isso há duas defesas:
//        a) gravarEmSerie: as gravações que criam número novo rodam UMA POR VEZ
//           dentro do processo (services/trava.ts), então não há disputa;
//        b) a opção `confirmar` de gravar(): depois do commit, confere no banco
//           se a linha realmente existe; se não existir, refaz com número novo
//           (pega também a disputa com o sistema legado em Delphi, que grava
//           fora desta trava).

// isc_unique_key_violation: PRIMARY KEY / UNIQUE violada (ex.: PK_OS, PK_HISTCHAMADO).
export const CODIGO_CHAVE_DUPLICADA = 335544665;

export function ehChaveDuplicada(erro: unknown): boolean {
  const e = erro as { gdscode?: number; message?: string } | null | undefined;

  return e?.gdscode === CODIGO_CHAVE_DUPLICADA || /violation of primary or unique key/i.test(e?.message ?? "");
}

export type Tx = {
  // SELECT dentro da transação (enxerga o que a própria transação já gravou)
  consultar: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>;
  // INSERT / UPDATE / DELETE
  executar: (sql: string, params?: unknown[]) => Promise<void>;
};

function abrirConexao(): Promise<any> {
  return new Promise((resolve, reject) => {
    getConnection((err: any, db: any) => (err ? reject(err) : resolve(db)));
  });
}

// Executa `trabalho` numa transação e SÓ devolve depois do commit terminar.
// Qualquer erro (inclusive ErroDeRegra lançado pelo trabalho) faz rollback e é
// repassado igual; a conexão sempre volta ao pool.
export async function emTransacao<T>(trabalho: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await abrirConexao();

  try {
    const transaction: any = await new Promise((resolve, reject) => {
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, t: any) => (err ? reject(err) : resolve(t)));
    });

    const tx: Tx = {
      consultar: (sql, params = []) =>
        new Promise((resolve, reject) => {
          transaction.query(sql, params, (err: any, res: any) => (err ? reject(err) : resolve(res ?? [])));
        }),
      executar: (sql, params = []) =>
        new Promise((resolve, reject) => {
          transaction.query(sql, params, (err: any) => (err ? reject(err) : resolve()));
        }),
    };

    try {
      const resultado = await trabalho(tx);

      await new Promise<void>((resolve, reject) => {
        transaction.commit((err: any) => (err ? reject(err) : resolve()));
      });

      return resultado;
    } catch (erro) {
      // o rollback pode falhar (conexão já caída): o erro que importa é o original
      await new Promise<void>((resolve) => {
        try {
          transaction.rollback(() => resolve());
        } catch {
          resolve();
        }
      });

      throw erro;
    }
  } finally {
    db.detach();
  }
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Refaz a operação INTEIRA (nova transação, números recalculados) quando dois
// gravadores disputam o mesmo número. Qualquer outro erro sobe na hora. A
// pequena espera aleatória evita que os dois tentem de novo no mesmo instante.
// 10 tentativas cobrem até 10 gravadores disputando ao mesmo tempo (a cada rodada
// pelo menos um deles consegue); na prática raramente passa da segunda.
export async function comNovasTentativas<T>(operacao: () => Promise<T>, tentativas = 10): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      if (!ehChaveDuplicada(erro) || tentativa >= tentativas) throw erro;

      await esperar(Math.random() * 40 * tentativa);
    }
  }
}

export type Consultar = <T = any>(sql: string, params?: unknown[]) => Promise<T[]>;

// Leitura FORA de qualquer transação de gravação (conexão própria do pool).
export const consultarFora: Consultar = async (sql, params = []) => {
  const db = await abrirConexao();

  try {
    return await new Promise((resolve, reject) => {
      db.query(sql, params, (err: any, res: any) => (err ? reject(err) : resolve(res ?? [])));
    });
  } finally {
    db.detach();
  }
};

export type OpcoesDeGravacao<T> = {
  tentativas?: number;
  // Depois do commit: a gravação realmente existe? (ex.: a linha com o COD_OS
  // que acabamos de inserir). Se não existir, a operação inteira é refeita.
  confirmar?: (resultado: T, consultar: Consultar) => Promise<boolean>;
};

// Erro para "gravação não confirmada": mesma classe do erro de chave duplicada,
// que é o que ele realmente é -- assim comNovasTentativas já sabe refazer.
function erroGravacaoNaoConfirmada(): Error {
  return Object.assign(new Error("Gravação não confirmada no banco (número em disputa com outra gravação)."), {
    gdscode: CODIGO_CHAVE_DUPLICADA,
  });
}

// Transação + confirmação + repetição em caso de número repetido. `trabalho`
// pode rodar mais de uma vez, então só deve mexer no banco (e-mail, log e afins
// ficam para DEPOIS que gravar() retornar).
export function gravar<T>(trabalho: (tx: Tx) => Promise<T>, { tentativas, confirmar }: OpcoesDeGravacao<T> = {}): Promise<T> {
  return comNovasTentativas(async () => {
    const resultado = await emTransacao(trabalho);

    if (confirmar && !(await confirmar(resultado, consultarFora))) throw erroGravacaoNaoConfirmada();

    return resultado;
  }, tentativas);
}

// Chave da fila única de gravações do sistema web.
export const TRAVA_GRAVACAO = "gravacao-web";

// gravar() uma de cada vez (ver o ACHADO no cabeçalho). Use em TODA gravação
// que cria número novo (OS, histórico) e, por simplicidade, nas que editam ou
// apagam OS: gravações levam milissegundos e o volume de uso é pequeno.
export function gravarEmSerie<T>(trabalho: (tx: Tx) => Promise<T>, opcoes?: OpcoesDeGravacao<T>): Promise<T> {
  return comTrava(TRAVA_GRAVACAO, () => gravar(trabalho, opcoes));
}

// Próximo número de uma coluna numérica (MAX + 1), lido dentro da transação.
export async function proximoCodigo(tx: Tx, tabela: string, coluna: string): Promise<number> {
  // tabela/coluna vêm de constantes do código (nunca de entrada do usuário)
  const [linha] = await tx.consultar<{ M: number | null }>(`SELECT MAX(${coluna}) AS M FROM ${tabela}`);

  return Number(linha?.M ?? 0) + 1;
}

// Próximo NUM_OS (texto de 6 dígitos) quando a OS não herda o número de OS anteriores.
export async function proximoNumeroOs(tx: Tx): Promise<string> {
  const [linha] = await tx.consultar<{ N: string | null }>("SELECT MAX(NUM_OS) AS N FROM OS");

  return `000${String(parseInt(String(linha?.N ?? "0")) + 1)}`.slice(-6);
}
