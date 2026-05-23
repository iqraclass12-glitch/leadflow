import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LeadDialog } from "@/components/LeadDialog";
import {
  PhoneCall,
  Search,
  MessageCircle,
  RefreshCw,
  Trash2,
  X,
  Lock,
  LockOpen,
  Users,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import { STATUSES, statusColor, buildWhatsAppUrl } from "@/lib/leads";
import { TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate, renderTemplate } from "@/templates/messages";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

interface LeadWithLock extends Lead {
  locked_by?: string | null;
  lock_expires_at?: string | null;
  call_status?: string | null;
}
type RpcClient = { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> };
type Group = { id: string; group_name: string };

function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const leadsData = useQuery(api.crm.listLeads, user ? { userId: user.id, isAdmin } : "skip");
  const groupsData = useQuery(api.crm.listGroups);
  const leadGroupsData = useQuery(api.crm.listLeadGroups);
  const profilesData = useQuery(api.crm.listProfiles);
  const deleteLeadsFn = useMutation(api.crm.deleteLeads);
  const acquireLeadLock = useMutation(api.crm.acquireLeadLock);
  const releaseLeadLock = useMutation(api.crm.releaseLeadLock);
  const logCall = useMutation(api.crm.logCall);
  const [leads, setLeads] = useState<LeadWithLock[]>([]);
  const [lockerNames, setLockerNames] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [leadGroupMap, setLeadGroupMap] = useState<Record<string, string[]>>({});
  const [tplId, setTplId] = useState<string>(DEFAULT_TEMPLATE_ID);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (leadsData === undefined) return;
    setLeads((leadsData as LeadWithLock[]) ?? []);
    setLoading(false);
  }, [leadsData]);

  useEffect(() => {
    setGroups((groupsData as Group[] | undefined) ?? []);
  }, [groupsData]);

  useEffect(() => {
    const map: Record<string, string[]> = {};
    ((leadGroupsData as { lead_id: string; group_id: string }[] | undefined) ?? []).forEach((r) => {
      (map[r.lead_id] ??= []).push(r.group_id);
    });
    setLeadGroupMap(map);
  }, [leadGroupsData]);

  useEffect(() => {
    const map: Record<string, string> = {};
    (
      (profilesData as { id: string; name?: string | null; email?: string | null }[] | undefined) ??
      []
    ).forEach((p) => {
      map[p.id] = p.name ?? p.email ?? p.id.slice(0, 6);
    });
    setLockerNames(map);
  }, [profilesData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setRefreshing(false);
    toast.success("Refreshed");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, "");
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (groupFilter !== "all") {
        const gs = leadGroupMap[l.id] ?? [];
        if (!gs.includes(groupFilter)) return false;
      }
      if (q) {
        const name = l.name?.toLowerCase() ?? "";
        const phone = (l.phone ?? "").replace(/\D+/g, "");
        if (!name.includes(q) && !(qDigits && phone.includes(qDigits))) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, groupFilter, leadGroupMap]);

  const openWhatsApp = (l: Lead) => {
    if (!l.phone) {
      toast.error("No phone number");
      return;
    }
    const tpl = getTemplate(tplId);
    const msg = renderTemplate(tpl, l.name);
    const url = buildWhatsAppUrl({ phone: l.phone, message: msg });
    if (url) window.open(url, "_blank", "noopener");
  };

  const isLockedByOther = useCallback(
    (l: LeadWithLock) => {
      return (
        !!l.locked_by &&
        l.locked_by !== user?.id &&
        !!l.lock_expires_at &&
        new Date(l.lock_expires_at).getTime() > now
      );
    },
    [user?.id, now],
  );

  const onCall = async (l: LeadWithLock, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) return;
    if (isLockedByOther(l)) {
      e.preventDefault();
      toast.error(
        `${lockerNames[l.locked_by!] ?? "Another manager"} is currently calling this lead.`,
      );
      return;
    }
    const row = await acquireLeadLock({ userId: user.id, leadId: l.id });
    if (row && !row.success) {
      e.preventDefault();
      toast.error(`${row.locker_name ?? "Another manager"} is currently calling this lead.`);
      return;
    }
    await logCall({ userId: user.id, leadId: l.id });
  };

  const claimLead = async (l: LeadWithLock) => {
    if (!user) return;
    if (isLockedByOther(l)) {
      toast.error(`${lockerNames[l.locked_by!] ?? "Another manager"} is currently on this lead.`);
      return;
    }
    const row = await acquireLeadLock({ userId: user.id, leadId: l.id });
    if (row && !row.success) {
      toast.error(`${row.locker_name ?? "Another manager"} is currently on this lead.`);
      return;
    }
    toast.success("Locked for 5 minutes. Update the status before it expires.");
  };

  const releaseLead = async (l: LeadWithLock) => {
    if (!user) return;
    await releaseLeadLock({ userId: user.id, leadId: l.id });
    toast.success("Released");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };

  const doDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      if (!user) return;
      await deleteLeadsFn({ userId: user.id, ids: Array.from(selected) });
      toast.success(`Deleted ${selected.size} lead${selected.size > 1 ? "s" : ""}`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Leads</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {filtered.length} of {leads.length} {isAdmin ? "total" : "assigned to you"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline ml-1">Refresh</span>
        </Button>
      </div>

      {/* Sticky group selector on mobile — always visible at the top */}
      {groups.length > 0 && (
        <div className="md:hidden sticky top-14 z-30 -mx-3 px-3 py-2 bg-background/95 backdrop-blur border-b mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Group
            </span>
            {groupFilter !== "all" && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {filtered.length} lead{filtered.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
            <button
              onClick={() => setGroupFilter("all")}
              className={`snap-start shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium ${groupFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input"}`}
            >
              All
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={`snap-start shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium ${groupFilter === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input"}`}
              >
                {g.group_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="p-3 mb-4 shadow-sm space-y-2">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Desktop group dropdown — mobile uses sticky pills above */}
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="hidden md:flex md:w-44">
              <Users className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || statusFilter !== "all" || groupFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setGroupFilter("all");
              }}
            >
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>
        {TEMPLATES.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">WhatsApp template:</span>
            <Select value={tplId} onValueChange={setTplId}>
              <SelectTrigger className="h-8 flex-1 sm:w-56 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {isAdmin && selected.size > 0 && (
        <Card className="p-3 mb-3 flex items-center justify-between shadow-sm border-red-200 bg-red-50/40 dark:bg-red-950/20">
          <div className="text-sm">{selected.size} selected</div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="size-4 mr-1" /> Delete selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selected.size} lead{selected.size > 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the lead{selected.size > 1 ? "s" : ""} and all their
                  notes & activity. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={doDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      )}

      {(() => {
        const active = leads.filter(
          (l) => l.locked_by && l.lock_expires_at && new Date(l.lock_expires_at).getTime() > now,
        );
        if (active.length === 0) return null;
        return (
          <Card className="p-3 mb-4 shadow-sm border-amber-300 bg-amber-50/70 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Active calls ({active.length})
              </h2>
            </div>
            <div className="space-y-1.5">
              {active.map((l) => {
                const mine = l.locked_by === user?.id;
                const lockerName = mine ? "You" : (lockerNames[l.locked_by!] ?? "Another manager");
                const secondsLeft = Math.max(
                  0,
                  Math.floor((new Date(l.lock_expires_at!).getTime() - now) / 1000),
                );
                const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
                const ss = String(secondsLeft % 60).padStart(2, "0");
                return (
                  <button
                    key={l.id}
                    onClick={() => setOpenLeadId(l.id)}
                    className={`w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-md border ${mine ? "bg-primary/10 border-primary/40" : "bg-white dark:bg-background border-amber-200"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {l.name}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {l.phone || "—"}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-300">
                        {mine
                          ? "You are calling this lead"
                          : `${lockerName} is calling — do not call`}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums font-medium text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 px-1.5 py-0.5 rounded">
                      {mm}:{ss}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No leads. {isAdmin && leads.length === 0 && "Go to Admin → CSV Upload to import."}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-3 w-8">
                        <Checkbox
                          checked={selected.size > 0 && selected.size === filtered.length}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((l) => {
                    const locked = isLockedByOther(l);
                    return (
                      <tr
                        key={l.id}
                        className={`border-t cursor-pointer ${locked ? "bg-amber-50/60 hover:bg-amber-100/60" : "hover:bg-muted"}`}
                        onClick={() => setOpenLeadId(l.id)}
                      >
                        {isAdmin && (
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(l.id)}
                              onCheckedChange={() => toggleSelect(l.id)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{l.name}</span>
                            {(() => {
                              const mine =
                                l.locked_by === user?.id &&
                                l.lock_expires_at &&
                                new Date(l.lock_expires_at).getTime() > now;
                              if (mine) {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void releaseLead(l);
                                    }}
                                    title="Release lock"
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/40 px-1.5 py-0.5 rounded hover:bg-primary/20"
                                  >
                                    <LockOpen className="size-3" /> Release
                                  </button>
                                );
                              }
                              if (locked) return null;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void claimLead(l);
                                  }}
                                  title="Lock this lead so other managers don't call it"
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-input px-1.5 py-0.5 rounded hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Lock className="size-3" /> Lock
                                </button>
                              );
                            })()}
                          </div>
                          {locked && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                              {lockerNames[l.locked_by!] ?? "Manager"} is calling
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{l.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusColor(l.status)}`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {l.notes || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {l.phone && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsApp(l);
                                }}
                                title="WhatsApp"
                                className="inline-flex items-center justify-center size-7 rounded-md border border-input bg-background hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                              >
                                <MessageCircle className="size-3.5" />
                              </button>
                              <a
                                href={locked ? undefined : `tel:${l.phone}`}
                                aria-disabled={locked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onCall(l, e);
                                }}
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md ${locked ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                              >
                                <PhoneCall className="size-3.5" /> {locked ? "In call" : "Call"}
                              </a>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t">
                  Showing first 500 of {filtered.length}. Use search to narrow.
                </div>
              )}
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.slice(0, 200).map((l) => {
              const locked = isLockedByOther(l);
              const mine =
                l.locked_by === user?.id &&
                l.lock_expires_at &&
                new Date(l.lock_expires_at).getTime() > now;
              const groupNames = (leadGroupMap[l.id] ?? [])
                .map((gid) => groups.find((g) => g.id === gid)?.group_name)
                .filter(Boolean) as string[];
              const lockSecs = l.lock_expires_at
                ? Math.max(0, Math.floor((new Date(l.lock_expires_at).getTime() - now) / 1000))
                : 0;
              const mm = String(Math.floor(lockSecs / 60)).padStart(2, "0");
              const ss = String(lockSecs % 60).padStart(2, "0");
              return (
                <Card
                  key={l.id}
                  className={`p-3 shadow-sm ${locked ? "border-2 border-amber-400 bg-amber-50/80 dark:bg-amber-950/30" : mine ? "border-2 border-primary/50 bg-primary/5" : ""}`}
                  onClick={() => setOpenLeadId(l.id)}
                >
                  {/* Prominent lock banner on top */}
                  {locked && (
                    <div className="-m-3 mb-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 border-b-2 border-amber-400 rounded-t-lg flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex-1 truncate">
                        {lockerNames[l.locked_by!] ?? "Another manager"} is calling
                      </span>
                      <span className="text-[11px] tabular-nums font-bold text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded border border-amber-300">
                        {mm}:{ss}
                      </span>
                    </div>
                  )}
                  {mine && (
                    <div className="-m-3 mb-2 px-3 py-1.5 bg-primary/15 border-b-2 border-primary/50 rounded-t-lg flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary animate-pulse shrink-0" />
                      <span className="text-xs font-semibold text-primary flex-1">
                        You are calling — update status
                      </span>
                      <span className="text-[11px] tabular-nums font-bold text-primary bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded border border-primary/40">
                        {mm}:{ss}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-base truncate">{l.name}</div>
                      <div className="text-sm text-muted-foreground tabular-nums mt-0.5">
                        {l.phone || "—"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {groupNames.map((g) => (
                          <span
                            key={g}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900 px-1.5 py-0.5 rounded"
                          >
                            <Users className="size-2.5" /> {g}
                          </span>
                        ))}
                      </div>
                      {l.notes && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {l.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${statusColor(l.status)}`}
                      >
                        {l.status}
                      </span>
                      {!locked && !mine && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void claimLead(l);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-input px-1.5 py-0.5 rounded"
                        >
                          <Lock className="size-3" /> Lock
                        </button>
                      )}
                      {mine && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void releaseLead(l);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/40 px-1.5 py-0.5 rounded"
                        >
                          <LockOpen className="size-3" /> Release
                        </button>
                      )}
                    </div>
                  </div>
                  {l.phone && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(l);
                        }}
                        className="inline-flex items-center justify-center size-11 rounded-md border border-input bg-background hover:bg-emerald-50 hover:text-emerald-700"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="size-5" />
                      </button>
                      <a
                        href={locked ? undefined : `tel:${l.phone}`}
                        aria-disabled={locked}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (locked) {
                            e.preventDefault();
                            toast.error(
                              `${lockerNames[l.locked_by!] ?? "Another manager"} is on this lead.`,
                            );
                            return;
                          }
                          void onCall(l, e);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-3 rounded-md ${locked ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground active:opacity-80"}`}
                      >
                        <PhoneCall className="size-4" /> {locked ? "In use" : "Call"}
                      </a>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <LeadDialog
        leadId={openLeadId}
        onOpenChange={(o) => {
          if (!o) setOpenLeadId(null);
        }}
      />
    </div>
  );
}
