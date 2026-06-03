import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isEmailAllowed } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Package } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <aside className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-5 w-5" />
            VMI Order Builder
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1 text-sm">
          <Link
            href="/"
            className="block px-3 py-2 rounded-md hover:bg-muted transition"
          >
            Partners
          </Link>
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground space-y-2">
          <div className="truncate" title={user.email ?? ""}>
            {user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
