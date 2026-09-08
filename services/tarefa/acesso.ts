import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import iconv from "iconv-lite"

export default async function UpdateAcesso(
    descricao: string,
    cliente: any): Promise<boolean> {

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
   
            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) {
                        db?.detach()
                        return reject(err)
                    }
                    return resolve(transaction)
                })
            })
            
            let success = await new Promise((resolve, reject) => {
                transaction.query(
                `UPDATE CLIENTE
                    SET 
                    ACESSO_CLIENTE=?
                    WHERE
                    COD_CLIENTE=?     
                `,
                    [
                        iconv.encode( descricao, 'WIN1252'),
                        cliente,
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
                    console.log(8)
                    transaction.rollback();
                    return reject(err)
                }
                else {
                    console.log(9)
                    db?.detach();
                    return resolve(true)
                }

            });


        } catch (err) {
            console.log(10, err)
            db?.detach();
            return reject(err)
        }
    })
}