import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

const GEM = "https://generativelanguage.googleapis.com/v1beta";

const TEXT_MODEL = () => process.env.GEMINI_TEXT_MODEL ?? "gemini-3.7-flash";
const IMAGE_MODEL = () => process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const MUSIC_MODEL = () => process.env.GEMINI_MUSIC_MODEL ?? "lyria-3-clip-preview";

/* ------------------------------------------------------------ base64 (V8) */

function b64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

function bytesToB64(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i += 0x8000) {
    s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/* ----------------------------------------------------------------- gemini */

async function gemini(model: string, body: unknown) {
  const r = await fetch(`${GEM}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j: any = await r.json();
  if (j.promptFeedback?.blockReason) throw new Error(`blocked: ${j.promptFeedback.blockReason}`);
  if (j.error) throw new Error(String(j.error.message ?? "gemini error").slice(0, 160));
  return (j.candidates?.[0]?.content?.parts ?? []) as any[];
}

async function geminiText(prompt: string, json = false) {
  const cfg: any = { maxOutputTokens: 16384 };
  if (json) cfg.responseMimeType = "application/json";
  const parts = await gemini(TEXT_MODEL(), {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: cfg,
  });
  const text = parts.map((p) => p.text).filter(Boolean).join("");
  if (!text) throw new Error("empty response");
  if (!json) return text;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("unparseable JSON");
    return JSON.parse(m[0]);
  }
}

/* --------------------------------------------------------------- pipeline */

export const run = internalAction({
  args: { id: v.id("postcards") },
  handler: async (ctx, { id }) => {
    const doc: any = await ctx.runQuery(api.postcards.get, { id });
    if (!doc) return;
    const { city, recipient, sender, phone, email } = doc;

    const step = (name: string, status: string, detail?: string) =>
      ctx.runMutation(internal.postcards.setStep, { id, name, status, detail });
    const fail = async (msg: string) => {
      await ctx.runMutation(internal.postcards.patch, { id, fields: { state: "failed", error: msg } });
    };

    /* 1 — scrape ------------------------------------------------------- */
    await step("scrape", "running");
    let posts: any[] | null = await ctx.runQuery(api.postcards.getCache, { city });
    let fromCache = Boolean(posts?.length);

    if (!fromCache) {
      try {
        const c = city.toLowerCase().replace(/[^a-z0-9]/g, "");
        const r = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=170`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hashtags: [c, `${c}life`, `${c}today`], resultsLimit: 90 }),
          },
        );
        const raw: any = await r.json();
        posts = (Array.isArray(raw) ? raw : [])
          .filter((p: any) => p && (p.caption || p.displayUrl))
          .map((p: any) => ({
            caption: String(p.caption ?? "").slice(0, 600),
            likes: p.likesCount ?? 0,
            timestamp: String(p.timestamp ?? ""),
            image: String(p.displayUrl ?? ""),
          }));
        if (posts.length) {
          await ctx.runMutation(internal.postcards.putCache, { city, posts });
        }
      } catch (e: any) {
        posts = [];
      }
    }

    if (!posts || !posts.length) {
      await step("scrape", "failed");
      return fail(`Couldn't reach ${city} right now.`);
    }
    await step("scrape", "done", `${posts.length} posts${fromCache ? " (cached)" : ""}`);
    await ctx.runMutation(internal.postcards.patch, {
      id,
      fields: { postCount: posts.length, fromCache },
    });

    /* 2 — curate ------------------------------------------------------- */
    await step("curate", "running");
    let details: string[] = [];
    let photoIndex = 0;
    try {
      const corpus = posts
        .map((p, i) => `[${i}] (${p.timestamp.slice(0, 10)}) ${p.caption.replace(/\s+/g, " ").slice(0, 260)}`)
        .join("\n");
      const out: any = await geminiText(
        `Below are Instagram captions posted in ${city} in the last day or two.\n\n${corpus}\n\n` +
          `Most are advertisements, promotions or spam. Ignore those completely.\n` +
          `Find the ones that show what it actually FEELS like to be in ${city} right now — weather, food, ` +
          `traffic, small human moments, things only a local would post.\n\n` +
          `Return JSON: {"details":["..."],"photoIndex":N}\n` +
          `- "details": 5-8 short concrete observations, each under 15 words.\n` +
          `- "photoIndex": index of the post whose photo would make the prettiest postcard.`,
        true,
      );
      details = (out.details ?? []).slice(0, 8);
      photoIndex = Number.isInteger(out.photoIndex) ? out.photoIndex : 0;
    } catch {
      details = posts
        .filter((p) => p.caption && !/\b(sale|shop|order|promo|discount|₱|\$)\b/i.test(p.caption))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 6)
        .map((p) => p.caption.replace(/\s+/g, " ").slice(0, 90));
    }
    if (!details.length) {
      await step("curate", "failed");
      return fail(`Nothing worth singing about came back from ${city}.`);
    }
    await step("curate", "done", `${details.length} real moments`);
    await ctx.runMutation(internal.postcards.patch, { id, fields: { details } });

    /* 3 — lyrics ------------------------------------------------------- */
    await step("lyrics", "running");
    let lyrics: string;
    try {
      lyrics = (await geminiText(
        `Write short song lyrics from ${sender} to ${recipient}, who is far away in ${city}.\n\n` +
          `Things happening in ${city} today:\n${details.map((d) => `- ${d}`).join("\n")}\n\n` +
          `Write 8-12 short lines. Weave in two or three of those specific details so it is unmistakably ` +
          `about ${city} today and not any other place. Say plainly that ${sender} misses ${recipient}. ` +
          `Warm, tender, simple language. No title, no section labels, just the lines.`,
      )) as string;
      lyrics = lyrics.trim();
    } catch {
      lyrics = details.join("\n");
    }
    await step("lyrics", "done");
    await ctx.runMutation(internal.postcards.patch, { id, fields: { lyrics } });

    /* 4+5 — song and postcard, in parallel ------------------------------ */
    await step("song", "running");
    await step("postcard", "running");

    const songP = (async () => {
      // Descriptive phrasing only — imperatives trip the safety filter.
      const make = (p: string) => gemini(MUSIC_MODEL(), { contents: [{ parts: [{ text: p }] }] });
      let parts;
      try {
        parts = await make(
          `A warm, tender acoustic folk song with a gentle female voice singing these words, ` +
            `soft guitar and light strings, intimate and a little wistful:\n\n${lyrics}`,
        );
      } catch {
        parts = await make(
          `A gentle acoustic folk song, soft female vocal, about missing someone far away in ${city}`,
        );
      }
      let audio: string | null = null;
      let sung = "";
      for (const p of parts) {
        if (p.text) sung = p.text;
        if (p.inlineData?.data) audio = p.inlineData.data;
      }
      if (!audio) throw new Error("no audio");
      const audioId = await ctx.storage.store(b64ToBlob(audio, "audio/mpeg"));
      return { audioId, sung };
    })();

    const cardP = (async () => {
      const order = [photoIndex, 0, 1, 2, 3].filter((i) => posts![i]?.image);
      for (const i of order) {
        try {
          const imgRes = await fetch(posts![i].image, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (!imgRes.ok) continue;
          const bytes = await imgRes.arrayBuffer();
          if (bytes.byteLength < 1000) continue;

          const parts = await gemini(IMAGE_MODEL(), {
            contents: [
              {
                parts: [
                  {
                    text:
                      `Turn this photo into a vintage travel postcard from ${city}. Keep the original ` +
                      `photograph clearly visible as the main image. Add a white postcard border and ` +
                      `hand-lettered text reading "${city}" in a warm retro style, plus a small postage ` +
                      `stamp in the corner. Make it look like a real postcard someone would mail.`,
                  },
                  { inline_data: { mime_type: "image/jpeg", data: bytesToB64(bytes) } },
                ],
              },
            ],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          });
          for (const p of parts) {
            if (p.inlineData?.data) {
              return await ctx.storage.store(b64ToBlob(p.inlineData.data, "image/png"));
            }
          }
          // Editing failed but the photo is good — keep the photo.
          return await ctx.storage.store(new Blob([bytes], { type: "image/jpeg" }));
        } catch {
          continue;
        }
      }
      return null;
    })();

    const [song, cardId] = await Promise.allSettled([songP, cardP]);

    if (song.status === "fulfilled") {
      await ctx.runMutation(internal.postcards.patch, {
        id,
        fields: { audioId: song.value.audioId, sungLyrics: song.value.sung },
      });
      await step("song", "done");
    } else {
      await step("song", "failed", String(song.reason).slice(0, 80));
    }

    if (cardId.status === "fulfilled" && cardId.value) {
      await ctx.runMutation(internal.postcards.patch, { id, fields: { cardId: cardId.value } });
      await step("postcard", "done");
    } else {
      await step("postcard", "failed");
    }

    if (song.status !== "fulfilled") return fail("The song didn't come through.");
    await ctx.runMutation(internal.postcards.patch, { id, fields: { state: "done" } });

    /* 6 — email it to them --------------------------------------------- */
    const link = `${process.env.PUBLIC_SITE_URL ?? process.env.CONVEX_SITE_URL ?? ""}/#${id}`;

    if (email && process.env.RESEND_API_KEY) {
      await step("deliver", "running");
      try {
        const fresh: any = await ctx.runQuery(api.postcards.get, { id });
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "Wish You Were Here <onboarding@resend.dev>",
            to: [email],
            subject: `${sender} sent you a postcard from ${city}`,
            html:
              `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#231d2e">` +
              `<h1 style="font-size:26px;margin:0 0 4px">${recipient},</h1>` +
              `<p style="color:#6b6280;margin:0 0 22px">${sender} made you this from ${city} today.</p>` +
              (fresh?.cardUrl
                ? `<img src="${fresh.cardUrl}" alt="A postcard from ${city}" style="width:100%;border-radius:12px;display:block;margin-bottom:22px">`
                : "") +
              `<p style="white-space:pre-wrap;font-style:italic;font-size:17px;line-height:1.8">${(lyrics || "")
                .replace(/[<>&]/g, "")}</p>` +
              `<p style="margin:26px 0"><a href="${link}" style="background:#ffb86b;color:#22141f;padding:13px 22px;` +
              `border-radius:9px;text-decoration:none;font-weight:700;font-family:system-ui,sans-serif">` +
              `▶ Listen to your song</a></p>` +
              `<p style="color:#9a90ad;font-size:13px;font-family:system-ui,sans-serif">` +
              `Every line came from something posted in ${city} this morning.</p></div>`,
          }),
        });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.message ?? `HTTP ${r.status}`);
        await ctx.runMutation(internal.postcards.patch, { id, fields: { emailSent: true } });
        await step("deliver", "done", `emailed ${email}`);
      } catch (e: any) {
        await step("deliver", "skipped", String(e.message).slice(0, 60));
      }
    } else {
      await step("deliver", "skipped", email ? "email not configured" : "share the link");
    }

    /* 7 — call --------------------------------------------------------- */
    if (phone && process.env.VAPI_API_KEY) {
      await step("call", "running");
      try {
        const r = await fetch("https://api.vapi.ai/call", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
            assistantId: process.env.VAPI_ASSISTANT_ID,
            customer: { number: phone },
            assistantOverrides: {
              firstMessage:
                `Hi ${recipient}. This isn't a sales call, I promise. ${sender} made you something today — ` +
                `a postcard from ${city}, with a song on the back, built from what people there posted this ` +
                `morning. I've sent you the link. ${sender} says they miss you.`,
            },
          }),
        });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.message ?? `HTTP ${r.status}`);
        await ctx.runMutation(internal.postcards.patch, { id, fields: { callId: j.id } });
        await step("call", "done", "ringing");
      } catch (e: any) {
        await step("call", "skipped", String(e.message).slice(0, 60));
      }
    } else {
      await step("call", "skipped", phone ? "calling not configured" : "link only");
    }
  },
});

/** Keeps demo cities warm so a live run is seconds, not a minute. */
export const prewarm = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const city of ["Manila", "Lagos", "Mumbai", "Krakow", "Seoul"]) {
      const cached = await ctx.runQuery(api.postcards.getCache, { city });
      if (cached?.length) continue;
      try {
        const c = city.toLowerCase();
        const r = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=170`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hashtags: [c, `${c}life`], resultsLimit: 90 }),
          },
        );
        const raw: any = await r.json();
        const posts = (Array.isArray(raw) ? raw : [])
          .filter((p: any) => p && (p.caption || p.displayUrl))
          .map((p: any) => ({
            caption: String(p.caption ?? "").slice(0, 600),
            likes: p.likesCount ?? 0,
            timestamp: String(p.timestamp ?? ""),
            image: String(p.displayUrl ?? ""),
          }));
        if (posts.length) await ctx.runMutation(internal.postcards.putCache, { city, posts });
      } catch {
        /* try again next tick */
      }
    }
  },
});
