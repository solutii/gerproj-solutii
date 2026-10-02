// Texto do botão de ajuda ("?") de cada card do dashboard: para que serve, o que mostra e
// como ler. Quando uma regra do card mudar, mude aqui também (há teste que confere as
// frases-chave de cada um).

export type Ajuda = {
  titulo: string;
  paraQueServe: string;
  oQueMostra: string[];
  comoLer: string[];
};

export const AJUDAS = {
  visaoGeral: {
    titulo: "Visão geral",
    paraQueServe: "Responder, de relance, como está o mês do time inteiro: quanto já foi apontado, como estão os chamados e quantas tarefas pedem atenção.",
    oQueMostra: [
      "Horas apontadas: a soma das horas de todos os consultores ativos (administradores não entram) no mês escolhido, contra a meta do mês.",
      "Mês anterior: a mesma soma no mês passado, com a variação em % (seta verde = mais horas; seta vermelha = menos horas).",
      "Chamados abertos (e quantos estão parados há mais de 7 dias) e chamados finalizados no mês.",
      "Quantos consultores têm pelo menos um dia útil já passado sem nenhuma OS.",
      "Tarefas em risco (80% ou mais do limite mensal) e tarefas com estouro liberado.",
    ],
    comoLer: [
      "A meta é a jornada diária de cada consultor × os dias úteis do mês (segunda a sexta, sem feriados nacionais). É a meta do mês INTEIRO: no começo do mês o percentual é baixo, e isso é normal.",
      "Num mês em andamento a comparação é com o mês anterior até o MESMO ponto (mesmo número de dias úteis), para ser justa. Num mês fechado, compara mês inteiro com mês inteiro.",
      "Os números são calculados no servidor e se atualizam sozinhos a cada 5 minutos (veja o selo no topo da página).",
    ],
  },

  comparativo: {
    titulo: "Comparativo de consultores",
    paraQueServe: "Comparar os consultores entre si: quem está acima ou abaixo da meta, quem aponta com regularidade e como cada um está nos chamados.",
    oQueMostra: [
      "Horas / meta: as horas apontadas no mês e a meta do consultor (jornada × dias úteis).",
      "% da meta e a barra: quanto da meta do mês já foi cumprido.",
      "Mês anterior: a variação das horas contra o mesmo ponto do mês passado.",
      "Dias com jornada: os dias úteis já passados em que ele bateu a jornada diária (e quantos ficaram sem nenhuma OS).",
      "Chamados: quantos atendeu no mês (teve OS neles) e quantos tem abertos hoje.",
      "SLA no prazo: o % dos chamados finalizados no mês dentro do prazo (entre parênteses, no prazo / total com SLA).",
      "Lançados atrasados: OS lançadas mais de 1 dia útil depois do dia trabalhado.",
    ],
    comoLer: [
      "Clique no nome para abrir o painel completo do consultor (só para consulta).",
      "Clique no cabeçalho para ordenar: o 1º clique é crescente, o 2º decrescente e o 3º volta à ordem padrão (maior % da meta primeiro).",
      "O card abre com 10 linhas; use 'Ver todas' para ver todos os consultores.",
    ],
  },

  tarefasPertoDoLimite: {
    titulo: "Tarefas perto do limite",
    paraQueServe: "Avisar quando uma tarefa está chegando ao limite mensal de horas (ou já passou), situação em que o apontamento acima do limite seria recusado.",
    oQueMostra: [
      "Tarefas com limite mensal definido e SEM estouro liberado que já consumiram 80% ou mais do limite no mês.",
      "O consumo do mês, o limite e o % consumido: 'No limite' (de 80% a 99%) ou 'Estourada' (100% ou mais).",
      "O responsável e o cliente da tarefa.",
    ],
    comoLer: [
      "As mais urgentes vêm primeiro: as estouradas e, depois, as de maior %.",
      "O botão de editar abre o mesmo formulário da aba Tarefas: dá para liberar o estouro ou ajustar o limite na hora.",
      "Só entram tarefas que tiveram apontamento no mês escolhido.",
    ],
  },

  tarefasComEstouroLiberado: {
    titulo: "Tarefas com estouro liberado",
    paraQueServe: "Lembrar o administrador das tarefas que aceitam apontar acima do limite, para fechar a liberação quando ela não for mais necessária.",
    oQueMostra: [
      "Tarefas em andamento (levantamento, desenvolvimento ou teste) com 'Liberar estouro do limite' = Sim, e também as de outros status que tiveram apontamento no mês.",
      "O consumo do mês e, se houver limite mensal, o % já usado. Em vermelho: já passou do limite.",
      "O responsável e o cliente da tarefa.",
    ],
    comoLer: [
      "As que já passaram do limite vêm primeiro.",
      "Para fechar a liberação, use o botão de editar e mude 'Liberar estouro do limite' para Não.",
    ],
  },

  chamadosAbertos: {
    titulo: "Chamados abertos",
    paraQueServe: "Mostrar quantos chamados estão abertos agora e em que situação cada um está.",
    oQueMostra: [
      "A contagem dos chamados que ainda não foram finalizados, por situação: Atribuído, Em atendimento, StandBy e Aguardando validação.",
      "É a foto de HOJE: não muda com o mês escolhido.",
    ],
    comoLer: [
      "Muitos chamados em StandBy ou Aguardando validação costumam indicar que a equipe espera uma resposta do cliente.",
      "Os que estão sem movimento aparecem no card 'Chamados parados'.",
      "Clique num badge para abrir, aqui mesmo no card, a tabela dos chamados daquela situação (número, cliente, assunto e consultor). O badge clicado sai da fileira e vai para o cabeçalho da tabela; clique no X para fechar e ele volta ao lugar dele. Clicar em outro badge troca a lista.",
      "As situações aparecem sempre na mesma ordem: Não iniciado, Em atendimento, Atribuído, StandBy, Aguardando validação e Finalizado (só as que têm chamados).",
    ],
  },

  chamadosPorSemana: {
    titulo: "Chamados por semana",
    paraQueServe: "Ver se a equipe está dando conta do volume: quantos chamados chegam e quantos são concluídos a cada semana.",
    oQueMostra: [
      "As últimas 8 semanas (de segunda a domingo). Num mês passado, as 8 semanas até o fim dele.",
      "Abertos: chamados contados pela data do chamado. Concluídos: contados pela data da finalização no histórico (cada chamado conta uma vez).",
      "O 'Ver em tabela' traz os números exatos de cada semana.",
    ],
    comoLer: [
      "Várias semanas seguidas com menos concluídos do que abertos indicam uma fila crescendo.",
      "A semana corrente ainda está incompleta.",
    ],
  },

  chamadosParados: {
    titulo: "Chamados parados",
    paraQueServe: "Achar os chamados abertos que ninguém mexe há tempo, para o administrador cobrar ou redistribuir.",
    oQueMostra: [
      "Os chamados abertos sem apontamento nem movimento há mais de 7 dias. A última atividade é a mais recente entre a última OS, o início do atendimento e o envio do chamado.",
      "O número, o assunto, o cliente, o consultor responsável, a situação e os dias parado.",
      "O número no título é o total de chamados parados.",
    ],
    comoLer: [
      "O card abre com 10 linhas; 'Ver todas' mostra a lista completa, 25 por página (use ‹ e › para trocar de página).",
      "Clique no cabeçalho para ordenar: crescente, decrescente e, no 3º clique, a ordem padrão (o mais parado primeiro).",
      "É a foto de hoje: não muda com o mês escolhido.",
    ],
  },

  chamadosPorCliente: {
    titulo: "Chamados por cliente",
    paraQueServe: "Mostrar quais clientes mais abriram chamados no mês.",
    oQueMostra: [
      "Os chamados ABERTOS no mês escolhido (pela data do chamado), agrupados por cliente.",
      "Os 8 clientes com mais chamados; o restante soma em 'Outros'.",
    ],
    comoLer: [
      "Chamados sem cliente cadastrado aparecem como 'Sem cliente'.",
      "No começo do mês o card tem poucos dados: troque para o mês anterior para ver o quadro completo.",
    ],
  },

  chamadosPorArea: {
    titulo: "Chamados por área de atuação",
    paraQueServe: "Mostrar em quais áreas de atuação os chamados se concentram.",
    oQueMostra: [
      "Os chamados ABERTOS no mês escolhido (pela data do chamado), agrupados pela área de atuação.",
      "As 8 áreas com mais chamados; o restante soma em 'Outros'.",
    ],
    comoLer: [
      "Muitos chamados não têm área cadastrada: eles ficam em 'Sem área'.",
      "No começo do mês o card tem poucos dados: troque para o mês anterior.",
    ],
  },

  diasSemApontamento: {
    titulo: "Dias úteis sem apontamento",
    paraQueServe: "Identificar quem esqueceu de apontar e em quais dias.",
    oQueMostra: [
      "Para cada consultor ativo, os dias úteis já passados do mês (segunda a sexta, sem feriados nacionais) em que não há nenhuma OS lançada.",
      "Uma linha por consultor, com o total de dias e todas as datas.",
    ],
    comoLer: [
      "O dia de hoje não conta, porque ainda dá tempo de apontar.",
      "Clique no nome para abrir o painel completo do consultor.",
      "O card abre com 10 consultores; 'Ver todas' mostra todos.",
    ],
  },

  permissaoAntiga: {
    titulo: "Permissão de apontar no passado a rever",
    paraQueServe: "Lembrar de rever liberações de 'apontar no passado' que ficaram abertas por tempo demais.",
    oQueMostra: [
      "Os consultores com 'Apontar no passado' = Sim e data-limite anterior ao início do mês passado (ou sem data-limite).",
      "A data-limite e há quantos dias ela ficou para trás.",
    ],
    comoLer: [
      "Com a liberação, o consultor pode apontar desde a data-limite até hoje: quanto mais antiga a data, mais para trás ele consegue mexer.",
      "A data-limite costuma ser renovada todo dia 1º, então a de até um mês atrás é normal e não aparece aqui.",
      "Para mudar a permissão ou a data, use a aba Consultores.",
    ],
  },

  lancamentosAtrasados: {
    titulo: "Lançamentos atrasados",
    paraQueServe: "Mostrar quem costuma lançar as OS bem depois do dia em que o trabalho foi feito.",
    oQueMostra: [
      "As OS do mês lançadas mais de 1 dia útil depois do dia trabalhado, por consultor: quantas atrasaram, o total de OS e o %.",
      "As OS sem data de lançamento registrada ficam fora da conta.",
    ],
    comoLer: [
      "Sexta trabalhada e lançada na segunda NÃO conta como atraso (é só 1 dia útil).",
      "Clique no nome para abrir o painel completo do consultor.",
    ],
  },
} satisfies Record<string, Ajuda>;

// Cards do painel de detalhe de um consultor (o Meu Painel dele, visto pelo administrador).
export const AJUDAS_DO_DETALHE = {
  mesDoConsultor: {
    titulo: "Mês do consultor",
    paraQueServe: "Mostrar como está o mês deste consultor contra a meta dele.",
    oQueMostra: [
      "As horas apontadas no mês escolhido e a meta do consultor (jornada diária × dias úteis do mês, de segunda a sexta, sem feriados nacionais).",
      "O % da meta já cumprido, na barra.",
      "No mês em andamento: quanto ele está à frente, ou quanto falta, em relação à meta até hoje.",
      "Todos os dias úteis já passados do mês em que não há nenhuma OS.",
    ],
    comoLer: [
      "É o mesmo painel que o consultor vê no Meu Painel, mas aqui é só para consulta: nada pode ser alterado.",
      "A meta é a do mês INTEIRO: no começo do mês o percentual é baixo, e isso é normal.",
      "Use o seletor de mês, no alto, para ver os meses anteriores.",
    ],
  },

  comparacao: {
    titulo: "Comparado ao mês anterior",
    paraQueServe: "Ver se o consultor está melhor ou pior do que no mês passado.",
    oQueMostra: [
      "Horas, OS lançadas e SLA no prazo do mês escolhido, cada um com o valor do mês anterior ('antes') e a variação.",
      "Seta verde para cima: melhorou. Seta vermelha para baixo: piorou. 'sem base': o mês anterior não tinha dados para comparar.",
    ],
    comoLer: [
      "Num mês em andamento a comparação é feita até o mesmo dia útil do mês anterior (para ser justa). Num mês fechado, é mês inteiro contra mês inteiro.",
      "O SLA varia em pontos percentuais, e não em %.",
    ],
  },

  horasPorDia: {
    titulo: "Horas por dia",
    paraQueServe: "Mostrar a regularidade dos apontamentos do consultor ao longo do mês.",
    oQueMostra: [
      "Uma barra por dia do mês, com as horas apontadas.",
      "Verde: o dia bateu a jornada do consultor. Âmbar: ficou abaixo (inclui dias sem OS e fins de semana).",
      "A linha tracejada é a jornada diária.",
    ],
    comoLer: [
      "Passe o mouse numa barra para ver as horas daquele dia.",
      "O 'Ver em tabela' traz os mesmos números em texto.",
    ],
  },

  sla: {
    titulo: "SLA dos chamados",
    paraQueServe: "Mostrar se os chamados do consultor são finalizados dentro do prazo (SLA) combinado.",
    oQueMostra: [
      "O % de chamados finalizados no mês dentro do SLA da tarefa, e quantos ficaram dentro e fora do prazo.",
      "O tempo médio do envio do chamado até a finalização, em horas úteis.",
    ],
    comoLer: [
      "Horas úteis são das 8h às 18h, de segunda a sexta, sem feriados nacionais.",
      "Chamado cuja tarefa não tem SLA definido não entra na conta.",
      "Verde: 80% ou mais no prazo. Âmbar: abaixo de 80%.",
    ],
  },

  faturamento: {
    titulo: "Faturamento das horas",
    paraQueServe: "Mostrar quanto das horas apontadas pelo consultor é faturável.",
    oQueMostra: [
      "O % das horas do mês que são faturáveis, com a barra.",
      "As horas faturáveis, as não faturáveis e as que já foram faturadas.",
    ],
    comoLer: [
      "Conta as OS lançadas no mês escolhido.",
      "'Já faturadas' são as horas cujas OS já entraram em um faturamento.",
    ],
  },

  avaliacoes: {
    titulo: "Avaliações dos clientes",
    paraQueServe: "Mostrar o que os clientes acham do atendimento do consultor.",
    oQueMostra: [
      "A nota média (de 1 a 5, em estrelas) e quantas avaliações existem.",
      "As últimas avaliações, com o número do chamado, a nota e o comentário do cliente.",
    ],
    comoLer: [
      "Considera todos os chamados avaliados do consultor, e não só os do mês escolhido.",
      "Chamado que o cliente não avaliou não entra na média.",
    ],
  },

  chamados: {
    titulo: "Chamados abertos do consultor",
    paraQueServe: "Ver a carga de chamados em aberto do consultor e quais são os mais antigos.",
    oQueMostra: [
      "A quantidade de chamados abertos do consultor, por situação.",
      "Os chamados abertos mais antigos, com o número, o assunto, o cliente e há quantos dias estão abertos.",
      "Quantos estão parados há mais de 7 dias.",
    ],
    comoLer: [
      "É a foto de hoje: não muda com o mês escolhido.",
      "Chamado parado é o que está sem apontamento nem movimento há mais de 7 dias.",
    ],
  },

  tarefas: {
    titulo: "Tarefas em andamento",
    paraQueServe: "Acompanhar as tarefas do consultor: quanto já foi lançado contra o estimado e como está o prazo.",
    oQueMostra: [
      "As tarefas em andamento do consultor (levantamento, desenvolvimento e teste).",
      "As horas lançadas na tarefa por todos os consultores, desde o início, contra as horas estimadas, com o %.",
      "O prazo: quantos dias faltam, ou há quantos dias venceu.",
    ],
    comoLer: [
      "Tarefa sem estimativa mostra só as horas lançadas.",
      "Aparecem as 8 primeiras, com as de maior % das horas estimadas na frente.",
    ],
  },

  evolucao: {
    titulo: "Evolução",
    paraQueServe: "Mostrar a tendência das horas do consultor nos últimos meses.",
    oQueMostra: [
      "Uma barra por mês, nos últimos 6 meses, com as horas apontadas (o mês escolhido em destaque).",
      "Um ponto por mês com a meta daquele mês (jornada × dias úteis).",
    ],
    comoLer: [
      "Barra acima do ponto: o consultor bateu a meta daquele mês.",
      "O 'Ver em tabela' traz os números exatos.",
    ],
  },

  horasPorCliente: {
    titulo: "Horas por cliente",
    paraQueServe: "Mostrar para quais clientes o consultor dedicou mais horas no mês.",
    oQueMostra: [
      "As horas apontadas no mês escolhido, agrupadas pelo cliente da tarefa.",
      "Os 8 clientes com mais horas; o restante soma em 'Outros'.",
    ],
    comoLer: [
      "OS sem cliente aparecem como 'Sem cliente'.",
      "O 'Ver em tabela' traz os números exatos.",
    ],
  },

  horasPorTarefa: {
    titulo: "Horas por tarefa",
    paraQueServe: "Mostrar em quais tarefas o consultor gastou mais horas no mês.",
    oQueMostra: [
      "As horas apontadas no mês escolhido, agrupadas por tarefa.",
      "As 8 tarefas com mais horas; o restante soma em 'Outros'.",
    ],
    comoLer: [
      "Tarefas com o mesmo nome ganham um número para diferenciar (por exemplo, 'Nome (2)').",
      "OS sem tarefa aparecem como 'Sem tarefa'.",
    ],
  },
} satisfies Record<string, Ajuda>;
