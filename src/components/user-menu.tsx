import Image from "next/image";
import { authEnabled, signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export async function UserMenu() {
  if (!authEnabled) return <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs">Demo mode</span>;
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      {user.image && <Image src={user.image} alt="" width={24} height={24} className="rounded-full" />}
      <span className="hidden sm:inline">{user.login}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="whitespace-nowrap text-muted hover:text-foreground">Sign out</button>
      </form>
    </div>
  );
}
