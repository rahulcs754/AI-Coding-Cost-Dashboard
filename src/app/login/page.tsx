import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authEnabled, signIn } from "@/auth";
import { Card } from "@/components/ui";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm pt-12">
      <Card>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Only team members invited by an admin can see this dashboard.</p>
        <Suspense>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

// Only allow same-site redirects after sign-in.
const safePath = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  if (!authEnabled) redirect("/");
  const callbackUrl = safePath(params.callbackUrl);
  const denied = params.error === "AccessDenied";

  return (
    <>
      {denied && (
        <p role="alert" className="mt-4 rounded-md bg-accent-soft px-3 py-2 text-sm">
          Your GitHub account isn&apos;t on this team yet. Ask an admin to add you on the Team page.
        </p>
      )}
      <form
        className="mt-4"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: callbackUrl });
        }}
      >
        <button className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Continue with GitHub
        </button>
      </form>
    </>
  );
}
