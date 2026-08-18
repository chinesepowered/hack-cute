import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const STEPS = [
  { name: "scrape", label: "Scraping their city", status: "pending" },
  { name: "curate", label: "Finding what's real", status: "pending" },
  { name: "lyrics", label: "Writing the words", status: "pending" },
  { name: "song", label: "Singing it", status: "pending" },
  { name: "postcard", label: "Making the postcard", status: "pending" },
  { name: "deliver", label: "Sending it to them", status: "pending" },
  { name: "call", label: "Calling them", status: "pending" },
];

/** Reactive: the browser subscribes and re-renders on every step change. */
export const get = query({
  args: { id: v.id("postcards") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return null;
    return {
      ...doc,
      audioUrl: doc.audioId ? await ctx.storage.getUrl(doc.audioId) : null,
      cardUrl: doc.cardId ? await ctx.storage.getUrl(doc.cardId) : null,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("postcards").order("desc").take(20);
    return Promise.all(
      docs.map(async (d) => ({
        _id: d._id,
        city: d.city,
        recipient: d.recipient,
        sender: d.sender,
        state: d.state,
        startedAt: d.startedAt,
        cardUrl: d.cardId ? await ctx.storage.getUrl(d.cardId) : null,
      })),
    );
  },
});

/** Kick off a postcard. Returns immediately; the action does the work. */
export const create = mutation({
  args: {
    city: v.string(),
    recipient: v.string(),
    sender: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.string(),
  },
  handler: async (ctx, { password, ...args }) => {
    // Generation burns Apify credits and Gemini quota, so it's gated.
    // The secret lives in a deployment env var, never in this (public) repo.
    const expected = process.env.GENERATE_PASSWORD;
    if (expected && password !== expected) {
      throw new Error("Wrong password.");
    }

    const id = await ctx.db.insert("postcards", {
      ...args,
      state: "running",
      steps: STEPS.map((s) => ({ ...s })),
      details: [],
      startedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.generate.run, { id });
    return id;
  },
});

export const patch = internalMutation({
  args: { id: v.id("postcards"), fields: v.any() },
  handler: async (ctx, { id, fields }) => {
    await ctx.db.patch(id, fields);
  },
});

export const setStep = internalMutation({
  args: {
    id: v.id("postcards"),
    name: v.string(),
    status: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, status, detail }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await ctx.db.patch(id, {
      steps: doc.steps.map((s) =>
        s.name === name ? { ...s, status, detail: detail ?? s.detail } : s,
      ),
    });
  },
});

/* --------------------------------------------------------------- city cache */

export const getCache = query({
  args: { city: v.string() },
  handler: async (ctx, { city }) => {
    const row = await ctx.db
      .query("cityCache")
      .withIndex("by_city", (q) => q.eq("city", city.toLowerCase()))
      .first();
    if (!row) return null;
    if (Date.now() - row.fetchedAt > 1000 * 60 * 60 * 6) return null;
    return row.posts;
  },
});

export const putCache = internalMutation({
  args: { city: v.string(), posts: v.any() },
  handler: async (ctx, { city, posts }) => {
    const key = city.toLowerCase();
    const row = await ctx.db
      .query("cityCache")
      .withIndex("by_city", (q) => q.eq("city", key))
      .first();
    if (row) await ctx.db.patch(row._id, { posts, fetchedAt: Date.now() });
    else await ctx.db.insert("cityCache", { city: key, posts, fetchedAt: Date.now() });
  },
});
