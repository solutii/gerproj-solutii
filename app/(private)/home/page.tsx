"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ChamadosType, STATUS_CHAMADO } from "@/models/chamados";
import { VscDebugStart } from "react-icons/vsc";
import { PiPauseDuotone } from "react-icons/pi";
import { TbCalendarCheck } from "react-icons/tb";
import { ImStop } from "react-icons/im";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { IoCloseCircleOutline } from "react-icons/io5";
import { MdOutlineDriveFolderUpload } from "react-icons/md";
import { HiOutlineFolderDownload } from "react-icons/hi";
import Modal from "@/components/modal";
import Loading from "@/components/loading";
import { PiTrashDuotone } from "react-icons/pi";
import { LuPointer } from "react-icons/lu";
import { CiEdit } from "react-icons/ci";
import Swal from 'sweetalert2'
import { STATUS_TASK, TaskType } from "@/models/tarefa";
import iconv from 'iconv-lite'
import UserComponent from "@/components/user";

export default function Home() {
    const { data: session } = useSession();
    const [calls, setCalls] = useState<ChamadosType[]>([]);
    const [tab, setTab] = useState<"chamado" | "os">("chamado");
    const [projes, setProjes] = useState<TaskType[]>([]);
    const [isOpenModal, setOpenModal] = useState(false);
    const [isOpenModal2, setOpenModal2] = useState(false);
    const [description, setDescription] = useState("");
    const [selectedCall, setSelectedCall] = useState<ChamadosType | null>(null);
    const [selectedOs, setSelectedOs] = useState<any | null>(null);
    const [selectedProj, setSelectedProj] = useState<TaskType | null>(null);
   
    const [modalStandby, setModalStandby] = useState(false);
    const [modalApontamento, setModalApontamento] = useState(false);
    const [modalClassificacao, setModalClassificacao] = useState(false);
    
    const [modalTarefa, setModalTarefa] = useState(false);
    const [modalEditOS, setModalEditOS] = useState(false);
    const [isUploading, setIsUploading] = useState(false)
    const [isChangeAccess, setIsChangeAccess] = useState(false)
    const [loadingOs, setLoadingOs] = useState(false);
    const [listOs, setListOs] = useState([]);
    const [hours, setHours] = useState({
        initial: "",
        final: "",
    });

    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [selectedClassificacao, setSelectedClassificacao] = useState<any>(null);

    const [tasks, setTasks] = useState([])
    const [classificacao, setClassificacao] = useState([])
    const [descriptionText,setDescriptionText] = useState('')
    const [accessText, setAccessText] = useState('')

    const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

    const [directionOrder, setDirectionOrder] = useState<'asc' | 'desc'>('desc')
    const [selectedDate, setSelectedDate] = useState<string>('')

    const [limitDate, setLimitDate] = useState<Date|undefined>()
    const [tomorrow, setTomorrow] = useState<Date|undefined>()


    function insertOs(event: FormEvent) {
        event.preventDefault();
        console.log(event);
    }

    function updateInitialHour(hr: string) {
        setHours((hours) => ({
            ...hours,
            initial: hr,
        }));
    }

    function changeSelectedDate(event: ChangeEvent<HTMLInputElement>) {
        setSelectedCall(null)
        setSelectedProj(null)
        setSelectedDate(event?.target?.value)
        getAllOs(event?.target?.value);

    }

    function updateFinalHour(hr: string) {
        setHours((hours) => ({
            ...hours,
            final: hr,
        }));
    }

    function changeSelectedCall(chamado: ChamadosType) {
        setSelectedCall(() => chamado);
        setSelectedProj(null);
        setSelectedDate('');
    }

    function changeSelectedCallTrf(task: TaskType) {
        setSelectedProj(() => task);
        setSelectedCall(null);
        setSelectedDate('');
    }

    function validRangeTime() {

        let [hoursEnd, minutesEnd]: any = hours.final.split(":")
        let [hoursStart, minutesStart]: any = hours.initial.split(":")

        hoursEnd = parseInt(hoursEnd)
        minutesEnd = parseInt(minutesEnd)

        hoursStart = parseInt(hoursStart)
        minutesStart = parseInt(minutesStart)


        if(hoursStart > hoursEnd) {
            return false
        }

        if(hoursStart === hoursEnd && minutesStart > minutesEnd) {
            return false
        }

        return true



    }

    function validTime(time: string) {

        let [hours, minutes]: any = time.split(":")

        minutes = parseInt(minutes)
        
        if(minutes === 0 || minutes % 15 === 0 ) {

            minutes = `${minutes}`.padStart(2, '0')

            return `${hours}:${minutes}`
        }

        if (minutes < 5) {

            minutes = 0
        }
            
        else if (minutes < 15) {

            minutes = 15
        }
            
        else if (minutes < 30) {

            minutes = 30
        }
            
        else {

            minutes = 45
        }
                
        

        minutes = `${minutes}`.padStart(2, '0')
        return `${hours}:${minutes}`

    }

    function getTimeOs(horaIni: string, horaFim: string) {
        let totalHours = 0;

        let minutesIni = parseInt(horaIni.substring(2, 4));
        minutesIni = minutesIni == 0 ? 0 : 60 - minutesIni;
        let minutesFim = parseInt(horaFim.substring(2, 4));

        totalHours = minutesIni == 0 ? 0 : -1;

        let totalMinutes = minutesIni + minutesFim;

        if (totalMinutes >= 60) {
            totalHours += 1;
            totalMinutes -= 60;
        }

        let hoursIni = parseInt(horaIni.substring(0, 2));
        let hoursFim = parseInt(horaFim.substring(0, 2));

        totalHours += hoursFim - hoursIni;

        return `0${totalHours}`.slice(-2) + ":" + `0${totalMinutes}`.slice(-2);
    }

    function totalTimesOs() {
        return listOs.reduce((accum: any, current: any) => {
            let time = getTimeOs(current.HRINI_OS, current.HRFIM_OS);

            if (accum === 0) {
                return time;
            }

            let [hours, minutes] = time.split(":");

            let [hoursAcum, minutesAccum] = accum.split(":");

            let hoursTotal = parseInt(hours) + parseInt(hoursAcum);
            let minutesTotal = parseInt(minutes) + parseInt(minutesAccum);

            if (minutesTotal >= 60) {
                minutesTotal -= 60;
                hoursTotal += 1;
            }

            return `0${hoursTotal}`.slice(-2) + ":" + `0${minutesTotal}`.slice(-2);
        }, 0);
    }

    async function getAllOs(date: string = '') {
        setLoadingOs(true);

        let result = await fetch(
            "/api/os/list", {
            headers: {
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify({
                chamado: selectedCall?.COD_CHAMADO,
                data: date,
                recurso: session?.user.recurso
            })
        }
        )
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

    async function getAllOsTarefa(date: string = '') {
        setLoadingOs(true);

        let result = await fetch(
            "/api/os/list-for-trf", {
            headers: {
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify({
                tarefa: selectedProj?.COD_TAREFA,
                data: date,
                recurso: session?.user.recurso
            })
        }
        )
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

    async function changeStatus(chamado: ChamadosType, status: string) {

        if(chamado.CODTRF_CHAMADO === null) {


            let selectedTasks: any = await fetch("/api/call/task", {
                method: "POST",
                body: JSON.stringify( { chamado } )
            }).then(response => response.json())
            
            setSelectedTask(null);
            setTasks(selectedTasks);
            setModalTarefa(true);
            return;
        }

        if(status != "START" && (chamado.COD_CLASSIFICACAO === null || chamado.COD_CLASSIFICACAO === 0)) {

            let selectedClassificacao: any = await fetch("/api/call/classificacao", {
                method: "POST",
                body: JSON.stringify( { chamado } )
            }).then(response => response.json())

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

        let result = await fetch(
            "/api/call/change-status?codChamado=" + chamado.COD_CHAMADO + "&status=" + status + "&email=" + chamado.EMAIL_CHAMADO
        )
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        setOpenModal(false);
        getCalls();
    }

    async function startCall(chamado: ChamadosType) {

        if(chamado.CODTRF_CHAMADO === null) {


            let selectedTasks: any = await fetch("/api/call/task", {
                method: "POST",
                body: JSON.stringify( { chamado } )
            }).then(response => response.json())
            
            setSelectedTask(null);
            setTasks(selectedTasks);
            setModalTarefa(true);
            return;
        }


        let result = await fetch(
            "/api/call/start?codChamado=" + chamado.COD_CHAMADO
        )
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        setOpenModal(false);
        getCalls();
    }

    async function apontamento(os: TaskType | null) {

        setLoadingOs(true);


        if(!validCurrentDate(date)) {
            alert("Selecione uma data dentro do período vigente.");
            return;
        }

        if((!hours.initial) || (!hours.final) || (!date)) {
            alert("Selecione uma data e hora inicial/final");
            return;
        }


        if( hours.initial > hours.final) {

            alert("Hora inicial não pode ser maior que a hora final!")
            return;

        }

        if(description?.trim() === "") {

            console.log(description)

            alert("Descrição do apontamento é obrigatória!")
            return;
        }

    
        if (!os) {
            console.log(os)
            alert("Selecione um projeto!");
            return;
        }
        
        //criar uma função identica a esta para validar as horas do projeto

        let responseValidHours = await fetch("/api/os/valid-hours", {
            method: "POST",
            body: JSON.stringify({
                chamado: os.COD_TAREFA,
                date,
                startTime: hours.initial,
                endTime: hours.final,
            })
        })
        .then((res) => res.json())
        .then((res) => res); 


        if(responseValidHours && responseValidHours[0] < responseValidHours[1] && responseValidHours[2] !== "SIM") {

            let horasTotais =  responseValidHours[0] / 60
            //let horasApontadas = responseValidHours[1] / 60
            console.log("TESTE")
            const confirmacao = await Swal.fire({
                title: `Horas mês: ${horasTotais}h`,
                text: `Horas para está Tarefa já ultrapassaram o limite, impossível realizar o apontamento.`,
                icon: 'warning',
                showCancelButton: false,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Confirmar',
            })

                return;

        }


        let task = await fetch("/api/get-task", {
            method: "POST",
            body: JSON.stringify({
                COD_CHAMADO: os?.COD_OS
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        let result = await fetch("/api/os/apoint", {
            method: "POST",
            body: JSON.stringify({
                os,
                description,
                date,
                startTime: hours.initial,
                endTime: hours.final,
                recurso: session?.user.recurso,
                state: 'STANDBY',
                task
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        getAllOsTarefa();        
        setModalApontamento(false);
        setLoadingOs(false);
    }


    async function standbyCall(chamado: ChamadosType | null) {


        if(!validCurrentDate(date)) {
            alert("Selecione uma data dentro do período vigente.");
            return;
        }

        if((!hours.initial) || (!hours.final) || (!date)) {
            alert("Selecione uma data e hora inicial/final");
            return;
        }


        if( hours.initial > hours.final) {

            alert("Hora inicial não pode ser maior que a hora final!")
            return;

        }

        if(description?.trim() === "") {

            alert("Descrição do chamado é obrigatória!")
            return;
        }

     
        if (!chamado) {
            alert("Selecione um chamado!");
            return;
        }


        let responseValidHours = await fetch("/api/call/valid-hours", {
            method: "POST",
            body: JSON.stringify({
                chamado: chamado.COD_CHAMADO,
                date,
                startTime: hours.initial,
                endTime: hours.final,
            })
        })
        .then((res) => res.json())
        .then((res) => res);


        if(responseValidHours && responseValidHours[0]>0 && responseValidHours[0] < responseValidHours[1] && responseValidHours[2] !== "SIM") {

            let horasTotais =  responseValidHours[0] / 60
            let horasApontadas = responseValidHours[1] / 60

            const confirmacao = await Swal.fire({
                title: `Horas mês: ${horasTotais}h`,
                text: `Horas para está tarefa já ultrapassaram o limite do mês, total final após apontamento: ${horasApontadas}h. ENTRE EM CONTATO COM A SOLUTII!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Confirmar apontamento!',
                cancelButtonText: 'Cancelar'
            })

            if (confirmacao.isDenied || confirmacao.isDismissed) {
                return;
            }

        }


        let task = await fetch("/api/get-task", {
            method: "POST",
            body: JSON.stringify({
                COD_CHAMADO: selectedCall?.COD_CHAMADO
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        let result = await fetch("/api/call/standby", {
            method: "POST",
            body: JSON.stringify({
                chamado,
                description,
                date,
                startTime: hours.initial,
                endTime: hours.final,
                state: 'STANDBY',
                task
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        getCalls();
        getAllOs();        
        setModalStandby(false);
    }

    async function salvarAcessoCliente(){

        setIsChangeAccess(true)

        let result = await fetch("/api/acesso", {
            method: "POST",
            body: JSON.stringify({
                descricao: accessText,
                cliente: selectedCall?.COD_CLIENTE
            })
        })

        getCalls()

        setIsChangeAccess(false)
        setOpenModal2(false)

    }

    function openDescriptions(chamado: ChamadosType) {
        let desc = chamado?.SOLICITACAO_CHAMADO?.trim();
        desc = desc?.substring(1, desc.length - 1);
        setSelectedCall(chamado)
        setDescriptionText(desc??"");
        setOpenModal(true);
    }

    function openAccess(chamado: ChamadosType) {
        let desc = chamado?.ACESSO_CLIENTE?.trim();
        setAccessText(desc??'Acesso não informado!');
        setSelectedCall(chamado);
        setOpenModal2(true);
    }

    async function updateChamadoTarefa() {
        setLoadingOs(true);


        if(!selectedTask) {
            alert("Selecione uma tarefa!")
            return;
        }


        let result = await fetch("/api/insert-task", {
            method: "POST",
            body: JSON.stringify({
                COD_CHAMADO: selectedCall?.COD_CHAMADO,
                COD_TAREFA: selectedTask 
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        if(selectedCall) {
            let call = {
                ...selectedCall,
                CODTRF_CHAMADO: selectedTask
            }
            await startCall(call)
        }


        setModalTarefa(false);

        setLoadingOs(false);

    }

    async function updateClassificacao() {
        setLoadingOs(true);

        if(!selectedClassificacao) {
            alert("Selecione uma classificação!")
            return;
        }


        let result = await fetch("/api/insert-classificacao", {
            method: "POST",
            body: JSON.stringify({
                COD_CHAMADO: selectedCall?.COD_CHAMADO,
                COD_CLASSIFICACAO: selectedClassificacao
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        if (!result) return;

        if(selectedCall) {
            let call = {
                ...selectedCall,
                CODTRF_CHAMADO: selectedTask
            }
            await startCall(call)
        }


        setModalClassificacao(false);

        setLoadingOs(false);

    }

    useEffect(() => {
        if (!selectedCall) return;

        getAllOs();
    }, [selectedCall]);

    useEffect(() => {
        if (!selectedProj) return;

        getAllOsTarefa();
    }, [selectedProj]);

    useEffect(() => {
        if (!session) return;

        getCalls();
        getTasksProject();
        getLimitDate();
    }, [session]);

    function getLimitDate() {

        let tomorrow = (new Date(`${(new Date()).toISOString().split('T')[0]} 00:00`));
        tomorrow.setDate(tomorrow.getDate() + 1)

        setTomorrow(tomorrow)

        fetch(
            "/api/os/valid", {
            headers: {
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify({
                recurso: session?.user.recurso
            })
        }
        )
            .then((res) => res.json())
            .then((res) => {

                if(res[0].PERMAPO_RECURSO === "SIM") {
                    setLimitDate(new Date(res[0].DTLIMITE_RECURSO))
                } else {
                    let date = (new Date(`${(new Date()).toISOString().split('T')[0]} 00:00`));
                    date.setDate(date.getDate() - 1)
                    setLimitDate(date)
                }
            })
            .catch(() => {
                setLoadingOs(false);
            })




    }

    function orderTo(field: string) {

        let asc = calls[0].COD_CHAMADO

        let newList = calls.sort((a: any, b: any) => {
            if (a[field] < b[field]) {
                return -1;
            } else if (a[field] > b[field]) {
                return 1;
            } else {
                return 0;
            }
        });

        if (newList[0].COD_CHAMADO === asc) {
            newList = newList.reverse();
        }


        setCalls([...newList]);

    }

    async function updateCall(codChamado: string, data: string, horaIni: string, horaFim: string, state: string) 
    {
        let result = fetch("/api/call/update", {
            method: "POST",
            body: JSON.stringify({
                codChamado,
                data,
                horaIni,
                horaFim,
                state
            }),
        })
            .then((res) => res.json())
            .then((res) => res);

    }

    function handleEdit(os: any) {
        
        setSelectedOs(os);

        setHours({
            initial: os.HRINI_OS.replace(/(\d{2})(\d{2})/, "$1:$2"),
            final: os.HRFIM_OS.replace(/(\d{2})(\d{2})/, "$1:$2")
        });

        setDescription(os.OBS)
        setDate(os.DTINI_OS.substring(0,10));

        setModalEditOS(true);
    }

    async function handleDelete(os: any) {


        const confirmacao = await Swal.fire({
            title: 'Deseja excluir esta OS?',
            text: "Esta ação não poderá ser desfeita!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir!',
            cancelButtonText: 'Cancelar'
        })

        if (confirmacao.isDenied || confirmacao.isDismissed) {
            return;
        }


        setLoadingOs(true);

        let result = await fetch("/api/os/delete", {
            method: "POST",
            body: JSON.stringify({
                codOs: os.COD_OS
            })
        })
            .then((res) => res.json())
            .then((res) => res);

        setLoadingOs(false);

        if(tab === 'chamado') {
            getCalls();
            getAllOs(selectedDate);
        } else {
            getAllOsTarefa()
        }
    }

    async function updateOs() {

        if(!validCurrentDate(date)) {
            alert("Selecione uma data dentro do período vigente.");
            return;
        }

        if((!hours.initial) || (!hours.final) || (!date)) {
            alert("Selecione uma data e hora inicial/final");
            return;
        }

        if( hours.initial > hours.final) {
            alert("Hora inicial não pode ser maior que a hora final!")
            return;
        }

        if(description?.trim() === "") {
            alert("Descrição do chamado é obrigatória!")
            return;
        }

        setLoadingOs(true)

        let result = await fetch("/api/os/update", {
            method: "POST",
            body: JSON.stringify({
                codOs: selectedOs.COD_OS,
                description,
                date,
                startTime:hours.initial,
                endTime: hours.final
            })
        })
            .then((res) => res.json())

        setLoadingOs(false)

        if(tab === 'chamado') {
            getCalls();
            getAllOs(selectedDate);
        } else {
            getAllOsTarefa()
        }

        setModalEditOS(false);

        return

    }

    function validCurrentDate(date: string): boolean {
        let selectedDate = date.length > 10 ? new Date(date) : new Date(date+`T00:00`);
        let tomorrow = (new Date(`${(new Date()).toISOString().split('T')[0]} 00:00`));
        tomorrow.setDate(tomorrow.getDate() + 1)
        return selectedDate >= (limitDate??'') && selectedDate < tomorrow
    }


    return (
        <main className="w-full h-full flex flex-col justify-center items-center p-4">

            { isUploading &&
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
                        <Loading />
                        <p className="text-gray-700">Enviando arquivo...</p>
                    </div>
                </div>
            }

            { isChangeAccess &&
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
                        <Loading />
                        <p className="text-gray-700">Atualizando acesso...</p>
                    </div>
                </div>
            }


            {isOpenModal && 
                <Modal
                    isOpen={isOpenModal}
                    setOpenModal={setOpenModal}
                    title="Descrição"
                >
                    <p
                        className="my-4 text-blueGray-500 text-lg leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: descriptionText }}
                    ></p>
                </Modal>
            }

            {isOpenModal2 &&
                <Modal
                    isOpen={isOpenModal2}
                    setOpenModal={setOpenModal2}
                    title="Dados de Acesso"

                    action={salvarAcessoCliente}
                    actionText="Salvar"
                >
                    <textarea
                    onChange={event => setAccessText(event.target.value)}
                    style={{
                        width: '100%',
                        resize: 'none',
                        minHeight: '300px',
                        padding: '10px'
                    }} name="acesso" id="acesso" value={accessText} />
                </Modal>
            }

            {modalTarefa &&
                <Modal 
                    isOpen={modalTarefa}
                    setOpenModal={setModalTarefa}
                    title="Selecione a Tarefa do chamado!"
                    action={updateChamadoTarefa}
                >
                    <select title="tarefa" name="tarefa" id="tarefa" onChange={(event) => setSelectedTask( event.target.value)}>
                        <option value="">Selecione uma Tarefa</option>
                        {   
                            tasks.map((task: any, index) => (
                                <option key={index} value={task.COD_TAREFA}>{task.NOME_TAREFA}</option>
                            ))
                        }
                    </select>

                </Modal>
            }

            {modalClassificacao &&
                <Modal 
                    isOpen={modalClassificacao}
                    setOpenModal={setModalClassificacao}
                    title="Selecione a Classificação do chamado!"
                    action={updateClassificacao}
                >
                    <select title="classificacao" name="classificacao" id="classificacao" onChange={(event) => setSelectedClassificacao( event.target.value)}>
                        <option value="">Selecione uma Classificação</option>
                        {   
                            classificacao.map((cls: any, index) => (
                                <option key={index} value={cls.COD_CLASSIFICACAO}>{cls.NOME_CLASSIFICACAO}</option>
                            ))
                        }
                    </select>

                </Modal>
            }

            {modalStandby && (
                <Modal
                    isOpen={modalStandby}
                    setOpenModal={setModalStandby}
                    title="StandBy"
                    action={() => standbyCall(selectedCall)}
                >
                    <label>Descrição</label>
                    <textarea
                        rows={5}
                        className="w-full border-zinc-300 border-2 outline-none rounded-lg resize-none p-2"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                    />

                    <p>Horas</p>

                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateInitialHour(event.target.value)}
                            onBlur={event => updateInitialHour(validTime(event.target.value))}
                            value={hours.initial}
                            type="time"
                        />
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateFinalHour(event.target.value)}
                            onBlur={event => updateFinalHour(validTime(event.target.value))}
                            value={hours.final}
                            type="time"
                        />
                    </div>

                    <p className="pt-4">Data</p>
                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                            
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => setDate(event.target.value)}
                            value={date}
                            min={limitDate?.toISOString()?.split('T')[0]}
                            max={(new Date())?.toISOString()?.split('T')[0]}
                            type="date" />
                    </div>
                </Modal>
            )}

            {
                modalEditOS && <Modal
                    title="Editar apontamento"
                    isOpen={modalEditOS}
                    setOpenModal={setModalEditOS}
                    action={updateOs} 

                >
                    <p>Chamado: {selectedOs?.COD_OS}</p>
                    <label>Descrição</label>
                    <textarea
                        title="descricao"
                        rows={5}
                        className="w-full border-zinc-300 border-2 outline-none rounded-lg resize-none p-2"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                    />

                    <p>Horas</p>

                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateInitialHour(event.target.value)}
                            onBlur={event => updateInitialHour(validTime(event.target.value))}
                            value={hours.initial}
                            type="time"
                        />
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateFinalHour(event.target.value)}
                            onBlur={event => updateFinalHour(validTime(event.target.value))}
                            value={hours.final}
                            type="time"
                        />
                    </div>

                    <p className="pt-4">Data</p>
                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                            
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => setDate(event.target.value)}
                            value={date}
                            type="date" />
                    </div>
                </Modal>
            }

            {modalApontamento && (
                <Modal
                    isOpen={modalApontamento}
                    setOpenModal={setModalApontamento}
                    title="Apontamento"
                    action={() => apontamento(selectedProj)}
                >
                    <label>Descrição</label>
                    <textarea
                        rows={5}
                        className="w-full border-zinc-300 border-2 outline-none rounded-lg resize-none p-2"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                    />

                    <p>Horas</p>

                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateInitialHour(event.target.value)}
                            onBlur={event => updateInitialHour(validTime(event.target.value))}
                            value={hours.initial}
                            type="time"
                        />
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => updateFinalHour(event.target.value)}
                            onBlur={event => updateFinalHour(validTime(event.target.value))}
                            value={hours.final}
                            type="time"
                        />
                    </div>

                    <p className="pt-4">Data</p>
                    <div className="w-full flex flex-row justify-between gap-8 pt-2">
                            
                        <input
                            className="border-zync-300 border-2 outline-none rounded-lg p-2 w-[40%]"
                            onChange={(event) => setDate(event.target.value)}
                            value={date}
                            min={limitDate?.toISOString()?.split('T')[0]}
                            max={(new Date())?.toISOString()?.split('T')[0]}
                            type="date" />
                    </div>
                </Modal>
            )}

            <UserComponent signOut={signOut} onSave={()=>{}}/>

            <section className="flex flex-row justify-center w-full margin-auto max-w-[800px]">
                <h2
                    onClick={() => setTab('chamado')}
                    className={
                        tab === "chamado"
                            ? "bg-orange-700 w-[50%] text-center text-white h-8 p-1 rounded-l-lg"
                            : "bg-zinc-100 w-[50%] text-center text-zinc-700 h-8 p-1 rounded-l-lg cursor-pointer"
                    }
                >
                    Chamado
                </h2>
                <h2
                    onClick={() => setTab('os')}
                    className={
                        tab === "os"
                            ? "bg-orange-700 w-[50%] text-center text-white h-8 p-1 rounded-r-lg"
                            : "bg-zinc-100 w-[50%] text-center text-zinc-700 h-8 p-1 rounded-r-lg cursor-pointer"
                    }
                >
                    OS
                </h2>
            </section>

            {tab === "chamado" ?         
            <section className="w-full sm:text-sm text-xs pt-6 overflow-auto">

                {/* <Box sx={{ height: 400, width: "100%" }}>
                    <DataGrid
                        getRowId={r => r.COD_CHAMADO}
                        rows={calls}
                        columns={columns}
                        initialState={{
                            pagination: {
                                paginationModel: {
                                    pageSize: 5,
                                },
                            },
                        }}
                        pageSizeOptions={[5]}

                    />
                </Box> */}


                <table className="w-full min-w-full border-collapse rounded-lg">
                    <thead>
                        <tr className="text-cyan-100 bg-cyan-900 h-12 rounded-tl-lg rounded-tr-lg">
                            <th onClick={_ => orderTo('COD_CHAMADO')} className="rounded-tl-lg cursor-pointer">Número</th>
                            <th className="cursor-pointer" onClick={_ => orderTo('ASSUNTO_CHAMADO')}>Assunto</th>
                            <th>E-mail</th>
			    <th className="cursor-pointer" onClick={_ => orderTo('DTENVIO_CHAMADO')}>Data</th>                            
			    <th className="cursor-pointer" onClick={_ => orderTo('STATUS_CHAMADO')}>Status</th>
                            <th>Ações</th>
                            <th className="w-[130px] rounded-tr-lg">Arquivos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calls.map((c: any, k: number) => (
                            <tr
                                key={`${k}call`}
                                className={"odd:bg-zinc-100 p-4 border-2" +
                                    (c?.COD_CHAMADO === selectedCall?.COD_CHAMADO
                                        ? " !bg-indigo-200 outline-2"
                                        : "")
                                }
                                onClick={() => changeSelectedCall(c) }
                            >
                                <td className="text-center p-2">
                                    {c?.COD_CHAMADO?.toLocaleString("pt-br")}
                                </td>
                                <td className="text-start  p-2">{Buffer.from(c?.ASSUNTO_CHAMADO, "latin1").toString("utf8")}</td>
                                <td className="text-start  p-2">{c?.EMAIL_CHAMADO}</td>
				<td className="text-center  p-2">
                                    {c?.DTENVIO_CHAMADO?.replace("-", " ")}
                                </td>
                                <td className="text-center  p-2">{c?.STATUS_CHAMADO}</td>
                                <td className="text-center flex flex-row gap-4 sm:gap-2 sm:flex-nowrap flex-wrap  sm:justify-between justify-center  max-w-[130px] p-2">

                                    {/* <LuPointer 
                                        onClick={(e) => {e.stopPropagation()} }
                                        title="APONTAMENTO"
                                        style={{ cursor: "pointer" }}
                                        className="text-indigo-900 hover:text-indigo-500"
                                        size={18}
                                    />*/}
                                    {c.STATUS_CHAMADO !== "EM ATENDIMENTO" && (
                                        <VscDebugStart
                                            onClick={(e) =>  { /* e.stopPropagation(); */startCall(c);}}
                                            title="EM ATENDIMENTO"
                                            style={{ cursor: "pointer" }}
                                            className="text-green-600 hover:text-green-400"
                                            size={18}
                                        />
                                    )}

                                    {c.STATUS_CHAMADO !== "STANDBY" &&
                                        c.STATUS_CHAMADO !== "AGUARDANDO VALIDACAO" &&
                                        c.STATUS_CHAMADO !== "ATRIBUIDO" && (
                                            <PiPauseDuotone
                                                title="STANDBY"
                                                onClick={(e) => { setModalStandby(true) }}
                                                style={{ cursor: "pointer" }}
                                                className="text-yellow-500 hover:text-yellow-300"
                                                size={18}
                                            />
                                        )}

                                    {c.STATUS_CHAMADO !== "AGUARDANDO VALIDACAO" &&
                                        c.STATUS_CHAMADO !== "ATRIBUIDO" && (
                                            <ImStop
                                                onClick={(e) =>  { /* e.stopPropagation(); */changeStatus(c, STATUS_CHAMADO['AGUARDANDO VALIDACAO']);}}
                                                title="AGUARDANDO VALIDAÇÃO"
                                                style={{ cursor: "pointer" }}
                                                className="text-red-700 hover:text-red-500"
                                                size={18}
                                            />
                                        )}

                                    {c.STATUS_CHAMADO !== "ATRIBUIDO" && (
                                        <TbCalendarCheck
                                            onClick={(e) =>  { /* e.stopPropagation(); */changeStatus(c, STATUS_CHAMADO['FINALIZADO']);}}
                                            title="FINALIZADO"
                                            style={{ cursor: "pointer" }}
                                            className="text-orange-500 hover:text-orange-300"
                                            size={18}
                                        />
                                    )}

                                    <HiOutlineClipboardDocumentList
                                        onClick={() => openDescriptions(c)}
                                        title="Detalhamento"
                                        style={{ cursor: "pointer" }}
                                        className="text-fuchsia-700 hover:text-fuchsia-500"
                                        size={18}
                                    />

                                    <HiOutlineClipboardDocumentList
                                        onClick={() => openAccess(c)}
                                        title="Acesso Cliente"
                                        style={{ cursor: "pointer" }}
                                        className="text-fuchsia-700 hover:text-fuchsia-500"
                                        size={18}
                                    />
                                </td>
                                <td >
                                    <div style={{
                                        display: "flex",
                                        flexDirection: 'row-reverse',
                                        alignItems: 'start',
                                        gap: 8
                                    }}>

                                    
                                    <form
                                        action={"/api/upload"+c?.COD_CHAMADO}
                                        method="post"
                                        encType="multipart/form-data"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="file"
                                            name="file"
                                            accept="image/*"
                                            className="hidden"
                                            id={`upload-${c?.COD_CHAMADO}`}
                                            onChange={(e) => {
                                                if (e.target.files?.length) {
                                                    const formData = new FormData();
                                                    formData.append("file", e.target.files[0]);
                                                    formData.append("codChamado", c?.COD_CHAMADO);

                                                    setIsUploading(true)

                                                    fetch("/api/upload/?codChamado="+c?.COD_CHAMADO, {
                                                        method: "POST",
                                                        body: formData,
                                                    })
                                                        .then((res) => res.json())
                                                        .then((data) => {
                                                            if (data.success) {
                                                                alert("Upload realizado com sucesso!");
                                                            } 
                                                        })
                                                        .catch(() => alert("Erro ao realizar upload."))
                                                        .finally( ()=> setIsUploading(false))
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor={`upload-${c?.COD_CHAMADO}`}
                                            className="cursor-pointer text-blue-500 hover:text-blue-700"
                                        >
                                            <MdOutlineDriveFolderUpload title="Upload" size="22" /> 
                                        </label>
                                    </form>
                                    <a  href={"/api/arquivos?codChamado="+c?.COD_CHAMADO} target="_blank"><HiOutlineFolderDownload color="green" title="Download" size="22"/></a>

                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            :
            <section className="w-full sm:text-sm text-xs pt-6 overflow-auto">

                <table className="w-full min-w-full border-collapse rounded-lg">
                    <thead>
                        <tr className="text-cyan-100 bg-cyan-900 h-12 rounded-tl-lg rounded-tr-lg">
                            <th onClick={_ => orderTo('COD_TAREFA')} className="rounded-tl-lg cursor-pointer">Número</th>
                            <th className="cursor-pointer" onClick={_ => orderTo('NOME_TAREFA')}>Assunto</th>
                            <th>Cliente</th>
                            <th>Hora Tarefa</th>
                            <th className="cursor-pointer" onClick={_ => orderTo('DTSOL_TAREFA')}>Data</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projes.map((c: any, k: number) => (
                            <tr
                                key={`${k}call`}
                                className={"odd:bg-zinc-100 p-4 border-2" +
                                    (c?.COD_TAREFA === selectedProj?.COD_TAREFA
                                        ? " !bg-indigo-200 outline-2"
                                        : "")
                                }
                                onClick={() => changeSelectedCallTrf(c) }
                            >
                                <td className="text-center p-2">
                                    {c?.COD_TAREFA?.toLocaleString("pt-br")}
                                </td>
                                <td className="text-start  p-2">{c?.NOME_TAREFA}</td>
                                <td className="text-start  p-2">{c?.NOME_CLIENTE}</td>
                                <td className="text-center  p-2">{c?.HRREAL_TAREFA}h</td>
                                <td className="text-center  p-2">
                                    {(new Date(c?.DTSOL_TAREFA)).toLocaleString("pt-br").slice(0,10)}
                                </td>
                                <td className="text-center flex flex-row gap-4 sm:gap-2 sm:flex-nowrap flex-wrap  sm:justify-between justify-center  max-w-[130px] p-2">

                                    <LuPointer 
                                        onClick={(e) => {setModalApontamento(true)} }
                                        title="APONTAMENTO"
                                        style={{ cursor: "pointer" }}
                                        className="text-indigo-900 hover:text-indigo-500"
                                        size={18}
                                    />

                                    

                                    <HiOutlineClipboardDocumentList
                                        onClick={() => openDescriptions(c)}
                                        title="Detalhamento"
                                        style={{ cursor: "pointer" }}
                                        className="text-fuchsia-700 hover:text-fuchsia-500"
                                        size={18}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            }

            <section className="w-full sm:text-sm text-xs pt-6 overflow-auto">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-row items-center gap-1">
                        <input placeholder="Selecione uma data" type="date" value={selectedDate} onChange={changeSelectedDate} className="h-8 p-2 w-[160px] outline-none border-2 border-zinc-200 rounded-md" />
                        <IoCloseCircleOutline onClick={_ => { if (!selectedCall && !selectedProj) setListOs([]); setSelectedDate(''); }} className="cursor-pointer text-red-500 size-4 rounded-lg" />
                    </div>
                    {selectedCall && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-100 border border-cyan-400 text-cyan-900 text-xs font-semibold">
                            📋 Apontamentos do chamado: <b>#{selectedCall.COD_CHAMADO}</b> — {selectedCall.NOME_CLIENTE}
                        </span>
                    )}
                    {selectedProj && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 border border-indigo-400 text-indigo-900 text-xs font-semibold">
                            📋 Apontamentos do Projeto: <b>{selectedProj.COD_TAREFA}</b> — {selectedProj.NOME_TAREFA}
                        </span>
                    )}
                    {selectedDate && !selectedCall && !selectedProj && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 border border-green-400 text-green-900 text-xs font-semibold">
                            📅 Apontamentos da data: <b>{new Date(selectedDate + 'T00:00').toLocaleDateString('pt-br')}</b>
                        </span>
                    )}
                </div>
            </section>


            {loadingOs ? (
                <Loading />
            ) : (
                !!listOs?.length && (
                    <section className="w-full sm:text-sm text-xs pt-6 overflow-auto">
                        <table className="w-full min-w-full border-collapse rounded-lg">
                            <thead>
                                <tr className="text-cyan-100 bg-cyan-800 h-10 rounded-tl-lg rounded-tr-lg">
                                    <th className="rounded-tl-lg">Código</th>
                                    <th>Cliente</th>
                                    <th>Tarefa</th>
                                    <th>Data</th>
                                    <th>Hora Início</th>
                                    <th>Hora Fim</th>
                                    <th className="w-[130px]">Tempo</th>
                                    <th className="rounded-tr-lg"></th>
                                </tr>
                            </thead>

                            <tbody className="max-h-[300px] overflow-auto text-xs">
                                {listOs.map((os: any) => (
                                    <tr
                                        key={os?.COD_OS}
                                        className="odd:bg-zinc-100 h-[20px] border-zinc-300 border-b-2"
                                    >
                                        <td className="p-2 text-center">
                                            {os?.COD_OS.toLocaleString("pt-br")}
                                        </td>
                                        <td className="p-2 text-center">{os.NOME_CLIENTE}</td>
                                        <td className="p-2">{os.OBS}</td>
                                        <td className="p-2 text-center">
                                            {new Date(os.DTINI_OS).toLocaleString("pt-br", {
                                                year: "numeric",
                                                month: "2-digit",
                                                day: "2-digit",
                                            })}
                                        </td>
                                        <td className="p-2 text-center">
                                            {os.HRINI_OS.replace(/(\d{2})(\d{2})/g, "$1:$2")}
                                        </td>
                                        <td className="p-2 text-center">
                                            {os.HRFIM_OS.replace(/(\d{2})(\d{2})/g, "$1:$2")}
                                        </td>
                                        <td className="p-2 text-center">
                                            {getTimeOs(os.HRINI_OS, os.HRFIM_OS)}
                                        </td>
                                        <td>
                                            {
                                                validCurrentDate(os.DTINI_OS) &&
                                                <div className="flex flex-row gap-2 justify-evenly">
                                                    <CiEdit 
                                                        onClick={() => handleEdit(os)}
                                                        style={{ cursor: "pointer" }} 
                                                        className="text-orange-700 hover:text-orange-500 text-center"
                                                        size={18}/>
                                                    <PiTrashDuotone
                                                        onClick={() => handleDelete(os)}
                                                        style={{ cursor: "pointer" }} 
                                                        className="text-red-700 hover:text-red-500 text-center"
                                                        size={18}
                                                    />    
                                                </div>
                                            }
                                        </td>

                                        
                                        
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-yellow-200 text-xs">
                                    <td colSpan={4} className="p-2 text-center"></td>
                                    <td colSpan={4} className="p-2 text-right text-orange-800">
                                        total: <b>{totalTimesOs()} hrs</b>
                                    </td>
                                    
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                )
            )}
        </main>
    );
}
