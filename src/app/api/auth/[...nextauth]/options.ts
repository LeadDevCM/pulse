import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { kv } from "@vercel/kv";
import { logAudit } from "@/lib/audit";
import type { User } from "@/types";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const userId = await kv.get<string>(`user:email:${credentials.email}`);
        if (!userId) {
          await logAudit({
            action: "login_failed",
            userId: "unknown",
            userRole: "unknown",
            resourceType: "auth",
            metadata: { email: credentials.email },
          });
          return null;
        }

        const raw = await kv.get<string>(`user:${userId}`);
        if (!raw) return null;

        const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await logAudit({
            action: "login_failed",
            userId: user.id,
            userRole: user.role,
            resourceType: "auth",
          });
          return null;
        }

        await logAudit({
          action: "login_success",
          userId: user.id,
          userRole: user.role,
          resourceType: "auth",
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicianId: user.clinicianId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clinicianId = user.clinicianId;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.clinicianId = token.clinicianId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes -- HIPAA session timeout
  },
};
