import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@fuse/db";
import crypto from "crypto";

// Generate a secure random API key
function generateApiKey(): string {
  return `fc_${crypto.randomBytes(32).toString("hex")}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from env
  providers: [Google],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 2, // 2 hours
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return true;
    },
    async jwt({ token, user }) {
      // `user` is only set on sign-in: find or create our DB user by email
      if (user?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            email: user.email,
            name: user.name,
            image: user.image,
            emailVerified: new Date(),
            apiKey: generateApiKey(),
          },
        });
        token.id = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = typeof token.id === "string" ? token.id : "";
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
