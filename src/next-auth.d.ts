import NextAuth from 'next-auth';
   declare module 'next-auth' {
   interface Session {
    user: {
     recurso: string,
     id: string;
     // "ADM" (administrador) ou "USU" (consultor)
     tipo?: string;
      } & DefaultSession['user'];
     }
    }