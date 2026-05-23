import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneCall, History, MessageCircle } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { ContributionTimeline } from "@/components/ContributionTimeline";
import { STATUSES, QUICK_NOTES, statusColor, buildWhatsAppUrl } from "@/lib/leads";
import { TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate, renderTemplate } from "@/templates/messages";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function LeadDialog({ leadId, onOpenChange }: Props) {
  const { user, isAdmin } = useAuth();
  const lead = useQuery(api.crm.getLead, { leadId: leadId ?? undefined }) as
    | Lead
    | null
    | undefined;
  const notesHistory =
    (useQuery(api.crm.listLeadNotes, { leadId: leadId ?? undefined }) as
      | { id: string; note: string; created_at: string; author_name?: string }[]
      | undefined) ?? [];
  const updateLead = useMutation(api.crm.updateLead);
  const acquireLeadLock = useMutation(api.crm.acquireLeadLock);
  const releaseLeadLock = useMutation(api.crm.releaseLeadLock);
  const logCall = useMutation(api.crm.logCall);
  const [newNote, setNewNote] = useState("");
  const [status, setStatus] = useState<string>("Pending");
  const [saving, setSaving] = useState(false);
  const [tplId, setTplId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [now, setNow] = useState(Date.now());
  const profilesData = useQuery(api.crm.listProfiles) as
    | { id: string; name?: string | null; email?: string | null }[]
    | undefined;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const locker = profilesData?.find((p) => p.id === lead?.locked_by);
  const lockInfo = {
    locked_by: lead?.locked_by ?? null,
    lock_expires_at: lead?.lock_expires_at ?? null,
    locker_name: locker?.name ?? locker?.email ?? null,
  };
  const lockExpiresMs = lockInfo.lock_expires_at ? new Date(lockInfo.lock_expires_at).getTime() : 0;
  const lockedByOther =
    !!lockInfo.locked_by && lockInfo.locked_by !== user?.id && lockExpiresMs > now;
  const lockedByMe = !!lockInfo.locked_by && lockInfo.locked_by === user?.id && lockExpiresMs > now;
  const remainSec = Math.max(0, Math.floor((lockExpiresMs - now) / 1000));

  useEffect(() => {
    if (lead) setStatus(lead.status);
    if (!leadId) setNewNote("");
  }, [leadId, lead?.status]);

  const openWhatsApp = () => {
    if (!lead?.phone) {
      toast.error("No phone number");
      return;
    }
    const tpl = getTemplate(tplId);
    const msg = renderTemplate(tpl, lead.name);
    const url = buildWhatsAppUrl({ phone: lead.phone, message: msg });
    if (url) window.open(url, "_blank", "noopener");
  };

  const close = () => onOpenChange(false);

  const save = async () => {
    if (!lead || !user) return;
    if (lockedByOther && !isAdmin) {
      toast.error("This lead is currently being handled by another manager.");
      return;
    }
    setSaving(true);
    try {
      await updateLead({
        userId: user.id,
        leadId: lead.id,
        status,
        note: newNote.trim() || undefined,
        releaseLock: lockInfo.locked_by === user.id || isAdmin,
      });
      setNewNote("");
      toast.success("Lead updated");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const markCalled = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!lead || !user) return;
    if (lockedByOther) {
      e.preventDefault();
      toast.error(`${lockInfo.locker_name ?? "Another manager"} is currently calling this lead.`);
      return;
    }
    const row = await acquireLeadLock({ userId: user.id, leadId: lead.id });
    if (row && !row.success) {
      e.preventDefault();
      toast.error(`${row.locker_name ?? "Another manager"} is currently calling this lead.`);
      return;
    }
    setStatus("Calling");
    await logCall({ userId: user.id, leadId: lead.id });
  };

  const open = !!leadId && !!lead;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {lead && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-xl">{lead.name}</DialogTitle>
                  <DialogDescription className="mt-1 tabular-nums">
                    {lead.phone || "No phone"}
                  </DialogDescription>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusColor(lead.status)}`}
                >
                  {lead.status}
                </span>
              </div>
            </DialogHeader>

            {lockedByOther && (
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="flex-1">
                  <strong>{lockInfo.locker_name ?? "Another manager"}</strong> is calling this lead
                </span>
                <span className="tabular-nums text-xs">
                  {Math.floor(remainSec / 60)}:{String(remainSec % 60).padStart(2, "0")}
                </span>
              </div>
            )}
            {lockedByMe && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="flex-1">You are on this call. Update status to release.</span>
                <span className="tabular-nums text-xs">
                  {Math.floor(remainSec / 60)}:{String(remainSec % 60).padStart(2, "0")}
                </span>
              </div>
            )}

            {lead.phone && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    asChild
                    className="flex-1 h-12 text-base"
                    disabled={lockedByOther && !isAdmin}
                  >
                    <a
                      href={lockedByOther && !isAdmin ? undefined : `tel:${lead.phone}`}
                      onClick={(e) => {
                        void markCalled(e);
                      }}
                      aria-disabled={lockedByOther && !isAdmin}
                    >
                      <PhoneCall className="size-5 mr-2" /> Call {lead.phone}
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    onClick={openWhatsApp}
                    title="Send WhatsApp message"
                  >
                    <MessageCircle className="size-5" />
                    <span className="hidden sm:inline ml-1">WhatsApp</span>
                  </Button>
                </div>
                {TEMPLATES.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground shrink-0">Template</Label>
                    <Select value={tplId} onValueChange={setTplId}>
                      <SelectTrigger className="h-8 flex-1">
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
                {getTemplate(tplId).imageUrl && (
                  <img
                    src={getTemplate(tplId).imageUrl}
                    alt="Template reference"
                    className="rounded-md border max-h-24 object-contain bg-muted w-full"
                  />
                )}
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Add note</Label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="What happened on this call?"
                rows={3}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_NOTES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setNewNote((n) => (n ? n + " · " + q : q))}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {notesHistory.length > 0 && (
              <div>
                <Label>Note history</Label>
                <div className="space-y-2 mt-1 max-h-44 overflow-y-auto">
                  {notesHistory.map((n) => (
                    <div key={n.id} className="text-xs border rounded-md p-2 bg-muted">
                      <div className="text-foreground">{n.note}</div>
                      <div className="text-muted-foreground mt-1">
                        {n.author_name ?? "Someone"} •{" "}
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="flex items-center gap-1.5">
                <History className="size-3.5" /> Activity timeline
              </Label>
              <div className="mt-2 rounded-md border p-3 bg-card">
                <ContributionTimeline leadId={lead.id} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
