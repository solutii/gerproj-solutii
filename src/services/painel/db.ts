import { getConnection } from "../firebird";
import { decodeBlobText } from "../encoding";

// Auxiliares de banco do painel (só leitura), compartilhados entre o painel e o
// espelho de apontamentos.

export type Db = {
  query: (sql: string, params: unknown[], cb: (e: any, r: any[]) => void) => void;
  detach: () => void;
};

export function abrirConexao(): Promise<Db> {
  return new Promise((resolve, reject) => {
    getConnection((err: any, db: any) => (err ? reject(err) : resolve(db)));
  });
}

export function consultar(db: Db, sql: string, params: unknown[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res ?? [])));
  });
}

// Texto de campo BLOB (o driver devolve uma função) ou VARCHAR comum.
export function lerTexto(valor: unknown): Promise<string> {
  if (typeof valor !== "function") return Promise.resolve(String(valor ?? "").trim());

  return new Promise((resolve, reject) => {
    (valor as any)((err: any, _nome: any, emissor: any) => {
      if (err) return reject(err);
      if (!emissor) return resolve("");

      const partes: Buffer[] = [];
      emissor.on("data", (p: Buffer) => partes.push(p));
      emissor.on("end", () => resolve(decodeBlobText(Buffer.concat(partes)).trim()));
      emissor.on("error", reject);
    });
  });
}

// Divide a lista em blocos (para consultas com IN (...) de tamanho limitado).
export function emBlocos<T>(lista: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho));

  return blocos;
}

export const texto = (v: unknown) => String(v ?? "").trim();
