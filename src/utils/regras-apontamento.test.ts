import { describe, expect, it } from "vitest";
import {
  dataLocalISO,
  dataMinimaPermitida,
  diaAnterior,
  horariosSeSobrepoem,
} from "./regras-apontamento";

describe("dataLocalISO / diaAnterior", () => {
  it("formata Date pelas partes locais", () => {
    expect(dataLocalISO(new Date(2026, 8, 1))).toBe("2026-09-01");
  });

  it("string só tem o dia extraído", () => {
    expect(dataLocalISO("2026-09-01T03:00:00.000Z")).toBe("2026-09-01");
  });

  it("dia anterior atravessa mês e ano", () => {
    expect(diaAnterior("2026-09-01")).toBe("2026-08-31");
    expect(diaAnterior("2026-01-01")).toBe("2025-12-31");
  });
});

describe("dataMinimaPermitida", () => {
  it("com permissão usa o DTLIMITE_RECURSO", () => {
    expect(dataMinimaPermitida(true, new Date(2026, 8, 1), "2026-09-30")).toBe("2026-09-01");
  });

  it("sem permissão só de ontem em diante", () => {
    expect(dataMinimaPermitida(false, new Date(2026, 8, 1), "2026-09-30")).toBe("2026-09-29");
  });

  it("com permissão mas sem data limite cai em ontem", () => {
    expect(dataMinimaPermitida(true, null, "2026-09-30")).toBe("2026-09-29");
  });
});

describe("horariosSeSobrepoem", () => {
  it("cruzar o intervalo existente é sobreposição", () => {
    expect(horariosSeSobrepoem("0900", "1100", "10:00", "12:00")).toBe(true);
    expect(horariosSeSobrepoem("0900", "1100", "08:00", "09:30")).toBe(true);
  });

  it("intervalo contido ou que contém é sobreposição", () => {
    expect(horariosSeSobrepoem("0900", "1100", "09:30", "10:00")).toBe(true);
    expect(horariosSeSobrepoem("0900", "1100", "08:00", "12:00")).toBe(true);
  });

  it("encostar nas pontas não é sobreposição", () => {
    expect(horariosSeSobrepoem("0900", "1000", "10:00", "11:00")).toBe(false);
    expect(horariosSeSobrepoem("1000", "1100", "09:00", "10:00")).toBe(false);
  });

  it("intervalos separados não se sobrepõem", () => {
    expect(horariosSeSobrepoem("0900", "1000", "14:00", "15:00")).toBe(false);
  });
});
