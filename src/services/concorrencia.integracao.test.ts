// @vitest-environment node
//
// Teste de INTEGRAÇÃO: roda os serviços de gravação de verdade contra o Firebird
// do .env, com gravações simultâneas. Fica DESLIGADO por padrão (não roda em
// "npx vitest run"). Para rodar, SÓ com o .env apontando para o banco LOCAL:
//
//   $env:INTEGRACAO_BANCO = "1"; npx vitest run src/services/concorrencia.integracao.test.ts
//
// Tudo que o teste cria tem a marca abaixo na descrição e é apagado no final.
// (Contexto: ver o ACHADO sobre o driver no cabeçalho de services/transacao.ts.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const LIGADO = process.env.INTEGRACAO_BANCO === "1";
const MARCA = `TESTE-CONCORRENCIA-${Date.now()}`;
const DESCRICAO = `${MARCA} - gravacao simultanea de teste, sera apagada pelo proprio teste.`;

describe.skipIf(!LIGADO)("gravações simultâneas no Firebird (local)", () => {
  let consultar: (sql: string, params?: unknown[]) => Promise<any[]>;
  let executar: (sql: string, params?: unknown[]) => Promise<void>;
  let ApointService: typeof import("./os/apoint").default;
  let recursos: number[] = [];
  let tarefa: any;
  let firebird: any;
  let opcoesBanco: any;
  const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  beforeAll(async () => {
    const host = process.env.FIREBIRD_HOST ?? "";
    // trava de segurança: nunca roda contra um banco que não seja o local
    if (!/^(localhost|127\.0\.0\.1)$/i.test(host)) throw new Error(`FIREBIRD_HOST=${host}: este teste só roda no banco LOCAL`);

    const { emTransacao } = await import("./transacao");
    const { getConnection, Firebird, options } = await import("./firebird");

    firebird = Firebird;
    opcoesBanco = options;
    consultar = (sql, params = []) =>
      new Promise((resolve, reject) =>
        getConnection((e: any, db: any) => (e ? reject(e) : db.query(sql, params, (e2: any, r: any) => (db.detach(), e2 ? reject(e2) : resolve(r ?? [])))))
      );
    executar = (sql, params = []) => emTransacao((tx) => tx.executar(sql, params));
    ApointService = (await import("./os/apoint")).default;

    // consultores reais (com OS recentes), um para cada gravação simultânea
    recursos = (
      await consultar("SELECT FIRST 6 DISTINCT CODREC_OS FROM OS WHERE CODREC_OS > 0 AND DTINI_OS >= '2026-08-01' ORDER BY CODREC_OS")
    ).map((r) => Number(r.CODREC_OS));

    // tarefa real que aceita estourar o limite do mês (para o limite não atrapalhar o teste)
    const [t] = await consultar(
      `SELECT FIRST 1 TAREFA.COD_TAREFA, TAREFA.NOME_TAREFA, TAREFA.FATURA_TAREFA, PROJETO.RESPCLI_PROJETO
         FROM TAREFA JOIN PROJETO ON PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA
        WHERE TAREFA.PERIMP_TAREFA = 'SIM' AND TAREFA.COD_TAREFA > 0`,
    );
    tarefa = t;
  }, 60_000);

  afterAll(async () => {
    if (!executar) return;
    // apaga SÓ o que este teste criou (a marca está no texto da descrição).
    // (LIKE com parâmetro em campo BLOB dá erro -303 no Firebird 2.1: o marcador é literal e só tem letras, dígitos e hífen)
    await executar(`DELETE FROM OS WHERE OBS LIKE '%${MARCA}%'`);
    const [{ N }] = await consultar(`SELECT COUNT(*) AS N FROM OS WHERE OBS LIKE '%${MARCA}%'`);
    expect(Number(N)).toBe(0);
  }, 60_000);

  const apontar = (recurso: number, ini: string, fim: string) =>
    ApointService(
      { COD_TAREFA: tarefa.COD_TAREFA, NOME_TAREFA: String(tarefa.NOME_TAREFA).trim(), RESPCLI_PROJETO: tarefa.RESPCLI_PROJETO, FATURA_TAREFA: tarefa.FATURA_TAREFA },
      DESCRICAO,
      dia,
      ini,
      fim,
      String(recurso),
      [],
    );

  const osDoTeste = () => consultar(`SELECT COD_OS, CODREC_OS FROM OS WHERE OBS LIKE '%${MARCA}%' ORDER BY COD_OS`);

  const exigirDados = () => {
    if (recursos.length < 3 || !tarefa) throw new Error("O banco local não tem consultores/tarefa suficientes para este teste");
  };

  it("vários consultores gravando ao MESMO tempo: todos gravam, nenhuma OS some e nenhum número se repete", async () => {
    exigirDados();

    const resultados = await Promise.allSettled(recursos.map((r) => apontar(r, "00:00", "00:30")));

    // todas as respostas de sucesso precisam corresponder a uma OS de verdade no banco
    const criadas = await osDoTeste();
    const numeros = criadas.map((o) => Number(o.COD_OS));

    expect(new Set(numeros).size).toBe(numeros.length);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(criadas.length);
    // e quem não gravou foi por regra de negócio, nunca por erro de banco
    for (const r of resultados) if (r.status === "rejected") expect((r.reason as Error).name).toBe("ErroDeRegra");
    expect(criadas.length).toBeGreaterThan(0);
    expect(criadas.length).toBe(recursos.length);
  }, 120_000);

  it("clique duplo (mesmo consultor, mesmo horário): só UMA OS é criada", async () => {
    exigirDados();

    const antes = (await osDoTeste()).length;
    const [r] = recursos;
    const resultados = await Promise.allSettled([apontar(r, "05:00", "05:30"), apontar(r, "05:00", "05:30")]);
    const depois = (await osDoTeste()).length;

    const ok = resultados.filter((x) => x.status === "fulfilled").length;

    expect(ok).toBe(1);
    expect(depois - antes).toBe(1);
  }, 120_000);

  it("OUTRO programa (ex.: Delphi) gravando o mesmo número ao mesmo tempo: a OS do sistema web não se perde", async () => {
    exigirDados();

    // "Delphi": abre uma transação própria e insere o PRÓXIMO número de OS, sem confirmar ainda
    const [{ M }] = await consultar("SELECT MAX(COD_OS) AS M FROM OS");
    const numeroDisputado = Number(M) + 1;
    const externo = await new Promise<any>((res, rej) => firebird.attach(opcoesBanco, (e: any, db: any) => (e ? rej(e) : res(db))));
    const txExterna: any = await new Promise((res, rej) => externo.transaction(firebird.ISOLATION_READ_COMMITTED, (e: any, t: any) => (e ? rej(e) : res(t))));
    const outroRecurso = recursos[recursos.length - 1];

    await new Promise<void>((res, rej) =>
      txExterna.query(
        `insert into OS (COD_OS, CODTRF_OS, DTINI_OS, HRINI_OS, HRFIM_OS, OBS_OS, STATUS_OS, PRODUTIVO_OS, CODREC_OS, PRODUTIVO2_OS, RESPCLI_OS, OBS, REMDES_OS, ABONO_OS, DTINC_OS, FATURADO_OS, PERC_OS, VALID_OS, NUM_OS, VRHR_OS, COMP_OS)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numeroDisputado, tarefa.COD_TAREFA, "02.10.2026", "0600", "0630", "T", 1, "SIM", outroRecurso, "SIM", "X", Buffer.from(DESCRICAO), "NAO", "NAO", "02.10.2026 10:00", "SIM", 100, "SIM", "000001", 0, "10/2026"],
        (e: any) => (e ? rej(e) : res()),
      ),
    );

    // o sistema web grava enquanto o "Delphi" ainda não confirmou; só depois o Delphi confirma
    const web = apontar(recursos[0], "07:00", "07:30");
    await new Promise((r) => setTimeout(r, 400));
    await new Promise<void>((res, rej) => txExterna.commit((e: any) => (e ? rej(e) : res())));
    externo.detach();

    await expect(web).resolves.toBe(true);

    const criadas = await osDoTeste();
    const doWeb = criadas.filter((o) => Number(o.CODREC_OS) === recursos[0] && Number(o.COD_OS) !== numeroDisputado);

    expect(criadas.some((o) => Number(o.COD_OS) === numeroDisputado)).toBe(true); // a do outro programa
    expect(doWeb.length).toBeGreaterThanOrEqual(1); // a do sistema web também existe (não foi perdida)
    expect(new Set(criadas.map((o) => Number(o.COD_OS))).size).toBe(criadas.length);
  }, 120_000);

  // CANÁRIO: documenta o comportamento do driver que justifica a confirmação depois do commit.
  // Sem ela, quem perde a disputa pelo número recebe "sucesso" e a OS some. Se este teste
  // FALHAR um dia (o INSERT passar a dar erro, ou a linha passar a existir), o driver foi
  // corrigido: a confirmação em gravar() pode ser revista/simplificada.
  it("CANÁRIO: sem a confirmação, o driver perde em silêncio o INSERT que disputa o número com outra transação", async () => {
    exigirDados();
    const { emTransacao } = await import("./transacao");

    const inserir = (executarSql: (sql: string, p: unknown[]) => Promise<unknown>, cod: number, recurso: number) =>
      executarSql(
        `insert into OS (COD_OS, CODTRF_OS, DTINI_OS, HRINI_OS, HRFIM_OS, OBS_OS, STATUS_OS, PRODUTIVO_OS, CODREC_OS, PRODUTIVO2_OS, RESPCLI_OS, OBS, REMDES_OS, ABONO_OS, DTINC_OS, FATURADO_OS, PERC_OS, VALID_OS, NUM_OS, VRHR_OS, COMP_OS)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cod, tarefa.COD_TAREFA, "02.10.2026", "0800", "0830", "T", 1, "SIM", recurso, "SIM", "X", Buffer.from(DESCRICAO), "NAO", "NAO", "02.10.2026 10:00", "SIM", 100, "SIM", "000001", 0, "10/2026"],
      );

    const [{ M }] = await consultar("SELECT MAX(COD_OS) AS M FROM OS");
    const numero = Number(M) + 1;
    const recursoA = recursos[0];
    const recursoB = recursos[1];

    // as duas transações disputam o MESMO número ao mesmo tempo (sem a trava e sem a confirmação)
    const resultados = await Promise.allSettled([
      emTransacao(async (tx) => {
        await inserir((s, p) => tx.executar(s, p), numero, recursoA);
        await new Promise((r) => setTimeout(r, 150)); // segura a transação aberta enquanto a outra insere
      }),
      emTransacao(async (tx) => {
        await inserir((s, p) => tx.executar(s, p), numero, recursoB);
      }),
    ]);

    const noBanco = (await osDoTeste()).filter((o) => Number(o.COD_OS) === numero);

    // as duas "deram certo"...
    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    // ...mas só uma linha existe: a outra foi perdida em silêncio
    expect(noBanco).toHaveLength(1);
  }, 120_000);
});
