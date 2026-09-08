import { ChamadosType } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import { decodeBlobText } from "../encoding";
import iconv from 'iconv-lite'
export default async function SuportCallService(recurso: string): Promise<ChamadosType[]> {
    

    return new Promise((resolve, reject) => {

        getConnection( function (err: any, db: any) {

            if (err) {
                return reject(err)
            }

            // db = DATABASE
            db.query(`
                SELECT
                    COD_CHAMADO,
                    ASSUNTO_CHAMADO,
                    COD_CLASSIFICACAO,
                    DTENVIO_CHAMADO,
                    HORA_CHAMADO,
                    STATUS_CHAMADO,
                    CODTRF_CHAMADO,
                    COD_RECURSO,
                    SOLICITACAO_CHAMADO,    -- BLOB TEXT
                    CLIENTE.ACESSO_CLIENTE, -- BLOB TEXT
                FROM 
                    CHAMADO 
                INNER JOIN CLIENTE ON CLIENTE.COD_CLIENTE = CHAMADO.cod_cliente
                        WHERE 
                    COD_RECURSO = ? 
                        AND 
                    STATUS_CHAMADO <> ?`,
                [recurso, 'FINALIZADO'], async function (err: any, result: any) {

                    
                    if (err) {
                        return reject(err)
                    }
                    
            // Função auxiliar para ler BLOB TEXT
          const readBlob = (blobFn: any): Promise<string> => {
            return new Promise((resolveBlob, rejectBlob) => {
              if (!blobFn || typeof blobFn !== "function") return resolveBlob("");

              blobFn((err: any, name: any, eventEmitter: any) => {
                if (err) return rejectBlob(err);
                if (!eventEmitter) return resolveBlob("");

                const chunks: Buffer[] = [];
                eventEmitter.on("data", (chunk: Buffer) => {
                  chunks.push(chunk);
                });
                eventEmitter.on("end", () => resolveBlob(decodeBlobText(Buffer.concat(chunks))));
                eventEmitter.on("error", rejectBlob);
              });
            });
          };

          try {
            // ⚡ Lê todos os BLOBs em paralelo
            await Promise.all(
              result.map(async (row: any) => {

                const blobs: Promise<void>[] = [];

                if (typeof row.SOLICITACAO_CHAMADO === "function") {
                  blobs.push(
                    readBlob(row.SOLICITACAO_CHAMADO).then((text) => {
                      row.SOLICITACAO_CHAMADO = text;
                    })
                  );
                }

                if (typeof row.ACESSO_CLIENTE === "function") {
                  blobs.push(
                    readBlob(row.ACESSO_CLIENTE).then((text) => {
                      row.ACESSO_CLIENTE = text;
                    })
                  );
                }

                await Promise.all(blobs); // aguarda os BLOBs dessa linha
              })
            );

            db?.detach();
            return resolve(result as ChamadosType[]);
          } catch (e) {
            db?.detach();
            return reject(e);
          }
        });

        });
    })



}