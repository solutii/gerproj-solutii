import { Firebird, getConnection } from "../firebird";

export class MacExistsError extends Error {
    constructor() {
        super('MAC já cadastrado');
        this.name = 'MacExistsError';
    }
}

function formatDate(date: Date): string {
    return date
        .toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replaceAll('/', '.')
        .replaceAll(',', '');
}

export async function InsertSaveService(mac: string, cnpj?: string, nome?: string): Promise<boolean> {

    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

            const exists: boolean = await new Promise((resolve, reject) => {
                db.query(
                    `SELECT MAC FROM SAVE WHERE MAC = ?`,
                    [mac], (err: any, result: any) => {
                        if (err) {
                            db?.detach()
                            return reject(err)
                        }
                        return resolve(result.length > 0)
                    })
            })

            if (exists) {
                db?.detach()
                return reject(new MacExistsError())
            }

            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) {
                        db?.detach()
                        return reject(err)
                    }
                    return resolve(transaction)
                })
            })

            await new Promise((resolve, reject) => {
                transaction.query(
                    `INSERT INTO SAVE (MAC, CNPJ, NOME, LIBERADO, DATA_CADASTRO) VALUES (?, ?, ?, 0, ?)`,
                    [
                        mac,
                        cnpj ?? null,
                        nome ?? null,
                        formatDate(new Date())
                    ], async function (err: any, result: any) {

                        if (err) {
                            transaction.rollback();
                            db?.detach()
                            return reject(err)
                        }

                        return resolve(true)
                    });
            })

            transaction.commit((err: Error) => {
                if (err) {
                    transaction.rollback();
                    return reject(err)
                }
                else {
                    db?.detach();
                    return resolve(true)
                }
            });

        } catch (err) {
            db?.detach();
            return reject(err)
        }
    })
}

export async function GetSaveService(mac: string): Promise<{ LIBERADO: boolean, PRODUCAO?: string, HOMOLOGACAO?: string } | null> {

    return new Promise((resolve, reject) => {

        getConnection( (err: any, db: any) => {
            if (err) return reject(err);

            db.query(
                `SELECT LIBERADO, PRODUCAO, HOMOLOGACAO FROM SAVE WHERE MAC = ?`,
                [mac],
                (err: any, result: any) => {
                    if (err) {
                        db?.detach();
                        return reject(err);
                    }

                    if (!result.length) {
                        db?.detach();
                        return resolve(null);
                    }

                    const row = result[0];
                    db?.detach();

                    if (row['LIBERADO'] != 1) {
                        return resolve({ LIBERADO: false });
                    }

                    return resolve({
                        LIBERADO: true,
                        PRODUCAO: row['PRODUCAO'],
                        HOMOLOGACAO: row['HOMOLOGACAO']
                    });
                }
            );
        });
    })
}
