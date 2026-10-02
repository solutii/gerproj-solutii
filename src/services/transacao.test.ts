// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));

vi.mock("./firebird", () => ({ Firebird: { ISOLATION_READ_COMMITTED: [] }, getConnection }));

import {
  CODIGO_CHAVE_DUPLICADA,
  gravarEmSerie,
  comNovasTentativas,
  ehChaveDuplicada,
  emTransacao,
  gravar,
  proximoCodigo,
  proximoNumeroOs,
} from "./transacao";

const chaveDuplicada = () => Object.assign(new Error('Violation of PRIMARY or UNIQUE KEY constraint "PK_OS" on table "OS"'), { gdscode: CODIGO_CHAVE_DUPLICADA });

type Evento = string;

// Banco falso: registra a ordem dos eventos e deixa o commit terminar só depois
// de um instante (como o banco de verdade), para provar que o serviço ESPERA.
function bancoFalso(opcoes: { respostas?: Record<string, any[]>; falharCommit?: boolean; falharEm?: string } = {}) {
  const eventos: Evento[] = [];
  const transacoes: number[] = [];
  let numero = 0;

  getConnection.mockImplementation((cb: (e: unknown, db: unknown) => void) =>
    cb(null, {
      transaction: (_iso: unknown, cbTx: (e: unknown, t: unknown) => void) => {
        const id = ++numero;
        transacoes.push(id);
        eventos.push(`abriu#${id}`);

        cbTx(null, {
          query: (sql: string, params: unknown[], done: (e: unknown, r?: unknown) => void) => {
            eventos.push(`sql#${id}:${sql.trim().slice(0, 28)}`);
            if (opcoes.falharEm && sql.includes(opcoes.falharEm)) return done(chaveDuplicada());

            const chave = Object.keys(opcoes.respostas ?? {}).find((k) => sql.includes(k));
            done(null, chave ? opcoes.respostas![chave] : []);
          },
          commit: (done: (e?: unknown) => void) => {
            setTimeout(() => {
              eventos.push(`commit#${id}`);
              done(opcoes.falharCommit ? new Error("commit falhou") : undefined);
            }, 15);
          },
          rollback: (done: () => void) => {
            eventos.push(`rollback#${id}`);
            done();
          },
        });
      },
      query: (sql: string, params: unknown[], done: (e: unknown, r?: unknown) => void) => {
        eventos.push(`fora:${sql.trim().slice(0, 24)}`);
        const chave = Object.keys(opcoes.respostas ?? {}).find((k) => sql.includes(k));
        done(null, chave ? opcoes.respostas![chave] : []);
      },
      detach: () => eventos.push("detach"),
    }),
  );

  return { eventos, transacoes };
}

beforeEach(() => {
  getConnection.mockReset();
});

describe("ehChaveDuplicada", () => {
  it("reconhece pelo código do Firebird e pela mensagem; outros erros não", () => {
    expect(ehChaveDuplicada(chaveDuplicada())).toBe(true);
    expect(ehChaveDuplicada({ gdscode: 335544665 })).toBe(true);
    expect(ehChaveDuplicada(new Error('violation of PRIMARY or UNIQUE KEY constraint "X"'))).toBe(true);
    expect(ehChaveDuplicada(new Error("deadlock"))).toBe(false);
    expect(ehChaveDuplicada({ gdscode: 335544336 })).toBe(false);
    expect(ehChaveDuplicada(null)).toBe(false);
  });
});

describe("emTransacao", () => {
  it("só devolve DEPOIS do commit terminar; fecha a conexão por último", async () => {
    const banco = bancoFalso();

    const resultado = await emTransacao(async (tx) => {
      await tx.executar("DELETE FROM OS WHERE COD_OS = ?", [1]);

      return "ok";
    });

    expect(resultado).toBe("ok");
    expect(banco.eventos).toEqual(["abriu#1", "sql#1:DELETE FROM OS WHERE COD_OS ", "commit#1", "detach"]);
  });

  it("erro no trabalho (inclusive de regra) faz rollback, devolve a conexão e repassa o MESMO erro", async () => {
    const banco = bancoFalso();
    const erro = new Error("regra violada");

    await expect(
      emTransacao(async () => {
        throw erro;
      }),
    ).rejects.toBe(erro);

    expect(banco.eventos).toEqual(["abriu#1", "rollback#1", "detach"]);
  });

  it("falha no commit também faz rollback e devolve a conexão", async () => {
    const banco = bancoFalso({ falharCommit: true });

    await expect(emTransacao(async () => 1)).rejects.toThrow("commit falhou");

    expect(banco.eventos).toEqual(["abriu#1", "commit#1", "rollback#1", "detach"]);
  });

  it("falha ao abrir a transação ainda devolve a conexão", async () => {
    const eventos: string[] = [];
    getConnection.mockImplementation((cb: (e: unknown, db: unknown) => void) =>
      cb(null, { transaction: (_i: unknown, c: (e: unknown) => void) => c(new Error("sem transação")), detach: () => eventos.push("detach") }),
    );

    await expect(emTransacao(async () => 1)).rejects.toThrow("sem transação");
    expect(eventos).toEqual(["detach"]);
  });

  it("sem conexão disponível o erro sobe sem tentar nada", async () => {
    getConnection.mockImplementation((cb: (e: unknown) => void) => cb(new Error("pool esgotado")));

    await expect(emTransacao(async () => 1)).rejects.toThrow("pool esgotado");
  });

  it("consultar devolve as linhas (ou lista vazia)", async () => {
    bancoFalso({ respostas: { "FROM OS": [{ A: 1 }] } });

    const [com, sem] = await emTransacao(async (tx) => [await tx.consultar("SELECT * FROM OS"), await tx.consultar("SELECT * FROM X")]);

    expect(com).toEqual([{ A: 1 }]);
    expect(sem).toEqual([]);
  });
});

describe("comNovasTentativas / gravar", () => {
  it("empate de número: refaz a gravação inteira numa NOVA transação e acaba conseguindo", async () => {
    const banco = bancoFalso();
    let tentativas = 0;

    const r = await gravar(async (tx) => {
      tentativas++;
      await tx.consultar("SELECT MAX(COD_OS) AS M FROM OS");
      if (tentativas < 3) throw chaveDuplicada(); // as 2 primeiras perdem a disputa

      return tentativas;
    });

    expect(r).toBe(3);
    expect(banco.transacoes).toEqual([1, 2, 3]);
    // cada tentativa fez rollback; a última fez commit; a conexão sempre volta
    expect(banco.eventos.filter((e) => e.startsWith("rollback")).length).toBe(2);
    expect(banco.eventos.filter((e) => e.startsWith("commit")).length).toBe(1);
    expect(banco.eventos.filter((e) => e === "detach").length).toBe(3);
  });

  it("desiste depois de N tentativas e repassa o erro de chave duplicada", async () => {
    const banco = bancoFalso();

    await expect(
      gravar(async () => {
        throw chaveDuplicada();
      }, { tentativas: 3 }),
    ).rejects.toMatchObject({ gdscode: CODIGO_CHAVE_DUPLICADA });

    expect(banco.transacoes).toHaveLength(3);
  });

  it("qualquer outro erro NÃO é repetido (nem erro de regra)", async () => {
    const banco = bancoFalso();
    let chamadas = 0;

    await expect(
      gravar(async () => {
        chamadas++;
        throw new Error("deadlock");
      }),
    ).rejects.toThrow("deadlock");

    expect(chamadas).toBe(1);
    expect(banco.transacoes).toHaveLength(1);
  });

  it("comNovasTentativas funciona sem banco (só a regra de repetição)", async () => {
    const operacao = vi.fn().mockRejectedValueOnce(chaveDuplicada()).mockResolvedValue("ok");

    await expect(comNovasTentativas(operacao)).resolves.toBe("ok");
    expect(operacao).toHaveBeenCalledTimes(2);
  });
});

describe("confirmação depois do commit (driver perde INSERT em silêncio)", () => {
  it("linha confirmada: segue sem repetir; a confirmação lê FORA da transação, depois do commit", async () => {
    const banco = bancoFalso();
    const confirmar = vi.fn().mockResolvedValue(true);

    const r = await gravar(async () => 42, { confirmar });

    expect(r).toBe(42);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toBe(42);
    expect(banco.eventos.indexOf("commit#1")).toBeLessThan(banco.eventos.indexOf("detach"));
  });

  it("linha NÃO encontrada depois do commit: refaz com nova transação e só devolve quando confirmar", async () => {
    const banco = bancoFalso();
    const confirmar = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);

    await gravar(async () => "x", { confirmar });

    expect(confirmar).toHaveBeenCalledTimes(3);
    expect(banco.transacoes).toHaveLength(3);
  });

  it("nunca confirma: desiste com erro (a gravação perdida NUNCA vira sucesso silencioso)", async () => {
    bancoFalso();

    await expect(gravar(async () => 1, { tentativas: 4, confirmar: async () => false })).rejects.toThrow(/não confirmada/i);
  });

  it("consultar da confirmação enxerga o banco (leitura fora da transação)", async () => {
    bancoFalso({ respostas: { "COUNT(*)": [{ N: 1 }] } });

    await expect(
      gravar(async () => 7, { confirmar: async (_r, consultar) => Number((await consultar("SELECT COUNT(*) AS N FROM OS"))[0].N) === 1 }),
    ).resolves.toBe(7);
  });
});

describe("gravarEmSerie", () => {
  it("duas gravações simultâneas rodam uma depois da outra (a segunda só abre transação depois do commit da primeira)", async () => {
    const banco = bancoFalso();

    await Promise.all([gravarEmSerie(async () => "a"), gravarEmSerie(async () => "b")]);

    expect(banco.eventos.filter((e) => /^(abriu|commit)/.test(e))).toEqual(["abriu#1", "commit#1", "abriu#2", "commit#2"]);
  });

  it("erro na primeira não trava a segunda", async () => {
    bancoFalso();

    const r = await Promise.allSettled([
      gravarEmSerie(async () => {
        throw new Error("falhou");
      }),
      gravarEmSerie(async () => "ok"),
    ]);

    expect(r[0].status).toBe("rejected");
    expect(r[1]).toEqual({ status: "fulfilled", value: "ok" });
  });
});

describe("números novos", () => {
  it("proximoCodigo = MAX + 1 lido na transação; tabela vazia começa em 1", async () => {
    bancoFalso({ respostas: { "FROM OS": [{ M: 60197 }], "FROM HISTCHAMADO": [{ M: null }] } });

    const [os, hist] = await emTransacao(async (tx) => [await proximoCodigo(tx, "OS", "COD_OS"), await proximoCodigo(tx, "HISTCHAMADO", "COD_HISTCHAMADO")]);

    expect(os).toBe(60198);
    expect(hist).toBe(1);
  });

  it("proximoNumeroOs devolve 6 dígitos com zeros à esquerda", async () => {
    bancoFalso({ respostas: { "MAX(NUM_OS)": [{ N: "000123" }] } });

    await expect(emTransacao((tx) => proximoNumeroOs(tx))).resolves.toBe("000124");
  });
});
