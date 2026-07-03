# DemoForge — Product Roadmap & Build Plan

*Owner: Product Engineering · Last updated: July 2, 2026*

> This is the master plan for taking DemoForge from a strong personal prototype to a market‑ready, launchable freemium SaaS. It supersedes and extends `MARKET_RESEARCH_ROADMAP.md`. It covers the product vision, the honest state of the codebase, the full prioritized feature backlog, the Azure AI architecture, recording/demo engagement features, extension enhancements, the new "Warm Canvas" website design system, freemium pricing, a phased 90‑day launch plan, and the security/launch checklist.

---

## 1. The one‑line bet

**Record your screen once. AI writes the script, voices it, frames every shot, and hands you a share link — in minutes, with no editing skills.**

DemoForge sits in the AI‑narration cluster (NarrateAI, Descript, Puppydog, Google Vids) rather than the click‑through interactive‑demo cluster (Arcade, Storylane, Supademo, Navattic). Our wedge is the thing those interactive tools can't do: **turn raw event data + screen capture into a finished, narrated video automatically.** That is a validated, funded, growing category — video demos convert at ~4.8% vs 2.9% without, and 93% of marketers report positive ROI from video in 2026.

Our unfair advantages already in the code:

- **Pixel‑perfect cursor capture** via a Chrome extension reading the true viewport (avoids the coordinate drift that plagues in‑page JS capture).
- **A genuinely sophisticated auto‑camera** (`lib/composition/camera.ts`): rule‑of‑thirds framing, velocity‑aware zoom, anticipatory movement, activity‑level pacing — more advanced than most competitors' auto‑zoom.
- **An emerging AI‑narration loop** (`script_generation` + `audio_creations`) that puts us in the same lane vendors are charging $20–40/seat for.

The job of this roadmap is to close the gaps between "impressive private prototype" and "a stranger can sign up, make a demo, send a link, and see who watched it."

---

## 2. Honest state of the codebase (July 2026)

**Stack.** Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn/ui, React Router, TanStack Query. Backend: Django 6 + DRF + SimpleJWT + django‑cors‑headers, SQLite. Extension: MV3 Chrome extension + local WebSocket bridge (port 8081). AI: Google Gemini (scripts), Azure Cognitive Services Speech (voice). Auth: Google OAuth → JWT.

**Strong and differentiated already**
- Extension‑based true‑viewport mouse capture and time‑locked cursor replay.
- The camera state machine and the effects library (particles, ripples, transitions, filters, bezier smoothing, annotations).
- Multi‑format export (WebM/MP4/GIF/APNG) and a real editor (color grading, text overlays, timeline, undo/redo).
- A working script→voice pipeline with per‑voice cost accounting.

**Missing / blocking launch**
- **No persistence.** `Dashboard.tsx` renders a `Project[]` from local state; there is **no `Project` model** in Django. Work vanishes on refresh and cannot sync across devices. *This is the #1 gap and the flagship build in this session.*
- **No sharing/embed.** No `/v/:id` public player route, no embed code. A demo tool you can't send a link from isn't a demo tool.
- **No analytics.** No view/completion/drop‑off tracking — which is often the actual reason teams pay.
- **No billing / plan gates** despite a freemium go‑to‑market.
- **No cloud media storage.** Rendered files live in the browser; nothing durable server‑side.

**Security / hygiene issues to fix before any launch**
- **Hardcoded Gemini API key** in `script_generation/services.py` (committed). Must be revoked and moved to env/secret store.
- `SECRET_KEY`, `DEBUG=True`, empty `ALLOWED_HOSTS` in `settings.py`; `.gitignore` only ignores `venv/`, so `.env` and `db.sqlite3` are tracked in git.
- Script endpoint is `AllowAny` in DEBUG and auto‑creates an `anonymous` user — fine for dev, must be gated for prod.

---

## 3. Product principles

1. **Time‑to‑first‑demo is the metric that matters.** Every decision optimizes the path from "install" to "here's my share link." Editing depth is secondary to that first magic moment.
2. **Calm, not loud.** The UI should feel like a trustworthy studio, not a toy with 200 sliders. Progressive disclosure: smart defaults up front, power under "Advanced."
3. **AI does the work, the human approves.** Auto‑generate the script, framing, captions, and chapters; let the user tweak, not author from scratch.
4. **The share link is the product.** Analytics, branding, and CTAs all live on that link and are what make it a *sales* tool, not a screen recorder.
5. **One recording, every market.** Localization is a first‑class feature, not an afterthought — it multiplies the value of a single capture.

---

## 4. Positioning & target users

| Segment | Job to be done | Why DemoForge |
|---|---|---|
| **Founders / indie makers** | Show the product on the landing page & in cold outreach | Fastest path to a narrated demo; free tier |
| **Product marketing** | Feature launches, release notes, onboarding | Auto‑script + brand kit + localization |
| **Sales / SE** | Personalized demos in emails, view tracking on prospects | Share analytics + CRM signals |
| **Customer success / support** | "How do I…" answer videos at scale | Record once, auto‑caption, reuse |

Primary wedge: **founders + product marketing**, because they feel the "I don't have time to script and record voiceover" pain most acutely and adopt bottoms‑up.

---

## 5. Azure AI architecture

You already have Azure Speech wired in and an Azure subscription. Here is the full target architecture, the four services you selected, plus the additional Azure resources I recommend as owner. Items marked **⚡ needs provisioning** are where CLI access would let me scaffold infra/IaC directly.

### 5.1 Selected services (build these)

**Azure Speech — neural TTS + captions.** Upgrade the existing integration to use the full neural voice catalog (400+ voices, 140+ locales) with **SSML** for emphasis, pacing, and pauses tied to click events. Critically, capture **word‑level timing/boundaries** from synthesis so we can auto‑generate perfectly synced captions and export `.srt`/`.vtt`. This is the backbone of both voiceover and accessibility.

**Azure OpenAI — scripts + smart edits.** Migrate script generation off the hardcoded Gemini key onto **Azure OpenAI (GPT‑4o / GPT‑4o‑mini with vision)** inside your tenant. Uses: narration script from click/move events + periodic screenshots; auto chapter titles; tone presets (friendly / formal / energetic); CTA and title suggestions; "tighten this narration" and "make it 20% shorter" edit actions. Keeps data in‑tenant and removes the leaked‑key risk. We keep a provider abstraction so Gemini stays as a fallback.

**Azure Translator — localization.** One‑click translate the approved script into 100+ languages, then re‑synthesize with a matching Azure Speech neural voice per locale. Turns one recording into demos for every market with no reshoot — a 2026 must‑have competitors (Supademo 15+ langs, HeyGen 175+) lead with.

**Azure Blob Storage + CDN — media + sharing.** Store recordings, render artifacts, thumbnails, and generated audio in **Blob Storage**; serve public share/embed playback through **Azure CDN / Front Door**. This is the foundation the public player (`/v/:id`), analytics beacons, and fast global playback all sit on. Use SAS tokens for private assets and a public container (behind CDN) for shared demos.

### 5.2 Additional Azure resources I recommend (⚡ needs provisioning)

- **Azure Key Vault** — store `AZURE_OPENAI_KEY`, `AZURE_SPEECH_KEY`, `TRANSLATOR_KEY`, `DJANGO_SECRET_KEY`, Stripe keys, Google OAuth secret. Nothing sensitive in git ever again. Wire via `DefaultAzureCredential`.
- **Azure Database for PostgreSQL – Flexible Server** — replace SQLite for production. JSONB fields map cleanly to our event/edit blobs and it scales.
- **Azure Container Apps** (or **App Service**) — host the Django API + a background worker; Container Apps gives us scale‑to‑zero and easy revisions. Front end on **Azure Static Web Apps**.
- **Azure Front Door + WAF** — global entry, TLS, caching, and basic protection for the API and player.
- **Azure Cache for Redis** — Celery/RQ broker for async rendering & synthesis jobs, plus rate‑limit counters and analytics buffering.
- **Azure Video Indexer** *(phase 2+)* — auto‑transcription, topic/keyframe extraction, and thumbnail selection to make demos searchable and to auto‑pick chapter cut points.
- **Azure AI Content Safety** — moderate user‑generated recordings/scripts before they're published on public share links (protects the brand at launch).
- **Azure Communication Services** (Email) — transactional email (share notifications, "your render is ready," weekly view digests) without a third party.
- **Azure Application Insights** — real‑time telemetry, error tracking, and performance for the whole stack.

> **If you grant CLI access**, I can generate a Bicep/Terraform module and `az` scripts that provision Key Vault, PostgreSQL Flexible Server, Container Apps, Blob + CDN, and Front Door as one deployable environment, plus a GitHub Actions pipeline. Tell me the target subscription/region and I'll scaffold `infra/` next session.

### 5.3 Provider abstraction

All AI calls go through a thin service interface (`ai/providers/`) with `speech`, `llm`, and `translate` capabilities, each with an Azure implementation and a fallback. This keeps us from being locked in and lets a single env var swap providers.

---

## 6. Prioritized feature backlog

Grouped by theme, each item tagged **P0** (launch‑blocking), **P1** (fast‑follow), **P2** (differentiation/enterprise).

### 6.1 Persistence & project management
- **P0 — Project model + REST API** (owner‑scoped CRUD, JSON recording/edit blobs, status, thumbnail, duration). *Built this session.*
- **P0 — Dashboard on real data** (list/create/open/delete against the API). *Built this session.*
- **P1 — Autosave** of editor state to the project (debounced).
- **P1 — Cloud media** (upload render + thumbnail to Blob, store URLs on the project).
- **P2 — Folders/tags, search, duplicate.**

### 6.2 Sharing & distribution
- **P0 — Public player route `/v/:slug`** (no auth, lightweight, plays render + captions).
- **P0 — Share modal** (copy link, visibility: private/unlisted/public, password‑optional).
- **P1 — Embed snippet** (`<iframe>` + oEmbed) for docs, landing pages, Notion.
- **P1 — Open Graph/Twitter preview** (auto thumbnail + title) so links unfurl nicely.
- **P2 — Custom domain / vanity slug** (Pro/Team).

### 6.3 Analytics
- **P0 — View beacon** (play, %‑watched, completion, drop‑off point) posted from the player.
- **P1 — Per‑demo dashboard** (views over time, avg completion, geography).
- **P2 — Per‑viewer sessions + CRM/webhook events** (who watched, how far) — the sales‑tool unlock.

### 6.4 AI narration loop (our differentiator)
- **P0 — Azure OpenAI script service** with provider abstraction; remove hardcoded key.
- **P0 — Script review UI polish** (edit segments, regenerate one, tone preset).
- **P1 — Word‑level captions** from Azure Speech timings; `.srt`/`.vtt` export; burn‑in toggle.
- **P1 — Auto chapters** (titles + timestamps) from events + vision.
- **P2 — "Director" mode**: AI proposes zoom/cut/emphasis keyframes the user can accept.

### 6.5 Recording & demo engagement (see §7 for detail)
- **P0 — Studio backgrounds, padding, rounded corners, shadow** (the Arcade "beautiful frame" look).
- **P0 — Cursor spotlight + smoothing presets.**
- **P1 — Intro/outro cards, brand kit (logo/colors/font), background music with auto‑ducking.**
- **P1 — Webcam bubble (picture‑in‑picture narrator).**
- **P2 — Interactive hotspots / clickable CTA overlays** (bridges us toward the interactive‑demo cluster).

### 6.6 Editor
- **P1 — Multi‑clip timeline, trim/split silence, speed ramps.**
- **P1 — Blur/redact tool** for sensitive data (privacy is a top objection).
- **P2 — Keyframe animation, motion‑tracked callouts.**

### 6.7 Extension (see §8)
- **P0 — Robust connect/session UX, permissions, and a one‑click "Record this tab."**
- **P1 — Auto‑screenshot capture** at click moments for the vision model.
- **P1 — Element metadata capture** (selector, bounding rect, text) for smarter zoom + captions.

### 6.8 Localization
- **P1 — Translate + re‑voice** (Azure Translator + Speech), per‑locale variants of one project.

### 6.9 Collaboration & teams
- **P2 — Workspaces, roles, shared brand kit, comments/approvals.**

### 6.10 Monetization
- **P0 — Plan model + usage metering + gates** (see §10).
- **P1 — Stripe billing, checkout, customer portal, webhooks.**

---

## 7. Recording & demo engagement enhancements

This is the "make recordings rich, engaging, demo‑worthy" workstream — the visual polish that makes a DemoForge video look like it came from a studio, and the reason a viewer keeps watching. Sequenced from highest ROI:

**The "beautiful frame" (P0).** The single biggest perceived‑quality jump. Composite the raw capture onto a **studio background** (solid, gradient, mesh, or image), with **inset padding, rounded corners, and a soft drop shadow**, and a subtle **3D tilt** option. This is the look Arcade/Screen Studio are known for; it's pure compositing over our existing canvas pipeline.

**Cursor spotlight & smoothing (P0).** A soft vignette/spotlight that follows the cursor to draw the eye, plus selectable **motion‑smoothing presets** (using the existing bezier smoother) so the pointer glides instead of jitters. Click ripples already exist — add size/color to the brand kit.

**Auto‑zoom polish (P0).** The camera engine is strong; expose it as **three presets** ("Calm," "Dynamic," "Off") instead of raw parameters, so a first‑time user gets a great result with zero tuning.

**Captions (P1).** Auto‑generated, word‑synced captions from Azure Speech timings, with a couple of tasteful styles (bottom bar, karaoke highlight). Captions measurably lift completion and are required for social/muted autoplay.

**Intro / outro cards (P1).** Templated title card (logo + headline) and end card (CTA button + URL). Drives the demo toward a conversion action.

**Brand kit (P1).** Logo, primary/secondary colors, font, and default background saved per workspace and auto‑applied to every new project — consistency with one click.

**Background music + auto‑ducking (P1).** A small royalty‑free library; music volume automatically ducks under narration.

**Webcam bubble (P1).** Optional circular picture‑in‑picture of the presenter, draggable, for a personal touch in sales demos.

**Interactive hotspots / CTA overlays (P2).** Timed clickable overlays ("Try it," "Book a demo") layered on the player — the bridge from passive video into the interactive‑demo category, without giving up our auto‑narration edge.

**Smart b‑roll / step markers (P2).** Auto‑insert a labeled step chip ("Step 3: Invite your team") synced to chapters for tutorial‑style demos.

---

## 8. Extension enhancements

The extension is a real moat (true‑viewport capture) but is currently a developer‑grade tool. To make it launch‑ready:

**Connection & session UX (P0).** Replace the manual WebSocket‑server + load‑unpacked flow with a polished popup: clear "Connected / Not connected" state, a single **"Record this tab"** button, a live event counter, and graceful reconnect. Ship to the **Chrome Web Store** (and Edge) rather than requiring `chrome://extensions` dev loading.

**Auto‑screenshot capture (P1).** Capture a frame at each click (and at scene changes) and stream it alongside events, so the Azure OpenAI vision model has real visual context for the script — dramatically better narration than events alone.

**Element metadata (P1).** Capture the clicked element's selector, bounding rect, role, and visible text. Feeds (a) smarter, element‑aware zoom, (b) captions that can say "clicked *Settings*," and (c) future auto‑hotspots.

**Cross‑browser + safety (P1).** MV3 hardening, minimal permissions, clear on‑record indicator, and a privacy note. Optional local‑only mode (no cloud) for sensitive captures.

**Full‑desktop capture path (P2).** For flows that leave the browser, offer a desktop‑capture fallback via `getDisplayMedia` with our overlay compositing.

---

## 9. Website redesign — "Warm Canvas" design system

A complete re‑theme to a calm, YC‑native aesthetic: **warm paper backgrounds, ink‑black text, a single confident burnt‑orange accent, generous whitespace, restrained motion.** Trustworthy and editorial rather than the generic SaaS‑purple gradient it has today.

### 9.1 Color tokens (light)

| Token | HSL | Hex | Use |
|---|---|---|---|
| `background` | `36 33% 97%` | `#FAF6F0` | Warm paper canvas |
| `card` | `40 40% 99%` | `#FEFCF9` | Surfaces |
| `foreground` | `24 12% 12%` | `#211D19` | Ink text |
| `primary` | `18 68% 55%` | `#DE6B3F` | Burnt‑orange accent / CTAs |
| `accent` | `28 55% 52%` | `#C98A4B` | Warm secondary (amber) |
| `muted-foreground` | `30 8% 46%` | `#7A736B` | Secondary text |
| `border` | `33 20% 88%` | `#E8E1D7` | Hairlines |
| `success` `warning` `destructive` | tuned warm | — | Status |

Dark mode is an espresso‑brown‑charcoal (`24 14% 8%` bg) with a slightly brighter orange, so the brand survives theme switch.

### 9.2 Typography
- **Display / headings:** a serif (Fraunces / Instrument Serif) for hero and section titles — the editorial, warm signal.
- **UI / body:** Inter (already loaded) for everything functional.
- Tight tracking on large headings; comfortable line‑height on body.

### 9.3 Layout & motion
- Max content width ~1140px, generous vertical rhythm, hairline borders instead of heavy shadows.
- **Restrained motion:** soft fade/slide on scroll, no bouncing gradients. Calm = fewer, slower, purposeful animations.
- Grain/paper texture at very low opacity optional for warmth.

### 9.4 Page‑by‑page
- **Landing:** editorial hero (serif headline + one accent), trust strip, "how it works" in 3 calm steps, a real product frame mock, feature grid, calm pricing, quiet footer.
- **Dashboard/editor chrome:** paper background, ink text, orange only on primary actions — the studio should feel calm so the content pops.
- **Public player `/v/:slug`:** minimal, centered, brandable.

*(Implemented this session: tokens + Landing + Header + Footer + button variants; editor/dashboard chrome inherits the tokens automatically.)*

---

## 10. Freemium pricing & limits

Standard for the category (Arcade, Supademo, Storylane). Free tier drives virality via a watermark; Pro removes friction; Team adds collaboration + analytics depth.

| | **Free** | **Pro — $24/mo** | **Team — $40/seat/mo** |
|---|---|---|---|
| Demos | 5 active | Unlimited | Unlimited |
| Export quality | 720p | 4K | 4K |
| Watermark | Yes | No | No |
| AI voices | Standard | Premium (neural) | Premium |
| Localization | — | 5 languages | Unlimited |
| Share analytics | Basic views | Full | Full + per‑viewer |
| Brand kit | — | 1 | Shared |
| Collaboration | — | — | Workspaces, comments |
| CRM / webhooks | — | — | Yes |
| Support | Community | Email | Priority |

**Metering to build:** count active projects, exported minutes, and premium‑voice characters per user per period; enforce at the API and reflect in the UI. Annual pricing at ~2 months free. Education/OSS free Pro on request (goodwill + word of mouth).

---

## 11. Phased 90‑day launch plan

### Phase 0 — Hardening (Week 1)  *(partly this session)*
Revoke + env‑ify the Gemini key; add `.gitignore` for `.env`/`db.sqlite3`/media; move secrets to env (Key Vault later); split `settings` into base/dev/prod; provider abstraction for AI. **Exit:** no secrets in git, clean `manage.py check`.

### Phase 1 — Persistence + Share + Analytics MVP (Weeks 2–4)  *(flagship started this session)*
Project model + API + real Dashboard (**done this session**); autosave; Blob upload of renders; public player `/v/:slug`; share modal + embed; view beacon + basic per‑demo analytics. **Exit:** a new user can record → save → share a link → see view counts. *This is the true "it's a product now" milestone.*

### Phase 2 — AI narration + engagement + localization (Weeks 5–8)
Azure OpenAI script service; word‑level captions + export; auto chapters; the "beautiful frame," cursor spotlight, zoom presets, intro/outro, brand kit; Translator + re‑voice localization; extension auto‑screenshots + Web Store listing. **Exit:** demos look studio‑grade and can ship in any language.

### Phase 3 — Teams + billing + integrations (Weeks 9–12)
Stripe billing + plan gates + metering; workspaces/roles; per‑viewer analytics; CRM/Zapier webhooks; SSO (Team). **Exit:** we can charge, and a sales team can standardize on it.

### Ongoing
Content Safety on public shares; Application Insights dashboards; SEO/landing iteration; template gallery; Product Hunt / Show HN launch at end of Phase 2.

---

## 12. Security & launch checklist

- [ ] Revoke the committed Gemini key; rotate `DJANGO_SECRET_KEY`; all secrets via env → Key Vault.
- [ ] `.gitignore` covers `.env`, `db.sqlite3`, `/media`, `__pycache__`, `node_modules`, `dist`.
- [ ] `DEBUG=False`, real `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`, HTTPS‑only cookies, HSTS in prod.
- [ ] PostgreSQL in prod; automated backups.
- [ ] Rate limiting on auth + AI endpoints; per‑user quotas enforced server‑side.
- [ ] Content Safety on anything published to a public share link.
- [ ] Signed/SAS URLs for private media; public container only for shared demos.
- [ ] Privacy policy + terms + data‑deletion path (the footer links currently 404).
- [ ] Application Insights + error alerting; uptime monitor on the player.
- [ ] Load test the render/synthesis path before Product Hunt.

---

## 13. Success metrics

- **Activation:** % of signups who publish a first share link within 24h (target > 40%).
- **Time‑to‑first‑demo:** median minutes from signup to first share link (target < 10).
- **Share rate:** demos that get at least one external view (target > 60%).
- **Week‑4 retention** of activated users (target > 30%).
- **Free→Pro conversion** (target 3–5% of activated free users).

---

## 14. What I'm shipping in this session

1. **This roadmap** (`PRODUCT_ROADMAP.md`).
2. **Warm Canvas design system** — new tokens in `index.css` + `tailwind.config.ts`, serif display font, restyled `button` variants.
3. **Redesigned marketing surfaces** — `Landing.tsx`, `Header.tsx`, `Footer.tsx`.
4. **Flagship: Projects persistence** — new Django `projects` app (model, serializers, DRF viewset with per‑user scoping + public share endpoint, migration, settings/URL wiring), and `Dashboard.tsx` wired to a new `lib/api/projects.ts` client.
5. **Security fix** — hardcoded Gemini key removed and env‑ified; Azure OpenAI provider scaffolding; `.env.example`; hardened `.gitignore`.

Everything else above is sequenced for the next sessions. If you grant Azure CLI access, the immediate next unlock is provisioning `infra/` (Key Vault + PostgreSQL + Container Apps + Blob/CDN + Front Door) and the CI/CD pipeline.
