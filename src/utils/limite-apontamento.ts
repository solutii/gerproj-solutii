import { agoraNoFuso } from "@/utils/horario-futuro";

type RegistroPeriodo = { PERMAPO_RECURSO?: string | null; DTLIMITE_RECURSO?: string | Date | null };

// Primeiro dia em que o consultor ainda pode apontar:
// - com permissão de apontar no passado (PERMAPO = "SIM"): a data-limite cadastrada;
// - sem ela: só a partir de ontem.
// `undefined` enquanto o cadastro não foi carregado.
export function calcularLimiteApontamento(
  registro: RegistroPeriodo | undefined | null,
  hoje: string = agoraNoFuso().data,
): Date | undefined {
  if (!registro) return undefined;

  if (registro.PERMAPO_RECURSO === "SIM" && registro.DTLIMITE_RECURSO) {
    return new Date(registro.DTLIMITE_RECURSO);
  }

  const ontem = new Date(`${hoje}T00:00`);
  ontem.setDate(ontem.getDate() - 1);

  return ontem;
}
