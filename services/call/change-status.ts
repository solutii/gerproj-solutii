import { ChamadosType, STATUS_CHAMADO } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import { sendEmail } from "../email/email";

export default async function ChangeStatusService(codChamado: string, status: string, email = ""): Promise<boolean> {


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


            let { DATA, HORA }: any = await new Promise((resolve, reject) => {

                db.query(`SELECT MAX(DTINI_OS) AS DATA, MAX(HRFIM_OS) AS HORA FROM OS WHERE CHAMADO_OS = ?`, [codChamado],
                    async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res[0]);
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

            if (DATA && HORA) {
                DATA = new Date(DATA).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-').replaceAll(',', '')
                HORA = HORA.substring(0, 2) + ':' + HORA.substring(2, 4)
            } else {
                DATA = new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-').replaceAll(',', '')
                HORA = new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' })
            }

            let conclusaoChamado = new Date(DATA + ' ' + HORA).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replace('T', '')

            await new Promise((resolve, reject) => {

                transaction.query(`
                        UPDATE CHAMADO SET STATUS_CHAMADO = ?, CONCLUSAO_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
                    [status, conclusaoChamado, codChamado, STATUS_CHAMADO.FINALIZADO], async function (err: any, result: any) {
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
                        status
                    ], async function (err: any, result: any) {

                        if (err) {
                            console.log(err)
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

                    if (status === STATUS_CHAMADO["AGUARDANDO VALIDACAO"]) {
                        sendEmail(email, 'Validação de Atendimento | Solutii', {
                            numero: codChamado
                        } as any)
                    }

                    return resolve(true)
                }

            });


        } catch (err) {
            console.log('error: ' ,err)
            db?.detach();
            return reject(err)
        }

    })
}