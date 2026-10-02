import { describe, expect, it } from "vitest";
import {
  duracaoOsMinutos,
  formatarHoras,
  hhmmParaMinutos,
  minutosParaHoras,
} from "./horas";
import { ehFeriado, feriadosNacionais, pascoa, somarDias } from "./feriados";
import { diaDaSemana, diasDoMes, diasEntre, diasUteisDoMes, ehDiaUtil } from "./dias-uteis";

describe("horas", () => {
  it("converte HHMM e HH:MM em minutos", () => {
    expect(hhmmParaMinutos("0848")).toBe(528);
    expect(hhmmParaMinutos("08:48")).toBe(528);
    expect(hhmmParaMinutos("0030")).toBe(30);
    expect(hhmmParaMinutos("830")).toBe(510);
  });

  it("valor inválido, vazio ou nulo vira 0", () => {
    expect(hhmmParaMinutos("")).toBe(0);
    expect(hhmmParaMinutos(null)).toBe(0);
    expect(hhmmParaMinutos("abc")).toBe(0);
  });

  it("duração de OS em minutos, nunca negativa", () => {
    expect(duracaoOsMinutos("0900", "1030")).toBe(90);
    expect(duracaoOsMinutos("1700", "1700")).toBe(0);
    expect(duracaoOsMinutos("1800", "0900")).toBe(0);
  });

  it("minutos para horas decimais e formato 8hs:48min", () => {
    expect(minutosParaHoras(528)).toBe(8.8);
    expect(minutosParaHoras(90)).toBe(1.5);
    expect(formatarHoras(528)).toBe("8hs:48min");
    expect(formatarHoras(480)).toBe("8hs:00min");
    expect(formatarHoras(30)).toBe("0h:30min");
    expect(formatarHoras(-5)).toBe("0h:00min");
  });
});

describe("feriados", () => {
  it("calcula a Páscoa", () => {
    expect(pascoa(2024)).toBe("2024-03-31");
    expect(pascoa(2025)).toBe("2025-04-20");
    expect(pascoa(2026)).toBe("2026-04-05");
  });

  it("feriados móveis de 2026 derivam da Páscoa", () => {
    const f = feriadosNacionais(2026);

    expect(f.has("2026-02-16")).toBe(true); // Carnaval (segunda)
    expect(f.has("2026-02-17")).toBe(true); // Carnaval (terça)
    expect(f.has("2026-04-03")).toBe(true); // Sexta-feira Santa
    expect(f.has("2026-06-04")).toBe(true); // Corpus Christi
  });

  it("feriados fixos", () => {
    for (const d of ["2026-01-01", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"]) {
      expect(ehFeriado(d)).toBe(true);
    }
    expect(ehFeriado("2026-09-08")).toBe(false);
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dias úteis", () => {
  it("dia da semana (0 = domingo)", () => {
    expect(diaDaSemana("2026-09-30")).toBe(3); // quarta
    expect(diaDaSemana("2026-09-27")).toBe(0); // domingo
  });

  it("fim de semana e feriado não são dia útil", () => {
    expect(ehDiaUtil("2026-09-30")).toBe(true);
    expect(ehDiaUtil("2026-09-26")).toBe(false); // sábado
    expect(ehDiaUtil("2026-09-07")).toBe(false); // feriado (segunda)
  });

  it("dias do mês", () => {
    expect(diasDoMes("2026-02")).toHaveLength(28);
    expect(diasDoMes("2028-02")).toHaveLength(29);
    expect(diasDoMes("2026-09")[0]).toBe("2026-09-01");
  });

  it("quantidade de dias úteis por mês de 2026", () => {
    expect(diasUteisDoMes("2026-09")).toHaveLength(21); // 22 dias de semana - 7/9
    expect(diasUteisDoMes("2026-10")).toHaveLength(21); // 22 - 12/10
    expect(diasUteisDoMes("2026-11")).toHaveLength(19); // 21 - 2/11 - 20/11 (15/11 é domingo)
    expect(diasUteisDoMes("2026-12")).toHaveLength(22); // 23 - 25/12
  });

  it("diferença em dias corridos", () => {
    expect(diasEntre("2026-09-01", "2026-09-30")).toBe(29);
    expect(diasEntre("2026-09-30", "2026-09-01")).toBe(-29);
    expect(diasEntre("2026-12-30", "2027-01-02")).toBe(3);
  });
});
