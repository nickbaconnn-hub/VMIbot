"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PartnerFormState } from "./actions";

type Props = {
  action: (state: PartnerFormState, fd: FormData) => Promise<PartnerFormState>;
  defaults?: {
    name?: string | null;
    location?: string | null;
    lookback_days?: number;
    days_of_cover_target?: number;
    notes?: string | null;
  };
  submitLabel?: string;
};

export function PartnerForm({ action, defaults, submitLabel = "Save" }: Props) {
  const [state, formAction, pending] = useActionState<PartnerFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          placeholder="e.g. Kush21 - Tacoma"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={defaults?.location ?? ""}
          placeholder="City, State"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lookback_days">Lookback days</Label>
          <Input
            id="lookback_days"
            name="lookback_days"
            type="number"
            min={1}
            defaultValue={defaults?.lookback_days ?? 60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="days_of_cover_target">Days of cover target</Label>
          <Input
            id="days_of_cover_target"
            name="days_of_cover_target"
            type="number"
            min={1}
            defaultValue={defaults?.days_of_cover_target ?? 21}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
        />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
