# 💌 Wish You Were Here

### Someone you love is far away. Tell them you noticed.

**Live → https://energized-raccoon-411.convex.site**

We all know the feeling. Your mum is in Manila. Your best friend moved to Lagos. Your
partner is on a work trip in Kraków. And every message you send comes out the same:
**"miss you, hope you're okay."**

The hard part of loving someone far away was never the caring. It's the *noticing*. You
don't know it rained all afternoon where they are. You don't know the trains stopped in
the storm, or that the power went out again.

**So we go and find out — and we turn it into a song.** 🎵

---

## ✨ What it does

Type a name and a city. Sixty seconds later they get a postcard with a song on the back,
and the song is about **their actual day**, in **their actual city**.

Not "Lagos is a beautiful city." Something a lot more like paying attention:

> 🎶 *I picture you out on the bustling streets at eight,*
> *before the heat rises and the **yellow danfos** fill with noise.*
> *I know you're counting the fuel budget tonight,*
> ***praying that the generator starts on the first pull.***

Danfos are Lagos's yellow minibuses. The generator line is about the power cuts. **No
model volunteers those details** — they came from what people in Lagos posted that
morning, and we sang them back. 🇳🇬

---

## ⚡ Built on Convex

Convex isn't storage bolted to the side of this — it's the whole spine. **Seven Convex
features**, each replacing something we'd otherwise have had to build ourselves:

| Feature | Where | What it does here |
|---|---|---|
| 🗄️ **Database** | `postcards` + `cityCache` | Every postcard and every scrape, typed end-to-end |
| 🔑 **Schema + indexes** | `schema.ts` | 3 indexes — `by_state`, `by_city` ×2 |
| ⚡ **Reactive subscriptions** | `client.onUpdate` ×4 | **Live build progress with zero polling** |
| ⏱️ **Scheduler** | `ctx.scheduler.runAfter` | Mutation returns instantly; the 60s pipeline runs detached |
| 🎬 **Actions** | `internalAction` | The only place external APIs can be reached |
| 📦 **File storage** | `ctx.storage` | The mp3 and the postcard, served from Convex's CDN |
| ⏰ **Cron** | every 3 hours | Re-scrapes demo cities so the details are always *today's* |
| 🌐 **HTTP actions** | `.site` domain | **Serves the entire frontend** — no separate host |

**The two that changed the architecture:**

🔴 **`onUpdate` — no polling anywhere.** Open the app in two browsers. Make a postcard in
one and watch the steps light up in the other, live. The gallery updates for everyone the
instant anyone makes something. Our pre-Convex version polled every 900ms; this is just
a subscription.

⏱️ **`scheduler.runAfter` — instant response on a 60-second job.** The mutation returns an
ID immediately and the browser starts watching. Without it we'd have needed a job queue.

And because HTTP actions serve the page itself, **the entire product is one Convex
deployment.** No Vercel, no S3, no separate API. One `npx convex dev` and it's live at a
public URL anyone can open on their phone. 🚀

---

## 🕷️ Powered by Apify

This is the part the whole idea rests on, so let's be precise.

**No model knows what happened in Lagos today.** Training data is months old. Search
grounding doesn't help either — Instagram is walled off from it, and the moment we care
about expires within 48 hours.

There is exactly one way to know that people were praying their generators would start
this morning: **go and get it.**

So we scrape **~80 posts per city** through Apify. And here's what makes it interesting —
**most of them are garbage.** City hashtags are overrun by marketers:

```
✗ "Okada Manila – luxury resort…"       ← ad
✗ "OP 39MM WATCH ₱450,000‼️"             ← ad
✗ "MUSCAT GREEN GRAPES 🍇"               ← ad
✓ "Manila's rain is relentless, but
   the jeepney driver laughs"            ← 💎 there it is
```

Roughly **one post in eight** says anything true about being alive in a place. So we
scrape at volume and read all eighty to find the handful that matter.

**Find, structure, and apply external information.** Without Apify there is no product —
just another model writing "Lagos is beautiful." 🏆

---

## 📞 Delivered with Vapi

Their phone rings. A warm voice tells them someone made them something today, which city
it came from, and that the link is waiting.

The call is deliberately an **announcement, not the delivery**. Telephony is 8kHz
narrowband — it would flatten a song into tin. So Vapi does what a phone call is
genuinely good at (*someone was thinking about you, right now*) and the music plays in
full fidelity from the link. 🔔

Prefer not to call? The native share sheet sends it by text, email or WhatsApp instead. 📲

---

## 🎨 The rest of the pipeline

| Stage | Powered by | ⚡ |
|---|---|---|
| 🕷️ Scrape ~80 posts from their city | **Apify** · `instagram-hashtag-scraper` | ~8s |
| 🧹 Discard the ads, keep what's real | **Gemini 3.7 Flash** | ~5s |
| ✍️ Write the words | **Gemini 3.7 Flash** | ~5s |
| 🎵 Sing it | **Lyria 3** | ~10s |
| 🖼️ Make the postcard | **Nano Banana** | ~7s |
| 📞 Tell them it's waiting | **Vapi** | ~2s |

Song and postcard render **in parallel**, so the whole thing lands in under a minute.

The postcard isn't conjured from nothing — we take a **real photograph someone posted in
that city today** and turn it into a vintage postcard, stamp and postmark and all. 📮

---

## 🚀 Run it

```bash
npx convex dev        # backend + live at the .site URL
node server.mjs       # optional local shell → localhost:8787
```

After editing `public/index.html`, recompile the page the HTTP action serves:

```bash
node scripts/build-page.mjs && npx convex dev --once
```

Ready to demo: 🇵🇭 **Manila** · 🇳🇬 **Lagos** · 🇮🇳 **Mumbai** · 🇵🇱 **Kraków** · 🇰🇷 **Seoul**

---

## 💖 Who it's for

Every international student who hasn't been home in two years. Every immigrant whose
parents are eight thousand miles and eleven time zones away. Everyone who has ever typed
"miss you" and then just sat there, because what else is there to say.

**There was something else to say.** It happened this morning, six thousand miles away,
and now it's a song. 🎶
