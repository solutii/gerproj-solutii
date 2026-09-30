export type ChamadosType = {
    COD_CHAMADO: number
    DATA_CHAMADO: string
    HORA_CHAMADO: string
    SOLICITACAO_CHAMADO: any
    CONCLUSAO_CHAMADO: any
    STATUS_CHAMADO: StatusChamadoType
    DTENVIO_CHAMADO: string
    COD_RECURSO: number
    CLIENTE_CHAMADO: any
    CODTRF_CHAMADO: number
    COD_CLIENTE: number
    SOLICITACAO2_CHAMADO: any
    ASSUNTO_CHAMADO: string
    EMAIL_CHAMADO: string
    PRIOR_CHAMADO: number
    COD_CLASSIFICACAO: number
    NOME_CLIENTE: string
    SOLICITACAO_UTF8?: string
    ACESSO_CLIENTE?: string
    DTINI_CHAMADO?: string
}

export type ChamadoLimitType = {
    COD_CHAMADO: number
    COD_OS: number
    COD_TAREFA: number
    LIMMES_TAREFA: number
}

export type StatusChamadoType = 'ATRIBUIDO'|'STANDBY'|'AGUARDANDO VALIDACAO'|'FINALIZADO'|'EM ATENDIMENTO'


export enum STATUS_CHAMADO {
    'EM ATENDIMENTO' = 'EM ATENDIMENTO',
    'ATRIBUIDO' = 'ATRIBUIDO',
    'STANDBY' = 'STANDBY',
    'AGUARDANDO VALIDACAO' = 'AGUARDANDO VALIDACAO',
    'FINALIZADO' = 'FINALIZADO',
}

export enum STATUS_CHAMADO_COD {
    'EM ATENDIMENTO' = '2',
    'ATRIBUIDO' = '1',
    'STANDBY' = '3',
    'AGUARDANDO VALIDACAO' = '4',
    'FINALIZADO' = '5',
}