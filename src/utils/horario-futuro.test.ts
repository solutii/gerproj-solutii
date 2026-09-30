import { describe, expect, it } from "vitest";
import { agoraNoFuso, apontamentoNoFuturo } from "./horario-futuro";

// 2026-09-30 17:05 em Brasília (UTC-3) = 20:05 UTC
const AGORA = new Date("2026-09-30T20:05:00Z");

describe("agoraNoFuso", () => {
  it("converte para data e hora de Brasília", () => {
    expect(agoraNoFuso(AGORA)).toEqual({ data: "2026-09-30", hora: "17:05" });
  });

  it("usa o dia de Brasília mesmo quando o UTC já virou o dia", () => {
    // 22:30 em Brasília = 01:30 UTC do dia seguinte
    expect(agoraNoFuso(new Date("2026-10-01T01:30:00Z"))).toEqual({
      data: "2026-09-30",
      hora: "22:30",
    });
  });
});

describe("apontamentoNoFuturo", () => {
  it("hoje com horário depois de agora é futuro", () => {
    expect(apontamentoNoFuturo("2026-09-30", "20:00", "21:00", AGORA)).toBe(true);
  });

  it("hoje com só a hora final depois de agora é futuro", () => {
    expect(apontamentoNoFuturo("2026-09-30", "16:00", "17:30", AGORA)).toBe(true);
  });

  it("hoje até o horário atual não é futuro", () => {
    expect(apontamentoNoFuturo("2026-09-30", "16:00", "17:00", AGORA)).toBe(false);
    expect(apontamentoNoFuturo("2026-09-30", "16:00", "17:05", AGORA)).toBe(false);
  });

  it("dia anterior nunca é futuro, mesmo com hora alta", () => {
    expect(apontamentoNoFuturo("2026-09-29", "20:00", "23:30", AGORA)).toBe(false);
  });

  it("dia seguinte é sempre futuro", () => {
    expect(apontamentoNoFuturo("2026-10-01", "08:00", "09:00", AGORA)).toBe(true);
  });

  it("aceita data com hora junto (ISO completo)", () => {
    expect(apontamentoNoFuturo("2026-09-30T00:00:00.000Z", "20:00", "21:00", AGORA)).toBe(true);
  });
});
