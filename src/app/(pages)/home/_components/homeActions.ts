import { useHomeStore } from "@/stores/home-store";
import { agoraNoFuso } from "@/utils/horario-futuro";
import { limiteDeApontamentoEmCache } from "@/lib/limite-em-cache";
import { ChamadosType } from "@/types/chamados";
import { TaskType } from "@/types/tarefa";

// Ações usadas pelas tabelas da tela /home que só leem/escrevem a store (sem
// depender de `session` nem de fetch de negócio) -- por isso são funções
// simples, não hooks, usando useHomeStore.getState()/setState() direto. Isso
// deixa as tabelas (ChamadosTable, ProjetosTable, OsListTable) sem precisar
// receber essas ações como prop.

// SOLICITACAO_CHAMADO vem de um editor de texto rico (HTML) -- aqui queremos
// só o texto puro que o usuário digitou na abertura do chamado, sem as tags.
function stripHtml(html: string): string {
    return html
        // remove blocos <style>/<script> por inteiro (conteúdo incluso) -- o
        // Word injeta CSS de VML (v\:*, o\:*, w\:*, .shape) dentro de <style>
        // quando o texto é colado do Word; sem isso, só as tags eram
        // removidas e o CSS aparecia como texto solto.
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

export function changeSelectedCall(chamado: ChamadosType) {
    const { selectedCall, setSelectedCall, setSelectedProj, setSelectedDate } = useHomeStore.getState();

    // A lista de OS na tela deriva da seleção (useOsLista): desmarcar o chamado a esvazia.
    if (selectedCall?.COD_CHAMADO === chamado.COD_CHAMADO) {
        setSelectedCall(null);
        return;
    }

    setSelectedCall(() => chamado);
    setSelectedProj(null);
    setSelectedDate("");
}

export function changeSelectedCallTrf(task: TaskType) {
    const { selectedProj, setSelectedCall, setSelectedProj, setSelectedDate } = useHomeStore.getState();

    if (selectedProj?.COD_TAREFA === task.COD_TAREFA) {
        setSelectedProj(null);
        return;
    }

    setSelectedProj(() => task);
    setSelectedCall(null);
    setSelectedDate("");
}

// Igual ao "select" de changeSelectedCallTrf, mas sem o toggle-off -- usado
// pelo ícone "Apontar horas" (deve sempre marcar a linha da tarefa, nunca
// desmarcar, mesmo se ela já estiver selecionada).
export function selectProjRow(task: TaskType) {
    const { setSelectedCall, setSelectedProj, setSelectedDate } = useHomeStore.getState();
    setSelectedProj(() => task);
    setSelectedCall(null);
    setSelectedDate("");
}

// Igual ao "select" de changeSelectedCall, mas sem o toggle-off -- usado
// pelos ícones de ação da linha (Solicitação, Acesso, Anexar/Baixar arquivo)
// que devem sempre marcar a linha do chamado, nunca desmarcar, mesmo se ela
// já estiver selecionada.
export function selectCallRow(chamado: ChamadosType) {
    const { setSelectedCall, setSelectedProj, setSelectedDate } = useHomeStore.getState();
    setSelectedCall(() => chamado);
    setSelectedProj(null);
    setSelectedDate("");
}

export function openDescriptions(chamado: ChamadosType) {
    const { setDescriptionText, setOpenModal } = useHomeStore.getState();
    const desc = stripHtml(chamado?.SOLICITACAO_CHAMADO?.trim() ?? "");
    selectCallRow(chamado);
    setDescriptionText(desc);
    setOpenModal(true);
}

export function openAccess(chamado: ChamadosType) {
    const { setAccessCliente, setAccessText, setOpenModal2 } = useHomeStore.getState();
    const desc = chamado?.ACESSO_CLIENTE?.trim();
    selectCallRow(chamado);
    setAccessText(desc ?? "Acesso não informado!");
    setAccessCliente(chamado.COD_CLIENTE);
    setOpenModal2(true);
}

export function handleEdit(os: any) {
    const { setSelectedOs, setHours, setDescription, setDate, setModalEditOS } = useHomeStore.getState();

    setSelectedOs(os);
    setHours({
        initial: os.HRINI_OS.replace(/(\d{2})(\d{2})/, "$1:$2"),
        final: os.HRFIM_OS.replace(/(\d{2})(\d{2})/, "$1:$2"),
    });
    setDescription(os.OBS);
    setDate(os.DTINI_OS.substring(0, 10));
    setModalEditOS(true);
}

// Limpa os campos compartilhados de apontamento (descrição, horas, data) --
// usado quando um dos 3 modais que usam CamposApontamento (Standby,
// Apontamento, Editar OS) é fechado sem confirmar, pra não deixar um
// rascunho velho pra próxima vez que o modal abrir.
function resetApontamentoFields() {
    const { setDescription, setHours, setDate, setApontamentoSugerido } = useHomeStore.getState();
    setDescription("");
    setHours({ initial: "", final: "" });
    setDate(agoraNoFuso().data);
    setApontamentoSugerido(null);
}

// Meu Painel: deixa a data (e o horário, se houver) já definidos para o próximo
// apontamento -- o modal abre com esses valores quando o consultor escolher a
// tarefa ou o chamado. Fechar o modal sem confirmar volta tudo ao normal.
export function sugerirApontamento(data: string, inicio: string = "", fim: string = "") {
    const { setDate, setHours, setApontamentoSugerido } = useHomeStore.getState();
    setDate(data);
    setHours({ initial: inicio, final: fim });
    setApontamentoSugerido({ data, inicio, fim });
}

// Repetir um apontamento: abre o modal certo (StandBy do chamado ou
// Apontamento da tarefa) já com a descrição da OS original; data volta a hoje e
// os horários ficam em branco para o consultor escolher.
export function repetirApontamento(
    destino: { tipo: "chamado"; chamado: ChamadosType; descricao: string } | { tipo: "tarefa"; tarefa: TaskType; descricao: string },
) {
    const store = useHomeStore.getState();

    store.setApontamentoSugerido(null);
    store.setHours({ initial: "", final: "" });
    store.setDate(agoraNoFuso().data);
    store.setDescription(destino.descricao);

    if (destino.tipo === "chamado") {
        store.setTab("chamado");
        selectCallRow(destino.chamado);
        store.setModalStandby(true);
    } else {
        store.setTab("os");
        selectProjRow(destino.tarefa);
        store.setModalApontamento(true);
    }
}

// Cancela a sugestão do painel (botão do aviso).
export function cancelarApontamentoSugerido() {
    resetApontamentoFields();
}

export function closeStandbyModal(open: boolean) {
    if (!open) resetApontamentoFields();
    useHomeStore.getState().setModalStandby(open);
}

export function closeApontamentoModal(open: boolean) {
    if (!open) resetApontamentoFields();
    useHomeStore.getState().setModalApontamento(open);
}

// Limpa também `selectedOs` ao fechar sem salvar -- o destaque visual da
// linha selecionada na tabela de OS's (ligado a `selectedOs`) só deve ficar
// visível enquanto o modal de edição está aberto.
export function closeEditOsModal(open: boolean) {
    if (!open) {
        resetApontamentoFields();
        useHomeStore.getState().setSelectedOs(null);
    }
    useHomeStore.getState().setModalEditOS(open);
}

// AcessoModal é preenchido com o texto já cadastrado do cliente (openAccess)
// -- fechar sem salvar não deve deixar edições não salvas pra próxima
// abertura, então limpamos aqui também.
export function closeAccessModal(open: boolean) {
    if (!open) {
        useHomeStore.getState().setAccessText("");
        useHomeStore.getState().setAccessCliente(null);
    }
    useHomeStore.getState().setOpenModal2(open);
}

export function validCurrentDate(date: string): boolean {
    // Período já carregado pelo usePeriodoApontamento (cache do Query).
    const limitDate = limiteDeApontamentoEmCache();
    const selectedDate = date.length > 10 ? new Date(date) : new Date(date + `T00:00`);
    const tomorrow = new Date(`${agoraNoFuso().data}T00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return selectedDate >= (limitDate ?? ("" as any)) && selectedDate < tomorrow;
}
