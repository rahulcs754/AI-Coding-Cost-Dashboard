"use server";

import { revalidatePath } from "next/cache";
import { removeMember, upsertMember, type Role } from "@/lib/members";
import { getCurrentUser } from "@/lib/session";

export type ActionState = { error?: string; ok?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Only admins can change the team.");
  return user;
}

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

export async function addMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const login = String(form.get("login") ?? "").trim().replace(/^@/, "");
  const role = (form.get("role") === "admin" ? "admin" : "member") as Role;
  if (!LOGIN.test(login)) return { error: "Enter a valid GitHub username." };
  upsertMember(login, role, admin.login);
  revalidatePath("/team");
  return { ok: `Added ${login} as ${role}.` };
}

export async function removeMemberAction(form: FormData) {
  const admin = await requireAdmin();
  const login = String(form.get("login") ?? "");
  if (login.toLowerCase() === admin.login) throw new Error("You can't remove yourself.");
  removeMember(login);
  revalidatePath("/team");
}
