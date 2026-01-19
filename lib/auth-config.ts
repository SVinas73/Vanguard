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
        console.log('🔐 Login attempt:', credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          console.log('🔍 Searching user in Supabase...');
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          console.log('📊 Result:', { found: !!user, error: error?.message });

          if (error || !user || !user.password) {
            console.log('❌ User not found');
            return null;
          }

          console.log('🔑 Verifying password...');
          const isValid = await bcrypt.compare(credentials.password, user.password);
          console.log('✅ Password valid:', isValid);

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error('💥 Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
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
      console.log('🔀 Redirect callback:', { url, baseUrl });
      
      // Ignorar archivos estáticos y API routes
      if (
        url.includes('/manifest.json') ||
        url.includes('/_next/') ||
        url.includes('/api/') ||
        url.includes('/favicon') ||
        url.includes('.') // Cualquier archivo con extensión
      ) {
        return url;
      }
      
      // Si está en la página de login, ir a home
      if (url === baseUrl + '/login' || url === '/login') {
        return baseUrl;
      }
      
      // Si es una URL del mismo sitio, usarla
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Si es una ruta relativa, construir URL completa
      if (url.startsWith('/')) {
        return baseUrl + url;
      }
      
      // Por defecto, ir a home
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};