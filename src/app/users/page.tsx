import Link from "next/link";
import { Suspense } from "react";
import { Card, RangeTabs, Skeleton } from "@/components/ui";
import { formatDate, formatTokens, formatUsd, userHref } from "@/lib/format";
import { getUsers, parseRange } from "@/lib/queries";

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <UsersTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Chips({ values }: { values: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.split(",").map((v) => (
        <span key={v} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs">{v}</span>
      ))}
    </div>
  );
}

async function UsersTable({ searchParams }: Pick<PageProps<"/users">, "searchParams">) {
  const days = parseRange((await searchParams).days);
  const users = await getUsers(days);

  return (
    <>
      <RangeTabs current={days} basePath="/users" />
      <Card title={`${users.length} people used AI coding agents in the last ${days} days`}>
        {users.length === 0 ? (
          <p className="text-sm text-muted">No usage in this range.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="py-2 pr-3 font-medium">Agents</th>
                  <th className="py-2 pr-3 font-medium">Models</th>
                  <th className="py-2 pr-3 text-right font-medium">Sessions</th>
                  <th className="py-2 pr-3 text-right font-medium">PRs</th>
                  <th className="py-2 pr-3 text-right font-medium">Tokens</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost</th>
                  <th className="py-2 text-right font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.author} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`${userHref(u.author)}?days=${days}`} className="hover:underline">{u.author}</Link>
                    </td>
                    <td className="py-2 pr-3"><Chips values={u.tools} /></td>
                    <td className="py-2 pr-3"><Chips values={u.models} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.sessions}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.prs}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(u.tokens)}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatUsd(u.cost)}</td>
                    <td className="py-2 text-right text-muted">{formatDate(u.lastTs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
