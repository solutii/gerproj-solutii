import { ChamadosType, STATUS_CHAMADO } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function ApointeService(
    codChamado: string,
    data: string,
    horaIni: string,
    horaFim: string,
    state: string): Promise<boolean> {


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
                        UPDATE CHAMADO SET STATUS_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
                    [state, codChamado, state], async function (err: any, result: any) {
                        if (err) {
                            db?.detach()
                            transaction.rollback();
                            return reject(err)
                        }

                        return resolve(true)
                    });

            })

            await new Promise((resolve, reject) => {
                transaction.query(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?)`,
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

            await new Promise((resolve, reject) => {
                transaction.query(`INSERT INTO OS 
                    (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
                    [
                        newID,
                        codChamado,
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
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

            /**
             * COD_OS, CODTRF_OS, DTINI_OS, HRINI_OS, HRFIM_OS, STATUS (1 - LEVANTAMENTO, 2 - DESENVOLVIMENTO, 3 - TESTE, 4 - CONCLUIDO), ?, PRODUTIVO_OS ('SIM'), CODREC_OS, PRODUTIVO2_OS ('SIM'), RESPCLI_OS, REMDES_OS ('NAO'), ABONO_OS ('NAO'), DESLOC_OS (0000), OBS (BLOB), DTINC_OS (DATA DE INCLUSAO), FATURADO_OS, PERC_OS (100), COMP_OS (MES VIGENTE), VALID_OS, VRHR_OS, NUM_OS, CHAMADO_OS
             */

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