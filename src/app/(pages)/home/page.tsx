"use client";

import { ChangeEvent, FormEvent } from "react";
import DateInput from "@/components/date-input";
import { useSession, signOut } from "next-auth/react";
import { useHomeStore } from "@/stores/home-store";
import { useAlertStore } from "@/stores/alert-store";
import { estourouLimiteHoras } from "@/utils/limite-horas";
import { ApiError, mensagemDoErro } from "@/lib/api";
import { chaveRascunhoChamado, chaveRascunhoTarefa, descartarRascunho } from "@/utils/rascunho";
import {
  buscarTarefaDoApontamento,
  listarClassificacoes,
  listarTarefasParaChamado,
  validarHorasChamado,
  validarHorasTarefa,
} from "@/lib/api-home";
import {
  useChamados,
  usePeriodoApontamento,
  useTarefas,
} from "@/hooks/queries/leituras";
import {
  useAlterarStatusChamado,
  useAtualizarOs,
  useColocarEmStandby,
  useExcluirOs,
  useIniciarChamado,
  useRegistrarApontamento,
  useSalvarAcesso,
  useVincularClassificacao,
  useVincularTarefa,
} from "@/hooks/queries/mutacoes";
import {
  descricaoInvalida,
  MENSAGEM_DESCRICAO,
} from "@/utils/descricao-apontamento";
import {
  intervaloInvalido,
  MENSAGEM_INTERVALO_INVALIDO,
} from "@/utils/intervalo-horas";
import {
  apontamentoNoFuturo,
  MENSAGEM_HORARIO_FUTURO,
} from "@/utils/horario-futuro";
import { ChamadosType, STATUS_CHAMADO } from "@/types/chamados";
import { TaskType } from "@/types/tarefa";
import UserComponent from "@/components/user";
import Loading from "@/components/loading";
import SessionGuard from "@/components/session-guard";
import PainelAba from "./_components/painel/PainelAba";
import AvisoDiasPendentes from "./_components/AvisoDiasPendentes";
import AvisoChamadosNovos from "./_components/AvisoChamadosNovos";
import { TbCircleX, TbClockHour4 } from "react-icons/tb";
import {
  cancelarApontamentoSugerido,
  closeApontamentoModal,
  closeEditOsModal,
  closeStandbyModal,
  selectCallRow,
  selectProjRow,
  sugerirApontamento,
  validCurrentDate,
} from "./_components/homeActions";
import ChamadosTable from "./_components/tables/ChamadosTable";
import ProjetosTable from "./_components/tables/ProjetosTable";
import OsListTable from "./_components/tables/OsListTable";
import LoadingOverlays from "./_components/LoadingOverlays";
import DescricaoModal from "./_components/modals/DescricaoModal";
import AcessoModal from "./_components/modals/AcessoModal";
import TarefaModal from "./_components/modals/TarefaModal";
import ClassificacaoModal from "./_components/modals/ClassificacaoModal";
import Tooltip from "@/components/tooltip";
import StandbyModal from "./_components/modals/StandbyModal";
import EditOsModal from "./_components/modals/EditOsModal";
import ApontamentoModal from "./_components/modals/ApontamentoModal";

export default function Home() {
  const { data: session } = useSession();
  const showAlert = useAlertStore((state) => state.showAlert);
  const {
    tab,
    setTab,
    isOpenModal,
    setOpenModal,
    isOpenModal2,
    setOpenModal2,
    description,
    setDescription,
    selectedCall,
    setSelectedCall,
    selectedOs,
    setSelectedOs,
    selectedProj,
    setSelectedProj,
    modalStandby,
    modalApontamento,
    modalClassificacao,
    setModalClassificacao,
    modalTarefa,
    setModalTarefa,
    modalEditOS,
    isUploading,
    setIsUploading,
    isChangeAccess,
    setIsChangeAccess,
    isProcessing,
    setIsProcessing,
    hours,
    setHours,
    selectedTask,
    setSelectedTask,
    selectedClassificacao,
    setSelectedClassificacao,
    tasks,
    setTasks,
    classificacao,
    setClassificacao,
    descriptionText,
    setDescriptionText,
    accessText,
    setAccessText,
    accessCliente,
    date,
    setDate,
    directionOrder,
    setDirectionOrder,
    selectedDate,
    setSelectedDate,
    apontamentoSugerido,
  } = useHomeStore();

  // Dados do servidor (Query): carregam uma vez e ficam em cache; trocar de
  // aba ou reabrir uma tela não refaz a busca enquanto o dado estiver fresco.
  const chamadosQuery = useChamados();
  const tarefasQuery = useTarefas();
  usePeriodoApontamento(); // carrega o período de apontamento ao abrir a Home
  const calls = chamadosQuery.data ?? [];
  const projes = tarefasQuery.data ?? [];
  const loadingTables = chamadosQuery.isPending || tarefasQuery.isPending;

  const alterarStatus = useAlterarStatusChamado();
  const iniciar = useIniciarChamado();
  const registrarApont = useRegistrarApontamento();
  const standby = useColocarEmStandby();
  const salvarAcesso = useSalvarAcesso();
  const vincularTarefa = useVincularTarefa();
  const vincularClassificacao = useVincularClassificacao();
  const excluir = useExcluirOs();
  const atualizar = useAtualizarOs();

  function insertOs(event: FormEvent) {
    event.preventDefault();
    console.log(event);
  }

  // Troca de aba: limpa a seleção e a lista de OS visíveis, senão a lista
  // de OS do chamado (ou da tarefa) selecionado na aba anterior continua
  // aparecendo na aba nova até o usuário selecionar outra coisa -- dando a
  // impressão de que aquelas OS's pertencem à aba atual.
  function changeTab(newTab: "chamado" | "os" | "painel") {
    setTab(newTab);
    setSelectedCall(null);
    setSelectedProj(null);
    setSelectedDate("");
  }

  // ─── Atalhos do Meu Painel ───────────────────────────────────────────────
  // O painel só aponta o destino; a seleção e o carregamento das OS são os
  // mesmos de um clique na tabela (os efeitos de selectedCall/selectedProj).

  // Dia (e horário, se vier) escolhidos: o modal abre já preenchido quando o
  // consultor clicar no relógio da tarefa.
  function painelApontarEm(data: string, inicio: string = "", fim: string = "") {
    changeTab("os");
    sugerirApontamento(data, inicio, fim);
  }

  function painelIrParaChamado(codChamado: number) {
    const chamado = calls.find((c) => c.COD_CHAMADO === codChamado);

    if (!chamado) {
      showAlert("Este chamado não está mais na sua lista de chamados.", "warning");
      return;
    }

    changeTab("chamado");
    selectCallRow(chamado);
  }

  function painelIrParaTarefa(codTarefa: number) {
    const tarefa = projes.find((t) => Number(t.COD_TAREFA) === codTarefa);

    if (!tarefa) {
      showAlert("Esta tarefa não está mais na sua lista de tarefas.", "warning");
      return;
    }

    changeTab("os");
    selectProjRow(tarefa);
  }

  function painelVerOsDoDia(data: string) {
    changeTab("chamado");
    setSelectedDate(data);
  }

  // Filtro por data: lista as OS do recurso lançadas naquele dia (de qualquer
  // chamado ou tarefa). Escolher uma data limpa a seleção de chamado/tarefa
  // (e escolher um chamado/tarefa limpa a data -- ver changeSelectedCall e
  // changeSelectedCallTrf em homeActions).
  function changeSelectedDate(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    setSelectedCall(null);
    setSelectedProj(null);
    setSelectedDate(value);

    // A lista de OS da data (ou o vazio, se o campo foi apagado) deriva de
    // selectedDate -- o Query busca sozinho.
  }

  function clearSelectedDate() {
    setSelectedDate("");
  }

  function validRangeTime() {
    let [hoursEnd, minutesEnd]: any = hours.final.split(":");
    let [hoursStart, minutesStart]: any = hours.initial.split(":");

    hoursEnd = parseInt(hoursEnd);
    minutesEnd = parseInt(minutesEnd);

    hoursStart = parseInt(hoursStart);
    minutesStart = parseInt(minutesStart);

    if (hoursStart > hoursEnd) {
      return false;
    }

    if (hoursStart === hoursEnd && minutesStart > minutesEnd) {
      return false;
    }

    return true;
  }

  // ─── Comunicação com a API ───────────────────────────────────────────────
  // Leituras (chamados, tarefas, OS, período) vêm dos hooks do Query lá em
  // cima; as gravações são mutations, que ao terminar já marcam como "velho"
  // só o que mudou (ver hooks/queries/mutacoes). Aqui não há refetch manual.

  function avisarErro(erro: unknown, padrao: string) {
    showAlert(
      mensagemDoErro(erro, padrao),
      erro instanceof ApiError && erro.status === 0 ? "error" : "warning",
    );
  }

  // Roda uma operação que fala com a API; se ela recusar (ou a rede cair),
  // mostra o motivo e devolve { ok: false } -- quem chamou interrompe o fluxo.
  async function tentar<T>(
    operacao: () => Promise<T>,
    padrao = "Não foi possível concluir a operação.",
  ): Promise<{ ok: true; valor: T } | { ok: false }> {
    try {
      return { ok: true, valor: await operacao() };
    } catch (erro) {
      avisarErro(erro, padrao);
      return { ok: false };
    }
  }

  async function changeStatus(chamado: ChamadosType, status: string) {
    setIsProcessing(true);
    try {
      if (chamado.CODTRF_CHAMADO === null) {
        const tarefas = await tentar(() => listarTarefasParaChamado(chamado));
        if (!tarefas.ok) return;

        setSelectedTask(null);
        setTasks(tarefas.valor);
        setModalTarefa(true);
        return;
      }

      if (
        status != "START" &&
        (chamado.COD_CLASSIFICACAO === null || chamado.COD_CLASSIFICACAO === 0)
      ) {
        const classificacoes = await tentar(() => listarClassificacoes(chamado));
        if (!classificacoes.ok) return;

        setModalClassificacao(true);
        setSelectedClassificacao(null);
        setClassificacao(classificacoes.valor);
        return;
      }

      const alterado = await tentar(
        () =>
          alterarStatus.mutateAsync({
            codChamado: chamado.COD_CHAMADO,
            status,
            email: chamado.EMAIL_CHAMADO,
          }),
        "Não foi possível alterar o status do chamado.",
      );
      if (!alterado.ok) return;

      // Chamado finalizado sai da lista: se as OS's dele estavam abertas, a
      // seleção é desfeita e a lista some junto, em vez de ficar na tela
      // esperando outra seleção.
      if (
        status === STATUS_CHAMADO["FINALIZADO"] &&
        useHomeStore.getState().selectedCall?.COD_CHAMADO === chamado.COD_CHAMADO
      ) {
        setSelectedCall(null);
      }

      setOpenModal(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function startCall(chamado: ChamadosType) {
    setIsProcessing(true);
    try {
      if (chamado.CODTRF_CHAMADO === null) {
        const tarefas = await tentar(() => listarTarefasParaChamado(chamado));
        if (!tarefas.ok) return;

        setSelectedTask(null);
        setTasks(tarefas.valor);
        setModalTarefa(true);
        return;
      }

      const iniciado = await tentar(
        () => iniciar.mutateAsync(chamado.COD_CHAMADO),
        "Não foi possível iniciar o chamado.",
      );
      if (!iniciado.ok) return;

      setOpenModal(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function apontamento(os: TaskType | null) {
    if (!validCurrentDate(date)) {
      showAlert("Selecione uma data dentro do período vigente.", "warning");
      return;
    }

    if (!hours.initial || !hours.final || !date) {
      showAlert("Selecione uma data e hora inicial/final", "warning");
      return;
    }

    if (intervaloInvalido(hours.initial, hours.final)) {
      showAlert(MENSAGEM_INTERVALO_INVALIDO, "warning");
      return;
    }

    if (apontamentoNoFuturo(date, hours.initial, hours.final)) {
      showAlert(MENSAGEM_HORARIO_FUTURO, "warning");
      return;
    }

    if (descricaoInvalida(description)) {
      showAlert(MENSAGEM_DESCRICAO, "warning");
      return;
    }

    if (!os) {
      showAlert("Selecione um projeto!", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      // Conferência do limite mensal no instante do clique (sempre fresca).
      const responseValidHours = await validarHorasTarefa({
        tarefa: os.COD_TAREFA,
        date,
        startTime: hours.initial,
        endTime: hours.final,
      });

      if (estourouLimiteHoras(responseValidHours)) {
        let horasTotais = responseValidHours[0] / 60;
        //let horasApontadas = responseValidHours[1] / 60
        showAlert(
          `Horas para esta tarefa já ultrapassaram o limite mensal (${horasTotais}h), impossível realizar o apontamento.`,
          "warning",
          `Horas mês: ${horasTotais}h`,
        );

        return;
      }

      const task = await buscarTarefaDoApontamento(os?.COD_OS);

      await registrarApont.mutateAsync({
        os,
        description,
        date,
        startTime: hours.initial,
        endTime: hours.final,
        recurso: session?.user.recurso,
        state: "STANDBY",
        task,
      });

      descartarRascunho(chaveRascunhoTarefa(os.COD_TAREFA));
      closeApontamentoModal(false);
      showAlert("Apontamento registrado com sucesso!", "success");
    } catch (erro) {
      avisarErro(erro, "Não foi possível registrar o apontamento. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function standbyCall(chamado: ChamadosType | null) {
    if (!validCurrentDate(date)) {
      showAlert("Selecione uma data dentro do período vigente.", "warning");
      return;
    }

    if (!hours.initial || !hours.final || !date) {
      showAlert("Selecione uma data e hora inicial/final", "warning");
      return;
    }

    if (intervaloInvalido(hours.initial, hours.final)) {
      showAlert(MENSAGEM_INTERVALO_INVALIDO, "warning");
      return;
    }

    if (apontamentoNoFuturo(date, hours.initial, hours.final)) {
      showAlert(MENSAGEM_HORARIO_FUTURO, "warning");
      return;
    }

    if (descricaoInvalida(description)) {
      showAlert(MENSAGEM_DESCRICAO, "warning");
      return;
    }

    if (!chamado) {
      showAlert("Selecione um chamado!", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      const responseValidHours = await validarHorasChamado({
        chamado: chamado.COD_CHAMADO,
        date,
        startTime: hours.initial,
        endTime: hours.final,
      });

      if (estourouLimiteHoras(responseValidHours, { ignorarLimiteZero: true })) {
        let horasTotais = responseValidHours[0] / 60;
        let horasApontadas = responseValidHours[1] / 60;

        showAlert(
          `Horas para esta tarefa já ultrapassaram o limite do mês, total final após apontamento: ${horasApontadas}h. ENTRE EM CONTATO COM A SOLUTII!`,
          "warning",
          `Horas mês: ${horasTotais}h`,
        );

        return;
      }

      const task = await buscarTarefaDoApontamento(selectedCall?.COD_CHAMADO);

      await standby.mutateAsync({
        chamado,
        description,
        date,
        startTime: hours.initial,
        endTime: hours.final,
        state: "STANDBY",
        task,
      });

      descartarRascunho(chaveRascunhoChamado(chamado.COD_CHAMADO));
      closeStandbyModal(false);
      showAlert(
        `Chamado #${chamado.COD_CHAMADO} colocado em standby com sucesso!`,
        "success",
      );
    } catch (erro) {
      avisarErro(
        erro,
        `Não foi possível colocar o chamado #${chamado.COD_CHAMADO} em standby. Tente novamente.`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function salvarAcessoCliente() {
    setIsChangeAccess(true);

    try {
      await salvarAcesso.mutateAsync({
        descricao: accessText,
        cliente: accessCliente,
      });

      setOpenModal2(false);
    } catch (erro) {
      avisarErro(erro, "Não foi possível salvar os dados de acesso.");
    } finally {
      setIsChangeAccess(false);
    }
  }

  async function updateChamadoTarefa() {
    if (!selectedTask) {
      showAlert("Selecione uma tarefa!", "warning");
      return;
    }

    const vinculada = await tentar(() =>
      vincularTarefa.mutateAsync({
        codChamado: selectedCall?.COD_CHAMADO,
        codTarefa: selectedTask,
      }),
    );
    if (!vinculada.ok) return;

    if (selectedCall) {
      let call = {
        ...selectedCall,
        CODTRF_CHAMADO: selectedTask,
      };
      await startCall(call);
    }

    setModalTarefa(false);
  }

  async function updateClassificacao() {
    if (!selectedClassificacao) {
      showAlert("Selecione uma classificação!", "warning");
      return;
    }

    const vinculada = await tentar(() =>
      vincularClassificacao.mutateAsync({
        codChamado: selectedCall?.COD_CHAMADO,
        codClassificacao: selectedClassificacao,
      }),
    );
    if (!vinculada.ok) return;

    if (selectedCall) {
      let call = {
        ...selectedCall,
        CODTRF_CHAMADO: selectedTask,
      };
      await startCall(call);
    }

    setModalClassificacao(false);
  }

  async function handleDelete(os: any) {
    setSelectedOs(os);
    const confirmado = await useAlertStore.getState().showConfirm(
      "Esta ação não poderá ser desfeita!",
      {
        title: `Deseja excluir a OS #${os?.COD_OS}?`,
        confirmText: "Sim, excluir!",
        cancelText: "Cancelar",
        type: "error",
      },
    );
    // O destaque visual na tabela (linha selecionada) só deve ficar visível
    // enquanto o alert-dialog de confirmação está aberto -- limpamos aqui,
    // logo após o usuário responder, independente do resultado.
    setSelectedOs(null);

    if (!confirmado) {
      return;
    }

    // As listas (OS, painel e, na aba Chamados, os chamados) se atualizam sozinhas.
    await tentar(
      () => excluir.mutateAsync({ codOs: os.COD_OS, recarregarChamados: tab === "chamado" }),
      "Não foi possível excluir o apontamento.",
    );
  }

  async function updateOs() {
    if (!validCurrentDate(date)) {
      showAlert("Selecione uma data dentro do período vigente.", "warning");
      return;
    }

    if (!hours.initial || !hours.final || !date) {
      showAlert("Selecione uma data e hora inicial/final", "warning");
      return;
    }

    if (intervaloInvalido(hours.initial, hours.final)) {
      showAlert(MENSAGEM_INTERVALO_INVALIDO, "warning");
      return;
    }

    if (apontamentoNoFuturo(date, hours.initial, hours.final)) {
      showAlert(MENSAGEM_HORARIO_FUTURO, "warning");
      return;
    }

    if (descricaoInvalida(description)) {
      showAlert(MENSAGEM_DESCRICAO, "warning");
      return;
    }

    setIsProcessing(true);
    try {
      await atualizar.mutateAsync({
        recarregarChamados: tab === "chamado",
        corpo: {
          codOs: selectedOs.COD_OS,
          description,
          date,
          startTime: hours.initial,
          endTime: hours.final,
        },
      });

      closeEditOsModal(false);
      showAlert(
        `OS #${selectedOs.COD_OS} atualizada com sucesso!`,
        "success",
      );
      setSelectedOs(null);
    } catch (erro) {
      avisarErro(
        erro,
        `Não foi possível salvar as alterações da OS #${selectedOs.COD_OS}. Tente novamente.`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col items-center">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(15,61,99,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,61,99,0.035)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      <TbClockHour4
        aria-hidden
        className="absolute -right-20 -top-20 text-[#0f3d63]/[0.03] dark:text-white/[0.03] pointer-events-none select-none"
        size={480}
      />

      <LoadingOverlays />

      <SessionGuard />

      <DescricaoModal />
      <AcessoModal action={salvarAcessoCliente} />
      <TarefaModal action={updateChamadoTarefa} />
      <ClassificacaoModal action={updateClassificacao} />
      <StandbyModal action={() => standbyCall(selectedCall)} />
      <EditOsModal action={updateOs} />
      <ApontamentoModal action={() => apontamento(selectedProj)} />

      <div className="relative z-10 w-full">
        <UserComponent signOut={signOut} onSave={() => {}} />
      </div>

      <div className="relative z-10 w-full flex flex-col gap-6 pt-6 pb-[60px] px-[80px]">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#0f3d63] via-cyan-500 to-[#0f3d63] dark:from-cyan-300 dark:via-white dark:to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
            Controle de Apontamentos
          </h1>
          <span className="block w-20 h-1.5 rounded-full bg-gradient-to-r from-[#0f3d63] to-cyan-400" />
        </div>

        <section className="flex flex-row w-full max-w-xl mx-auto bg-slate-300 dark:bg-slate-700 rounded-full p-1 mt-4">
          <button
            onClick={() => changeTab("chamado")}
            className={
              tab === "chamado"
                ? "flex-1 bg-[#0f3d63] dark:bg-[#081c2e] text-white rounded-full py-2 text-sm font-semibold transition depth-btn"
                : "flex-1 text-slate-600 dark:text-slate-300 rounded-full py-2 text-sm font-semibold transition hover:text-slate-900 dark:hover:text-white"
            }
          >
            Chamados
          </button>
          <button
            onClick={() => changeTab("os")}
            className={
              tab === "os"
                ? "flex-1 bg-[#0f3d63] dark:bg-[#081c2e] text-white rounded-full py-2 text-sm font-semibold transition depth-btn"
                : "flex-1 text-slate-600 dark:text-slate-300 rounded-full py-2 text-sm font-semibold transition hover:text-slate-900 dark:hover:text-white"
            }
          >
            Tarefas
          </button>
          <button
            onClick={() => changeTab("painel")}
            className={
              tab === "painel"
                ? "flex-1 bg-[#0f3d63] dark:bg-[#081c2e] text-white rounded-full py-2 text-sm font-semibold transition depth-btn"
                : "flex-1 text-slate-600 dark:text-slate-300 rounded-full py-2 text-sm font-semibold transition hover:text-slate-900 dark:hover:text-white"
            }
          >
            Meu Painel
          </button>
        </section>

        <AvisoChamadosNovos onVer={() => changeTab("chamado")} />

        {tab !== "painel" && (
          <AvisoDiasPendentes onApontarEm={painelApontarEm} onVerPainel={() => changeTab("painel")} />
        )}

        {apontamentoSugerido && tab !== "painel" && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 w-full max-w-xl mx-auto rounded-xl border border-green-700 dark:border-green-400 bg-green-50 dark:bg-green-950/40 px-4 py-2.5"
          >
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Apontamento em {apontamentoSugerido.data.split("-").reverse().join("/")}
              {apontamentoSugerido.inicio && ` das ${apontamentoSugerido.inicio} às ${apontamentoSugerido.fim}`}:{" "}
              {tab === "os"
                ? "clique no relógio da tarefa para continuar."
                : "para apontar nesse dia, use a aba Tarefas."}
            </p>
            <button
              type="button"
              onClick={cancelarApontamentoSugerido}
              className="rounded-md border border-green-800 dark:border-green-400 px-3 py-1 text-xs font-semibold text-green-800 dark:text-green-300 cursor-pointer transition hover:bg-green-100 dark:hover:bg-green-900/50 outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            >
              Cancelar
            </button>
          </div>
        )}

        {tab === "painel" ? (
          <PainelAba
            onApontarEm={painelApontarEm}
            onIrParaChamado={painelIrParaChamado}
            onIrParaTarefa={painelIrParaTarefa}
            onVerOsDoDia={painelVerOsDoDia}
            onErro={(mensagem) => showAlert(mensagem, "warning")}
          />
        ) : (
          <>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            {tab === "chamado" ? "Chamados" : "Tarefas"}
          </h2>
          <section className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sm:text-sm text-xs overflow-hidden">
            <div className="overflow-auto">
              {loadingTables ? (
                <Loading />
              ) : tab === "chamado" ? (
                <ChamadosTable
                  onStart={startCall}
                  onChangeStatus={changeStatus}
                />
              ) : (
                <ProjetosTable />
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-row items-center gap-2">
          <DateInput
            aria-label="Filtrar apontamentos por data"
            value={selectedDate}
            onChange={changeSelectedDate}
            className="h-9 w-[170px] cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 dark:[color-scheme:dark] text-sm outline-none transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
          />
          <Tooltip content="Limpar data">
            <button
              type="button"
              onClick={clearSelectedDate}
              aria-label="Limpar data"
              className="text-red-500 hover:text-red-400 rounded-full transition hover:scale-110 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <TbCircleX size={22} className="depth-icon" />
            </button>
          </Tooltip>
        </div>

        {(selectedCall || selectedProj || selectedDate) && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 px-1">
              {selectedCall
                ? `OS's DO CHAMADO - #${Number(selectedCall.COD_CHAMADO).toLocaleString("pt-br")}`
                : selectedProj
                  ? `OS's DA TAREFA - #${Number(selectedProj.COD_TAREFA).toLocaleString("pt-br")}`
                  : `OS's DA DATA - ${new Date(`${selectedDate}T00:00`).toLocaleDateString("pt-br")}`}
            </h2>
            <OsListTable onDelete={handleDelete} />
          </div>
        )}
          </>
        )}
      </div>
    </main>
  );
}
