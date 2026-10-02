import { describe, expect, it } from "vitest";
import {
  limitesDoMes,
  mesAnterior,
  mesAtual,
  mesProximo,
  mesValido,
  nomeDoMes,
  rotuloCurtoDoMes,
  ultimosMeses,
} from "./periodo";
import {
  avaliarSla,
  horasUteisEntre,
  momentoDoHistorico,
  parseDataHora,
  resumirSla,
} from "./sla";
import { minutosPorDia, somarPorChave, topComOutros } from "./agregacoes";
import { calcularResumoMes } from "./resumo";
import { chamadoParado, diasSemAtividade, situacaoDaTarefa } from "./pendencias";

describe("período (mês)", () => {
  it("mês atual no fuso de Brasília (não em UTC)", () => {
    expect(mesAtual(new Date("2026-10-02T15:00:00Z"))).toBe("2026-10");
    // 02:00 UTC de 1º/10 ainda é 23:00 de 30/09 em Brasília
    expect(mesAtual(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
  });

  it("valida o parâmetro mes", () => {
    expect(mesValido("2026-10", "2026-10")).toBe(true);
    expect(mesValido("2026-09", "2026-10")).toBe(true);
    expect(mesValido("2026-11", "2026-10")).toBe(false); // futuro
    expect(mesValido("2026-13", "2026-10")).toBe(false);
    expect(mesValido("2026-1", "2026-10")).toBe(false);
    expect(mesValido("1999-12", "2026-10")).toBe(false);
    expect(mesValido(undefined, "2026-10")).toBe(false);
    expect(mesValido("2026-10'; DROP", "2026-10")).toBe(false);
  });

  it("mês anterior e próximo atravessam o ano", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-10")).toBe("2026-09");
    expect(mesProximo("2026-12")).toBe("2027-01");
    expect(mesProximo("2026-09")).toBe("2026-10");
  });

  it("limites do mês e últimos meses", () => {
    expect(limitesDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(limitesDoMes("2028-02").fim).toBe("2028-02-29");
    expect(ultimosMeses("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("nomes dos meses", () => {
    expect(nomeDoMes("2026-09")).toBe("setembro de 2026");
    expect(rotuloCurtoDoMes("2026-09")).toBe("set/26");
  });
});

describe("datas do banco", () => {
  it("lê DTENVIO_CHAMADO (DD/MM/AAAA HH:MM)", () => {
    expect(parseDataHora("23/09/2026 12:00")).toEqual({ data: "2026-09-23", minutos: 720 });
    expect(parseDataHora("23/09/2026")).toEqual({ data: "2026-09-23", minutos: 0 });
    expect(parseDataHora("lixo")).toBeNull();
    expect(parseDataHora(null)).toBeNull();
  });

  it("evento do histórico (data + HHMM)", () => {
    expect(momentoDoHistorico(new Date(2026, 8, 28), "1316")).toEqual({ data: "2026-09-28", minutos: 796 });
    expect(momentoDoHistorico("2026-09-28T03:00:00.000Z", "0836")).toEqual({ data: "2026-09-28", minutos: 516 });
  });
});

describe("horas úteis e SLA", () => {
  const seg = "2026-09-21"; // segunda
  const sex = "2026-09-25"; // sexta

  it("um dia útil dentro do expediente", () => {
    expect(horasUteisEntre({ data: seg, minutos: 9 * 60 }, { data: seg, minutos: 17 * 60 })).toBe(8);
  });

  it("corta o que está fora do expediente (8h-18h)", () => {
    expect(horasUteisEntre({ data: seg, minutos: 6 * 60 }, { data: seg, minutos: 9 * 60 })).toBe(1);
    expect(horasUteisEntre({ data: sex, minutos: 19 * 60 }, { data: "2026-09-28", minutos: 8 * 60 + 30 })).toBe(0.5);
  });

  it("atravessa o fim de semana", () => {
    expect(horasUteisEntre({ data: sex, minutos: 16 * 60 }, { data: "2026-09-28", minutos: 10 * 60 })).toBe(4);
  });

  it("ignora feriado nacional (7/9/2026 é segunda)", () => {
    expect(horasUteisEntre({ data: "2026-09-04", minutos: 17 * 60 }, { data: "2026-09-08", minutos: 9 * 60 })).toBe(2);
  });

  it("só fim de semana ou fim antes do início = 0", () => {
    expect(horasUteisEntre({ data: "2026-09-26", minutos: 600 }, { data: "2026-09-27", minutos: 900 })).toBe(0);
    expect(horasUteisEntre({ data: seg, minutos: 900 }, { data: seg, minutos: 600 })).toBe(0);
    expect(horasUteisEntre({ data: seg, minutos: 600 }, { data: seg, minutos: 600 })).toBe(0);
  });

  it("avalia o SLA do chamado", () => {
    const base = { codChamado: 1, abertura: { data: seg, minutos: 9 * 60 }, finalizacao: { data: seg, minutos: 17 * 60 } };

    expect(avaliarSla({ ...base, slaHoras: 24 })).toEqual({ codChamado: 1, horasUteis: 8, slaHoras: 24, cumpriu: true });
    expect(avaliarSla({ ...base, slaHoras: 8 })?.cumpriu).toBe(true); // exatamente no limite
    expect(avaliarSla({ ...base, slaHoras: 4 })?.cumpriu).toBe(false);
  });

  it("sem SLA definido (nulo ou 0) o chamado fica fora da conta", () => {
    const base = { codChamado: 1, abertura: { data: seg, minutos: 540 }, finalizacao: { data: seg, minutos: 600 } };

    expect(avaliarSla({ ...base, slaHoras: null })).toBeNull();
    expect(avaliarSla({ ...base, slaHoras: 0 })).toBeNull();
  });

  it("resume vários chamados", () => {
    const r = resumirSla([
      { codChamado: 1, horasUteis: 2, slaHoras: 8, cumpriu: true },
      { codChamado: 2, horasUteis: 4, slaHoras: 8, cumpriu: true },
      { codChamado: 3, horasUteis: 12, slaHoras: 8, cumpriu: false },
    ]);

    expect(r).toEqual({ total: 3, noPrazo: 2, foraDoPrazo: 1, percentualNoPrazo: 67, tempoMedioHoras: 6 });
    expect(resumirSla([])).toEqual({ total: 0, noPrazo: 0, foraDoPrazo: 0, percentualNoPrazo: null, tempoMedioHoras: null });
  });
});

describe("agregações", () => {
  it("minutos por dia traz todos os dias do mês, zerados quando não há OS", () => {
    const r = minutosPorDia("2026-02", [
      { data: "2026-02-03", minutos: 60 },
      { data: "2026-02-03", minutos: 30 },
    ]);

    expect(r).toHaveLength(28);
    expect(r.find((d) => d.data === "2026-02-03")?.minutos).toBe(90);
    expect(r.find((d) => d.data === "2026-02-04")?.minutos).toBe(0);
  });

  it("soma por chave em ordem decrescente e agrupa o resto em Outros", () => {
    const itens = [
      { c: "A", n: "Cliente A", m: 100 },
      { c: "B", n: "Cliente B", m: 200 },
      { c: "A", n: "Cliente A", m: 200 },
      { c: "C", n: "Cliente C", m: 100 },
      { c: "D", n: "Cliente D", m: 50 },
    ];
    const somado = somarPorChave(itens, (i) => i.c, (i) => i.n, (i) => i.m);

    expect(somado.map((i) => [i.chave, i.minutos])).toEqual([["A", 300], ["B", 200], ["C", 100], ["D", 50]]);
    expect(topComOutros(somado, 2).map((i) => [i.rotulo, i.minutos])).toEqual([
      ["Cliente A", 300],
      ["Cliente B", 200],
      ["Outros", 150],
    ]);
    expect(topComOutros(somado, 4)).toHaveLength(4); // nada sobra: sem "Outros"
  });
});

describe("resumo do mês", () => {
  const jornada = 528; // 8h48

  it("meta = jornada × dias úteis e dias sem apontamento (hoje não conta)", () => {
    const porDia = minutosPorDia("2026-09", [
      { data: "2026-09-01", minutos: 528 },
      { data: "2026-09-02", minutos: 528 },
    ]);
    const r = calcularResumoMes({ mes: "2026-09", hoje: "2026-09-30", jornadaDiariaMin: jornada, porDia });

    expect(r.diasUteis).toBe(21);
    expect(r.metaMesMin).toBe(528 * 21);
    expect(r.horasApontadasMin).toBe(1056);
    expect(r.percentualMeta).toBe(10);
    expect(r.diasSemApontamento).toHaveLength(18); // 20 dias úteis passados (30/9 é hoje) - 2 com OS
    expect(r.diasSemApontamento).not.toContain("2026-09-30");
    expect(r.saldoAteHojeMin).toBe(1056 - 528 * 21);
  });

  it("no meio do mês a meta até hoje usa só os dias úteis já corridos", () => {
    const porDia = minutosPorDia("2026-09", [{ data: "2026-09-01", minutos: 528 }]);
    const r = calcularResumoMes({ mes: "2026-09", hoje: "2026-09-02", jornadaDiariaMin: jornada, porDia });

    expect(r.diasUteisAteHoje).toBe(2);
    expect(r.metaAteHojeMin).toBe(1056);
    expect(r.diasSemApontamento).toEqual([]); // 1/9 tem OS e 2/9 é hoje
    expect(r.percentualMetaAteHoje).toBe(50);
  });

  it("mês passado: todos os dias úteis já passaram", () => {
    const r = calcularResumoMes({ mes: "2026-08", hoje: "2026-10-02", jornadaDiariaMin: jornada, porDia: minutosPorDia("2026-08", []) });

    expect(r.diasSemApontamento).toHaveLength(r.diasUteis);
    expect(r.percentualMeta).toBe(0);
  });

  it("jornada 0 não gera percentual", () => {
    const r = calcularResumoMes({ mes: "2026-09", hoje: "2026-09-30", jornadaDiariaMin: 0, porDia: minutosPorDia("2026-09", []) });

    expect(r.metaMesMin).toBe(0);
    expect(r.percentualMeta).toBeNull();
  });
});

describe("pendências", () => {
  it("chamado parado só passa de 7 dias corridos", () => {
    expect(diasSemAtividade("2026-09-20", "2026-09-30")).toBe(10);
    expect(diasSemAtividade("2026-10-05", "2026-09-30")).toBe(0);
    expect(chamadoParado("2026-09-20", "2026-09-30")).toBe(true);
    expect(chamadoParado("2026-09-23", "2026-09-30")).toBe(false); // exatamente 7
  });

  it("tarefa bloqueada: sem horas e sem permissão de exceder", () => {
    expect(situacaoDaTarefa({ limiteMensalHoras: 0, horasContratadas: 0, consumoMesMin: 0, permiteExceder: false })).toEqual({ tipo: "bloqueada" });
    expect(situacaoDaTarefa({ limiteMensalHoras: 0, horasContratadas: 0, consumoMesMin: 0, permiteExceder: true })).toBeNull();
    expect(situacaoDaTarefa({ limiteMensalHoras: 0, horasContratadas: null, consumoMesMin: 0, permiteExceder: false })).toBeNull();
  });

  it("tarefa no limite a partir de 80% do limite mensal", () => {
    const base = { limiteMensalHoras: 10, horasContratadas: 100, permiteExceder: false };

    expect(situacaoDaTarefa({ ...base, consumoMesMin: 480 })).toEqual({ tipo: "no-limite", percentual: 80 });
    expect(situacaoDaTarefa({ ...base, consumoMesMin: 700 })).toEqual({ tipo: "no-limite", percentual: 117 });
    expect(situacaoDaTarefa({ ...base, consumoMesMin: 300 })).toBeNull();
    expect(situacaoDaTarefa({ ...base, limiteMensalHoras: null, consumoMesMin: 9999 })).toBeNull();
  });
});
