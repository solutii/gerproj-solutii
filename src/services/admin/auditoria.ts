import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { comTrava } from "../trava";

// Registro de quem alterou o quê no painel de administração.
//
// Fica em ARQUIVO (nunca no banco): logs/auditoria/auditoria-AAAA-MM.log, um por
// mês, uma linha JSON por evento, só acrescentando no final. Cada linha traz o
// hash da anterior ("corrente"): se alguém editar, apagar ou trocar a ordem de
// uma linha, a corrente quebra e o painel avisa. Não impede quem tem acesso à
// pasta do servidor de mexer, mas deixa o rastro.
//
// Nunca entram senha, segredo nem o corpo completo da requisição: só os campos
// alterados (antes e depois) e quem fez.

export const HASH_INICIAL = "0".repeat(64);

export type Ator = { codUsuario: number; nome: string; login: string; ip: string };

export type AlvoAuditoria = { tipo: "consultor" | "tarefa"; codigo: number; nome: string };

export type EntradaAuditoria =
  | {
      tipo: "alteracao";
      ator: Ator;
      acao: string; // ex.: "consultor.atualizar"
      alvo: AlvoAuditoria;
      antes: Record<string, unknown>;
      depois: Record<string, unknown>;
    }
  | {
      // Fecha uma "alteracao": depois do commit (confirmada) ou se a gravação falhou.
      tipo: "confirmacao";
      ator: Ator;
      ref: string; // hash da linha de alteração
      resultado: "confirmada" | "falhou";
      erro?: string;
    };

export type LinhaAuditoria = EntradaAuditoria & { ts: string; prev: string; hash: string };

export function pastaAuditoria(): string {
  return process.env.AUDITORIA_DIR || path.join(process.cwd(), "logs", "auditoria");
}

// JSON com chaves em ordem fixa: o mesmo conteúdo sempre gera o mesmo hash.
function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return "[" + valor.map(canonico).join(",") + "]";

  const objeto = valor as Record<string, unknown>;

  return (
    "{" +
    Object.keys(objeto)
      .filter((k) => objeto[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonico(objeto[k]))
      .join(",") +
    "}"
  );
}

export function calcularHash(linhaSemHash: Omit<LinhaAuditoria, "hash">): string {
  return createHash("sha256").update(linhaSemHash.prev + "\n" + canonico(linhaSemHash)).digest("hex");
}

// "2026-10" a partir do instante (fuso de Brasília)
export function mesDoRegistro(instante: Date): string {
  return instante.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

const NOME_ARQUIVO = /^auditoria-(\d{4}-\d{2})\.log$/;

async function arquivosOrdenados(dir: string): Promise<{ mes: string; caminho: string }[]> {
  let nomes: string[];

  try {
    nomes = await fs.readdir(dir);
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw erro;
  }

  return nomes
    .map((n) => ({ n, m: n.match(NOME_ARQUIVO) }))
    .filter((x) => x.m)
    .map((x) => ({ mes: x.m![1], caminho: path.join(dir, x.n) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

async function linhasDe(caminho: string): Promise<string[]> {
  const texto = await fs.readFile(caminho, "utf8");

  return texto.split("\n").filter((l) => l.trim() !== "");
}

// Hash da última linha gravada (a do mês, ou a do mês anterior se o arquivo é novo).
async function ultimoHash(dir: string, mes: string): Promise<string> {
  const arquivos = await arquivosOrdenados(dir);
  const candidatos = arquivos.filter((a) => a.mes <= mes);

  for (let i = candidatos.length - 1; i >= 0; i--) {
    const linhas = await linhasDe(candidatos[i].caminho);
    if (linhas.length === 0) continue;

    let ultima: { hash?: string };
    try {
      ultima = JSON.parse(linhas[linhas.length - 1]);
    } catch {
      throw new Error(`Arquivo de auditoria ilegível (${path.basename(candidatos[i].caminho)}): a última linha não é válida.`);
    }
    if (typeof ultima.hash !== "string") throw new Error(`Arquivo de auditoria ilegível (${path.basename(candidatos[i].caminho)}): linha sem hash.`);

    return ultima.hash;
  }

  return HASH_INICIAL;
}

// Acrescenta uma linha e devolve o hash dela. LANÇA ERRO se não conseguir gravar:
// quem chama deve recusar a alteração (sem registro, nada muda). A fila garante
// que duas linhas nunca disputem o mesmo "anterior".
export async function registrarAuditoria(entrada: EntradaAuditoria, agora: Date = new Date()): Promise<string> {
  const dir = pastaAuditoria();

  return comTrava("auditoria", async () => {
    await fs.mkdir(dir, { recursive: true });

    const mes = mesDoRegistro(agora);
    const prev = await ultimoHash(dir, mes);
    const semHash = { ...entrada, ts: agora.toISOString(), prev } as Omit<LinhaAuditoria, "hash">;
    const hash = calcularHash(semHash);

    await fs.appendFile(path.join(dir, `auditoria-${mes}.log`), JSON.stringify({ ...semHash, hash }) + "\n", { encoding: "utf8" });

    return hash;
  });
}

// ─── Leitura e verificação ───────────────────────────────────────────────────

export type ProblemaDeIntegridade = { arquivo: string; linha: number; motivo: string };

// Confere hash de cada linha e o encadeamento. `prevEsperado`: hash da última
// linha do arquivo anterior (undefined = não há arquivo anterior: não confere).
export function verificarCorrente(
  linhasBrutas: string[],
  arquivo: string,
  prevEsperado?: string,
): { linhas: LinhaAuditoria[]; problemas: ProblemaDeIntegridade[] } {
  const linhas: LinhaAuditoria[] = [];
  const problemas: ProblemaDeIntegridade[] = [];
  let anterior: string | undefined = prevEsperado;

  linhasBrutas.forEach((bruta, i) => {
    const numero = i + 1;
    let linha: LinhaAuditoria;

    try {
      linha = JSON.parse(bruta);
    } catch {
      problemas.push({ arquivo, linha: numero, motivo: "linha ilegível (não é JSON válido)" });
      anterior = undefined;
      return;
    }

    const { hash, ...semHash } = linha;

    if (calcularHash(semHash as Omit<LinhaAuditoria, "hash">) !== hash) {
      problemas.push({ arquivo, linha: numero, motivo: "conteúdo alterado (o hash não confere)" });
    }
    if (anterior !== undefined && linha.prev !== anterior) {
      problemas.push({ arquivo, linha: numero, motivo: "falta uma linha antes desta, ou a ordem foi trocada" });
    }

    anterior = hash;
    linhas.push(linha);
  });

  return { linhas, problemas };
}

export async function listarMesesDeAuditoria(): Promise<string[]> {
  return (await arquivosOrdenados(pastaAuditoria())).map((a) => a.mes).reverse();
}

export type RegistroDeHistorico = {
  hash: string;
  ts: string;
  ator: Ator;
  acao: string;
  alvo: AlvoAuditoria;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  // "confirmada": a gravação foi confirmada no banco; "falhou": não foi aplicada;
  // "nao-confirmada": não há desfecho registrado (ex.: o sistema parou no meio)
  situacao: "confirmada" | "falhou" | "nao-confirmada";
  erro?: string;
};

export type HistoricoDoMes = {
  mes: string;
  registros: RegistroDeHistorico[]; // mais recentes primeiro
  integridade: { ok: boolean; problemas: ProblemaDeIntegridade[] };
};

// Histórico de um mês, com a conferência da corrente. `busca` filtra por nome,
// código ou login (do administrador ou do alvo).
export async function lerHistorico(mes: string, busca = ""): Promise<HistoricoDoMes> {
  const dir = pastaAuditoria();
  const arquivos = await arquivosOrdenados(dir);
  const indice = arquivos.findIndex((a) => a.mes === mes);

  if (indice < 0) return { mes, registros: [], integridade: { ok: true, problemas: [] } };

  // elo com o mês anterior (se o arquivo anterior existe)
  let prevEsperado: string | undefined;
  if (indice > 0) {
    const anteriores = await linhasDe(arquivos[indice - 1].caminho);
    try {
      prevEsperado = anteriores.length ? (JSON.parse(anteriores[anteriores.length - 1]) as LinhaAuditoria).hash : undefined;
    } catch {
      prevEsperado = undefined;
    }
  }

  const { linhas, problemas } = verificarCorrente(await linhasDe(arquivos[indice].caminho), path.basename(arquivos[indice].caminho), prevEsperado);

  const desfecho = new Map<string, { resultado: "confirmada" | "falhou"; erro?: string }>();
  for (const l of linhas) if (l.tipo === "confirmacao") desfecho.set(l.ref, { resultado: l.resultado, erro: l.erro });

  const termo = busca.trim().toLowerCase();
  const registros: RegistroDeHistorico[] = [];

  for (const l of linhas) {
    if (l.tipo !== "alteracao") continue;

    const d = desfecho.get(l.hash);
    const registro: RegistroDeHistorico = {
      hash: l.hash,
      ts: l.ts,
      ator: l.ator,
      acao: l.acao,
      alvo: l.alvo,
      antes: l.antes,
      depois: l.depois,
      situacao: d ? d.resultado : "nao-confirmada",
      ...(d?.erro ? { erro: d.erro } : {}),
    };

    if (termo) {
      const alvo = `${registro.alvo.nome} ${registro.alvo.codigo} ${registro.ator.nome} ${registro.ator.login}`.toLowerCase();
      if (!alvo.includes(termo)) continue;
    }

    registros.push(registro);
  }

  registros.reverse();

  return { mes, registros, integridade: { ok: problemas.length === 0, problemas } };
}
