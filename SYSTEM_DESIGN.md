# System Design Write-Up

## Rate Calculation Engine

The rate engine lives as a single pure function (`calculateCharge` in `backend/src/utils/rateEngine.js`) that both the quote endpoint and the order-creation endpoint call — this was a deliberate choice. Early on I considered duplicating the logic (a "preview" calculation on the frontend, a "real" calculation on the backend), but that's exactly how quote-vs-charge drift bugs get introduced: the customer sees one number, confirms, and the actual order comes out slightly different. Instead, both paths run the identical function against the same database-backed configuration, so the number shown before confirmation is guaranteed to match the number that gets billed.

The calculation itself runs in five steps: resolve the pickup and drop areas to their zones, classify the route as intra- or inter-zone, compute volumetric weight `(L×B×H)/5000` and take the greater of that or actual weight as the billed weight, look up the matching rate card by `(order_type, zone_type)` to get a base price and per-kg rate, and finally add a COD surcharge if the payment type calls for it. Every number in that chain — base price, rate per kg, surcharge amount — comes from the database, never from a constant in the code. An admin can walk into the Rate Cards screen and change B2B inter-zone pricing without a deploy.

I chose to fail loudly rather than silently when configuration is missing — if an address maps to an unmapped area, or a rate card doesn't exist for a given combination, the quote throws a specific, readable error instead of falling back to some default rate. A wrong silent default is a worse failure mode for a billing system than an error that tells someone exactly what to go configure.

## Zone Detection Approach

Rather than doing geocoding or distance math, zone detection here is a lookup table: admins maintain a list of "areas" (localities, pincodes — whatever granularity makes sense for the business), and each area belongs to exactly one zone. When an order comes in, both the pickup and drop area names are matched (case-insensitively) against this table. This keeps the system simple and fully admin-controlled, at the cost of requiring areas to be pre-configured before orders can be placed there. For a real deployment this table would likely be seeded from a pincode-to-zone mapping file rather than typed in one at a time, but the underlying mechanism — area belongs to zone, zone comparison determines intra/inter — would stay the same. I picked this over live geocoding because it's deterministic and free: no external API dependency, no risk of a geocoding service being down blocking order creation, and zone boundaries in logistics are usually operational decisions (which warehouse serves which pincodes) rather than something you'd want computed from raw coordinates anyway.

## Auto-Assignment Logic

Assignment is agent-availability-first, then zone-first: the system looks for agents who are marked available *and* currently sitting in the pickup zone, and among those, picks whichever agent has the fewest active (not yet Delivered/Failed) orders — a simple load-balancing tiebreaker so work doesn't stack up on one person. If no one is available in the pickup zone, the search widens to any available agent system-wide, using the same tiebreaker. This two-tier fallback means the system almost always finds someone rather than returning "no agents available," while still preferring proximity when it's an option.

Agent "location" here is modeled as a zone assignment rather than live GPS coordinates — agents (or admins on their behalf) set their current zone manually. This was a deliberate scope decision: true GPS-based nearest-agent routing needs a location-streaming pipeline that's a project in itself, and zone-level granularity is what the rate engine already works in, so reusing it for assignment keeps the whole system coherent around one geographic model instead of two.

## Failed Delivery Handling

A failed delivery is treated as a first-class state, not an error path bolted onto the status field. When an agent marks a delivery Failed, the customer is notified immediately and a Reschedule action becomes available to them. Rescheduling captures a new date and re-runs the exact same assignment logic used for fresh orders — it's not special-cased reassignment code, it's the normal auto-assignment function called again, which means whichever agent is genuinely best-positioned at that moment gets the order, whether or not that's the original agent. The order then moves to a Rescheduled state and re-enters the normal lifecycle from Picked Up onward.

Every transition — including Failed and Rescheduled — is written to an append-only status history table with a timestamp and the acting user, so the full story of what happened to an order (including failed attempts) is always reconstructable, not overwritten by whatever the current status happens to be.
