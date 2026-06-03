"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, guessColumnMapping, normalizeRows } from "@/lib/csv/parse";
import type { ColumnMapping } from "@/types/db";
import { ingestSnapshot } from "./actions";

const NONE = "__none__";

type Parsed = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
};

export function UploadClient({
  partnerId,
  savedMapping,
}: {
  partnerId: string;
  savedMapping: ColumnMapping | null;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [submitting, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    const text = await file.text();
    const parsedCsv = parseCsv(text);
    if (parsedCsv.headers.length === 0 || parsedCsv.rows.length === 0) {
      setErr("CSV is empty or unreadable.");
      return;
    }
    setParsed({
      fileName: file.name,
      headers: parsedCsv.headers,
      rows: parsedCsv.rows,
    });

    // Prefer saved mapping if every column is still present
    const validateSaved = (m: ColumnMapping) => {
      const hs = new Set(parsedCsv.headers);
      return (
        hs.has(m.partner_sku_name) &&
        hs.has(m.units_sold) &&
        (!m.on_hand || hs.has(m.on_hand))
      );
    };
    if (savedMapping && validateSaved(savedMapping)) {
      setMapping(savedMapping);
    } else {
      setMapping(guessColumnMapping(parsedCsv.headers));
    }
  }

  const preview = useMemo(() => {
    if (!parsed || !mapping) return [];
    return normalizeRows(parsed.rows.slice(0, 5), mapping);
  }, [parsed, mapping]);

  const mappingComplete =
    mapping != null && mapping.partner_sku_name && mapping.units_sold;

  function updateField(field: keyof ColumnMapping, value: string) {
    if (!mapping) return;
    const next: ColumnMapping = { ...mapping };
    if (field === "on_hand") {
      next.on_hand = value === NONE ? null : value;
    } else {
      next[field] = value === NONE ? "" : value;
    }
    setMapping(next);
  }

  async function submit() {
    if (!parsed || !mapping || !mappingComplete) return;
    const normalized = normalizeRows(parsed.rows, mapping);
    if (normalized.length === 0) {
      setErr("No valid rows after applying the mapping.");
      return;
    }
    start(async () => {
      try {
        await ingestSnapshot({
          partnerId,
          sourceFileName: parsed.fileName,
          mapping,
          rawRows: parsed.rows,
          normalizedRows: normalized,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        // Next's redirect() throws a special error; treat as success.
        if (msg.includes("NEXT_REDIRECT")) return;
        toast.error(msg);
        setErr(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      <FilePicker onFile={handleFile} />
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {parsed && mapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {parsed.fileName} — {parsed.rows.length} rows, {parsed.headers.length}{" "}
              columns
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MappingField
                label="Partner SKU name"
                value={mapping.partner_sku_name || NONE}
                headers={parsed.headers}
                onChange={(v) => updateField("partner_sku_name", v)}
                required
              />
              <MappingField
                label="Units sold"
                value={mapping.units_sold || NONE}
                headers={parsed.headers}
                onChange={(v) => updateField("units_sold", v)}
                required
              />
              <MappingField
                label="On hand (optional)"
                value={mapping.on_hand ?? NONE}
                headers={parsed.headers}
                onChange={(v) => updateField("on_hand", v)}
              />
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Preview</div>
              <div className="border rounded-md overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1.5">Partner SKU name</th>
                      <th className="text-right px-3 py-1.5">Units sold</th>
                      <th className="text-right px-3 py-1.5">On hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                          No rows yet — pick columns above.
                        </td>
                      </tr>
                    ) : (
                      preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{r.partner_sku_name}</td>
                          <td className="px-3 py-1.5 text-right">{r.units_sold}</td>
                          <td className="px-3 py-1.5 text-right">
                            {r.on_hand ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Button
              onClick={submit}
              disabled={!mappingComplete || submitting}
            >
              {submitting ? "Uploading…" : "Ingest snapshot"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilePicker({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
        dragging ? "border-foreground bg-muted/50" : "border-muted-foreground/30"
      }`}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm">Drop a CSV here</p>
      <p className="text-xs text-muted-foreground mb-3">or</p>
      <label className="inline-flex">
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <span className="cursor-pointer px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition">
          Choose file
        </span>
      </label>
    </div>
  );
}

function MappingField({
  label,
  value,
  headers,
  onChange,
  required,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? NONE)}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a column…" />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>— none —</SelectItem>}
          {headers.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
