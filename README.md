# 💌 Wish You Were Here

### Someone you love is far away. Tell them you noticed.

We all know the feeling. Your mum is in Manila. Your best friend moved to Lagos.
Your partner is on a work trip in Kraków. And every message you send comes out the
same: **"miss you, hope you're okay."**

The hard part of loving someone far away was never the caring. It's the *noticing*.
You don't know it rained all afternoon where they are. You don't know the museum
downtown was packed today, or that the trains stopped running in the storm.

**So we go and find out — and we turn it into a song.** 🎵

---

## ✨ What it does

You type in a name and a city. Sixty seconds later, they get a postcard with a song
on the back — and the song is about **their actual day**, in **their actual city**.

Not "Manila is a beautiful city." Something a lot more like paying attention:

> 🎶 *The gray horizon sweeps across your town,*
> *As relentless monsoon rains come pouring down.*
> ***The jeepney drivers laugh through every flooded street,***
> ***While LRT platforms fall silent in the sudden squall.***
> *Ana, I miss you plainly, with all my heart...*

Every one of those details was posted in Manila **this morning**. The jeepney drivers.
The flooded streets. The silent train platforms. We found them, and we sang them back.

---

## 🔍 Why this needs Apify

This is the whole build, so we want to be precise about it.

**No model knows what happened in Manila today.** Not GPT, not Gemini, not Claude —
their training data is months old. Search grounding doesn't help either: Instagram is
walled off from it, and the moment we care about expires in 48 hours.

There is exactly one way to know that jeepney drivers were laughing through flooded
streets in Manila this morning: **go and get it.** 🕷️

So we scrape **~80 posts per city** through Apify. And here's the interesting part —
**most of them are garbage.** City hashtags are overrun by marketers:

```
✗ "Okada Manila – luxury resort..."        ← ad
✗ "OP 39MM WATCH ₱450,000‼️"                ← ad
✗ "MUSCAT GREEN GRAPES 🍇"                  ← ad
✓ "Manila's rain is relentless, but the
   jeepney driver laughs"                   ← 💎 there it is
```

That's the real problem: roughly **one post in eight** says anything true about being
alive in a place. So we scrape at volume and let Gemini read all eighty to find the
handful that matter.

**Find, structure, and apply external information** — that's the entire pipeline, and
without Apify there is no product at all. 🏆

---

## 🎛️ How it's built

| Stage | Powered by | ⚡ |
|---|---|---|
| 🕷️ Scrape ~80 posts from their city | **Apify** · `instagram-hashtag-scraper` | ~8s |
| 🧹 Read all of them, keep what's real | **Gemini 3.7 Flash** | ~5s |
| ✍️ Write the words | **Gemini 3.7 Flash** | ~5s |
| 🎵 Sing it | **Lyria 3** | ~10s |
| 🖼️ Make the postcard | **Nano Banana** | ~7s |
| 📞 Call to tell them it's waiting | **Vapi** | ~2s |

The song and the postcard render **in parallel**, so the whole thing lands in under a
minute.

The postcard isn't generated from nothing — we take a **real photograph someone posted
in that city today** and turn it into a vintage postcard, stamp and postmark and all. 📮

And the phone call is deliberately just an *announcement*. Telephony is 8kHz; it would
flatten the song. So Vapi rings them, tells them warmly that someone made them
something, and points them at the real thing. 🔔

---

## 🚀 Run it

```bash
node server.mjs      # → http://localhost:8787
```

Type a name, type a city, press the button.

Already loaded and ready to demo: 🇵🇭 **Manila** · 🇳🇬 **Lagos** · 🇮🇳 **Mumbai** ·
🇵🇱 **Kraków** · 🇰🇷 **Seoul**

---

## 💖 Who it's for

Every international student who hasn't been home in two years. Every immigrant whose
parents are eight thousand miles and eleven time zones away. Everyone who has ever
typed "miss you" and then just sat there, because what else is there to say.

**There was something else to say.** It happened this morning, six thousand miles away,
and now it's a song. 🎶
