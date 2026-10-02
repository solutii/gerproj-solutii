import UserService from "@/services/usuario"
import {
  ipDaRequisicao,
  minutosDeBloqueio,
  registrarFalhaLogin,
  registrarLoginOk,
} from "@/services/login-limite"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
    callbacks: {
      session({ session, token, user }) {
        session.user.recurso = session.user.email['COD_RECURSO']
        session.user.id = session.user.email['COD_USUARIO']
        session.user.tipo = session.user.email['TIPO_USUARIO']
        session.user.dataLimite = session.user.email['DTLIMITE_RECURSO']
        session.user.email = ""
        return session 
      },
    },
    session: {
      maxAge: 4*60*60
    },
    providers: [
        CredentialsProvider({
          name: 'Credentials',
          credentials: {
            username: { label: "Username", type: "text", placeholder: "solutii.s" },
            password: { label: "Password", type: "password" }
          },
          async authorize(credentials, req) {

            const usuario = credentials?.username ?? ''
            const ip = ipDaRequisicao(req?.headers as Record<string, unknown> | undefined)

            // Muitas tentativas erradas: bloqueia por um tempo (a tela reconhece o código).
            if (minutosDeBloqueio(ip, usuario) > 0) {
              throw new Error('LOGIN_BLOQUEADO')
            }

            try {
              const user: any = await UserService({
                login: usuario,
                password: credentials?.password ?? ''
              })

              registrarLoginOk(ip, usuario)
  
              return {
                
                id: user['COD_USUARIO'],
                name: user['NOME_USUARIO'],
                // Só o que a aplicação usa (ver callback de sessão acima) -- a linha
                // inteira do usuário, com a senha, não vai pro token de sessão.
                email: {
                  COD_USUARIO: user['COD_USUARIO'],
                  COD_RECURSO: user['COD_RECURSO'],
                  DTLIMITE_RECURSO: user['DTLIMITE_RECURSO'],
                  // ADM ou USU: decide qual área o usuário enxerga (utils/perfil.ts)
                  TIPO_USUARIO: String(user['TIPO_USUARIO'] ?? '').trim().toUpperCase(),
                } as any

              }

            } catch(error) {
              // Só usuário/senha errados contam como tentativa falha (erro de banco não).
              if (error === 'Usuário não encontrado' || error === 'Senha incorreta') {
                registrarFalhaLogin(ip, usuario)
              }
              console.log(error)
              return null
            }
      
          },
          
        })
      ],
      pages: {
        signIn: '/login'
      }
})

export { handler as GET, handler as POST }