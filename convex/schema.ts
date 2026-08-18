import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One postcard = one person, one city, one day.
  postcards: defineTable({
    city: v.string(),
    recipient: v.string(),
    sender: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),

    state: v.string(), // running | done | failed
    error: v.optional(v.string()),

    // Drives the live progress list on the dashboard — every write here
    // pushes to every subscribed browser with no polling.
    steps: v.array(
      v.object({
        name: v.string(),
        label: v.string(),
        status: v.string(), // pending | running | done | failed | skipped
        detail: v.optional(v.string()),
      }),
    ),

    details: v.array(v.string()),
    lyrics: v.optional(v.string()),
    sungLyrics: v.optional(v.string()),

    audioId: v.optional(v.id("_storage")),
    cardId: v.optional(v.id("_storage")),

    postCount: v.optional(v.number()),
    fromCache: v.optional(v.boolean()),
    callId: v.optional(v.string()),
    emailSent: v.optional(v.boolean()),
    startedAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_city", ["city"]),

  // Scraped posts, reused for 6h so demo runs are fast and Apify isn't
  // hammered. The cron below keeps popular cities warm.
  cityCache: defineTable({
    city: v.string(),
    posts: v.array(
      v.object({
        caption: v.string(),
        likes: v.number(),
        timestamp: v.string(),
        image: v.string(),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_city", ["city"]),
});
