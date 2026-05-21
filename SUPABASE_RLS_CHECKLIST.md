# Supabase RLS Checklist

All data mutations in this app run directly from the browser using the
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (by design — there is no backend API layer).
This means **Row Level Security is the only thing preventing a browser tab
from deleting arbitrary rows**.

## Required policies — verify in the Supabase dashboard

For each table, RLS must be **enabled** and the policies below must exist.

### `leads`
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IS NOT NULL` (authenticated users only) |
| INSERT | `auth.uid() IS NOT NULL` |
| UPDATE | `auth.uid() IS NOT NULL` |
| DELETE | `auth.uid() IS NOT NULL` |

### `clients`
Same as `leads`.

### `revenue_records`
Same as `leads`.

### `activities`
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IS NOT NULL` |
| INSERT | `auth.uid() IS NOT NULL` |
| DELETE | Deny all (system-written audit trail — should not be deletable) |

### `automations_log`
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IS NOT NULL` |
| INSERT | Deny from browser — only the cron route should write here |
| UPDATE | `auth.uid() IS NOT NULL` (for resolve actions) |

### `system_health_snapshots`
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IS NOT NULL` |
| INSERT | Deny from browser — cron-only |

## How to verify
1. Open the Supabase dashboard → your project → Authentication → Policies
2. For every table listed above, confirm "RLS enabled" is toggled on
3. Confirm the policies match the intent above
4. Use the Supabase policy editor to test with `auth.uid() = null` — all
   writes should be rejected

## Notes
- The anon key is safe to expose publicly *only when RLS is correctly configured*
- The `CRON_SECRET` env var guards the `/api/intelligence/run` route —
  the cron service role is never exposed to the browser