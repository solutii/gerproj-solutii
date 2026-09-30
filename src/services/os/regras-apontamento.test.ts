// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection, getToken } = vi.hoisted(() => ({
  getConnection: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("../firebird", () => ({ getConnection }));
vi.mock("next-auth/jwt", () => ({ getToken }));

import {
  recursoDaRequisicao,
  validarApontamento,
  validarPosseChamado,
  validarPosseCliente,
  validarPosseOs,
} from "./regras-apontamento";

type Linha = Record<string, unknown>;

// Banco falso: responde pela consulta (trecho do SQL) e guarda o que foi pedido.
function bancoFalso(respostas: Record<string, Linha[]>) {
  const consultas: { sql: string; params: unknown[] }[] = [];

  getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
    cb(null, {
      query: (sql: string, params: unknown[], done: (e: unknown, r: Linha[]) => void) => {
        consultas.push({ sql, params });
        const chave = Object.keys(respostas).find((k) => sql.includes(k));
        done(null, chave ? respostas[chave] : []);
      },
      detach: vi.fn(),
    }),
  );

  return consultas;
}

// 2026-09-30 17:05 em Brasília
const AGORA = new Date("2026-09-30T20:05:00Z");
const DESCRICAO = "a".repeat(60);

const RECURSO_COM_PERMISSAO = {
  "FROM RECURSO": [{ DTLIMITE_RECURSO: new Date(2026, 8, 1), PERMAPO_RECURSO: "SIM" }],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  getConnection.mockReset();
  getToken.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recursoDaRequisicao", () => {
  it("lê o consultor do token da sessão", async () => {
    getToken.mockResolvedValue({ email: { COD_RECURSO: 152 } });

    await expect(recursoDaRequisicao({} as any)).resolves.toBe(152);
  });

  it("sem token ou sem COD_RECURSO não autentica", async () => {
    getToken.mockResolvedValue(null);
    await expect(recursoDaRequisicao({} as any)).rejects.toThrow("Não autenticado");

    getToken.mockResolvedValue({ email: {} });
    await expect(recursoDaRequisicao({} as any)).rejects.toThrow("Não autenticado");
  });
});

describe("validarApontamento", () => {
  const base = {
    recurso: 152,
    date: "2026-09-30",
    startTime: "09:00",
    endTime: "10:00",
    description: DESCRICAO,
  };

  it("aceita um apontamento válido", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(validarApontamento(base)).resolves.toBeUndefined();
  });

  it("recusa descrição com menos de 50 caracteres", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(validarApontamento({ ...base, description: "curta" })).rejects.toThrow(
      "no mínimo 50 caracteres",
    );
  });

  it("recusa campos vazios", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(validarApontamento({ ...base, startTime: "" })).rejects.toThrow(
      "Selecione uma data e hora",
    );
  });

  it("recusa hora final igual ou menor que a inicial", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(
      validarApontamento({ ...base, startTime: "10:00", endTime: "10:00" }),
    ).rejects.toThrow("hora final precisa ser maior");
  });

  it("recusa horário que ainda não aconteceu", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(
      validarApontamento({ ...base, startTime: "20:00", endTime: "21:00" }),
    ).rejects.toThrow("ainda não aconteceram");
  });

  it("recusa data antes do DTLIMITE_RECURSO de quem tem permissão", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await expect(validarApontamento({ ...base, date: "2026-08-31" })).rejects.toThrow(
      "período vigente",
    );
  });

  it("sem permissão de retroativo só aceita de ontem em diante", async () => {
    bancoFalso({
      "FROM RECURSO": [{ DTLIMITE_RECURSO: new Date(2026, 8, 1), PERMAPO_RECURSO: "NAO" }],
      "FROM OS": [],
    });

    await expect(validarApontamento({ ...base, date: "2026-09-28" })).rejects.toThrow(
      "período vigente",
    );
    await expect(validarApontamento({ ...base, date: "2026-09-29" })).resolves.toBeUndefined();
  });

  it("recusa conflito de horário e diz qual OS", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS": [{ COD_OS: 777, HRINI_OS: "0930", HRFIM_OS: "1030" }],
    });

    await expect(validarApontamento(base)).rejects.toThrow(
      "OS #777 das 09:30 às 10:30",
    );
  });

  it("horário que só encosta em outra OS não é conflito", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS": [{ COD_OS: 777, HRINI_OS: "0800", HRFIM_OS: "0900" }],
    });

    await expect(validarApontamento(base)).resolves.toBeUndefined();
  });

  it("na edição a própria OS não conta como conflito", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS": [{ COD_OS: 777, HRINI_OS: "0900", HRFIM_OS: "1000" }],
    });

    await expect(validarApontamento({ ...base, ignorarCodOs: 777 })).resolves.toBeUndefined();
  });

  it("consulta só as OS do próprio consultor no dia", async () => {
    const consultas = bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS": [] });

    await validarApontamento(base);

    const consultaOs = consultas.find((c) => c.sql.includes("FROM OS"));
    expect(consultaOs?.params).toEqual([152, "2026-09-30"]);
  });
});

describe("validarPosseOs", () => {
  const osDoConsultor = {
    CODREC_OS: 152,
    DTINI_OS: new Date(2026, 8, 15),
    CHAMADO_OS: null,
    CODTRF_OS: 10,
    HRINI_OS: "0900",
    HRFIM_OS: "1000",
  };

  it("devolve a OS quando é do consultor e está no período", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS WHERE COD_OS": [osDoConsultor] });

    await expect(validarPosseOs(152, 1)).resolves.toMatchObject({ CODTRF_OS: 10 });
  });

  it("OS inexistente", async () => {
    bancoFalso({ ...RECURSO_COM_PERMISSAO, "FROM OS WHERE COD_OS": [] });

    await expect(validarPosseOs(152, 1)).rejects.toThrow("OS não encontrada");
  });

  it("OS de outro consultor", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS WHERE COD_OS": [{ ...osDoConsultor, CODREC_OS: 999 }],
    });

    await expect(validarPosseOs(152, 1)).rejects.toThrow("seus próprios apontamentos");
  });

  it("OS fora do período vigente", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS WHERE COD_OS": [{ ...osDoConsultor, DTINI_OS: new Date(2026, 7, 10) }],
    });

    await expect(validarPosseOs(152, 1)).rejects.toThrow("fora do período vigente");
  });

  it("OS de chamado finalizado não pode ser alterada", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS WHERE COD_OS": [{ ...osDoConsultor, CHAMADO_OS: "15161" }],
      "STATUS_CHAMADO FROM CHAMADO": [{ STATUS_CHAMADO: "FINALIZADO" }],
    });

    await expect(validarPosseOs(152, 1)).rejects.toThrow("Chamado finalizado");
  });

  it("OS de chamado em andamento pode", async () => {
    bancoFalso({
      ...RECURSO_COM_PERMISSAO,
      "FROM OS WHERE COD_OS": [{ ...osDoConsultor, CHAMADO_OS: "15161" }],
      "STATUS_CHAMADO FROM CHAMADO": [{ STATUS_CHAMADO: "STANDBY" }],
    });

    await expect(validarPosseOs(152, 1)).resolves.toMatchObject({ CHAMADO_OS: "15161" });
  });
});

describe("validarPosseChamado / validarPosseCliente", () => {
  it("chamado do consultor passa; de outro, não; inexistente, não", async () => {
    bancoFalso({ "FROM CHAMADO WHERE COD_CHAMADO": [{ COD_RECURSO: 152 }] });
    await expect(validarPosseChamado(152, 15161)).resolves.toBeUndefined();
    await expect(validarPosseChamado(7, 15161)).rejects.toThrow("não está atribuído a você");

    bancoFalso({ "FROM CHAMADO WHERE COD_CHAMADO": [] });
    await expect(validarPosseChamado(152, 1)).rejects.toThrow("Chamado não encontrado");
  });

  it("cliente só se o consultor tem chamado dele", async () => {
    bancoFalso({ "FROM CHAMADO WHERE COD_RECURSO": [{ COD_CHAMADO: 1 }] });
    await expect(validarPosseCliente(152, 5)).resolves.toBeUndefined();

    bancoFalso({ "FROM CHAMADO WHERE COD_RECURSO": [] });
    await expect(validarPosseCliente(152, 5)).rejects.toThrow("não possui chamados atribuídos");
    await expect(validarPosseCliente(152, "")).rejects.toThrow("Cliente não informado");
  });
});
