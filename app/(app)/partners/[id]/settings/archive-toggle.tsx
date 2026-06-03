"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archivePartner } from "../../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ArchiveToggle({
  partnerId,
  archived,
}: {
  partnerId: string;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant={archived ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await archivePartner(partnerId, !archived);
            toast.success(archived ? "Partner restored" : "Partner archived");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        })
      }
    >
      {archived ? "Restore partner" : "Archive partner"}
    </Button>
  );
}
