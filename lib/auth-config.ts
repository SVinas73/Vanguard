import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          if (error || !user || !user.password) return null;

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch {
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas — ERP con datos financieros sensibles
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      
      // Opcional: Revalidar rol en cada request (descomentar si querés actualizaciones automáticas)
      // ADVERTENCIA: Esto hace una query a Supabase en cada request, puede impactar performance
      /*
      if (token.email && trigger === 'update') {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('email', token.email)
          .single();
        
        if (userData) {
          token.role = userData.role;
          console.log('🔄 Role updated in JWT:', token.role);
        }
      }
      */
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Si la URL es relativa, la combinamos con baseUrl
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Si la URL ya contiene baseUrl, la devolvemos
      if (url.startsWith(baseUrl)) return url;
      // Por defecto, volvemos a la home
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};