# Small Steps

A JavaScript micro-win milestone app for psychological readiness, fear during directional changes, gratitude, and reframing. Includes real accounts, persistent records, an administrator dashboard, profiles, data export, and responsive phone layouts.

### Your progress tools

- **Home** brings together your daily check-in, recent wins, progress, and shortcuts to each tool.
- **Fear thermometer** records a movement or situation, fear from 0 to 10, an optional afterwards rating, and what helped. Save multiple moments in a day.
- **Ladder map** holds personal goals you can reorder, edit, revisit, and mark complete at your own pace.
- **Me vs last month** compares the current month to date with the same dates last month. Averages use recorded daily check-ins; missing days are not zeros.
- **Micro-win journal** saves multiple wins per day with optional gratitude and reframing. Earlier daily check-in wins remain visible in the journal.

Each successful save displays a confirmation popup after the database accepts it, including account changes and edits. Errors remain visible without a success popup. Administrators can also inspect the new records, and account exports include them. Existing accounts and check-ins are preserved when the local app starts with the updated schema.

Submitting an incomplete form shows a summary and a message beside each missing field, focuses the first field to fix, and preserves your draft. Signup/login, check-ins, reflections, fear entries, ladder goals, micro-wins, profile edits, and password changes share this validation. It also checks email format, password confirmation, whitespace-only required text, and incomplete reframing pairs. Invalid forms do not send save requests, and optional notes can stay blank.

### Run on this Windows computer

Double-click `start.cmd` in the parent `CC15` folder. It uses the portable Node.js runtime already downloaded into `.tools`; there is no database service to install. Keep the terminal open while using the app.

Open **http://localhost:3000**, then choose **Sign up** to create your account. Each local signup creates a normal member; roles cannot be selected from the browser. No default passwords or sample patient records are installed.

### Set up an administrator

After signing up, double-click `make-admin.cmd` in the parent folder and enter your account email. Refresh the app. **Admin dashboard** appears in the sidebar and on your profile page. The administrator can search members and view their account details, check-ins, readiness, fear scores, notes, gratitude, and reframing entries.

### Open it on your phone

1. Connect the computer and phone to the **same Wi-Fi**.
2. Run `start.cmd`. The terminal prints one or more **Phone** addresses, such as `http://192.168.1.10:3000`.
3. Open the appropriate Phone address in Safari or Chrome and sign in. The app also shows these addresses under **My profile → Use on my phone**.
4. If Windows asks, allow Node.js on **private networks**. Guest Wi-Fi, device isolation, and VPNs can prevent the connection. Try your Wi-Fi adapter's address rather than a virtual adapter address.

The computer must stay on with the server running. Use **Add to Home Screen** from your phone browser if desired. Internet-independent local operation works because the interface has no external font, image, or JavaScript CDN dependencies. Saving requires connection to the server; this is a responsive web app, not an offline native app. Local HTTP access is for a trusted private network; use the HTTPS hosted version for internet access.

The phone icon in the desktop header toggles a phone-sized preview. Phone layouts have bottom navigation; the admin dashboard is also accessible from an administrator's profile.

### Database and account behavior

- Local data lives in **`data/small-steps.sqlite`**, with SQLite WAL enabled. Keep `data/` to retain accounts and progress across restarts. The database is excluded from version control and deployment archives. Stop the server before copying the database for a backup.
- Hosted data uses **Cloudflare D1** and the committed Drizzle migration. Local and hosted databases are separate; records are not automatically synchronized.
- New passwords use salted scrypt hashes (N=32768, r=8, p=3), an OWASP profile supported by both Node and the hosted runtime. Earlier local PBKDF2 and scrypt hashes are verified and upgraded at login. Sessions use HttpOnly cookies and hashed, expiring tokens. HTTPS adds the Secure cookie flag. Every private API checks the session and enforces ownership or an administrator role on the server.
- Password updates revoke other sessions. Login attempts are rate-limited. Forms and the server validate scores, dates, and field lengths. Cross-origin writes are rejected.
- Check-ins and reflections are unique per account and calendar day. Editing a day updates it. The profile's time zone determines the current date.
- Milestones reward nonconsecutive participation, gratitude, reframing, and reflecting on movement with fear present. They do not recommend attempting a movement. Earned milestones and their points stay earned after setbacks or deleting an entry; repeated edits do not multiply points.
- Administrators can view member records. Signup and the journal disclose this access. There is no email verification or email password-reset service configured.

### Commands for development

Requires Node.js 24 (the included portable runtime works). From this directory:

```text
node server/local.js                 # Start the zero-dependency local app on all network interfaces
node scripts/make-admin.mjs         # Promote an existing local member
node --test tests/api.test.mjs tests/features.test.mjs tests/passwords.test.mjs  # Account, feature, persistence, and hosted-auth regression tests
node scripts/browser-qa.mjs         # Headless Edge UI checks, using an isolated QA database
```

`PORT` defaults to `3000`, `HOST` defaults to `0.0.0.0`, and `DATABASE_PATH` can select another SQLite file. Browser QA uses Windows Edge by default; set `BROWSER_PATH` for another Chromium executable. It checks signup, check-ins, fear ratings, ladder goals, journal entries, monthly comparisons, save popups, profile editing, admin records, and all page layouts at 1440px, 390px, and 320px. Its screenshots and test data stay in ignored `.sites-runtime/`.

The user interface is implemented in **`public/app.js`**, **`public/features.js`**, and **`public/app.css`**. **`server/api.js`** and **`server/features.js`** contain the shared JavaScript API. **`server/local.js`** serves it with Node.js and SQLite. The small `app/` adapter serves the same interface and API through the Sites framework for hosting.

### Hosted version

The Sites deployment is public: anyone with its URL can open the login/signup page on any network. Visitors use their own Small Steps accounts; personal records and administrator APIs remain protected by app sessions. Local and hosted accounts are separate. Opening the hosted site on a phone does not require keeping your computer on or sharing Wi-Fi.

Public signups create regular members. To create the first hosted administrator, the owner must also be signed in through the Site's **Sign in with ChatGPT** route (`/signin-with-chatgpt?return_to=/`). The runtime setting `SMALL_STEPS_OWNER_EMAIL` must match that verified owner's email. The owner can then sign up for Small Steps and receive the administrator role if none exists, even if members have signed up earlier. This runtime value is configured through Sites and is not included in source. Locally, use `make-admin.cmd` instead.

---

## Hosted framework reference

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm run preview:hosted` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm run preview:hosted -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run preview:hosted`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
