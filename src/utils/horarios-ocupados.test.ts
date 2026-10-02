import { describe, expect, it } from "vitest";
import { horariosSeSobrepoem } from "./regras-apontamento";
import {
  conflitoDoIntervalo,
  horaFinalIndisponivel,
  horaInicialOcupada,
  intervalosOcupados,
  textoDoConflito,
} from "./horarios-ocupados";

const lista = [
  { COD_OS: 2, HRINI_OS: "1400", HRFIM_OS: "1500" },
  { COD_OS: 1, HRINI_OS: "0900", HRFIM_OS: "1000" },
  { COD_OS: 3, HRINI_OS: null, HRFIM_OS: null },
];

describe("intervalosOcupados", () => {
  it("converte HHMM em HH:MM, ordena e ignora OS sem horário", () => {
    expect(intervalosOcupados(lista)).toEqual([
      { codOs: 1, inicio: "09:00", fim: "10:00" },
      { codOs: 2, inicio: "14:00", fim: "15:00" },
    ]);
  });

  it("na edição, a própria OS não conta como ocupada (compara como texto)", () => {
    expect(intervalosOcupados(lista, "1").map((i) => i.codOs)).toEqual([2]);
    expect(intervalosOcupados(lista, 2).map((i) => i.codOs)).toEqual([1]);
  });
});

describe("hora inicial", () => {
  const ocupados = intervalosOcupados(lista);

  it("ocupada quando cai dentro de outra OS; livre ao encostar no fim ou antes do início", () => {
    expect(horaInicialOcupada("09:00", ocupados)).toBe(true);
    expect(horaInicialOcupada("09:30", ocupados)).toBe(true);
    expect(horaInicialOcupada("10:00", ocupados)).toBe(false); // começa quando a outra termina
    expect(horaInicialOcupada("08:30", ocupados)).toBe(false);
  });
});

describe("hora final", () => {
  const ocupados = intervalosOcupados(lista);

  it("sem hora inicial escolhida nada é bloqueado", () => {
    expect(horaFinalIndisponivel("12:00", "", ocupados)).toBe(false);
  });

  it("não deixa o intervalo atravessar outra OS, mas permite terminar encostando nela", () => {
    expect(horaFinalIndisponivel("09:00", "08:00", ocupados)).toBe(false); // termina quando a outra começa
    expect(horaFinalIndisponivel("09:30", "08:00", ocupados)).toBe(true);
    expect(horaFinalIndisponivel("11:00", "08:00", ocupados)).toBe(true); // atravessa 09-10
    expect(horaFinalIndisponivel("14:00", "10:00", ocupados)).toBe(false);
    expect(horaFinalIndisponivel("14:30", "10:00", ocupados)).toBe(true);
  });
});

describe("conflitoDoIntervalo", () => {
  const ocupados = intervalosOcupados(lista);

  it("devolve a OS em conflito, ou null", () => {
    expect(conflitoDoIntervalo("09:30", "10:30", ocupados)?.codOs).toBe(1);
    expect(conflitoDoIntervalo("10:00", "11:00", ocupados)).toBeNull();
    expect(conflitoDoIntervalo("", "11:00", ocupados)).toBeNull();
    expect(conflitoDoIntervalo("08:00", "", ocupados)).toBeNull();
  });

  it("a mensagem cita a OS e o horário", () => {
    expect(textoDoConflito({ codOs: 1, inicio: "09:00", fim: "10:00" })).toBe(
      "Conflito de horário: você já tem a OS #1 das 09:00 às 10:00 nesta data.",
    );
  });
});

describe("mesma regra do servidor", () => {
  // varre todas as combinações de meia em meia hora e compara com a regra do servidor
  it("conflitoDoIntervalo concorda com horariosSeSobrepoem em todos os intervalos possíveis", () => {
    const horas = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
    const ocupados = intervalosOcupados([{ COD_OS: 1, HRINI_OS: "0900", HRFIM_OS: "1030" }]);

    for (const ini of horas) {
      for (const fim of horas) {
        if (fim <= ini) continue;

        expect(conflitoDoIntervalo(ini, fim, ocupados) !== null).toBe(horariosSeSobrepoem("0900", "1030", ini, fim));
      }
    }
  });
});
