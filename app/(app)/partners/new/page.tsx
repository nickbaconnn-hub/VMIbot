import { PartnerForm } from "../partner-form";
import { createPartner } from "../actions";

export default function NewPartnerPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">New partner</h1>
      <PartnerForm action={createPartner} submitLabel="Create partner" />
    </div>
  );
}
