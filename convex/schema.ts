import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leads: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    assigned_to: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    locked_by: v.optional(v.string()),
    lock_expires_at: v.optional(v.string()),
    call_status: v.optional(v.string()),
  })
    .index("by_phone", ["phone"])
    .index("by_assigned_to", ["assigned_to"]),
  groups: defineTable({
    group_name: v.string(),
    created_by: v.string(),
  }),
  lead_groups: defineTable({
    lead_id: v.string(),
    group_id: v.string(),
  })
    .index("by_lead", ["lead_id"])
    .index("by_group", ["group_id"])
    .index("by_lead_group", ["lead_id", "group_id"]),
  lead_notes: defineTable({
    lead_id: v.string(),
    author_id: v.string(),
    note: v.string(),
    created_at: v.string(),
  }).index("by_lead", ["lead_id"]),
  lead_contributions: defineTable({
    lead_id: v.string(),
    manager_id: v.string(),
    contribution_type: v.string(),
    description: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_lead", ["lead_id"])
    .index("by_manager", ["manager_id"]),
  user_roles: defineTable({
    user_id: v.string(),
    role: v.string(),
  }).index("by_user", ["user_id"]),
  profiles: defineTable({
    id: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    suspended: v.boolean(),
  }).index("by_profile_id", ["id"]),
  activity_log: defineTable({
    user_id: v.string(),
    action: v.string(),
    created_at: v.string(),
    details: v.optional(v.any()),
  }).index("by_user", ["user_id"]),
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    isDisabled: v.boolean(),
  }).index("by_email", ["email"]),
});
