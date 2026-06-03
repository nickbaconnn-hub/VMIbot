"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pw-email">Email</Label>
        <Input
          id="pw-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nwcs.example"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-password">Password</Label>
        <Input
          id="pw-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <Alert>
        <AlertDescription>
          Check your email for a magic link to sign in.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ml-email">Email</Label>
        <Input
          id="ml-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nwcs.example"
        />
      </div>
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const notAllowed = search.get("error") === "not_allowed";
  const exchange = search.get("error") === "exchange";
  const next = search.get("next") ?? "/";

  function onPasswordSuccess() {
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>VMI Order Builder</CardTitle>
          <CardDescription>Sign in with your NWCS email</CardDescription>
        </CardHeader>
        <CardContent>
          {notAllowed && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                That email is not on the allowlist. Ask an admin to add it.
              </AlertDescription>
            </Alert>
          )}
          {exchange && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                The magic link could not be exchanged — it may have expired or been
                used already. Request a new one or use a password.
              </AlertDescription>
            </Alert>
          )}
          <Tabs defaultValue="password">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="magic">Magic link</TabsTrigger>
            </TabsList>
            <TabsContent value="password">
              <PasswordForm onSuccess={onPasswordSuccess} />
            </TabsContent>
            <TabsContent value="magic">
              <MagicLinkForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
