"use client";

import { useActionState } from "react";
import { addMemberAction, type ActionState } from "./actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addMemberAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted">GitHub username</span>
        <input
          name="login"
          required
          placeholder="octocat"
          autoComplete="off"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Role</span>
        <select name="role" defaultValue="member" className="rounded-md border border-border bg-background px-3 py-2">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <p aria-live="polite" className={`w-full text-sm ${state.error ? "text-up" : "text-down"}`}>
        {state.error ?? state.ok}
      </p>
    </form>
  );
}
