# Archived Python scripts

These are the original YT outreach scripts, kept here for reference.
They have been fully replaced by the TypeScript implementation in the main app:

| Python script         | Replaced by                                          |
|-----------------------|------------------------------------------------------|
| yt_leads_finder.py    | lib/ytDiscovery.ts + app/api/outreach/discover + app/outreach/page.tsx |
| outreach.py           | lib/ytOutreach.ts (sendOutreachEmail) + app/api/outreach/send          |
| reply_tracker.py      | lib/ytOutreach.ts (checkReplies) + app/api/outreach/sync               |

Delete this folder once you've run a full outreach cycle through the new system
without issues.
