"use client";

import { ChangeEvent, FormEvent, useEffect } from "react";
import DateInput from "@/components/date-input";
import { useSession, signOut } from "next-auth/react";
import { useHomeStore } from "@/stores/home-store";
import { useAlertStore } from "@/stores/alert-store";
import { estourouLimiteHoras } from "@/utils/limite-horas";
import { agoraNoFuso } from "@/utils/horario-futuro";
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
import { TbCircleX, TbClockHour4 } from "react-icons/tb";
import {
  closeApontamentoModal,
  closeEditOsModal,
  closeStandbyModal,
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
    calls,
    setCalls,
    tab,
    setTab,
    projes,
    setProjes,
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
    loadingOs,
    setLoadingOs,
    loadingTables,
    setLoadingTables,
    listOs,
    setListOs,
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
    limitDate,
    setLimitDate,
    tomorrow,
    setTomorrow,
  } = useHomeStore();

  function insertOs(event: FormEvent) {
    event.preventDefault();
    console.log(event);
  }

  // Troca de aba: limpa a seleção e a lista de OS visíveis, senão a lista
  // de OS do chamado (ou da tarefa) selecionado na aba anterior continua
  // aparecendo na aba nova até o usuário selecionar outra coisa -- dando a
  // impressão de que aquelas OS's pertencem à aba atual.
  function changeTab(newTab: "chamado" | "os") {
    setTab(newTab);
    setSelectedCall(null);
    setSelectedProj(null);
    setSelectedDate("");
    setListOs([]);
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

    // Campo apagado pelo próprio seletor de data: não há o que buscar.
    if (!value) {
      setListOs([]);
      return;
    }

    getAllOs(value);
  }

  function clearSelectedDate() {
    if (!selectedCall && !selectedProj) setListOs([]);
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

  async function getAllOs(date: string = "") {
    setLoadingOs(true);

    let result = await fetch("/api/os/list", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        chamado: selectedCall?.COD_CHAMADO,
        data: date,
        recurso: session?.user.recurso,
      }),
    })
      .then((res) => res.json())
      .then((res) => res)
      .catch(() => {
        setLoadingOs(false);
      })
      .finally(() => {
        setLoadingOs(false);
      });

    if (!result) {
      setListOs([]);
      return;
    }

    setListOs(result);
  }

  // Aba Tarefas: com o filtro por data ativo (nenhuma tarefa selecionada) a
  // lista é a das OS's da data; senão, a das OS's da tarefa selecionada.
  function recarregarOsDaAbaTarefas() {
    if (!selectedProj && selectedDate) {
      getAllOs(selectedDate);
      return;
    }

    getAllOsTarefa();
  }

  async function getAllOsTarefa(date: string = "") {
    setLoadingOs(true);

    let result = await fetch("/api/os/list-for-trf", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        tarefa: selectedProj?.COD_TAREFA,
        data: date,
        recurso: session?.user.recurso,
      }),
    })
      .then((res) => res.json())
      .then((res) => res)
      .catch(() => {
        setLoadingOs(false);
      })
      .finally(() => {
        setLoadingOs(false);
      });

    if (!result) {
      setListOs([]);
      return;
    }

    setListOs(result);
  }

  async function getCalls() {
    let result = await fetch("/api/call/list?recurso=" + session?.user.recurso)
      .then((res) => res.json())
      .then((res) => res);

    if (!result) return;

    setCalls(result);
  }

  async function getTasksProject() {
    let result = await fetch("/api/os/list?recurso=" + session?.user.recurso)
      .then((res) => res.json())
      .then((res) => res);

    if (!result) return;

    setProjes(result);
  }

  // Lê o JSON da resposta; se a API recusou (status de erro + { error }), mostra
  // o motivo e devolve null -- quem chamou interrompe o fluxo.
  async function lerJsonOuMostrarErro(response: Response): Promise<any | null> {
    const json = await response.json();

    if (!response.ok) {
      showAlert(
        json?.error ?? "Não foi possível concluir a operação.",
        "warning",
      );
      return null;
    }

    return json;
  }

  async function changeStatus(chamado: ChamadosType, status: string) {
    setIsProcessing(true);
    try {
      if (chamado.CODTRF_CHAMADO === null) {
        let selectedTasks: any = await lerJsonOuMostrarErro(
          await fetch("/api/call/task", {
            method: "POST",
            body: JSON.stringify({ chamado }),
          }),
        );
        if (selectedTasks === null) return;

        setSelectedTask(null);
        setTasks(selectedTasks);
        setModalTarefa(true);
        return;
      }

      if (
        status != "START" &&
        (chamado.COD_CLASSIFICACAO === null || chamado.COD_CLASSIFICACAO === 0)
      ) {
        let selectedClassificacao: any = await fetch(
          "/api/call/classificacao",
          {
            method: "POST",
            body: JSON.stringify({ chamado }),
          },
        ).then((response) => response.json());

        setModalClassificacao(true);
        setSelectedClassificacao(null);
        setClassificacao(selectedClassificacao);
        return;
      }

      /* let data = ""

        if(status === STATUS_CHAMADO['FINALIZADO']) {
            const now = new Date();
            const defaultDatetime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const { value: dataFinalizacao, isConfirmed } = await Swal.fire({
                title: 'Data de Finalização',
                html: `<input type="datetime-local" id="swal-datetime" class="swal2-input" value="${defaultDatetime}" max="${defaultDatetime}">`,
                showCancelButton: true,
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const input = document.getElementById('swal-datetime') as HTMLInputElement;
                    if (!input.value) {
                        Swal.showValidationMessage('A data de finalização é obrigatória!');
                        return false;
                    }
                    const selectedDate = new Date(input.value);
                    if (selectedDate > new Date()) {
                        Swal.showValidationMessage('A data de finalização não pode ser maior que a data atual!');
                        return false;
                    }
                    return input.value;
                }
            });

            if (!isConfirmed || !dataFinalizacao) {
                return;
            }

            // Parse de yyyy-MM-ddTHH:mm para dd.mm.aaaa HH:mm
            const [datePart, timePart] = dataFinalizacao.split('T');
            const [year, month, day] = datePart.split('-');
            data = `${day}.${month}.${year} ${timePart}`;
        } */

      const response = await fetch(
        "/api/call/change-status?codChamado=" +
          chamado.COD_CHAMADO +
          "&status=" +
          status +
          "&email=" +
          chamado.EMAIL_CHAMADO,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok) {
        showAlert(
          result?.error ?? "Não foi possível alterar o status do chamado.",
          "warning",
        );
        return;
      }

      if (!result) return;

      // Chamado finalizado sai da lista: se as OS's dele estavam abertas, some
      // junto, em vez de ficar na tela esperando outra seleção.
      if (
        status === STATUS_CHAMADO["FINALIZADO"] &&
        useHomeStore.getState().selectedCall?.COD_CHAMADO === chamado.COD_CHAMADO
      ) {
        setSelectedCall(null);
        setListOs([]);
      }

      setOpenModal(false);
      getCalls();
    } finally {
      setIsProcessing(false);
    }
  }

  async function startCall(chamado: ChamadosType) {
    setIsProcessing(true);
    try {
      if (chamado.CODTRF_CHAMADO === null) {
        let selectedTasks: any = await lerJsonOuMostrarErro(
          await fetch("/api/call/task", {
            method: "POST",
            body: JSON.stringify({ chamado }),
          }),
        );
        if (selectedTasks === null) return;

        setSelectedTask(null);
        setTasks(selectedTasks);
        setModalTarefa(true);
        return;
      }

      let result = await lerJsonOuMostrarErro(
        await fetch("/api/call/start?codChamado=" + chamado.COD_CHAMADO, {
          method: "POST",
        }),
      );

      if (!result) return;

      setOpenModal(false);
      getCalls();
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
      //criar uma função identica a esta para validar as horas do projeto

      let responseValidHours = await fetch("/api/os/valid-hours", {
        method: "POST",
        body: JSON.stringify({
          chamado: os.COD_TAREFA,
          date,
          startTime: hours.initial,
          endTime: hours.final,
        }),
      })
        .then((res) => res.json())
        .then((res) => res);

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

      let task = await fetch("/api/get-task", {
        method: "POST",
        body: JSON.stringify({
          COD_CHAMADO: os?.COD_OS,
        }),
      })
        .then((res) => res.json())
        .then((res) => res);

      const responseApoint = await fetch("/api/os/apoint", {
        method: "POST",
        body: JSON.stringify({
          os,
          description,
          date,
          startTime: hours.initial,
          endTime: hours.final,
          recurso: session?.user.recurso,
          state: "STANDBY",
          task,
        }),
      });
      const result = await responseApoint.json();

      if (!responseApoint.ok) {
        showAlert(
          result?.error ??
            "Não foi possível registrar o apontamento. Tente novamente.",
          "warning",
        );
        return;
      }

      if (!result) {
        showAlert(
          "Não foi possível registrar o apontamento. Tente novamente.",
          "error",
        );
        return;
      }

      getAllOsTarefa();
      closeApontamentoModal(false);
      showAlert("Apontamento registrado com sucesso!", "success");
    } catch {
      showAlert(
        "Não foi possível registrar o apontamento. Verifique sua conexão e tente novamente.",
        "error",
      );
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

    let responseValidHours = await fetch("/api/call/valid-hours", {
      method: "POST",
      body: JSON.stringify({
        chamado: chamado.COD_CHAMADO,
        date,
        startTime: hours.initial,
        endTime: hours.final,
      }),
    })
      .then((res) => res.json())
      .then((res) => res);

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

    setIsProcessing(true);
    try {
      let task = await fetch("/api/get-task", {
        method: "POST",
        body: JSON.stringify({
          COD_CHAMADO: selectedCall?.COD_CHAMADO,
        }),
      })
        .then((res) => res.json())
        .then((res) => res);

      const responseStandby = await fetch("/api/call/standby", {
        method: "POST",
        body: JSON.stringify({
          chamado,
          description,
          date,
          startTime: hours.initial,
          endTime: hours.final,
          state: "STANDBY",
          task,
        }),
      });
      const result = await responseStandby.json();

      if (!responseStandby.ok) {
        showAlert(
          result?.error ??
            `Não foi possível colocar o chamado #${chamado.COD_CHAMADO} em standby. Tente novamente.`,
          "warning",
        );
        return;
      }

      if (!result) {
        showAlert(
          `Não foi possível colocar o chamado #${chamado.COD_CHAMADO} em standby. Tente novamente.`,
          "error",
        );
        return;
      }

      getCalls();
      getAllOs();
      closeStandbyModal(false);
      showAlert(
        `Chamado #${chamado.COD_CHAMADO} colocado em standby com sucesso!`,
        "success",
      );
    } catch {
      showAlert(
        `Não foi possível colocar o chamado #${chamado.COD_CHAMADO} em standby. Verifique sua conexão e tente novamente.`,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function salvarAcessoCliente() {
    setIsChangeAccess(true);

    const responseAcesso = await fetch("/api/acesso", {
      method: "POST",
      body: JSON.stringify({
        descricao: accessText,
        cliente: accessCliente,
      }),
    });

    if (!responseAcesso.ok) {
      const erro = await responseAcesso.json().catch(() => null);
      showAlert(
        erro?.error ?? "Não foi possível salvar os dados de acesso.",
        "warning",
      );
      setIsChangeAccess(false);
      return;
    }

    getCalls();

    setIsChangeAccess(false);
    setOpenModal2(false);
  }

  async function updateChamadoTarefa() {
    setLoadingOs(true);

    try {
      if (!selectedTask) {
        showAlert("Selecione uma tarefa!", "warning");
        return;
      }

      let result = await lerJsonOuMostrarErro(
        await fetch("/api/insert-task", {
          method: "POST",
          body: JSON.stringify({
            COD_CHAMADO: selectedCall?.COD_CHAMADO,
            COD_TAREFA: selectedTask,
          }),
        }),
      );

      if (!result) return;

      if (selectedCall) {
        let call = {
          ...selectedCall,
          CODTRF_CHAMADO: selectedTask,
        };
        await startCall(call);
      }

      setModalTarefa(false);
    } finally {
      setLoadingOs(false);
    }
  }

  async function updateClassificacao() {
    setLoadingOs(true);

    try {
      if (!selectedClassificacao) {
        showAlert("Selecione uma classificação!", "warning");
        return;
      }

      let result = await lerJsonOuMostrarErro(
        await fetch("/api/insert-classificacao", {
          method: "POST",
          body: JSON.stringify({
            COD_CHAMADO: selectedCall?.COD_CHAMADO,
            COD_CLASSIFICACAO: selectedClassificacao,
          }),
        }),
      );

      if (!result) return;

      if (selectedCall) {
        let call = {
          ...selectedCall,
          CODTRF_CHAMADO: selectedTask,
        };
        await startCall(call);
      }

      setModalClassificacao(false);
    } finally {
      setLoadingOs(false);
    }
  }

  useEffect(() => {
    if (!selectedCall) return;

    getAllOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCall]);

  useEffect(() => {
    if (!selectedProj) return;

    getAllOsTarefa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProj]);

  useEffect(() => {
    if (!session) return;

    setLoadingTables(true);
    Promise.all([getCalls(), getTasksProject()]).finally(() =>
      setLoadingTables(false),
    );
    getLimitDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function getLimitDate() {
    let tomorrow = new Date(`${agoraNoFuso().data}T00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);

    setTomorrow(tomorrow);

    fetch("/api/os/valid", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        recurso: session?.user.recurso,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res[0].PERMAPO_RECURSO === "SIM") {
          setLimitDate(new Date(res[0].DTLIMITE_RECURSO));
        } else {
          let date = new Date(`${agoraNoFuso().data}T00:00`);
          date.setDate(date.getDate() - 1);
          setLimitDate(date);
        }
      })
      .catch(() => {
        setLoadingOs(false);
      });
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

    setLoadingOs(true);

    const responseDelete = await fetch("/api/os/delete", {
      method: "POST",
      body: JSON.stringify({
        codOs: os.COD_OS,
      }),
    });
    const result = await responseDelete.json();

    setLoadingOs(false);

    if (!responseDelete.ok) {
      showAlert(
        result?.error ?? "Não foi possível excluir o apontamento.",
        "warning",
      );
      return;
    }

    if (tab === "chamado") {
      getCalls();
      getAllOs(selectedDate);
    } else {
      recarregarOsDaAbaTarefas();
    }
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
      const responseUpdate = await fetch("/api/os/update", {
        method: "POST",
        body: JSON.stringify({
          codOs: selectedOs.COD_OS,
          description,
          date,
          startTime: hours.initial,
          endTime: hours.final,
        }),
      });
      const result = await responseUpdate.json();

      if (!responseUpdate.ok) {
        showAlert(
          result?.error ??
            `Não foi possível salvar as alterações da OS #${selectedOs.COD_OS}. Tente novamente.`,
          "warning",
        );
        return;
      }

      if (!result) {
        showAlert(
          `Não foi possível salvar as alterações da OS #${selectedOs.COD_OS}. Tente novamente.`,
          "error",
        );
        return;
      }

      if (tab === "chamado") {
        getCalls();
        getAllOs(selectedDate);
      } else {
        recarregarOsDaAbaTarefas();
      }

      closeEditOsModal(false);
      showAlert(
        `OS #${selectedOs.COD_OS} atualizada com sucesso!`,
        "success",
      );
      setSelectedOs(null);
    } catch {
      showAlert(
        `Não foi possível salvar as alterações da OS #${selectedOs.COD_OS}. Verifique sua conexão e tente novamente.`,
        "error",
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

        <section className="flex flex-row w-full max-w-md mx-auto bg-slate-300 dark:bg-slate-700 rounded-full p-1 mt-4">
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
        </section>

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
      </div>
    </main>
  );
}
