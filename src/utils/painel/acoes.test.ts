import { describe, expect, it } from "vitest";
import { minutosPorDia } from "./agregacoes";
import { calcularProjecao } from "./projecao";
import { horariosLivres, intervalosDasOs, minutosParaHHMM } from "./agenda";
import { minutosAteDiaUtil, variacaoPercentual } from "./comparacao";
import { csvEspelho, htmlEspelho, type LinhaEspelho } from "./espelho";

const META = 480 * 21; // setembro/2026: 21 dias úteis de 8h

describe("projeção do mês", () => {
  const base = { mes: "2026-09", metaMesMin: META };
  const vazio = minutosPorDia("2026-09", []);

  it("no ritmo: a média dos dias decorridos chega na meta", () => {
    // até 14/9 há 9 dias úteis; 72h apontadas = 8h/dia; restam 12 dias
    const p = calcularProjecao({ ...base, hoje: "2026-09-15", horasApontadasMin: 4320, porDia: vazio });

    expect(p.diasDecorridos).toBe(9);
    expect(p.diasRestantes).toBe(12);
    expect(p.mediaDiariaMin).toBe(480);
    expect(p.projecaoMesMin).toBe(10080);
    expect(p.situacao).toBe("no-ritmo");
    expect(p.faltaParaMetaMin).toBe(5760);
    expect(p.necessarioPorDiaMin).toBe(480);
  });

  it("abaixo: projeção menor que a meta e quanto precisa por dia", () => {
    const p = calcularProjecao({ ...base, hoje: "2026-09-15", horasApontadasMin: 3600, porDia: vazio });

    expect(p.mediaDiariaMin).toBe(400);
    expect(p.projecaoMesMin).toBe(8400);
    expect(p.situacao).toBe("abaixo");
    expect(p.necessarioPorDiaMin).toBe(540);
  });

  it("meta batida", () => {
    const p = calcularProjecao({ ...base, hoje: "2026-09-15", horasApontadasMin: META, porDia: vazio });

    expect(p.situacao).toBe("meta-batida");
    expect(p.faltaParaMetaMin).toBe(0);
    expect(p.necessarioPorDiaMin).toBe(0);
  });

  it("hoje só conta como decorrido se já tem apontamento", () => {
    const comOsHoje = minutosPorDia("2026-09", [{ data: "2026-09-15", minutos: 480 }]);
    const p = calcularProjecao({ ...base, hoje: "2026-09-15", horasApontadasMin: 4800, porDia: comOsHoje });

    expect(p.diasDecorridos).toBe(10);
    expect(p.diasRestantes).toBe(11);
  });

  it("início do mês, sem base para projetar", () => {
    const p = calcularProjecao({ ...base, hoje: "2026-09-01", horasApontadasMin: 0, porDia: vazio });

    expect(p.diasDecorridos).toBe(0);
    expect(p.mediaDiariaMin).toBeNull();
    expect(p.projecaoMesMin).toBeNull();
    expect(p.situacao).toBe("sem-dados");
    expect(p.necessarioPorDiaMin).toBe(480);
  });

  it("último dia útil sem OS ainda conta como restante", () => {
    const p = calcularProjecao({ ...base, hoje: "2026-09-30", horasApontadasMin: 9600, porDia: vazio });

    expect(p.diasDecorridos).toBe(20);
    expect(p.diasRestantes).toBe(1);
    expect(p.necessarioPorDiaMin).toBe(480);
  });
});

describe("agenda do dia", () => {
  it("converte as OS em intervalos e ignora as inválidas", () => {
    expect(
      intervalosDasOs([
        { HRINI_OS: "0900", HRFIM_OS: "1200" },
        { HRINI_OS: "1500", HRFIM_OS: "1500" },
        { HRINI_OS: null, HRFIM_OS: null },
      ]),
    ).toEqual([{ inicio: 540, fim: 720 }]);
  });

  it("minutos para HH:MM", () => {
    expect(minutosParaHHMM(540)).toBe("09:00");
    expect(minutosParaHHMM(1025)).toBe("17:05");
  });

  it("dia vazio: livre da abertura até o último horário já passado (grade de 30 min)", () => {
    // 17:05 -> o último horário apontável é 17:00
    expect(horariosLivres([], 17 * 60 + 5)).toEqual([{ inicio: 480, fim: 1020 }]);
  });

  it("lacunas entre as OS do dia", () => {
    const ocupados = [{ inicio: 540, fim: 720 }, { inicio: 840, fim: 900 }]; // 9-12 e 14-15
    expect(horariosLivres(ocupados, 17 * 60 + 5)).toEqual([
      { inicio: 480, fim: 540 }, // 08:00-09:00
      { inicio: 720, fim: 840 }, // 12:00-14:00
      { inicio: 900, fim: 1020 }, // 15:00-17:00
    ]);
  });

  it("OS fora da grade de 30 min: a lacuna se alinha à grade", () => {
    // 09:10-10:20 ocupado
    expect(horariosLivres([{ inicio: 550, fim: 620 }], 18 * 60)).toEqual([
      { inicio: 480, fim: 540 },
      { inicio: 630, fim: 1080 },
    ]);
  });

  it("OS que não depende da ordem de entrada", () => {
    const a = horariosLivres([{ inicio: 840, fim: 900 }, { inicio: 540, fim: 720 }], 1020);
    const b = horariosLivres([{ inicio: 540, fim: 720 }, { inicio: 840, fim: 900 }], 1020);

    expect(a).toEqual(b);
  });

  it("não oferece horário que ainda não aconteceu", () => {
    expect(horariosLivres([], 8 * 60 + 20)).toEqual([]); // 08:20: ainda não fechou nem 30 min
    expect(horariosLivres([], 23 * 60)).toEqual([{ inicio: 480, fim: 1080 }]); // à noite vai até 18:00
    expect(horariosLivres([{ inicio: 960, fim: 1140 }], 17 * 60 + 30)).toEqual([{ inicio: 480, fim: 960 }]);
  });

  it("descarta lacuna menor que 30 minutos", () => {
    expect(horariosLivres([{ inicio: 480, fim: 510 }, { inicio: 530, fim: 600 }], 11 * 60)).toEqual([
      { inicio: 600, fim: 660 },
    ]);
  });
});

describe("comparação com o mês anterior", () => {
  // set/2026: úteis 1,2,3,4 (qua? ter..sex), 8... ; 5/9 é sábado
  const porDia = minutosPorDia("2026-09", [
    { data: "2026-09-01", minutos: 100 },
    { data: "2026-09-02", minutos: 50 },
    { data: "2026-09-05", minutos: 30 }, // sábado
    { data: "2026-09-08", minutos: 60 },
  ]);

  it("soma até o N-ésimo dia útil (inclusive)", () => {
    expect(minutosAteDiaUtil("2026-09", porDia, 2)).toBe(150); // até 2/9
    expect(minutosAteDiaUtil("2026-09", porDia, 5)).toBe(240); // 5º útil = 8/9 (7/9 é feriado); sábado 5/9 entra
    expect(minutosAteDiaUtil("2026-09", porDia, 0)).toBe(0);
  });

  it("sem limite ou limite maior que o mês: mês inteiro", () => {
    expect(minutosAteDiaUtil("2026-09", porDia, null)).toBe(240);
    expect(minutosAteDiaUtil("2026-09", porDia, 99)).toBe(240);
  });

  it("variação percentual", () => {
    expect(variacaoPercentual(110, 100)).toBe(10);
    expect(variacaoPercentual(90, 100)).toBe(-10);
    expect(variacaoPercentual(150, 100)).toBe(50);
    expect(variacaoPercentual(50, 0)).toBeNull();
  });
});

describe("espelho de apontamentos", () => {
  const linha: LinhaEspelho = {
    data: "2026-09-01",
    inicio: "09:00",
    fim: "10:30",
    minutos: 90,
    cliente: "Cliente A;B",
    tarefa: "Tarefa 1",
    chamado: "100",
    codOs: 5,
    descricao: "Ajuste do relatório",
  };

  it("CSV: BOM, separador ;, horas com vírgula e total", () => {
    const csv = csvEspelho([linha]);
    const linhas = csv.split("\r\n");

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas[0]).toBe("﻿Data;Início;Fim;Horas;Cliente;Tarefa;Chamado;OS;Descrição");
    expect(linhas[1]).toBe('01/09/2026;09:00;10:30;1,50;"Cliente A;B";Tarefa 1;100;5;Ajuste do relatório');
    expect(linhas[2]).toBe("Total;;;1,50;;;;;");
  });

  it("CSV: aspas dobradas, quebra de linha vira espaço e fórmula é neutralizada", () => {
    const csv = csvEspelho([{ ...linha, descricao: '=HYPERLINK("http://x")\nsegunda linha' }]);

    expect(csv).toContain("\"'=HYPERLINK(\"\"http://x\"\") segunda linha\"");
  });

  it("CSV: sinais + - @ também são neutralizados", () => {
    for (const perigoso of ["+1+1", "-2+3", "@SOMA(A1)"]) {
      expect(csvEspelho([{ ...linha, descricao: perigoso }])).toContain(`'${perigoso}`);
    }
  });

  it("HTML: escapa texto vindo do banco e traz o total", () => {
    const html = htmlEspelho({
      consultor: "Fulano <b>",
      nomeMes: "setembro de 2026",
      linhas: [{ ...linha, descricao: "<script>alert(1)</script>" }],
      totalMin: 90,
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Fulano &lt;b&gt;");
    expect(html).toContain("1h:30min");
    expect(html).toContain("chamado 100");
    expect(html).toContain("<!doctype html>");
  });
});
