import { ChamadosType, STATUS_CHAMADO } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function StartCallService(codChamado: string): Promise<boolean> {


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

            const newID: number = await new Promise((resolve, reject) => {

                db.query(`SELECT MAX(COD_HISTCHAMADO) + 1 as ID FROM HISTCHAMADO`,
                    [], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res[0]['ID'])
                    })
            })

            const chamado = await new Promise<ChamadosType>((resolve, reject) => {
                db.query(`SELECT * FROM CHAMADO WHERE COD_CHAMADO = ?`,
                    [codChamado], async function (err: any, res: ChamadosType[]) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res[0])
                    })
            })


            let dataIniChamado = chamado['DTINI_CHAMADO']??'';
            if (dataIniChamado == '' || dataIniChamado == null) {
                dataIniChamado = new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replaceAll('/', '.').replaceAll(',', '');
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

                transaction.query(`
                        UPDATE CHAMADO SET STATUS_CHAMADO = ? , DTINI_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
                    [STATUS_CHAMADO["EM ATENDIMENTO"], dataIniChamado, codChamado, STATUS_CHAMADO.FINALIZADO], async function (err: any, result: any) {
                        if (err) {
                            db?.detach()
                            transaction.rollback();
                            return reject(err)
                        }

                        return resolve(true)
                    });

            })

            await new Promise((resolve, reject) => {
                transaction.query(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
                    [
                        newID,
                        codChamado,
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' }).replaceAll(':', ''),
                        STATUS_CHAMADO["EM ATENDIMENTO"]
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