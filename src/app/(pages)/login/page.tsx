"use client";

import { Suspense, useEffect, useState } from "react";
import { destinoAposLogin } from "@/utils/perfil";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiUser, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { PiSpinnerGap } from "react-icons/pi";
import { TbClockHour4 } from "react-icons/tb";

const createLoginFormSchema = z.object({
  login: z
    .string({ required_error: "Campo obrigatório." })
    .min(1, "Campo obrigatório."),
  password: z
    .string({ required_error: "Campo obrigatório." })
    .min(1, "Campo obrigatório."),
});

type createLoginFormData = z.infer<typeof createLoginFormSchema>;

// Lembra só o usuário digitado (nunca a senha) -- pura conveniência de
// preencher o campo, não é um mecanismo de sessão persistente.
const LEMBRAR_USUARIO_KEY = "gerproj:lembrar-usuario";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/home";

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [lembrarUsuario, setLembrarUsuario] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<createLoginFormData>({
    resolver: zodResolver(createLoginFormSchema),
  });

  // Preenche o campo "Usuário" com o valor salvo, se houver.
  useEffect(() => {
    const usuarioSalvo = localStorage.getItem(LEMBRAR_USUARIO_KEY);
    if (usuarioSalvo) {
      setValue("login", usuarioSalvo);
      setLembrarUsuario(true);
    }
  }, [setValue]);

  async function login(data: createLoginFormData) {
    setLoginError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      username: data.login,
      password: data.password,
      redirect: false,
    });

    if (!result || result.error) {
      setIsSubmitting(false);
      setLoginError(
        result?.error === "LOGIN_BLOQUEADO"
          ? "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
          : "Usuário ou senha inválidos.",
      );
      return;
    }

    if (lembrarUsuario) {
      localStorage.setItem(LEMBRAR_USUARIO_KEY, data.login);
    } else {
      localStorage.removeItem(LEMBRAR_USUARIO_KEY);
    }

    // mantém o loading ativo até a navegação de fato acontecer -- só
    // desligamos no caminho de erro acima; aqui o componente fica
    // desmontado assim que o router troca de página.
    // O administrador sempre cai no painel de controle; o consultor, no destino de sempre.
    const sessao = await getSession();
    router.push(destinoAposLogin(sessao?.user?.tipo, callbackUrl, window.location.origin));
  }

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a2540] via-[#0f3d63] to-[#155a8a] p-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      <TbClockHour4
        aria-hidden
        className="absolute -right-16 -bottom-16 text-white/[0.06] pointer-events-none select-none"
        size={420}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Solutii <span className="font-light text-cyan-300">Sistemas</span>
          </h1>
          <p className="text-cyan-100/70 text-sm mt-1">
            GerProj &middot; Controle de Apontamentos
          </p>
        </div>

        <form
          onSubmit={handleSubmit(login)}
          noValidate
          className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-5"
        >
          <div>
            <label
              htmlFor="login"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Usuário
            </label>
            <div className="relative">
              <FiUser
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={18}
              />
              <input
                id="login"
                {...register("login")}
                autoFocus
                autoComplete="username"
                placeholder="solutii.s"
                className="w-full h-12 pl-10 pr-4 rounded-lg border border-slate-300 text-slate-800 outline-none transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
              />
            </div>
            {errors.login && (
              <p className="text-red-500 text-xs mt-1">
                {errors.login.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <FiLock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={18}
              />
              <input
                id="password"
                {...register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full h-12 pl-10 pr-10 rounded-lg border border-slate-300 text-slate-800 outline-none transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 depth-icon"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={lembrarUsuario}
              onChange={(e) => setLembrarUsuario(e.target.checked)}
              className="w-4 h-4 accent-[#0f3d63]"
            />
            Lembrar meu usuário
          </label>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 rounded-lg bg-[#0f3d63] text-white font-semibold flex items-center justify-center gap-2 transition depth-btn hover:bg-[#0c3252] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <PiSpinnerGap className="animate-spin" size={18} />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="text-center text-cyan-100/50 text-xs mt-6">
          &copy; {new Date().getFullYear()} Solutii Sistemas
        </p>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
