import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Instagram posts expire fast — re-scrape the demo cities every few hours so a
// live run is seconds rather than a minute, and so the details are always today's.
crons.interval("keep demo cities warm", { hours: 3 }, internal.generate.prewarm, {});

export default crons;
