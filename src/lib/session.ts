import "server-only";
import { auth, authEnabled } from "@/auth";
import { getRole, type Role } from "./members";

export type CurrentUser = { login: string; name: string | null; image: string | null; role: Role };

// In demo mode (no login configured) everyone is treated as an admin.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!authEnabled) return { login: "demo", name: "Demo mode", image: null, role: "admin" };
  const session = await auth();
  const login = session?.user?.login;
  const role = getRole(login);
  if (!login || !role) return null;
  return { login, name: session.user.name ?? null, image: session.user.image ?? null, role };
}
