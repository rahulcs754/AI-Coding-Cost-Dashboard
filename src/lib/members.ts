import "server-only";
import { getDb } from "./db";

export type Role = "admin" | "member";
export type Member = { login: string; role: Role; addedBy: string | null; addedAt: string; fromEnv?: boolean };

const norm = (login: string) => login.trim().toLowerCase();

// Admins listed in ADMIN_GITHUB_LOGINS always have access, so a fresh install
// (or a serverless instance with an empty database) can't lock everyone out.
export function envAdmins(): string[] {
  return (process.env.ADMIN_GITHUB_LOGINS ?? "").split(",").map(norm).filter(Boolean);
}

export function getRole(login: string | null | undefined): Role | null {
  if (!login) return null;
  const l = norm(login);
  if (envAdmins().includes(l)) return "admin";
  const row = getDb().prepare("SELECT role FROM members WHERE login = ?").get(l) as { role: Role } | undefined;
  return row?.role ?? null;
}

export function listMembers(): Member[] {
  const rows = getDb()
    .prepare("SELECT login, role, added_by AS addedBy, added_at AS addedAt FROM members ORDER BY role, login")
    .all() as unknown as Member[];
  const inDb = new Set(rows.map((r) => r.login));
  const fromEnv = envAdmins()
    .filter((l) => !inDb.has(l))
    .map((login): Member => ({ login, role: "admin", addedBy: null, addedAt: "", fromEnv: true }));
  return [...fromEnv, ...rows];
}

export function upsertMember(login: string, role: Role, addedBy: string) {
  getDb()
    .prepare(
      `INSERT INTO members (login, role, added_by, added_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET role = excluded.role`,
    )
    .run(norm(login), role, addedBy, new Date().toISOString());
}

export function removeMember(login: string) {
  getDb().prepare("DELETE FROM members WHERE login = ?").run(norm(login));
}
