import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getRole } from "@/lib/members";

// Login is optional: without GitHub OAuth credentials the dashboard runs open (demo mode).
export const authEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

declare module "next-auth" {
  interface Session {
    user: { login: string; name?: string | null; image?: string | null };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Only invited team members (or env admins) can sign in.
    signIn({ profile }) {
      return getRole(profile?.login as string | undefined) !== null;
    },
    jwt({ token, profile }) {
      if (profile?.login) token.login = String(profile.login).toLowerCase();
      return token;
    },
    session({ session, token }) {
      session.user.login = String(token.login ?? "");
      return session;
    },
  },
});
