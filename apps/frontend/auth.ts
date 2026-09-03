import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import crypto from "crypto";

// Generate a secure random API key
function generateApiKey(): string {
  return `fc_${crypto.randomBytes(32).toString("hex")}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (user) => {
      return prisma.user.create({
        data: {
          ...user,
          apiKey: generateApiKey(),
        },
      });
    },
  },

  providers: [
    Resend({
      from: "no-reply@pomogolo.ninja",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 2, // 2 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = typeof token.id === "string" ? token.id : "";

      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
