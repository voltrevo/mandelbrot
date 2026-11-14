# Hoardling — V1 Handover

You are picking up a greenfield project. All product decisions below were made with the owner already. **Build V1 end to end without asking further questions.** Where something isn't specified, make a sensible call, note it in `docs/DECISIONS.md`, and keep going.

---

## 1. What we're building

**Hoardling** is an internal marketing data aggregation and analysis platform for **one company** (not multi-tenant SaaS).

- **V1:** our own first-party analytics (JS tracker + Go ingestion), a **sample e-commerce site** to generate data, a **traffic simulator**, Postgres storage, and **fixed dashboards**.
- **Later (design for, don't build):** Google Ads, Facebook/Meta Ads and other connectors; cross-channel attribution (ROAS/CAC); a **user-facing dashboard builder**.

## 2. Repo, hosting, environment

- **Git:** plain git server at `git.voltrevo.com`. A proxy injects credentials, so just push over HTTPS with no auth setup. Repo name: **`hoardling`**. Try `https://git.voltrevo.com/hoardling.git` first; if that fails, try without `.git`. If the repo has to be created first and you can't, report that and stop. **Do not use GitHub. Ignore the `mandelbrot` repo entirely.**
- **Pages:** pushing a branch named **`pages`** to the repo publishes it at `https://pages.voltrevo.com/hoardling/` behind username/password auth. Treat it as static hosting of the branch contents at root, under a subpath, so **use relative asset paths / Vite `base: './'`**.
- Nothing is public. That makes things simpler, but still do basic security hygiene.
- **Network:** the previous session was blocked from `git.voltrevo.com` by the environment's network policy. If you get a proxy 403 on CONNECT, tell the owner to add `git.voltrevo.com` (and `pages.voltrevo.com`) under the environment's allowed domains. Don't try to route around it.
- Toolchain seen in the previous env: Go 1.24, Node 22, Docker, Postgres 16 binaries. Use whatever's present.
- Commit early and often; push to `main`. The container is ephemeral.

## 3. Stack (decided)

| Area | Choice |
|---|---|
| Backend | Go, `net/http` + **chi**, **pgx/v5**, **sqlc**, **goose** migrations, `slog` logging |
| DB | **Postgres 16** (plain; no Timescale). Monthly partitioned events table + rollup tables |
| Dashboard frontend | **TypeScript, React, Vite**, TanStack Query, React Router, **ECharts** (via `echarts-for-react` or a thin wrapper), Tailwind |
| Sample shop | TypeScript + Vite (multi-page, plain TS or light React; your call), styled decently |
| Tracker | Tiny dependency-free TS → single minified `hl.js` (target < 5 KB gz) |
| Simulator | Go command (`cmd/simulator`) |
| Dev/ops | Docker Compose (postgres, api, web, shop) + `Makefile` |
| Tests | Go: `go test` incl. integration tests against a real Postgres. Frontend: Vitest for the query/format logic. One Playwright smoke test that loads the shop, buys something, and sees it in the dashboard |

## 4. Repo layout

```
hoardling/
  backend/
    cmd/api/            # HTTP server (collect + dashboard API + serves tracker)
    cmd/simulator/      # traffic generator / backfill
    cmd/migrate/        # goose wrapper (or use goose CLI)
    internal/collect/   # ingestion, validation, enrichment, cookieless hashing
    internal/query/     # widget query spec -> safe SQL
    internal/rollup/    # rollup jobs
    internal/dashboards/
    internal/auth/
    internal/connectors/# interface + registry only (no real connectors in V1)
    db/migrations/  db/queries/  (sqlc)
  tracker/              # hl.js source + build
  shop/                 # sample e-commerce site
  web/                  # dashboard app
  e2e/                  # playwright smoke test
  docs/  (ARCHITECTURE.md, DECISIONS.md, TRACKING.md)
  docker-compose.yml  Makefile  README.md
```

## 5. The sample shop

The company sells a **tabletop game turn timer**: each player gets a button that lights up when it's their turn; they press it to pass to the next player, and it times each player. Fictional brand for the sample site: **PassLight** (rename if you like).

Catalogue (SKUs, prices in USD, made up):
- PassLight Starter — 4 buttons + hub — $79
- PassLight Party — 6 buttons + hub — $109
- PassLight Grand — 8 buttons + hub — $139
- Extra Button (single, choose colour) — $15
- Carry Case — $25
- Rechargeable Battery Pack — $19

Pages: home/landing (hero, how it works, testimonials), product list, product detail (variant/colour picker), cart, checkout (fake form, no payment; produces an order id), order confirmation, a blog/guide page or two (e.g. "Speed up your board game nights") for content traffic, and a newsletter signup.

Include a **consent banner** (Accept / Reject).

## 6. Tracker & identity

**Identity (decided: first-party cookie, with cookieless fallback):**
- Before consent or on Reject: **cookieless mode**. Don't set any cookie. The server derives `visitor_id = hash(daily_salt + site + ip + user_agent)`, rotating daily; salts are stored in the DB and deleted after 2 days. Session is inferred server-side (same visitor, 30 min inactivity).
- On Accept: set first-party cookie `hl_vid` (random UUID, 13-month expiry) and `hl_sid` (30-min sliding session). Send both with events. Record `consent_state` on every event.
- On Accept mid-session, send an `identify`-style link so the current cookieless session can be attributed to the new visitor id. Best effort; document it.

**Captured automatically:** page_view (incl. SPA history changes), URL, path, title, referrer, UTM params (`utm_source/medium/campaign/term/content`), click ids (`gclid`, `fbclid`, `msclkid`) persisted for the session, screen size, language, timezone. The server derives UA → browser/OS/device type, IP → country (use a free GeoLite-style DB if available offline, otherwise leave a pluggable stub and let the simulator supply country), then **discards the raw IP**.

**API:** `hl('track', name, props)`, `hl('consent', 'granted'|'denied')`. Send with `navigator.sendBeacon`, falling back to `fetch keepalive`. Batch when practical.

**E-commerce events** (GA4-like names): `view_item_list`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `purchase` (props: `order_id`, `value`, `currency`, `items[]` with sku/name/price/qty), plus `newsletter_signup`. Dedupe purchases by `order_id`.

Document the event contract in `docs/TRACKING.md`.

## 7. Ingestion

- `POST /api/collect`: accepts a single event or a batch. Validate size and schema, enrich, insert. CORS allowed for configured shop origins. Respond 202 fast. A synchronous insert is fine at V1 scale; use a buffered batch writer (flush every ~1 s or 500 events) if easy.
- Bot filtering: drop known bot UAs, except the simulator, which is tagged.
- **Backfill/trusted mode:** with header `Authorization: Bearer $INGEST_TOKEN`, the client may set an explicit `ts`, `ip`, `country`. The simulator uses this to generate history.
- The tracker is served at `GET /hl.js`.

## 8. Data model (Postgres)

- `events`: **partitioned by month** on `ts`. Columns: id, ts, received_at, name, visitor_id, session_id, consent_state, url, path, title, referrer, referrer_domain, utm_*, click_id_type/value, channel (derived), country, browser, os, device_type, screen, language, props `jsonb`, is_simulated. Create partitions automatically ahead of time.
- `sessions`: derived/upserted. Start/end, entry/exit path, pageviews, duration, source/medium/campaign/channel of the **first** event, converted, revenue.
- `orders` + `order_items`: materialised from `purchase` events.
- **Rollups:** e.g. `daily_traffic` (date × channel × source × medium × campaign × device × country: visitors, sessions, pageviews, bounces, duration), `daily_pages`, `daily_products` (views, add-to-carts, purchases, revenue), `daily_funnel`. Refresh incrementally (a background goroutine every minute for today, plus a nightly full recompute of yesterday). The query layer reads rollups for long ranges and raw events for today/realtime.
- **Channel derivation** (documented rules): Paid Search, Paid Social, Organic Search, Organic Social, Email, Referral, Direct, Other. Base it on utm_medium, click ids and referrer domain lists.
- **Future-proofing for connectors:** create (empty) `ad_platforms`, `ad_accounts`, `ad_campaigns`, `ad_daily_stats` (date, platform, account, campaign, adset, ad, impressions, clicks, spend, platform_conversions, platform_conversion_value, currency) and `connector_runs`. In `internal/connectors`, define a `Connector` interface (`Name()`, `Authorize`, `Sync(ctx, since) error`) and a registry. **No real connectors in V1.**

## 9. Query layer (foundation for the future builder)

Every chart is driven by a **declarative widget query**, never by bespoke endpoints:

```json
{
  "metrics": ["visitors", "sessions", "conversion_rate", "revenue"],
  "dimensions": ["channel"],          // optional; "date" with granularity for time series
  "granularity": "day",                // hour|day|week|month
  "filters": [{"field": "device_type", "op": "eq", "value": "mobile"}],
  "dateRange": {"preset": "last_30_days"} | {"from": "...", "to": "..."},
  "compare": "previous_period",        // optional
  "sort": [{"field": "revenue", "dir": "desc"}],
  "limit": 10
}
```

- `POST /api/query` compiles the spec to SQL from a **whitelisted registry** of metrics and dimensions (each has an SQL expression, its allowed sources, and a format: number, percent, currency or duration). Never interpolate user strings. Pick rollups vs raw events automatically.
- `GET /api/schema` returns available metrics and dimensions with labels and formats. The future builder UI will use it, and the fixed dashboards use it now.
- Metrics: visitors, sessions, pageviews, pages_per_session, bounce_rate, avg_session_duration, conversions (orders), conversion_rate, revenue, aov, add_to_cart_rate, product views/adds/purchases. Funnel is a special widget type with an ordered list of step events.
- Timezone: a company setting (default `Europe/London`; changeable in config). All date bucketing uses it.

## 10. Dashboards (fixed now, builder later)

Dashboards are **stored as JSON in the DB** (`dashboards` table: id, slug, name, definition jsonb, is_system). A definition is a grid layout plus widgets; each widget is `{type, title, query, display options}`. Widget types: `kpi` (with sparkline + delta vs previous period), `timeseries` (line/area/bar), `bar`, `table`, `pie/donut` (sparingly), `funnel`, `map` (country; optional).

Seed these **system dashboards** (read-only in V1) via migration or seed code:
1. **Overview:** KPIs (visitors, sessions, conversion rate, revenue, AOV), traffic over time, revenue over time, top channels, top pages, top products.
2. **Acquisition:** channels, source/medium, campaigns (sessions, conv rate, revenue), referrers, landing pages.
3. **Funnel:** session → view_item → add_to_cart → begin_checkout → purchase, plus a breakdown by device/channel.
4. **Products:** views, add-to-cart rate, purchases and revenue per SKU; attach rate for Extra Button and Carry Case.
5. **Audience:** device, browser, OS, country, new vs returning (consented visitors only; label it).
6. **Realtime:** visitors in the last 30 min, live event stream, active pages (poll every 5 s).

Global controls: date range picker with presets, compare-to-previous toggle, and a filter bar (channel, device, country, campaign) that applies to every widget. Put state in the URL so views are shareable. Write the renderer generically (`<Dashboard definition>` → `<Widget>`), so the later builder is just an editor for the JSON. Respect light/dark mode and keep it clean, not flashy.

## 11. Auth

Single company, few users. Email + password (argon2id), server-side sessions in Postgres with an HttpOnly cookie, CSRF protection for mutating requests. Seed the admin from env `ADMIN_EMAIL` / `ADMIN_PASSWORD`. No roles in V1 beyond `admin`. `/api/collect` and `/hl.js` stay unauthenticated.

## 12. Traffic simulator (`cmd/simulator`)

- **`backfill --days 90`:** generates realistic history through `/api/collect` in trusted mode with explicit timestamps.
- **`live --rate N`:** continuous traffic in real time, so Realtime shows activity.
- Realism: weekly seasonality (weekends and evenings higher, since it's a games product), gradual growth, and a couple of campaign spikes (e.g. a Black Friday-style promo, a Facebook campaign burst). Channel mix: roughly Direct 20%, Organic Search 25%, Paid Search 15%, Paid Social 15%, Email 8%, Referral 10% (board-game blogs/forums), Organic Social 7%, with plausible UTMs and gclid/fbclid. Device mix about 60% mobile, 35% desktop, 5% tablet. Countries weighted toward US/UK/DE/CA/AU. Roughly 65% accept consent. Returning visitors exist.
- Funnel behaviour: realistic drop-off (overall conversion about 1.5–3%, varying by channel), mostly single-product orders with accessory attach, AOV around $110.
- Mark simulated events `is_simulated=true`. The dashboard has an "include simulated data" toggle, default **on** for now.

## 13. Pages branch (owner preview)

Build a static preview and push it to the **`pages`** branch:
- `/` → a small index page linking to the shop and the dashboard.
- `/shop/` → the sample shop. Point its tracker at a configurable endpoint; on Pages it can run with tracking disabled, or log to the console.
- `/dashboard/` → the dashboard app in **demo mode**: it reads a pre-generated static JSON snapshot (produced by running the simulator backfill locally, then exporting query results for each system dashboard and preset range) instead of the live API. Hide auth in demo mode.

Add a `make pages` target that builds this and commits it to the `pages` branch (use a worktree or orphan branch; never mix it into `main`).

## 14. Definition of done (V1)

- [ ] `docker compose up` + `make seed` (migrate + admin + 90-day backfill) gives a working stack locally
- [ ] The shop works end to end; real clicks show up in Realtime within seconds and in the other dashboards after rollup
- [ ] Consent accept/reject behaves as specified (verify that no cookies are set before consent)
- [ ] All 6 system dashboards render with sensible data, filters, date ranges and comparison
- [ ] `/api/query` + `/api/schema` are documented and tested, including SQL-injection-style tests against the whitelist
- [ ] Go unit + integration tests, Vitest and the Playwright smoke test all pass
- [ ] README (quickstart), `docs/ARCHITECTURE.md`, `docs/TRACKING.md`, `docs/DECISIONS.md`
- [ ] `main` and `pages` pushed to `git.voltrevo.com/hoardling`; the preview works at `pages.voltrevo.com/hoardling/`
- [ ] A final short report to the owner: what was built, how to run it, known gaps, suggested next steps (connectors → attribution → builder)

## 15. Explicitly out of scope for V1

Real ad connectors, the dashboard builder UI, multi-tenancy, roles/permissions, alerts/scheduled reports, data export, A/B testing, server-side tag management, production deployment/hardening beyond Compose.
