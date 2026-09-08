import nodemailer from 'nodemailer';
import { Firebird, getConnection } from "../firebird";

// Gera o link de validação sem login (token assinado, ver
// /api/gerar-link-validacao no dashboard). Se a chamada falhar por
// qualquer motivo, cai no link antigo (portal sem chamado pré-selecionado)
// em vez de travar o envio do e-mail.
async function gerarLinkValidacao(codChamado: string): Promise<string> {
    const urlBase = 'https://portal.solutii.com.br';
    const fallback = `${urlBase}/`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${urlBase}/api/gerar-link-validacao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Key': process.env.LINK_VALIDACAO_INTERNAL_KEY ?? '',
            },
            body: JSON.stringify({ codChamado: Number(codChamado) }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return fallback;

        const data = await res.json();
        return typeof data?.url === 'string' && data.url.trim() ? data.url : fallback;
    } catch {
        return fallback;
    }
}

export async function sendEmail(
    to: string,
    subject: string,
    chamado: {
        numero: string;
        data: string;
        hora: string;
        consultor: string;
        emailConsultor: string;
        assunto: string;
    }
): Promise<void> {


    let registroChamado: any = []
    let parametrosEmail: any = []


    await new Promise(async (resolve, reject) => {

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

           

            registroChamado = await new Promise((resolve, reject) => {

                db.query(`SELECT * FROM chamado
                    LEFT JOIN recurso on recurso.cod_recurso = chamado.cod_recurso
                    where cod_chamado =? `,
                    [chamado.numero], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })

            parametrosEmail = await new Promise((resolve, reject) => {

                db.query(`SELECT * from PARAMETROS `,
                    [chamado.numero], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })

            db?.detach();

            return resolve([])


        } catch (err) {
            db?.detach();
            return reject(err)
        }
    })


    let parametrosFormatados = {
        host: 'email-ssl.com.br', // CodParametro 2
        port: 465, //
        secure: true, 
        auth: {
            user: 'suporte@solutii.com.br', // Substitua pelo seu e-mail
            pass: 'Solutii@2025*', // Substitua pela sua senha
        },
    }

    parametrosEmail.map( (p: any) => {
        if(['2', '3', '4', '13'].includes(p.COD_PARAMETRO)) {
            switch(p.COD_PARAMETRO) {

                case '2':
                    parametrosFormatados.host = p.VALOR_PARAMETRO
                case '3':
                    parametrosFormatados.auth.user = p.VALOR_PARAMETRO
                case '4':
                    parametrosFormatados.auth.pass = p.VALOR_PARAMETRO
                case '13':
                    parametrosEmail.port = p.VALOR_PARAMETRO 
            }
        }
    })

    chamado.data            = registroChamado[0].DTENVIO_CHAMADO.substring(0,10)
    chamado.assunto         = registroChamado[0].ASSUNTO_CHAMADO
    chamado.consultor       = registroChamado[0].NOME_RECURSO
    chamado.emailConsultor  = registroChamado[0].EMAIL_RECURSO
    chamado.hora            = new Date().toLocaleString('pt-br').substring(12,17)
    chamado.numero          = registroChamado[0].COD_CHAMADO
    to = registroChamado[0].EMAIL_CHAMADO

    const linkValidacao = await gerarLinkValidacao(String(chamado.numero));

    // Configuração do transporte de e-mail
    const transporter = nodemailer.createTransport(parametrosFormatados);

    // Template de e-mail
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <title>Validação de Atendimento | Solutii</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            @media (max-width:620px){
                .container{width:100%!important}
                .content{padding:20px!important}
                .cta{display:block!important;width:100%!important;text-align:center!important}
                .grid td{display:block!important;width:100%!important}
            }
        </style>
    </head>
    <body style="margin:0;padding:0;background:#f4f6fa;">
        <div style="display:none;overflow:hidden;line-height:0;opacity:0;max-height:0;max-width:0;">
            Seu chamado aguarda validação. Por favor, realize os testes e confirme o encerramento.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fa;">
            <tr>
                <td align="center" style="padding:24px;">
                    <table class="container" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;box-shadow:0 6px 24px rgba(13,30,60,.08);overflow:hidden;">
                        <tr>
                            <td style="background:#0f3d63;padding:22px 24px;">
                                <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                    <tr>
                                        <td align="left">
                                            <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:18px;letter-spacing:.3px;color:#e6f1ff;font-weight:700;">
                                                Solutii <span style="font-weight:600;color:#9bd4ff;">Sistemas</span>
                                            </div>
                                            <div style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:12px;color:#cde6ff;margin-top:2px;">
                                                Notificação de validação · Suporte
                                            </div>
                                        </td>
                                        <td align="right">
                                            <a href="https://solutii.com.br/" target="_blank" style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:12px;color:#cde6ff;text-decoration:none;">solutii.com.br</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="content" style="padding:28px 32px 10px 32px;">
                                <h1 style="margin:0 0 8px 0;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:20px;color:#0f3d63;">
                                    CHAMADO AGUARDANDO VALIDAÇÃO
                                </h1>
                                <p style="margin:0;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;line-height:1.6;">
                                    Solicitamos que sejam realizados os testes necessários e que o consultor responsável seja informado quanto à validação da solução ou à necessidade de ajustes.
                                <br/>O prazo para validação é de até 2 (dois) dias úteis a partir do envio desta mensagem. 
                                <br/>Na ausência de manifestação dentro desse prazo, o chamado será considerado validado e finalizado automaticamente.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td class="content" style="padding:12px 32px 8px 32px;">
                                <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border:1px solid #e6edf6;border-radius:12px;">
                                    <tr>
                                        <td style="padding:16px 18px;">
                                            <table class="grid" width="100%" cellspacing="0" cellpadding="0" role="presentation">
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;width:40%;">Número</td>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;font-weight:600;">${chamado.numero}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;">Data</td>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;">${chamado.data}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;">Hora</td>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;">${chamado.hora}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;">Consultor</td>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;font-weight:600;">${chamado.consultor}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;">E-mail do Consultor</td>
                                                    <td><a href="mailto:${chamado.emailConsultor}" style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#0f3d63;text-decoration:none;">${chamado.emailConsultor}</a></td>
                                                </tr>
                                                <tr>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#6a7280;">Assunto</td>
                                                    <td style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#2a2e35;">${chamado.assunto}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="content" style="padding:12px 32px 22px 32px;">
                                <a href="${linkValidacao}" target="_blank"
                                    style="display:inline-block;padding:10px 16px;background:#0f3d63;color:#ffffff;text-decoration:none;border-radius:10px;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;margin-right:8px;">
                                    Confirmar validação
                                </a>
                                <a href="mailto:${chamado.emailConsultor}?subject=Chamado%20${chamado.numero}%20-%20Ajustes%20necess%C3%A1rios"
                                    style="display:inline-block;padding:10px 16px;background:#ffffff;color:#0f3d63;border:1px solid #0f3d63;text-decoration:none;border-radius:10px;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;">
                                    Solicitar ajustes ao consultor
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:16px 24px 26px 24px;">
                                <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-top:1px solid #e8eef5;">
                                    <tr>
                                        <td style="padding-top:12px;font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:12px;color:#6a7280;">
                                            <em>Esta é uma mensagem automática. Por favor, não responda este e-mail.</em><br>
                                            © Solutii Sistemas — 
                                            <a href="https://solutii.com.br/" target="_blank" style="color:#6a7280;text-decoration:none;">www.solutii.com.br</a>
                                        </td>
                                        <td align="right" style="padding-top:12px;">
                                            <a href="https://solutii.com.br/politica-de-privacidade/" target="_blank" style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:12px;color:#6a7280;text-decoration:none;">Política de Privacidade</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Configuração do e-mail
    const mailOptions = {
        from: '"Solutii Sistemas" <suporte@solutii.com.br>', // Substitua pelo seu e-mail
        to,
        subject,
        html,
    };

    // Envio do e-mail
    await transporter.sendMail(mailOptions);
}