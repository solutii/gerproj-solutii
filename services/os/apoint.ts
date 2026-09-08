import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import iconv from "iconv-lite"

export default async function ApointService(
    os: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    recurso: string,
    task: any): Promise<boolean> {

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

            let newID: number = await new Promise((resolve, reject) => {

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

            /* let success = await new Promise((resolve, reject) => {

                transaction.query(`
                        UPDATE OS SET STATUS_CHAMADO = ? WHERE COD_CHAMADO = ?`,
                    [state, os.COD_CHAMADO], async function (err: any, result: any) {
                        if (err) {
                            db?.detach()
                            transaction.rollback();
                            return reject(err)
                        }

                        return resolve(true)
                    });

            }) */


            /* success = await new Promise((resolve, reject) => {
                transaction.query(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
                    [
                        newID,
                        os.COD_CHAMADO,
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' }).replaceAll(':', ''),
                        state
                    ], async function (err: any, result: any) {

                        if (err) {
                            transaction.rollback();
                            db?.detach()
                            return reject(err)
                        }

                        return resolve(true)

                        
                    });
            }) */

            let NUM_OS_MATER: any = await new Promise<[number, number|string]>((resolve, reject) => {

                db.query(`SELECT Max(OS.num_os) as num_os FROM
                            OS
                                INNER JOIN
                            TAREFA  on TAREFA.cod_tarefa = OS.codtrf_os

                            WHERE
                            TAREFA.cod_tarefa = ?
                            and OS.codrec_os = ?`,
                    [   os.COD_TAREFA
                        ,recurso

                    ], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })

            let [COD_OS, NUM_OS] = await new Promise<[number, number|string]>((resolve, reject) => {

                db.query(`SELECT MAX(COD_OS) + 1 as COD_OS, MAX(NUM_OS) as NUM_OS FROM OS`,
                    [], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve([res[0]['COD_OS'], res[0]['NUM_OS']])
                    })
            })
            
            NUM_OS = `000${String( parseInt(NUM_OS as string)+1)}`.slice(-6)

            if(!!NUM_OS_MATER[0]['NUM_OS']) {
                NUM_OS = NUM_OS_MATER[0]['NUM_OS']
            }
            
            let success = await new Promise((resolve, reject) => {
                transaction.query(
                `insert into OS (
                    COD_OS,
                    CODTRF_OS,
                    DTINI_OS,
                    HRINI_OS,
                    HRFIM_OS,
                    OBS_OS,
                    STATUS_OS,
                    PRODUTIVO_OS,
                    CODREC_OS,
                    PRODUTIVO2_OS,
                    RESPCLI_OS,
                    OBS,
                    REMDES_OS,
                    ABONO_OS,
                    DTINC_OS,
                    FATURADO_OS,
                    PERC_OS,
                    VALID_OS,
                    NUM_OS,
                    VRHR_OS,
                    COMP_OS
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        COD_OS,
                        os.COD_TAREFA,
                        new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        startTime.replace(":", ""),
                        endTime.replace(":", ""),
                        os.NOME_TAREFA,
                        STATUS_CHAMADO_COD['STANDBY'],
                        'SIM',  //PRODUTIVO_OS
                        recurso,
                        'SIM',  //PRODUTIVO2_OS
                        os.RESPCLI_PROJETO, //RESPCLI_OS
                        iconv.encode( description, 'WIN1252'),
                        'NAO',
                        'NAO',
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        os.FATURA_TAREFA,  //FATURADO_OS
                        100, //PERC_OS
                        'SIM', //VALID_OS
                        NUM_OS,
                        0,
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit'})
                    ], async function (err: any, result: any) {

                        if (err) {
                            console.log(10,err)
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

            success = await transaction.commit((err: Error) => {
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