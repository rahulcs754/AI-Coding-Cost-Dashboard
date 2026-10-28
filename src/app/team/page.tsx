import { connection } from "next/server";
import { Suspense } from "react";
import { authEnabled } from "@/auth";
import { Card, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { listMembers } from "@/lib/members";
import { getCurrentUser } from "@/lib/session";
import { removeMemberAction } from "./actions";
import { AddMemberForm } from "./add-member-form";

export default function TeamPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  await connection();
  const [user, members] = [await getCurrentUser(), listMembers()];
  const isAdmin = user?.role === "admin";

  return (
    <>
      {!authEnabled && (
        <p className="rounded-lg border border-border bg-accent-soft px-4 py-3 text-sm">
          Login is off (demo mode), so anyone can open this dashboard. Set <code>AUTH_GITHUB_ID</code>,{" "}
          <code>AUTH_GITHUB_SECRET</code>, <code>AUTH_SECRET</code> and <code>ADMIN_GITHUB_LOGINS</code> to turn it on.
        </p>
      )}
      {isAdmin && (
        <Card title="Invite a team member">
          <AddMemberForm />
        </Card>
      )}
      <Card title={`${members.length} member${members.length === 1 ? "" : "s"}`}>
        {members.length === 0 ? (
          <p className="text-sm text-muted">No members yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.login} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium">{m.login}</span>
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs">{m.role}</span>
                <span className="text-muted">
                  {m.fromEnv ? "from ADMIN_GITHUB_LOGINS" : `added ${formatDate(m.addedAt)}${m.addedBy ? ` by ${m.addedBy}` : ""}`}
                </span>
                {isAdmin && !m.fromEnv && m.login !== user?.login && (
                  <form action={removeMemberAction} className="ml-auto">
                    <input type="hidden" name="login" value={m.login} />
                    <button className="text-xs text-up hover:underline">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
