import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function ValidLimitDate(
    recurso: string
    ): Promise<boolean> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            getConnection( function (err: any, db: any) {

                if (err) {
                    return reject(err)
                }

                // db = DATABASE
                db.query(`
                    SELECT
                    DTLIMITE_RECURSO,
                    PERMAPO_RECURSO
                        FROM RECURSO
                        
                    where 
                     
                        COD_RECURSO = ? `,
                    [recurso], async function (err: any, result: any) {

                       
                        if (err) {
                            console.log(err)
                            db?.detach();
                            return reject(err)
                        }

                        // Fechar a conexão com o banco de dados
                        db?.detach();
                        return resolve(result)
                        // IMPORTANT: close the connection

                    });

            });

        } catch (err) {
            console.log(err)
            db?.detach();
            return reject(err)
        }
    })
}