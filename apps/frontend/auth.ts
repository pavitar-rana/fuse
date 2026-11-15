import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@fuse/db";

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
            // No API key on sign-up: the user generates one from the
            // dashboard and sees it once (only the hash is stored).
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
