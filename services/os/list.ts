import { ChamadoLimitType, ChamadosType, STATUS_CHAMADO } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import { decodeBlobText } from "../encoding";

export default (function OsService() {

    // Função auxiliar para ler BLOB TEXT
    const readBlob = (blobFn: any): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!blobFn || typeof blobFn !== "function") return resolve("");

            blobFn((err: any, name: any, stream: any) => {
                if (err) return reject(err);
                if (!stream) return resolve("");

                const chunks: Buffer[] = [];
                stream.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                stream.on("end", () => {
                    resolve(decodeBlobText(Buffer.concat(chunks)));
                });
                stream.on("error", reject);
            });
        });
    };

    // Função interna genérica para processar BLOBs em paralelo
    const processBlobs = async (rows: any[], blobField: string) => {
        await Promise.all(
            rows.map(async (row) => {
                if (typeof row[blobField] === "function") {
                    row[blobField] = await readBlob(row[blobField]);
                }
            })
        );
    };

    function list(chamado: string, recurso: string, data: string): Promise<ChamadosType[]> {
        return new Promise((resolve, reject) => {
            getConnection( async (err: any, db: any) => {
                if (err) return reject(err);

                db.query(
                    `
                    SELECT
                        OS.OBS,
                        OS.COD_OS,
                        OS.DTINI_OS,
                        OS.HRINI_OS,
                        OS.HRFIM_OS,
                        CLIENTE.NOME_CLIENTE
                    FROM OS
                    LEFT JOIN CHAMADO ON (OS.chamado_os = CHAMADO.cod_chamado)
                    LEFT JOIN TAREFA ON (TAREFA.cod_tarefa = OS.codtrf_os)
                    LEFT JOIN PROJETO ON (PROJETO.cod_projeto = TAREFA.codpro_tarefa)
                    LEFT JOIN CLIENTE ON (CLIENTE.cod_cliente = PROJETO.codcli_projeto)
                    WHERE ${data ? "DTINI_OS" : "CHAMADO_OS"} = ? 
                        AND CODREC_OS = ?
                    `,
                    [data ? data : chamado, recurso],
                    async (err: any, result: any) => {
                        if (err) {
                            db?.detach();
                            return reject(err);
                        }

                        if (!result.length) {
                            db?.detach();
                            return resolve([]);
                        }

                        try {
                            await processBlobs(result, "OBS");

                            // Se houver campos VARCHAR/CHAR que precisem de LATIN1 → UTF-8
                            for (const row of result) {
                                if (row.NOME_CLIENTE) {
                                    row.NOME_CLIENTE = row.NOME_CLIENTE;
                                }
                            }

                            db?.detach();
                            resolve(result);
                        } catch (e) {
                            db?.detach();
                            reject(e);
                        }
                    }
                );
            });
        });
    }

    function listOsTarefa(tarefa: string, recurso: string, data: string): Promise<ChamadosType[]> {
        return new Promise((resolve, reject) => {
            getConnection( async (err: any, db: any) => {
                if (err) return reject(err);

                db.query(
                    `
                    SELECT
                        OS.OBS,
                        OS.COD_OS,
                        OS.DTINI_OS,
                        OS.HRINI_OS,
                        OS.HRFIM_OS,
                        CLIENTE.NOME_CLIENTE
                    FROM OS
                    LEFT JOIN CHAMADO ON (OS.chamado_os = CHAMADO.cod_chamado)
                    LEFT JOIN TAREFA ON (TAREFA.cod_tarefa = OS.codtrf_os)
                    LEFT JOIN PROJETO ON (PROJETO.cod_projeto = TAREFA.codpro_tarefa)
                    LEFT JOIN CLIENTE ON (CLIENTE.cod_cliente = PROJETO.codcli_projeto)
                    WHERE ${data ? "DTINI_OS" : "CODTRF_OS"} = ? 
                        AND CODREC_OS = ?
                    `,
                    [data ? data : tarefa, recurso],
                    async (err: any, result: any) => {
                        if (err) {
                            db?.detach();
                            return reject(err);
                        }

                        if (!result.length) {
                            db?.detach();
                            return resolve([]);
                        }

                        try {
                            await processBlobs(result, "OBS");

                            db?.detach();
                            resolve(result);
                        } catch (e) {
                            db?.detach();
                            reject(e);
                        }
                    }
                );
            });
        });
    }

    function details(chamado: string, recurso: string): Promise<ChamadoLimitType[]> {
        return new Promise((resolve, reject) => {
            getConnection( (err: any, db: any) => {
                if (err) return reject(err);

                db.query(
                    `
                    SELECT C.cod_chamado, O.cod_os, T.cod_tarefa, T.limmes_tarefa 
                    FROM CHAMADO C
                    JOIN OS O ON O.chamado_os = C.cod_chamado AND C.cod_chamado = ?
                    JOIN TAREFA T ON T.cod_tarefa = O.codtrf_os
                    WHERE O.cod_recurso = ?
                    `,
                    [chamado, recurso],
                    (err: any, result: any) => {
                        db?.detach();
                        if (err) return reject(err);
                        resolve(result);
                    }
                );
            });
        });
    }

    async function insert(codChamado: string): Promise<any> {
        let db: any = null;
        try {
            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) return reject(err);
                    resolve(db);
                });
            });

            const newID: number = await new Promise((resolve, reject) => {
                db.query(`SELECT MAX(COD_HISTCHAMADO) + 1 as ID FROM HISTCHAMADO`, [], (err: any, res: any) => {
                    if (err) return reject(err);
                    resolve(res[0]["ID"]);
                });
            });

            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) return reject(err);
                    resolve(transaction);
                });
            });

            await new Promise((resolve, reject) => {
                transaction.query(
                    `UPDATE CHAMADO SET STATUS_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
                    [STATUS_CHAMADO["EM ATENDIMENTO"], codChamado, STATUS_CHAMADO.FINALIZADO],
                    (err: any) => {
                        if (err) {
                            transaction.rollback();
                            return reject(err);
                        }
                        resolve(true);
                    }
                );
            });

            await new Promise((resolve, reject) => {
                transaction.query(
                    `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
                    [
                        newID,
                        codChamado,
                        new Date()
                            .toLocaleString("pt-br", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                            .replaceAll("/", ".")
                            .replaceAll(",", ""),
                        new Date().toLocaleString("pt-br", { hour: "2-digit", minute: "2-digit" }).replaceAll(":", ""),
                        STATUS_CHAMADO["EM ATENDIMENTO"],
                    ],
                    (err: any) => {
                        if (err) {
                            transaction.rollback();
                            return reject(err);
                        }
                        resolve(true);
                    }
                );
            });

            await new Promise((resolve, reject) => {
                transaction.commit((err: any) => {
                    if (err) {
                        transaction.rollback();
                        return reject(err);
                    }
                    resolve(true);
                });
            });

            db?.detach();
            return true;
        } catch (err) {
            if (db) db?.detach();
            throw err;
        }
    }

    return {
        list,
        listOsTarefa,
        details,
        insert,
    };
})();
