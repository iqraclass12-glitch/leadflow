import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ROLES = ["admin", "manager", "caller"] as const;

function nowIso() {
  return new Date().toISOString();
}

function toPublic<T extends { _id: unknown; _creationTime: number }>(doc: T) {
  const { _id, _creationTime, ...rest } = doc;
  return { id: String(_id), _creationTime, ...rest };
}

function normalizePhone(phone: string) {
  let n = phone.toString().replace(/\D+/g, "");
  if (n.length > 10 && n.startsWith("91")) n = n.slice(2);
  return n;
}

async function getRole(ctx: any, userId: string) {
  const roles = await ctx.db
    .query("user_roles")
    .withIndex("by_user", (q: any) => q.eq("user_id", userId))
    .collect();
  return roles.some((r: any) => r.role === "admin") ? "admin" : roles[0]?.role ?? "manager";
}

async function assertAdmin(ctx: any, userId: string) {
  const role = await getRole(ctx, userId);
  if (role !== "admin") throw new Error("Forbidden: admin only");
}

async function profileName(ctx: any, userId: string) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_profile_id", (q: any) => q.eq("id", userId))
    .first();
  return profile?.name ?? profile?.email?.split("@")[0] ?? null;
}

async function deleteByPublicId(ctx: any, table: any, id: string) {
  const normalized = ctx.db.normalizeId(table, id);
  if (normalized) await ctx.db.delete(normalized);
}

export const me = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_profile_id", (q) => q.eq("id", args.userId!))
      .first();
    if (!profile || profile.suspended) return null;
    return {
      user: { id: args.userId, email: profile.email ?? "", user_metadata: { name: profile.name } },
      role: await getRole(ctx, args.userId),
      profileName: profile.name ?? null,
    };
  },
});

export const listLeads = query({
  args: { userId: v.string(), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    const leads = await ctx.db.query("leads").collect();
    return leads
      .filter((lead) => args.isAdmin || !lead.assigned_to || lead.assigned_to === args.userId)
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
      .map(toPublic);
  },
});

export const getLead = query({
  args: { leadId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.leadId) return null;
    const id = ctx.db.normalizeId("leads", args.leadId);
    if (!id) return null;
    const lead = await ctx.db.get(id);
    return lead ? toPublic(lead) : null;
  },
});

export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    return groups.sort((a, b) => a.group_name.localeCompare(b.group_name)).map(toPublic);
  },
});

export const listLeadGroups = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("lead_groups").collect()).map(toPublic),
});

export const listProfiles = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("profiles").collect()).map(toPublic),
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("user_roles").collect()).map(toPublic),
});

export const listLeadNotes = query({
  args: { leadId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.leadId) return [];
    const notes = await ctx.db
      .query("lead_notes")
      .withIndex("by_lead", (q) => q.eq("lead_id", args.leadId!))
      .collect();
    const profiles = await ctx.db.query("profiles").collect();
    const names = new Map(profiles.map((p) => [p.id, p.name ?? p.email]));
    return notes
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((n) => ({ ...toPublic(n), author_name: names.get(n.author_id) ?? undefined }));
  },
});

export const listContributions = query({
  args: { leadId: v.optional(v.string()), managerId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let rows = args.leadId
      ? await ctx.db.query("lead_contributions").withIndex("by_lead", (q) => q.eq("lead_id", args.leadId!)).collect()
      : await ctx.db.query("lead_contributions").collect();
    if (args.managerId) rows = rows.filter((r) => r.manager_id === args.managerId);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.slice(0, args.limit ?? 500).map(toPublic);
  },
});

export const listActivity = query({
  args: { userId: v.optional(v.string()), action: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("activity_log").collect();
    if (args.userId) rows = rows.filter((r) => r.user_id === args.userId);
    if (args.action) rows = rows.filter((r) => r.action === args.action);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.slice(0, args.limit ?? 500).map(toPublic);
  },
});

export const dashboardStats = query({
  args: { userId: v.string(), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    const leads = (await ctx.db.query("leads").collect()).filter(
      (lead) => args.isAdmin || !lead.assigned_to || lead.assigned_to === args.userId,
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = today.toISOString();
    const contributions = (await ctx.db.query("lead_contributions").collect()).filter(
      (c) => c.created_at >= iso && (args.isAdmin || c.manager_id === args.userId),
    );
    return { leads: leads.map(toPublic), todayActivity: contributions.length };
  },
});

export const adminOverview = query({
  args: { userId: v.string(), since: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    const [profiles, roles, contributions, activities, leads, groups, leadGroups] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("user_roles").collect(),
      ctx.db.query("lead_contributions").collect(),
      ctx.db.query("activity_log").collect(),
      ctx.db.query("leads").collect(),
      ctx.db.query("groups").collect(),
      ctx.db.query("lead_groups").collect(),
    ]);
    return {
      profiles: profiles.map(toPublic),
      roles: roles.map(toPublic),
      contributions: contributions.filter((c: any) => c.created_at >= args.since).map(toPublic),
      activities: activities.filter((a: any) => a.created_at >= args.since && a.action === "call").map(toPublic),
      leadCount: leads.length,
      groups: groups.sort((a: any, b: any) => a.group_name.localeCompare(b.group_name)).map(toPublic),
      leadGroups: leadGroups.map(toPublic),
    };
  },
});

export const updateLead = mutation({
  args: { userId: v.string(), leadId: v.string(), status: v.string(), note: v.optional(v.string()), releaseLock: v.boolean() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("leads", args.leadId);
    if (!id) throw new Error("Lead not found");
    const lead = await ctx.db.get(id);
    if (!lead) throw new Error("Lead not found");
    const now = nowIso();
    await ctx.db.patch(id, { status: args.status, updated_at: now, ...(args.note ? { notes: args.note } : {}) });
    if (lead.status !== args.status) {
      await ctx.db.insert("lead_contributions", {
        lead_id: args.leadId,
        manager_id: args.userId,
        contribution_type: "status_updated",
        description: `${lead.status} -> ${args.status}`,
        created_at: now,
      });
    }
    if (args.note) {
      await ctx.db.insert("lead_notes", { lead_id: args.leadId, author_id: args.userId, note: args.note, created_at: now });
      await ctx.db.insert("lead_contributions", {
        lead_id: args.leadId,
        manager_id: args.userId,
        contribution_type: "note_added",
        description: args.note,
        created_at: now,
      });
    }
    if (args.releaseLock) await ctx.db.patch(id, { locked_by: undefined, lock_expires_at: undefined });
    return { ok: true };
  },
});

export const acquireLeadLock = mutation({
  args: { userId: v.string(), leadId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("leads", args.leadId);
    if (!id) throw new Error("Lead not found");
    const lead = await ctx.db.get(id);
    if (!lead) throw new Error("Lead not found");
    const now = Date.now();
    const expires = lead.lock_expires_at ? new Date(lead.lock_expires_at).getTime() : 0;
    if (lead.locked_by && lead.locked_by !== args.userId && expires > now) {
      return { success: false, locker_name: await profileName(ctx, lead.locked_by) };
    }
    await ctx.db.patch(id, {
      locked_by: args.userId,
      lock_expires_at: new Date(now + 5 * 60 * 1000).toISOString(),
      call_status: "calling",
      updated_at: nowIso(),
    });
    return { success: true, locker_name: null };
  },
});

export const releaseLeadLock = mutation({
  args: { userId: v.string(), leadId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("leads", args.leadId);
    if (!id) return { ok: true };
    const lead = await ctx.db.get(id);
    const role = await getRole(ctx, args.userId);
    if (lead && (lead.locked_by === args.userId || role === "admin")) {
      await ctx.db.patch(id, { locked_by: undefined, lock_expires_at: undefined });
    }
    return { ok: true };
  },
});

export const logCall = mutation({
  args: { userId: v.string(), leadId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("activity_log", {
      user_id: args.userId,
      action: "call",
      details: { lead_id: args.leadId },
      created_at: nowIso(),
    });
    return { ok: true };
  },
});

export const deleteLeads = mutation({
  args: { userId: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    for (const id of args.ids) {
      await deleteByPublicId(ctx, "leads", id);
      const links = await ctx.db.query("lead_groups").withIndex("by_lead", (q: any) => q.eq("lead_id", id)).collect();
      for (const link of links) await ctx.db.delete(link._id);
    }
    return { ok: true, deleted: args.ids.length };
  },
});

export const importLeads = mutation({
  args: {
    userId: v.string(),
    rows: v.array(v.object({ name: v.string(), phone: v.string() })),
    groupId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    const total = args.rows.length;
    let invalid = 0;
    let inserted = 0;
    let failed = 0;
    const seen = new Set<string>();
    const insertedIds: string[] = [];
    const existingIds: string[] = [];
    const existing = await ctx.db.query("leads").collect();
    const byPhone = new Map(existing.map((l) => [l.phone, String(l._id)]));
    for (const row of args.rows) {
      const name = row.name.trim();
      const phone = normalizePhone(row.phone);
      if (!name || phone.length < 7 || phone.length > 15) {
        invalid++;
        continue;
      }
      if (seen.has(phone)) continue;
      seen.add(phone);
      const found = byPhone.get(phone);
      if (found) {
        existingIds.push(found);
        continue;
      }
      try {
        const now = nowIso();
        const id = await ctx.db.insert("leads", {
          name,
          phone,
          status: "Pending",
          created_by: args.userId,
          created_at: now,
          updated_at: now,
        });
        inserted++;
        insertedIds.push(String(id));
        await ctx.db.insert("lead_contributions", {
          lead_id: String(id),
          manager_id: args.userId,
          contribution_type: "import_added",
          description: "Imported lead",
          created_at: now,
        });
      } catch {
        failed++;
      }
    }
    if (args.groupId) {
      for (const leadId of [...insertedIds, ...existingIds]) {
        const exists = await ctx.db
          .query("lead_groups")
          .withIndex("by_lead_group", (q: any) => q.eq("lead_id", leadId).eq("group_id", args.groupId!))
          .first();
        if (!exists) await ctx.db.insert("lead_groups", { lead_id: leadId, group_id: args.groupId });
      }
    }
    const duplicates = total - invalid - seen.size + existingIds.length;
    return { ok: true, total, inserted, duplicates, invalid, failed };
  },
});

export const createGroup = mutation({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    const id = await ctx.db.insert("groups", { group_name: args.name.trim(), created_by: args.userId });
    return { id: String(id), group_name: args.name.trim() };
  },
});

export const renameGroup = mutation({
  args: { userId: v.string(), id: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    const id = ctx.db.normalizeId("groups", args.id);
    if (!id) throw new Error("Group not found");
    await ctx.db.patch(id, { group_name: args.name.trim() });
    return { ok: true };
  },
});

export const deleteGroup = mutation({
  args: { userId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    await deleteByPublicId(ctx, "groups", args.id);
    const links = await ctx.db.query("lead_groups").withIndex("by_group", (q: any) => q.eq("group_id", args.id)).collect();
    for (const link of links) await ctx.db.delete(link._id);
    return { ok: true };
  },
});

export const setUserRole = mutation({
  args: { userId: v.string(), targetUserId: v.string(), role: v.union(v.literal("admin"), v.literal("manager")) },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    const existing = await ctx.db.query("user_roles").withIndex("by_user", (q: any) => q.eq("user_id", args.targetUserId)).collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("user_roles", { user_id: args.targetUserId, role: args.role });
    return { ok: true };
  },
});

export const setUserSuspended = mutation({
  args: { userId: v.string(), targetUserId: v.string(), suspended: v.boolean() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.userId);
    if (args.userId === args.targetUserId && args.suspended) throw new Error("You cannot suspend your own account");
    const profile = await ctx.db.query("profiles").withIndex("by_profile_id", (q: any) => q.eq("id", args.targetUserId)).first();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { suspended: args.suspended });
    const user = ctx.db.normalizeId("users", args.targetUserId);
    if (user) await ctx.db.patch(user, { isDisabled: args.suspended });
    return { ok: true };
  },
});
