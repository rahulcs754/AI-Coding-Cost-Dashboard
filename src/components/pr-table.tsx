import Link from "next/link";
import { formatDate, formatTokens, formatUsd, prHref, repoHref } from "@/lib/format";
import type { PrRow } from "@/lib/queries";

export function PrTable({ rows, showRepo = true }: { rows: PrRow[]; showRepo?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No PRs with AI spend in this range.</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">Pull request</th>
            {showRepo && <th className="py-2 pr-3 font-medium">Repo</th>}
            <th className="py-2 pr-3 font-medium">Authors</th>
            <th className="py-2 pr-3 text-right font-medium">Sessions</th>
            <th className="py-2 pr-3 text-right font-medium">Tokens</th>
            <th className="py-2 pr-3 text-right font-medium">Cost</th>
            <th className="py-2 text-right font-medium">Last</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.repo}#${r.pr}`} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">
                <Link href={prHref(r.repo, r.pr)} className="hover:underline">
                  <span className="text-muted">#{r.pr}</span> {r.title ?? "Untitled"}
                </Link>
              </td>
              {showRepo && (
                <td className="py-2 pr-3">
                  <Link href={repoHref(r.repo)} className="text-muted hover:underline">{r.repo}</Link>
                </td>
              )}
              <td className="py-2 pr-3 text-muted">{r.authors.split(",").join(", ")}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.sessions}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(r.tokens)}</td>
              <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatUsd(r.cost)}</td>
              <td className="py-2 text-right text-muted">{formatDate(r.lastTs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
