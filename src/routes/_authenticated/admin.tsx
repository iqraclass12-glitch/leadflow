import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Activity, Trophy, Loader2, ShieldCheck, Upload, Database, FolderPlus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Profile = { id: string; name: string | null; email: string | null; suspended: boolean };
type RoleRow = { user_id: string; role: "admin" | "manager" | "caller" };
type Contrib = { id: string; manager_id: string; contribution_type: string; created_at: string };
type Activity = { id: string; user_id: string; action: string; created_at: string };

type Group = { id: string; group_name: string };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, "admin" | "manager" | "caller">>({});
  const [contribs, setContribs] = useState<Contrib[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const since = useMemo(() => subDays(new Date(), 30).toISOString(), []);
  const overview = useQuery(api.crm.adminOverview, user && isAdmin ? { userId: user.id, since } : "skip");
  const setRoleFn = useMutation(api.crm.setUserRole);
  const setSuspendFn = useMutation(api.crm.setUserSuspended);
  const createGroupFn = useMutation(api.crm.createGroup);
  const renameGroupFn = useMutation(api.crm.renameGroup);
  const deleteGroupFn = useMutation(api.crm.deleteGroup);


  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/dashboard" });
  }, [loading, isAdmin, nav]);

  const load = async () => {
    if (!overview) return;
    setProfiles((overview.profiles ?? []) as Profile[]);
    const rmap: Record<string, "admin" | "manager" | "caller"> = {};
    for (const r of (overview.roles ?? []) as RoleRow[]) if (rmap[r.user_id] !== "admin") rmap[r.user_id] = r.role;
    setRoles(rmap);
    setContribs((overview.contributions ?? []) as Contrib[]);
    setActivities((overview.activities ?? []) as Activity[]);
    setLeadCount(overview.leadCount ?? 0);
    setGroups((overview.groups as Group[] | null) ?? []);
    const counts: Record<string, number> = {};
    ((overview.leadGroups as { group_id: string }[] | null) ?? []).forEach(r => { counts[r.group_id] = (counts[r.group_id] ?? 0) + 1; });
    setGroupCounts(counts);
  };

  useEffect(() => { void load(); }, [overview]);

  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (!user) return;
      await createGroupFn({ userId: user.id, name });
      setNewGroupName("");
      toast.success("Group created");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const saveGroupName = async (id: string) => {
    const name = editGroupName.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (!user) return;
      await renameGroupFn({ userId: user.id, id, name });
      setEditingGroup(null);
      toast.success("Group renamed");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const removeGroup = async (id: string) => {
    setBusy(true);
    try {
      if (!user) return;
      await deleteGroupFn({ userId: user.id, id });
      toast.success("Group deleted");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };


  const nameOf = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p?.name || p?.email?.split("@")[0] || id.slice(0, 6);
  };

  const perManager = useMemo(() => {
    const map = new Map<string, { name: string; total: number; calls: number; status: number; notes: number; leads: number }>();
    for (const c of contribs) {
      const cur = map.get(c.manager_id) ?? { name: nameOf(c.manager_id), total: 0, calls: 0, status: 0, notes: 0, leads: 0 };
      cur.total++;
      if (c.contribution_type === "status_updated") cur.status++;
      else if (c.contribution_type === "note_added") cur.notes++;
      else if (c.contribution_type === "lead_created") cur.leads++;
      map.set(c.manager_id, cur);
    }
    for (const a of activities) {
      const cur = map.get(a.user_id) ?? { name: nameOf(a.user_id), total: 0, calls: 0, status: 0, notes: 0, leads: 0 };
      cur.calls++;
      cur.total++;
      map.set(a.user_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contribs, activities, profiles]);

  const daily = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({ day: format(d, "MMM d"), count: 0 });
    }
    const bump = (ts: string) => {
      const d = format(startOfDay(new Date(ts)), "MMM d");
      const row = days.find(x => x.day === d);
      if (row) row.count++;
    };
    contribs.forEach(c => bump(c.created_at));
    activities.forEach(a => bump(a.created_at));
    return days;
  }, [contribs, activities]);

  const topManager = perManager[0];
  const totalActions = perManager.reduce((s, x) => s + x.total, 0);

  const changeRole = async (userId: string, role: "admin" | "manager") => {
    setBusy(true);
    try {
      if (!user) return;
      await setRoleFn({ userId: user.id, targetUserId: userId, role });
      toast.success("Role updated");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const toggleSuspend = async (userId: string, suspended: boolean) => {
    setBusy(true);
    try {
      if (!user) return;
      await setSuspendFn({ userId: user.id, targetUserId: userId, suspended });
      toast.success(suspended ? "User suspended" : "User reinstated");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" /> SAPE Admin
        </h1>
        <p className="text-sm text-muted-foreground">Manage managers, leads & templates. Activity overview for the last 30 days.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Link to="/import" className="block">
          <Card className="p-4 hover:border-primary/40 transition">
            <Upload className="size-5 text-primary mb-2" />
            <div className="font-medium">CSV Upload</div>
            <div className="text-xs text-muted-foreground">Import leads into a group.</div>
          </Card>
        </Link>
        <Link to="/leads" className="block">
          <Card className="p-4 hover:border-primary/40 transition">
            <Database className="size-5 text-primary mb-2" />
            <div className="font-medium">Lead Management</div>
            <div className="text-xs text-muted-foreground">View, reassign, delete ({leadCount}).</div>
          </Card>
        </Link>
        <Card className="p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-5 text-primary" />
            <div className="font-medium">Groups</div>
            <span className="ml-auto text-xs text-muted-foreground">{groups.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">Organise leads — see section below.</div>
        </Card>
      </div>

      {/* Groups manager */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FolderPlus className="size-5 text-primary" />
          <h3 className="font-medium text-sm">Lead groups</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <Input
            placeholder="New group name (e.g. Group A)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void addGroup(); }}
            maxLength={80}
          />
          <Button onClick={addGroup} disabled={busy || !newGroupName.trim()}>
            <FolderPlus className="size-4 mr-1" /> Create
          </Button>
        </div>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">No groups yet. Create one above, then choose it on the CSV upload page.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {groups.map(g => (
              <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                {editingGroup === g.id ? (
                  <>
                    <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="h-8 flex-1" maxLength={80} />
                    <Button size="sm" variant="ghost" onClick={() => void saveGroupName(g.id)} disabled={busy}><Check className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingGroup(null)}><X className="size-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-sm flex-1 truncate">{g.group_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{groupCounts[g.id] ?? 0} leads</span>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingGroup(g.id); setEditGroupName(g.group_name); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{g.group_name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Leads will stay in the system but lose this group tag. {groupCounts[g.id] ?? 0} lead membership(s) will be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void removeGroup(g.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          WhatsApp templates are now stored in code at <code className="bg-muted px-1 rounded">src/templates/messages/</code> and images at <code className="bg-muted px-1 rounded">src/templates/images/</code>. Edit those files to change templates.
        </p>
      </Card>



      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Activity className="size-4" />} label="Total actions (30d)" value={totalActions} />
        <Stat icon={<Users className="size-4" />} label="Active managers" value={perManager.length} />
        <Stat icon={<Trophy className="size-4" />} label="Top performer" value={topManager?.name ?? "—"} sub={topManager ? `${topManager.total} actions` : ""} />
        <Stat icon={<Database className="size-4" />} label="Total leads" value={leadCount} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-medium mb-3 text-sm">Actions per manager (calls + status + notes)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perManager}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-3 text-sm">Daily activity (14 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Manager history */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-medium text-sm">Manager activity breakdown</h3>
          <p className="text-xs text-muted-foreground">Calls, status updates, notes & leads created. (No WhatsApp tracking — managers' messaging is private.)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Manager</th>
                <th className="px-4 py-2">Calls</th>
                <th className="px-4 py-2">Status updates</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Leads created</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {perManager.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No activity yet.</td></tr>}
              {perManager.map(m => (
                <tr key={m.name} className="border-t">
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2">{m.calls}</td>
                  <td className="px-4 py-2">{m.status}</td>
                  <td className="px-4 py-2">{m.notes}</td>
                  <td className="px-4 py-2">{m.leads}</td>
                  <td className="px-4 py-2 font-semibold">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Users */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-medium text-sm">Users & roles</h3>
          <p className="text-xs text-muted-foreground">Promote, demote, or suspend accounts.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Suspended</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => {
                const r = roles[p.id] ?? "manager";
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{p.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Select value={r === "caller" ? "manager" : r} onValueChange={(v) => changeRole(p.id, v as "admin" | "manager")} disabled={busy}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Switch checked={p.suspended} onCheckedChange={(v) => toggleSuspend(p.id, v)} disabled={busy} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
      <div className="text-2xl font-semibold mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
