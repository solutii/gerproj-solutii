import { ChamadosType } from "@/models/chamados";
import { Dispatch, SetStateAction, useState } from "react";

type ModalType = {
  children: React.ReactNode;
  isOpen: boolean;
  setOpenModal: Dispatch<SetStateAction<boolean>>;
  title: string;
  actionText?: string | undefined;
  action?: Function | undefined;
};

export default function Modal({
  children,
  isOpen,
  setOpenModal,
  title,
  actionText,
  action,
}: ModalType) {
  const [showModal, setShowModal] = useState(isOpen);
  return (
    <>
      {showModal ? (
        <>
          <div className="justify-center items-center flex fixed inset-0 z-50 outline-none focus:outline-none">
            <div className="relative w-full">
              {/*content*/}
              <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none max-w-[1200px] mx-auto">
                {/*header*/}
                <div className="flex items-start justify-between p-5 border-b border-solid border-blueGray-200 rounded-t text-center">
                  <h3 className="text-3xl font-semibold">{title}</h3>
                  <button
                    className="p-1 ml-auto bg-transparent border-0 text-black float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                    onClick={() => setOpenModal(false)}
                  >
                    <span className="bg-transparent text-black opacity-60 h-6 w-6 text-2xl block outline-none focus:outline-none">
                      ×
                    </span>
                  </button>
                </div>
                {/*body*/}
                <div className="relative p-6 flex-auto max-h-[60vh] overflow-y-auto">
                  {children}
                </div>
                {/*footer*/}
                <div className="flex items-center justify-end p-6 border-t border-solid border-blueGray-200 rounded-b">
                  <button
                    className="text-red-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                    type="button"
                    onClick={() => setOpenModal(false)}
                  >
                    Fechar
                  </button>

                  {action && (
                    <button
                      className="bg-emerald-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                      type="button"
                      onClick={action as any}
                    >
                      {actionText ? actionText : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
      ) : null}
    </>
  );
}
