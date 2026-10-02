import { describe, expect, it } from "vitest";
import {
  contarPor,
  doisPrimeirosNomes,
  horaDeBrasilia,
  primeiroNomeDoCliente,
  textoDeFalta,
  textoDeIdade,
  diasUteisDeAtraso,
  indiceDaSemana,
  lancamentoAtrasado,
  ordemDeUrgencia,
  percentual,
  permissaoParaRever,
  semanasTerminandoEm,
  situacaoDaTarefaNoDashboard,
} from "./admin-dashboard";

describe("percentual", () => {
  it("arredonda e devolve null sem base", () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(5, 0)).toBeNull();
    expect(percentual(5, -1)).toBeNull();
  });
});

describe("semanasTerminandoEm", () => {
  it("devolve semanas de segunda a domingo, da mais antiga para a mais nova, terminando na semana da data", () => {
    // 2026-10-02 é uma sexta-feira
    const semanas = semanasTerminandoEm("2026-10-02", 3);

    expect(semanas.map((s) => [s.inicio, s.fim])).toEqual([
      ["2026-09-14", "2026-09-20"],
      ["2026-09-21", "2026-09-27"],
      ["2026-09-28", "2026-10-04"],
    ]);
    expect(semanas[2].rotulo).toBe("28/09");
  });

  it("domingo ainda pertence à semana que começou na segunda anterior; segunda abre a semana", () => {
    expect(semanasTerminandoEm("2026-10-04", 1)[0].inicio).toBe("2026-09-28");
    expect(semanasTerminandoEm("2026-09-28", 1)[0].inicio).toBe("2026-09-28");
  });

  it("padrão: 8 semanas, atravessando a virada do ano", () => {
    const semanas = semanasTerminandoEm("2027-01-05");

    expect(semanas).toHaveLength(8);
    expect(semanas[0].inicio).toBe("2026-11-16");
    expect(semanas[7].inicio).toBe("2027-01-04");
  });

  it("indiceDaSemana acha a semana da data e -1 fora da janela", () => {
    const semanas = semanasTerminandoEm("2026-10-02", 3);

    expect(indiceDaSemana(semanas, "2026-09-14")).toBe(0);
    expect(indiceDaSemana(semanas, "2026-09-27")).toBe(1);
    expect(indiceDaSemana(semanas, "2026-10-04")).toBe(2);
    expect(indiceDaSemana(semanas, "2026-09-13")).toBe(-1);
    expect(indiceDaSemana(semanas, "2026-10-05")).toBe(-1);
  });
});

describe("lançamento atrasado", () => {
  it("conta só dias úteis depois do dia trabalhado", () => {
    // 2026-09-25 é sexta
    expect(diasUteisDeAtraso("2026-09-25", "2026-09-25")).toBe(0);
    expect(diasUteisDeAtraso("2026-09-25", "2026-09-26")).toBe(0); // sábado
    expect(diasUteisDeAtraso("2026-09-25", "2026-09-28")).toBe(1); // segunda
    expect(diasUteisDeAtraso("2026-09-25", "2026-09-29")).toBe(2); // terça
  });

  it("lançar antes do dia trabalhado (data inconsistente) não é atraso", () => {
    expect(diasUteisDeAtraso("2026-09-25", "2026-09-20")).toBe(0);
  });

  it("sexta lançada na segunda NÃO é atraso; segunda lançada na quarta é", () => {
    expect(lancamentoAtrasado("2026-09-25", "2026-09-28")).toBe(false);
    expect(lancamentoAtrasado("2026-09-28", "2026-09-29")).toBe(false);
    expect(lancamentoAtrasado("2026-09-28", "2026-09-30")).toBe(true);
    expect(lancamentoAtrasado("2026-09-24", "2026-09-28")).toBe(true); // quinta lançada na segunda
  });

  it("feriado nacional não conta como dia útil de atraso", () => {
    // 07/09/2026 (segunda) é feriado: quinta 03/09 lançada na terça 08/09 = sexta 04 + terça 08 = 2 úteis
    expect(diasUteisDeAtraso("2026-09-03", "2026-09-08")).toBe(2);
    // sexta 04/09 lançada na terça 08/09: só a terça conta (segunda é feriado)
    expect(diasUteisDeAtraso("2026-09-04", "2026-09-08")).toBe(1);
  });

  it("datas absurdas não travam (limite de segurança)", () => {
    const inicio = Date.now();

    expect(diasUteisDeAtraso("2000-01-01", "2026-09-30")).toBeGreaterThan(100);
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});

describe("permissaoParaRever", () => {
  const hoje = "2026-10-02"; // início do mês passado = 2026-09-01

  it("sem a permissão de apontar no passado: nada a rever", () => {
    expect(permissaoParaRever(false, "2020-01-01", hoje)).toBeUndefined();
    expect(permissaoParaRever(false, null, hoje)).toBeUndefined();
  });

  it("data-limite renovada no dia 1º do mês passado ou depois é normal (não alarma)", () => {
    expect(permissaoParaRever(true, "2026-09-01", hoje)).toBeUndefined();
    expect(permissaoParaRever(true, "2026-09-15", hoje)).toBeUndefined();
    expect(permissaoParaRever(true, "2026-10-01", hoje)).toBeUndefined();
  });

  it("data-limite anterior ao início do mês passado é esquecida: devolve os dias", () => {
    expect(permissaoParaRever(true, "2026-08-31", hoje)).toEqual({ diasDesdeLimite: 32 });
    expect(permissaoParaRever(true, "2026-08-01", hoje)).toEqual({ diasDesdeLimite: 62 });
  });

  it("liberada e sem data-limite: precisa rever (sem dias)", () => {
    expect(permissaoParaRever(true, null, hoje)).toEqual({ diasDesdeLimite: null });
  });

  it("em janeiro, o mês passado é dezembro do ano anterior", () => {
    expect(permissaoParaRever(true, "2025-12-01", "2026-01-10")).toBeUndefined();
    expect(permissaoParaRever(true, "2025-11-30", "2026-01-10")).toEqual({ diasDesdeLimite: 41 });
  });
});

describe("situacaoDaTarefaNoDashboard", () => {
  const h = (n: number) => n * 60;

  it("sem estouro liberado e com limite: estourada a partir de 100%, no limite a partir de 80%", () => {
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(10), permiteExceder: false })).toEqual({ situacao: "estourada", percentual: 100, passouDoLimite: true });
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(12), permiteExceder: false })).toMatchObject({ situacao: "estourada", percentual: 120 });
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(8), permiteExceder: false })).toEqual({ situacao: "no-limite", percentual: 80, passouDoLimite: false });
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(7.9), permiteExceder: false })).toBeNull();
  });

  it("sem limite mensal (null ou 0) e sem liberação: nada a mostrar", () => {
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: null, consumoMesMin: h(50), permiteExceder: false })).toBeNull();
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 0, consumoMesMin: h(50), permiteExceder: false })).toBeNull();
  });

  it("com estouro liberado: sempre 'liberada', e diz se já passou do limite", () => {
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(3), permiteExceder: true })).toEqual({ situacao: "liberada", percentual: 30, passouDoLimite: false });
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: 10, consumoMesMin: h(11), permiteExceder: true })).toEqual({ situacao: "liberada", percentual: 110, passouDoLimite: true });
    expect(situacaoDaTarefaNoDashboard({ limiteMensalHoras: null, consumoMesMin: h(11), permiteExceder: true })).toEqual({ situacao: "liberada", percentual: null, passouDoLimite: false });
  });

  it("ordemDeUrgencia: quem passou do limite primeiro, depois o maior percentual; sem percentual por último", () => {
    const lista = [
      { nome: "a", percentual: 85, passouDoLimite: false },
      { nome: "b", percentual: null, passouDoLimite: false },
      { nome: "c", percentual: 130, passouDoLimite: true },
      { nome: "d", percentual: 95, passouDoLimite: false },
      { nome: "e", percentual: 100, passouDoLimite: true },
    ];

    expect([...lista].sort(ordemDeUrgencia).map((x) => x.nome)).toEqual(["c", "e", "d", "a", "b"]);
  });
});

describe("contarPor", () => {
  const itens = ["A", "B", "A", "C", "A", "B", "D", "E"];

  it("conta, ordena do maior para o menor e desempata pelo nome", () => {
    expect(contarPor(itens, (i) => i, (i) => `Item ${i}`, 10).map((x) => [x.rotulo, x.quantidade])).toEqual([
      ["Item A", 3],
      ["Item B", 2],
      ["Item C", 1],
      ["Item D", 1],
      ["Item E", 1],
    ]);
  });

  it("mantém os maiores e junta o resto em 'Outros' (a soma continua igual ao total)", () => {
    const r = contarPor(itens, (i) => i, (i) => i, 2);

    expect(r.map((x) => [x.rotulo, x.quantidade])).toEqual([["A", 3], ["B", 2], ["Outros", 3]]);
    expect(r.reduce((s, x) => s + x.quantidade, 0)).toBe(itens.length);
  });

  it("lista vazia: vazio; sem excedente: não cria 'Outros'", () => {
    expect(contarPor([], (i: string) => i, (i) => i, 3)).toEqual([]);
    expect(contarPor(["A", "B"], (i) => i, (i) => i, 2).some((x) => x.rotulo === "Outros")).toBe(false);
  });
});

describe("textoDeIdade e horaDeBrasilia", () => {
  const gerado = "2026-10-02T15:00:00.000Z";
  const agora = (minutos: number) => new Date(gerado).getTime() + minutos * 60_000;

  it("agora mesmo, minutos, horas e mais de um dia", () => {
    expect(textoDeIdade(gerado, agora(0))).toBe("agora mesmo");
    expect(textoDeIdade(gerado, agora(0.9))).toBe("agora mesmo");
    expect(textoDeIdade(gerado, agora(1))).toBe("há 1 min");
    expect(textoDeIdade(gerado, agora(59.9))).toBe("há 59 min");
    expect(textoDeIdade(gerado, agora(60))).toBe("há 1 h");
    expect(textoDeIdade(gerado, agora(5 * 60 + 40))).toBe("há 5 h");
    expect(textoDeIdade(gerado, agora(24 * 60))).toBe("há mais de 1 dia");
  });

  it("relógio adiantado (momento no futuro) não vira número negativo; data ilegível devolve vazio", () => {
    expect(textoDeIdade(gerado, agora(-5))).toBe("agora mesmo");
    expect(textoDeIdade("lixo", agora(5))).toBe("");
  });

  it("hora no fuso de Brasília", () => {
    expect(horaDeBrasilia("2026-10-02T15:00:00.000Z")).toBe("12:00");
    expect(horaDeBrasilia("2026-10-02T02:05:00.000Z")).toBe("23:05");
    expect(horaDeBrasilia("lixo")).toBe("");
  });
});

describe("textoDeFalta", () => {
  it("instantes, menos de 1 min e minutos arredondados para cima", () => {
    expect(textoDeFalta(0)).toBe("em instantes");
    expect(textoDeFalta(-1000)).toBe("em instantes");
    expect(textoDeFalta(1)).toBe("em menos de 1 min");
    expect(textoDeFalta(59_999)).toBe("em menos de 1 min");
    expect(textoDeFalta(60_000)).toBe("em 1 min");
    expect(textoDeFalta(61_000)).toBe("em 2 min");
    expect(textoDeFalta(300_000)).toBe("em 5 min");
  });
});

describe("doisPrimeirosNomes", () => {
  it("pessoa com 3 ou mais nomes: só os dois primeiros", () => {
    expect(doisPrimeirosNomes("DAVI TAVARES DIAMANTINO MONTALVÃO")).toBe("DAVI TAVARES");
    expect(doisPrimeirosNomes("ANDRE LUIZ MENDONCA")).toBe("ANDRE LUIZ");
    expect(doisPrimeirosNomes("ROGERIO JUNIO LOPES FERREIRA")).toBe("ROGERIO JUNIO");
  });

  it("ligações (de, da, do, dos, das, e) não contam como nome", () => {
    expect(doisPrimeirosNomes("MARIA DE FÁTIMA FALCÃO LIMA")).toBe("MARIA DE FÁTIMA");
    expect(doisPrimeirosNomes("JOAO PAULO DE FRANÇA SILVA")).toBe("JOAO PAULO");
    expect(doisPrimeirosNomes("JOSE DOS SANTOS SILVA")).toBe("JOSE DOS SANTOS");
    expect(doisPrimeirosNomes("ANA DA SILVA E SOUZA")).toBe("ANA DA SILVA");
    expect(doisPrimeirosNomes("Maria das Dores Costa")).toBe("Maria das Dores");
  });

  it("nome curto fica como está (um ou dois nomes), inclusive 'Sem consultor'", () => {
    expect(doisPrimeirosNomes("ANA SOUZA")).toBe("ANA SOUZA");
    expect(doisPrimeirosNomes("MADONNA")).toBe("MADONNA");
    expect(doisPrimeirosNomes("Sem consultor")).toBe("Sem consultor");
    expect(doisPrimeirosNomes("ANA DE SOUZA")).toBe("ANA DE SOUZA");
  });

  it("espaços sobrando e texto vazio não quebram; ligação no fim não sobra", () => {
    expect(doisPrimeirosNomes("  ANA    SOUZA   LIMA  ")).toBe("ANA SOUZA");
    expect(doisPrimeirosNomes("")).toBe("");
    expect(doisPrimeirosNomes("   ")).toBe("");
    expect(doisPrimeirosNomes("ANA DE")).toBe("ANA");
  });
});

describe("primeiroNomeDoCliente", () => {
  it("só a primeira palavra do nome do cliente", () => {
    expect(primeiroNomeDoCliente("SOMAPEL LTDA")).toBe("SOMAPEL");
    expect(primeiroNomeDoCliente("GV PNEUS E SERVICOS SA")).toBe("GV");
    expect(primeiroNomeDoCliente("TECNOSULFUR LTDA")).toBe("TECNOSULFUR");
    expect(primeiroNomeDoCliente("DOX BRASIL")).toBe("DOX");
    expect(primeiroNomeDoCliente("HF METALURGICA")).toBe("HF");
  });

  it("nome de uma palavra só fica igual; espaços sobrando e vazio não quebram", () => {
    expect(primeiroNomeDoCliente("ARAGUAIA")).toBe("ARAGUAIA");
    expect(primeiroNomeDoCliente("  EMTEL   SERVICOS ")).toBe("EMTEL");
    expect(primeiroNomeDoCliente("")).toBe("");
    expect(primeiroNomeDoCliente("   ")).toBe("");
  });

  it("'Sem cliente' (texto padrão de chamado sem cliente) não é cortado", () => {
    expect(primeiroNomeDoCliente("Sem cliente")).toBe("Sem cliente");
    expect(primeiroNomeDoCliente("  Sem cliente ")).toBe("Sem cliente");
  });
});
