import type { NextAuthConfig } from 'next-auth';

// Config leve, sem providers/adapter — compatível com Edge Runtime (middleware)
export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
