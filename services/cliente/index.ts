import { Firebird, getConnection } from "../firebird";
import { decodeBlobText } from "../encoding";

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

async function findClienteByName(nome: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        getConnection( (err: any, db: any) => {
            if (err) return reject(err);

            const q = `SELECT * FROM CLIENTE WHERE UPPER(NOME_CLIENTE) LIKE ? ORDER BY NOME_CLIENTE`;
            db.query(q, [`%${(nome || "").toUpperCase()}%`], async (err: any, result: any) => {
                if (err) {
                    db?.detach();
                    return reject(err);
                }

                if (!result || !result.length) {
                    db?.detach();
                    return resolve([]);
                }

                try {
                    // Converter BLOBs e campos texto codificados
                    await Promise.all(
                        result.map(async (row: any) => {
                            for (const key of Object.keys(row)) {
                                if (typeof row[key] === "function") {
                                    row[key] = await readBlob(row[key]);
                                } else if (typeof row[key] === "string") {
                                    row[key] = row[key]; // placeholder para conversões se necessário
                                }
                            }
                        })
                    );

                    db?.detach();
                    resolve(result);
                } catch (e) {
                    db?.detach();
                    reject(e);
                }
            });
        });
    });
}

export default findClienteByName;
