import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History as HistoryIcon, Phone, Activity, Search, Loader2, PhoneCall, FileText, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { contributionLabel, contributionTone, type Contribution } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type LeadLite = { id: string; name: string; phone: string | null; status: string };
type Row = Contribution & { lead: LeadLite | null; manager_name: string };
type Profile = { id: string; name: string | null; email: string | null };

const ACTIONS = [
  { v: "all", label: "All actions" },
  { v: "call", label: "Calls" },
  { v: "lead_created", label: "Lead created" },
  { v: "note_added", label: "Note added" },
  { v: "status_updated", label: "Status updated" },
  { v: "assignment_changed", label: "Assignment changed" },
];

interface CallRow { id: string; user_id: string; created_at: string; details: { lead_id?: string } | null }

function HistoryPage() {
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [managerFilter, setManagerFilter] = useState<string>("me");

  const effectiveManager = isAdmin ? managerFilter : "me";
  const managerId = effectiveManager === "me" ? user?.id : effectiveManager === "all" ? undefined : effectiveManager;
  const contribs = (useQuery(api.crm.listContributions, user ? { managerId, limit: 500 } : "skip") as Contribution[] | undefined) ?? [];
  const calls = (useQuery(api.crm.listActivity, user ? { userId: managerId, action: "call", limit: 500 } : "skip") as CallRow[] | undefined) ?? [];
  const leads = (useQuery(api.crm.listLeads, user ? { userId: user.id, isAdmin: true } : "skip") as LeadLite[] | undefined) ?? [];
  const profiles = (useQuery(api.crm.listProfiles) as Profile[] | undefined) ?? [];
  const loading = user && contribs === undefined;
  const leadsMap = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  const nameOf = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p?.name || p?.email?.split("@")[0] || id.slice(0, 6);
  };

  const rows: Row[] = useMemo(() => {
    const combined: Row[] = [];
    for (const c of contribs) {
      combined.push({ ...c, lead: leadsMap[c.lead_id] ?? null, manager_name: nameOf(c.manager_id) });
    }
    for (const c of calls) {
      const lid = c.details?.lead_id ?? "";
      combined.push({
        id: c.id,
        lead_id: lid,
        manager_id: c.user_id,
        contribution_type: "call" as unknown as Contribution["contribution_type"],
        description: null,
        created_at: c.created_at,
        lead: lid ? leadsMap[lid] ?? null : null,
        manager_name: nameOf(c.user_id),
      });
    }
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contribs, calls, leadsMap, profiles]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const sd = s.replace(/\D+/g, "");
    return rows.filter(r => {
      if (action !== "all" && r.contribution_type !== action) return false;
      if (s) {
        const name = r.lead?.name?.toLowerCase() ?? "";
        const phone = (r.lead?.phone ?? "").replace(/\D+/g, "");
        if (!name.includes(s) && !(sd && phone.includes(sd))) return false;
      }
      return true;
    });
  }, [rows, search, action]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let callsN = 0, notes = 0, updates = 0, todayN = 0;
    for (const r of filtered) {
      if (r.contribution_type === ("call" as unknown)) callsN++;
      else if (r.contribution_type === "note_added") notes++;
      else if (r.contribution_type === "status_updated") updates++;
      if (r.created_at.startsWith(today)) todayN++;
    }
    return { calls: callsN, notes, updates, today: todayN };
  }, [filtered]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <HistoryIcon className="size-6 text-primary" />
            {isAdmin && effectiveManager !== "me" ? "Activity History" : "My History"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Filter by manager to audit individual activity." : "Your calls, status updates and notes."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {}}><RefreshCw className="size-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<PhoneCall className="size-4" />} label="Calls" value={stats.calls} />
        <Stat icon={<FileText className="size-4" />} label="Notes" value={stats.notes} />
        <Stat icon={<Activity className="size-4" />} label="Status updates" value={stats.updates} />
        <Stat icon={<HistoryIcon className="size-4" />} label="Today" value={stats.today} />
      </div>

      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone" className="pl-8" />
          </div>
          {isAdmin && (
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="md:w-44"><SelectValue placeholder="Manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">My activity</SelectItem>
                <SelectItem value="all">All managers</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name ?? p.email ?? p.id.slice(0, 6)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map(a => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Action</th>
                {isAdmin && effectiveManager !== "me" && <th className="px-4 py-3">By</th>}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="size-5 animate-spin inline text-muted-foreground" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">No activity yet.</td></tr>}
              {!loading && filtered.map(r => (
                <tr key={`${r.contribution_type}-${r.id}`} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.lead?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    {r.lead?.phone ? (
                      <a href={`tel:${r.lead.phone}`} className="text-primary hover:underline flex items-center gap-1">
                        <Phone className="size-3" /> {r.lead.phone}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${r.contribution_type === ("call" as unknown) ? "bg-blue-500" : contributionTone(r.contribution_type)}`} />
                      <span className="capitalize text-xs">
                        {r.contribution_type === ("call" as unknown) ? "made a call" : contributionLabel(r.contribution_type)}
                      </span>
                      {r.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {r.description}</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && effectiveManager !== "me" && (
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.manager_name}</td>
                  )}
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{format(new Date(r.created_at), "HH:mm:ss")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </Card>
  );
}
