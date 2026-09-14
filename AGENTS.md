# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project status

This repository is in the **domain design phase** for "Blanc," a WhatsApp-driven, AI-assisted appointment booking platform for a 3-branch (soon 4) nail salon. There is no source code yet — no build, lint, or test commands exist.

Current documentation (read before proposing any design or code):
- `docs/requirements/blanc-requisitos-negocio.md` — official source of business/functional requirements. Treat as authoritative; don't reinterpret without recording the change.
- `docs/architecture/01-domain-discovery.md` — DDD domain discovery (subdomains, bounded contexts, entities, aggregates, domain events, open questions). Several modeling decisions are marked as open questions pending business confirmation — check section 2/9 of that doc before assuming an answer.
- `docs/architecture/02-architecture-principles.md` — governing architecture principles (Modular Monolith, Hexagonal+Clean+Vertical Slices, CQRS-lite, in-process event-driven + outbox, AI/API/DB/security principles).
- `docs/architecture/ADR_INDEX.md` and `docs/architecture/adr/ADR-001..022-*.md` — the 22 formal, individually-numbered Architecture Decision Records that freeze every major architectural decision (status: Proposed, pending client approval as of 2026-07-07). **ADR-008 recommends rejecting the client's proposed Evolution API for WhatsApp** in favor of the official WhatsApp Business Platform, due to business-continuity risk — this is an open deviation awaiting explicit client sign-off. Any code that violates an Accepted ADR needs a new ADR, not a silent deviation.

No technology stack, data model, or API design has been finalized beyond what the ADRs lock in (PostgreSQL, OpenAI, Google Calendar integration shape). A tech stack was proposed by the client as reference only (see the requirements doc) and has not been fully architecturally validated — see ADR-008 for the one confirmed deviation so far.

Once implementation starts, replace this section with:
- Build, lint, and test commands (including how to run a single test)
- The high-level architecture — major components/modules and how they interact
- Any non-obvious conventions the codebase relies on
