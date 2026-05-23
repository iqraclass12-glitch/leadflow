import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Link2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { fetchGoogleSheetCsv } from "@/lib/sheet-import.functions";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

type Group = { id: string; group_name: string };


/** Pick the value of the first column whose header (case-insensitive) matches any candidate. */
function pick(row: Record<string, string>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find(h => h.trim().toLowerCase() === c);
    if (k && row[k]?.toString().trim()) return row[k].toString().trim();
  }
  // fallback: substring match
  for (const c of candidates) {
    const k = keys.find(h => h.toLowerCase().includes(c));
    if (k && row[k]?.toString().trim()) return row[k].toString().trim();
  }
  return "";
}

function ImportPage() {
  const { isAdmin, loading } = useAuth();
  const { user } = useAuth();
  const nav = useNavigate();
  const fetchSheet = useServerFn(fetchGoogleSheetCsv);
  const importFn = useMutation(api.crm.importLeads);

  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("none");
  const groupsData = useQuery(api.crm.listGroups);

  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/dashboard" });
  }, [loading, isAdmin, nav]);

  useEffect(() => {
    setGroups((groupsData as Group[] | undefined) ?? []);
  }, [groupsData]);


  const handleCsvText = (text: string) => {
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) toast.warning(`Parsed with ${parsed.errors.length} warnings`);
    const data = (parsed.data ?? []).filter(r => Object.values(r).some(v => v && String(v).trim()));
    setRows(data);
    setHeaders(parsed.meta.fields ?? []);
    toast.success(`Loaded ${data.length} rows`);
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) handleCsvText(await file.text());
    else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(await file.arrayBuffer());
      handleCsvText(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
    } else toast.error("Please upload a .csv or .xlsx file");
  };

  const handleSheetUrl = async () => {
    if (!sheetUrl.trim()) return;
    setFetching(true);
    const r = await fetchSheet({ data: { url: sheetUrl.trim() } });
    setFetching(false);
    if (!r.ok) { toast.error(r.error); return; }
    handleCsvText(r.csv);
  };

  const preview = useMemo(() => {
    return rows.slice(0, 5).map(r => ({
      name: pick(r, ["name", "student name", "full name"]),
      phone: pick(r, ["number", "phone", "phone number", "mobile", "contact"]),
    }));
  }, [rows]);

  const runImport = async () => {
    setImporting(true);
    try {
      const records = rows.map(r => ({
        name: pick(r, ["name", "student name", "full name"]),
        phone: pick(r, ["number", "phone", "phone number", "mobile", "contact"]),
      })).filter(r => r.name && r.phone);
      if (records.length === 0) { toast.error("No rows with both Name and Number found."); return; }
      if (!user) return;
      const r = await importFn({ userId: user.id, rows: records, groupId: groupId === "none" ? null : groupId });
      const groupName = groups.find(g => g.id === groupId)?.group_name;
      toast.success(`Total ${r.total} · Uploaded ${r.inserted} · Duplicates ${r.duplicates} · Invalid ${r.invalid} · Failed ${r.failed}${groupName ? ` → ${groupName}` : ""}`);
      setRows([]); setHeaders([]); setSheetUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setImporting(false); }
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Import leads</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Upload CSV/Excel or paste a public Google Sheet link. Only <strong>Name</strong> and <strong>Number</strong> are imported.
        </p>
      </div>

      <Card className="p-3 sm:p-4 mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <Label className="flex items-center gap-1.5 text-sm shrink-0"><Users className="size-4 text-primary" /> Group</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="Select a group (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.group_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground sm:ml-2">All uploaded leads will be added to this group. Manage groups from Admin → Groups.</p>
      </Card>


      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><FileSpreadsheet className="size-5 text-primary" /><h2 className="font-semibold">Upload file</h2></div>
          <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted">
            <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Drop or click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls</div>
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </label>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Link2 className="size-5 text-primary" /><h2 className="font-semibold">Google Sheet URL</h2></div>
          <Label>Public sheet link</Label>
          <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
          <Button onClick={handleSheetUrl} disabled={fetching || !sheetUrl} className="w-full mt-3">
            {fetching ? <><Loader2 className="size-4 animate-spin mr-1" /> Fetching…</> : "Fetch sheet"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Share &gt; "Anyone with the link can view".</p>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card className="p-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Preview</h2>
              <p className="text-xs text-muted-foreground">{rows.length} rows detected · {headers.length} columns (only Name & Number used)</p>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md mb-4">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr><th className="px-3 py-2 text-left font-medium">Name</th><th className="px-3 py-2 text-left font-medium">Number</th></tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.name || <span className="text-muted-foreground italic">missing</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{r.phone || <span className="text-muted-foreground italic">missing</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRows([]); setHeaders([]); }}>Cancel</Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? <><Loader2 className="size-4 animate-spin mr-1" /> Importing…</> : `Import ${rows.length} rows`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
