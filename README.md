<<<<<<< HEAD
# Last-Mile Delivery Tracker

A delivery management platform: customers place orders, the system works out what to charge them on the spot, an agent gets assigned (by hand, automatically, or by claiming it themselves), and everyone gets kept in the loop as the package moves from pickup to doorstep.

This doc is written the way I'd explain the project to a teammate joining the repo for the first time — what's here, why it's built this way, and how to get it running on your machine.

**A note if you're testing multiple roles at once:** sessions are stored per browser tab (not shared across the whole browser), so you can log in as a customer in one tab and an agent in another, side by side, and each tab keeps its own login. Just don't reuse the exact same tab for two different accounts without logging out first.

---

## What's actually in the box

- **`backend/`** — a Node.js + Express API, backed by SQLite (via `better-sqlite3`). No external database to install — the whole thing runs off a single file.
- **`frontend/`** — a React app (Vite) with three experiences baked into one login system: customer, delivery agent, and admin.

There's no comments littered through the code — variable and function names are meant to carry the meaning on their own, and this README + the system design doc cover the "why."

---

## Getting it running locally

You'll need Node.js 18 or newer. That's the only hard dependency — SQLite ships as part of the `better-sqlite3` package, so there's no database server to stand up.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed      # creates the SQLite file and drops in some demo data
npm start          # runs on http://localhost:4000
```

The seed script gives you three ready-to-use logins so you're not starting from a completely empty app:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@lastmile.test` | `admin123` |
| Customer | `priya@lastmile.test` | `customer123` |
| Agent | `ravi.agent@lastmile.test` | `agent123` |
| Agent | `meera.agent@lastmile.test` | `agent123` |

It also sets up two zones (North and South), a handful of areas mapped into them, and rate cards for both B2B and B2C so you can place an order immediately without configuring anything first.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

The dev server proxies `/api` calls straight to `http://localhost:4000`, so as long as the backend is running, you don't need to touch any config to get the two talking to each other.

Open `http://localhost:5173`, log in with one of the demo accounts above, and you're in.

### 3. Building for production

```bash
cd frontend && npm run build
```

This outputs static files to `frontend/dist`, which you can serve from any static host (or from Express itself, if you'd rather ship one deployable unit — see the note on deployment below).

---

## Environment variables (`.env.example`)

```
PORT=4000
JWT_SECRET=change_this_to_something_long_and_random
DB_PATH=./data/lastmile.db

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_user
SMTP_PASS=your_ethereal_pass
SMTP_FROM=notifications@lastmile-tracker.local

FRONTEND_ORIGIN=http://localhost:5173
```

A few notes on these:

- **`JWT_SECRET`** — swap this for something random before you deploy anywhere real. It's what signs the login tokens.
- **`SMTP_*`** — email is genuinely optional. If you don't fill these in, the app doesn't break — it just logs what *would* have been emailed to the console, and still records the notification in the database. This is handy for local development, and it means you can plug in any free-tier SMTP provider (Ethereal for testing, Brevo/Mailjet/Gmail app-passwords for something closer to real) just by filling in the four SMTP fields.
- **`DB_PATH`** — where the SQLite file lives. The folder gets created automatically if it doesn't exist.

---

## How the rate calculation actually works

This is the part of the spec that mattered most, so it's worth walking through carefully.

When someone places an order, here's the sequence:

1. **Figure out the zones.** Every address the customer types in also comes with an "area" (like a locality or pincode) — and every area is mapped to exactly one zone by an admin, ahead of time. The pickup area's zone and the drop area's zone get looked up. If they're the same zone, it's an **intra-zone** delivery. If they're different, it's **inter-zone**. This distinction matters because inter-zone deliveries usually cost more — different rate.

2. **Work out what weight to actually bill.** Courier companies don't just charge by the scale — a huge, light box still takes up a huge amount of van space, so it gets billed as if it were heavier. That's *volumetric weight*, and the formula used here is the standard one:

   ```
   volumetric weight (kg) = (Length × Breadth × Height in cm) ÷ 5000
   ```

   Whichever is bigger — the actual weight on the scale, or the volumetric weight — is what gets billed. A dense, compact package gets billed by its real weight; a big, empty-feeling box gets billed by its volume.

3. **Look up the right rate card.** Admins configure four rate cards: B2B-intra, B2B-inter, B2C-intra, B2C-inter. Each one has a **base price** (a flat starting charge) and a **rate per kg** (multiplied by the billed weight from step 2). Nothing here is hardcoded in the code — every number lives in the database and admins can change it anytime from the Rate Cards screen.

   ```
   base_charge = base_price + (billed_weight × rate_per_kg)
   ```

4. **Add the COD surcharge, if it applies.** If the customer picked "Cash on Delivery" instead of "Prepaid," a flat surcharge gets added on top — again, a number admins set per order type (B2B orders and B2C orders can have different COD surcharges).

5. **Show the number before anything is committed.** The frontend calls a `/orders/quote` endpoint that runs this exact same calculation and hands back a full breakdown — zone relation, volumetric weight, billed weight, base charge, surcharge, total — so the customer sees precisely what they're about to pay *before* they confirm. When they hit confirm, the order is created using the same calculation function, so the quote and the final charge can never drift apart from each other.

If an area hasn't been mapped to a zone yet, or a rate card is missing for the requested order type/zone combination, the quote fails with a clear error rather than silently guessing — better to tell someone to go configure it than to charge the wrong amount.

---

## How agent assignment works

Admins can either hand-pick an agent for an order, or hit "auto-assign" and let the system pick. Agents also aren't stuck waiting to be assigned — they have an **Available Pickups** screen where every unassigned order shows up, with the ones in their current zone flagged and sorted to the top. An agent ticks the orders they can take and hits "Take Charge of Selected" to self-assign them. The claim is first-come-first-served: if two agents try to grab the same order, whoever's request lands first gets it, and the second gets a clear "already claimed" message rather than silently overwriting the first agent's claim.

Auto-assignment logic (used by the admin's "auto-assign" button and by reschedule), in plain terms: look at the pickup zone, and find an available agent currently sitting in that same zone. Among agents in that zone, prefer whoever has the fewest active deliveries right now, so work doesn't pile up on one person. If nobody's available in the pickup zone, widen the search to any available agent anywhere, using the same "fewest active deliveries" tiebreaker.

Agents control their own availability from their dashboard (a simple "Go available / Go unavailable" toggle) and can update which zone they're currently in. Admins can see all of this on the Agents screen.

---

## The order status lifecycle

Orders move through a fixed sequence:

```
Created → Picked Up → In Transit → Out for Delivery → Delivered
                                                      ↘ Failed → Rescheduled → Picked Up → ...
```

A delivery agent can only push a status forward one step at a time, and can't skip steps — this keeps the tracking timeline honest. Admins are the exception: they can override an order to *any* status directly, for the inevitable real-world situation where something needs correcting.

Every single status change — whether it came from an agent, a customer action (like reschedule), or an admin override — gets written to an `order_status_history` table with a timestamp and who did it. Nothing in that table is ever edited or deleted, so the tracking timeline you see on an order is a genuine, immutable audit trail, not just a "current status" field.

### What happens on a failed delivery

1. The agent marks the order **Failed** (with an optional note on why).
2. The customer gets an email notification and sees a "Reschedule" option appear on the order page.
3. The customer picks a new date. Behind the scenes, the same auto-assignment logic from above runs again — a fresh agent gets matched to the order (which might be the same one, or might not, depending on who's available).
4. The order moves to **Rescheduled**, and from there follows the normal lifecycle again starting from Picked Up.

---

## API reference

All endpoints are under `/api`. Every route except `/auth/login` and `/auth/register` requires a `Bearer` token in the `Authorization` header, which you get back from login/register.

### Auth
| Method | Route | Who | What it does |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create a customer or agent account |
| POST | `/auth/login` | anyone | Log in, get back a JWT + user object |

### Users
| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/users/me` | any logged-in user | Your own profile |
| GET | `/users/customers?search=` | admin | Look up a customer (used when placing an order on their behalf) |

### Zones & Areas
| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/zones` | any logged-in user | List all zones, each with its mapped areas |
| POST | `/zones` | admin | Create a zone |
| DELETE | `/zones/:id` | admin | Delete a zone (and its areas) |
| POST | `/zones/:id/areas` | admin | Map an area name to a zone |
| DELETE | `/zones/areas/:areaId` | admin | Remove an area mapping |

### Rate Cards
| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/rate-cards` | any logged-in user | List all rate cards and COD surcharges |
| PUT | `/rate-cards` | admin | Create or update a rate card (`order_type`, `zone_type`, `base_price`, `rate_per_kg`) |
| PUT | `/rate-cards/cod-surcharge` | admin | Create or update a COD surcharge for an order type |

### Agents
| Method | Route | Who | What it does |
|---|---|---|---|
| GET | `/agents` | admin | List all agents with zone, availability, active order count |
| PATCH | `/agents/:id/availability` | admin, or the agent themself | Update availability and/or current zone |

### Orders
| Method | Route | Who | What it does |
|---|---|---|---|
| POST | `/orders/quote` | any logged-in user | Run the rate engine without creating an order — get the price breakdown |
| POST | `/orders` | customer, admin | Create an order (admin can create on behalf of a customer via `customerEmail`) |
| GET | `/orders` | any logged-in user | List orders — customers see their own, agents see what's assigned to them, admins see everything and can filter by `status`, `zoneId`, `agentId` |
| GET | `/orders/:id` | involved parties + admin | Full order detail, including the tracking timeline |
| POST | `/orders/:id/assign` | admin | Assign a specific agent, or auto-assign the nearest available one |
| GET | `/orders/available` | agent | Unassigned orders (status Created/Rescheduled), flagged for whether they're in the agent's current zone |
| POST | `/orders/:id/claim` | agent | Self-assign an unassigned order — fails with 409 if another agent already claimed it |
| PATCH | `/orders/:id/status` | agent (their own orders), admin (any order, any status) | Move an order forward in its lifecycle |
| POST | `/orders/:id/reschedule` | customer, admin | Reschedule a failed delivery, triggering reassignment |

---

## Database schema

```
users
  id, name, email, password_hash, role (customer/agent/admin),
  phone, current_zone_id, is_available, created_at

zones
  id, name, created_at

areas
  id, name, zone_id

rate_cards
  id, order_type (B2B/B2C), zone_type (intra/inter),
  base_price, rate_per_kg
  [unique on (order_type, zone_type)]

cod_surcharges
  id, order_type (B2B/B2C), surcharge_amount
  [unique on order_type]

orders
  id, customer_id, created_by_id,
  pickup_address, pickup_area_id, drop_address, drop_area_id,
  length_cm, breadth_cm, height_cm,
  actual_weight_kg, volumetric_weight_kg, billed_weight_kg,
  order_type, payment_type, zone_relation,
  base_charge, cod_surcharge, total_charge,
  status, agent_id, reschedule_date, created_at

order_status_history
  id, order_id, status, actor_id, actor_role, note, created_at

notifications
  id, order_id, channel, message, sent_at
```

A couple of design choices worth flagging:

- **`created_by_id` vs `customer_id`** on orders — these are separate on purpose. When an admin places an order on a customer's behalf, `customer_id` is the customer (so it shows up on their dashboard and they get notified), while `created_by_id` records who actually clicked the button.
- **`order_status_history` is append-only.** Nothing in the API ever updates or deletes a row in this table — it's the audit trail, and it's what powers the tracking timeline in the UI.

---

## A note on the "hosted application URL" deliverable

This sandbox's outbound network access is locked down to package registries (npm, PyPI, GitHub) — it can't reach Vercel, Render, or Railway to actually deploy for you. The app is 100% ready to deploy as-is, though:

- **Backend** — deploys as a standard Node service. Point `DB_PATH` at a persistent disk (Render and Railway both offer this) since SQLite is a single file. Set `JWT_SECRET`, SMTP credentials, and `FRONTEND_ORIGIN` (to your deployed frontend URL) as environment variables.
- **Frontend** — `npm run build` produces static files in `frontend/dist` that deploy directly to Vercel, Netlify, or any static host. Update the API base URL in `frontend/src/api.js` (currently `/api`, relying on the dev proxy) to point at your deployed backend URL, or reintroduce a proxy/rewrite rule on your hosting platform.

If you'd like, I can walk through the exact steps for whichever platform you use.

---

## A note on tests

There's no automated test suite included here — given the time available, the priority was making sure the core flows (rate calculation, zone detection, auto-assignment, the full status lifecycle including failure and reschedule, and role-based permissions) actually work correctly, which I verified by hand end-to-end against the running API before writing the frontend against it. If this were headed to production, the rate engine and assignment logic in `backend/src/utils/` are the two places I'd write unit tests for first — they're pure functions with no side effects, so they're cheap to test thoroughly.
=======
# Last-Mile-Delivery
>>>>>>> d784f6c4c1bdb313f3dcadd40c9b5afb480df312
