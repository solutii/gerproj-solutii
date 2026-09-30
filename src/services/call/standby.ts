import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/types/chamados";
import { Firebird, getConnection } from "../firebird";
import { sendEmail } from "../email/email";
import iconv from "iconv-lite"
import { ErroDeRegra } from "../erro-regra"
import ValidHoursService from "./valid-hours"
import { estourouLimiteHoras } from "@/utils/limite-horas"
import { validarApontamento, validarPosseChamado } from "./../os/regras-apontamento"

export default async function UpdateCallService(
    chamado: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    state: any,
    task: any,
    recurso: number): Promise<boolean> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            // O chamado precisa ser do consultor logado e o apontamento passa pelas
            // regras (descrição mínima, intervalo, horário no futuro, período vigente
            // e conflito de horário). `recurso` vem da sessão, não da tela.
            await validarPosseChamado(recurso, chamado.COD_CHAMADO)
            await validarApontamento({ recurso, date, startTime, endTime, description })
            chamado = { ...chamado, COD_RECURSO: recurso }

            // Limite mensal de horas da tarefa: a tela já bloqueia, mas a regra também
            // vale aqui pra não ser contornada chamando a API direto. Roda antes de
            // abrir a conexão deste serviço (o ValidHoursService abre a própria).
            const horasValidas = await ValidHoursService(chamado.COD_CHAMADO, date, startTime, endTime)

            if (estourouLimiteHoras(horasValidas, { ignorarLimiteZero: true })) {
                return reject(new ErroDeRegra(`Horas para esta tarefa já ultrapassaram o limite do mês, total final após apontamento: ${horasValidas[1] / 60}h. ENTRE EM CONTATO COM A SOLUTII!`))
            }

            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

            // IMPORTANTE: execute TODAS as leituras (db.query / auto-commit) ANTES de
            // abrir a transação que faz o UPDATE no CHAMADO. Caso contrário, a leitura
            // abaixo (que faz JOIN no CHAMADO) tenta ler a linha que o UPDATE travou,
            // e como o ISOLATION_READ_COMMITTED do node-firebird usa no_rec_version+wait,
            // ela espera o commit que nunca acontece -> deadlock (335544336).

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

            let NUM_OS_MATER: any = await new Promise<[number, number|string]>((resolve, reject) => {

                db.query(`SELECT Max(OS.num_os) as num_os FROM
                            OS
                                INNER JOIN
                            CHAMADO on CHAMADO.cod_chamado = CAST(OS.chamado_os as integer )
                                INNER JOIN
                            TAREFA  on TAREFA.cod_tarefa = OS.codtrf_os

                            WHERE
                            CHAMADO.cod_chamado = ?
                            and TAREFA.cod_tarefa = ?
                            and OS.codrec_os = ?`,
                    [   chamado.COD_CHAMADO
                        ,chamado.CODTRF_CHAMADO??task[0].COD_TAREFA
                        ,chamado.COD_RECURSO

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

            console.log('num os manter', NUM_OS_MATER)

            if(!!NUM_OS_MATER[0]['NUM_OS']) {
                NUM_OS = NUM_OS_MATER[0]['NUM_OS']
            }

            // A partir daqui só rodam statements DENTRO da transação (sem db.query).
            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) {
                        db?.detach()
                        return reject(err)
                    }
                    return resolve(transaction)
                })
            })

            // Chamado FINALIZADO não pode ser reaberto por aqui (nem receber OS nova):
            // as demais trocas de status já têm essa proteção no UPDATE.
            const statusAtual: string | null = await new Promise((resolve, reject) => {
                transaction.query(`SELECT STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`,
                    [chamado.COD_CHAMADO], function (err: any, res: any) {
                        if (err) {
                            transaction.rollback();
                            db?.detach()
                            return reject(err)
                        }
                        return resolve(res?.[0]?.STATUS_CHAMADO ?? null)
                    })
            })

            if (typeof statusAtual === 'string' && statusAtual.trim().toUpperCase() === 'FINALIZADO') {
                transaction.rollback();
                db?.detach()
                return reject(new ErroDeRegra('Chamado já finalizado: não é possível alterar o status.'))
            }

            let success = await new Promise((resolve, reject) => {

                transaction.query(`
                        UPDATE CHAMADO SET STATUS_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> 'FINALIZADO'`,
                    [state, chamado.COD_CHAMADO], async function (err: any, result: any) {
                        if (err) {
                            db?.detach()
                            transaction.rollback();
                            return reject(err)
                        }

                        return resolve(true)
                    });

            })


            success = await new Promise((resolve, reject) => {
                transaction.query(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
                    [
                        newID,
                        chamado.COD_CHAMADO,
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit'}).replaceAll('/', '.').replaceAll(',', ''),
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
            })

            success = await new Promise((resolve, reject) => {
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
                    CHAMADO_OS,
                    VRHR_OS,
                    COMP_OS
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        COD_OS,
                        chamado.CODTRF_CHAMADO??task[0].COD_TAREFA,
                        new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        startTime.replace(":", ""),
                        endTime.replace(":", ""),
                        chamado.ASSUNTO_CHAMADO,
                        STATUS_CHAMADO_COD['STANDBY'],
                        'SIM',  //PRODUTIVO_OS
                        chamado.COD_RECURSO,
                        'SIM',  //PRODUTIVO2_OS
                        task[0].RESPCLI_PROJETO, //RESPCLI_OS
                        iconv.encode( description, 'WIN1252'),
                        'NAO',
                        'NAO',
                        new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        'SIM',  //FATURADO_OS
                        100, //PERC_OS
                        'SIM', //VALID_OS
                        NUM_OS,
                        chamado.COD_CHAMADO,
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

            success = await transaction.commit((err: Error) => {

                if (err) {
                    transaction.rollback();
                    return reject(err)
                }
                else {
                    db?.detach();

                    if (state === STATUS_CHAMADO["AGUARDANDO VALIDACAO"]) {
                        sendEmail(chamado.EMAIL_CHAMADO, 'Validação de Atendimento | Solutii', {
                            numero: chamado.COD_CHAMADO
                        } as any)
                    }

                    return resolve(true)
                }

            });


        } catch (err) {
            db?.detach();
            return reject(err)
        }
    })
}