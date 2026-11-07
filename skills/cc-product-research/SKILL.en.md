---
name: cc-product-research
description: >-
  Research any product, repository, or approach and produce a traceable report: by default a one-screen
  decision brief (7 questions) plus a five-act timeline / data-flow; use a runnable instance hands-on when
  available, or download / clone the repository and research it from source. Answer with both a product
  lens and a developer lens: "what can it do, how does it do it, and is it worth using / copying /
  switching / merging?" Use for requests like "research X", "what can this product do", "how is this
  implemented", "which of these should I choose / can they be merged", or "is this idea worth copying";
  also for auditing your own product's feature claims (claimed vs. visible vs. implemented).
---

> English translation of `SKILL.md`. The Chinese `SKILL.md` is the operative file; method details in `references/`, `assets/`, and the report scripts remain in Chinese. The two files must not differ in rules.

# Product research

## What this is

Turn a research task into a report that **enables a decision and can be re-checked**: the first screen is a one-screen decision brief (7 questions), the body runs as a five-act runtime chain, and evidence, self-proof, and references live in three appendices. It is neither a feature list nor an audit worksheet.

## Shortest usage

```
/cc-product-research <code path or repo URL> [product URL]
```

Nothing else is required. These are the defaults:

- **Read-only**: do not write, delete, rebuild, or send messages; ask once before any action that spends LLM credits or writes to disk on the object's side.
- **Scope**: walk every reachable entry point, not just the main path; click what can be clicked, trace what cannot to its source registration point. Exercise a runnable instance when available; when there is none, download / clone the repository and research it from source plus docs — this is a first-class mode, not a downgrade.
- **Output**: `<workspace>/.research/<slug>/<YYYY-MM-DD>-v<N>.html`, a single self-contained file with screenshots inlined; override with `--out`.
- **Reader mode**: `evaluator` (default); use `operator` to install / run, `maintainer` to modify / integrate.

## When to use

- "Research / look into / check out this repo / how is this product"
- Choosing between several similar implementations, merging them, or replacing one
- Assessing whether an external approach or implementation is worth absorbing
- Diagnosing why a product / repo is broken and whether it is still usable
- Auditing your own product: are the claimed capabilities actually in the UI and actually in the code

Not for: reverse engineering (a different discipline), pure code review, pure competitor intelligence collection.

## Five non-negotiables

1. **Read-only by default.** Do not change the state of the object under research; never perform irreversible actions (delete / publish / charge / change shared config).
2. **Do not invent rules.** Checks that the user has not confirmed and that do not appear in this round's evidence can only be candidates; do not put them into conclusions.
3. **Traceability.** Every conclusion must point back to an operation, a screenshot, a line of code, or a document; if it cannot, mark it "unverified".
4. **Understand before believing.** The first screen must answer 7 questions: what it is / who it is for / how to use it / what it costs / what was not done this time / whether to try it / what to do next. Explain a term the first time it appears. Before delivery, an independent reader performs a three-stage acceptance (first screen 7 questions / five-act mainline recap / 3 facts from evidence). If any answer fails, fix the report first.
5. **Write along the runtime chain.** Organise the body as `S0 → S1 → … → Sn`; each hop states input state, executor, processing, output state, failure/degradation, and evidence. A static asset must answer the four questions or stay out of the body.

## Dual lens (core)

Every finding must pass through two lenses; see `references/dual-lens.md` for the full method:

- **Product lens**: who uses it, in what scenario, what they see, what they get, what it costs them.
- **Developer lens**: what mechanism makes it work, what the data structures are, where the boundaries are, how it breaks, how expensive it is to maintain.

Alignment rules:

- A conclusion that fits only one lens → you have not looked deep enough; go back and cover the other side.
- Development problems must be translated into product consequences (e.g., 600 lines with no build → the delete button returns 409 on click); if you cannot translate it, downweight it.
- Product promises must have a code landing point (e.g., the UI has a filter → which function implements it); if there is none, write "no implementation".
- Presentation order is always **product first, code second**: code is evidence, not the outline.
- **When there is no UI**, "visible" means the promise confirmed by README / docs / code entry points. If a UX detail cannot be answered, mark it "not run on a real instance"; do not use source code to pretend there is a UI.

## Three-column check

Fill three columns for each core capability; **the difference is the value of the report**:

| Claimed | Visible | Implemented |
|---|---|---|
| What README / marketing says | What is actually in the UI | What the code actually does |

When the three disagree, the evidence order is: trust the UI first (it is the user's truth), then the docs, and finally your own understanding. Without a UI, trust what the source code can confirm about entry points and behaviour first, then the docs.

## SOP: A → B → C → D → E

Deepen level by level; **each level can be delivered independently**, and stop when you can decide. See `references/sop-abcde.md`.

| Level | Answers | Main evidence |
|---|---|---|
| **A Product capability** | What can it do, is it usable | Walk every reachable entry point + screenshots + five checklists |
| **B Technical mechanism** | How does it work, where are the boundaries, where does it break | Source-code path + minimal reproduction |
| **C Compare / choose / merge** | Which to choose, can they be merged | A+B for each + one shared yardstick + coexistence conflicts |
| **D Absorb an external approach** | Is it worth copying | Locate the seat first, then criticize, then run a small experiment |
| **E Failure / abandonment postmortem** | Why is it broken, can it be saved | Timeline + issue / PR archaeology + version drift |

- **Level A covers every reachable entry point**, with no upper limit; pick 3–5 main paths for deeper work.
- **Level A comes first**: deliver the one-screen brief (7 questions) before the full evidence.
- **Source-code Level A**: README / CLI help / routes / exports / command registration points are the entry points; trace each to `path:line`, and write capability as "source-visible, not run on a real instance".
- When entering a new level, first write **a short proposal** (what to do / what evidence to collect / what to produce), then continue without waiting for confirmation; work continuously within a level without interruption.

## Evidence

Four layers of evidence, top first; see `references/evidence-rules.md`:

1. Hands-on operation (what was clicked, what happened)
2. Screenshots (a screen that can be re-checked)
3. What the UI itself says (copy / empty states / errors / busy states)
4. Source code (used to answer "why / boundaries / where it breaks")

Hard rules:

- A runnable instance must be exercised for real; when there is no instance, source / docs are first-class evidence and are not written as a "downgrade".
- **Source-only** reports tag `[源码]`, and the first screen's "not done this time" says "not run on a real instance"; do not infer UX from source.
- Security / boundary conclusions must be tested for real, or marked "not tested".
- Act 5 "unverified and pending decisions" must exist and must not be empty.

## Access surfaces (decide how to reach it first)

Form determines the driver; the driver determines evidence strength:

| Form | Driver | Evidence available |
|---|---|---|
| Web page | Browser (browser-use / built-in) | Screenshots + accessibility tree + DOM + network |
| Desktop app | computer-use | Screenshots (weak semantics; rely on looking) |
| CLI / TUI | Terminal | Commands + output text |
| API / SDK | curl / scripts | Request-response |
| Hybrid (Electron / Tauri) | Browser or computer-use | By the chosen driver; the two evidence sets cannot be mixed |
| Vendor-only ecosystem | That ecosystem itself | Screenshots or logs; never fake UI evidence |
| **Source / docs (not runnable)** | File reads / git / static analysis | `path:line` + claims + data flow |

Rules: **probe before promising** (list pages / list windows / `--help` / status code / read the README and at least one entry definition); on failure, **switch** to a workable access surface. Tag every hands-on conclusion with its driver `[browser] [screen] [terminal] [API] [source] [docs]`; **evidence from different drivers cannot substitute for each other**; source cannot prove reachability / UX. Handle hybrid and vendor-only products as described in `references/access-surfaces.md`.

## Orchestration (triage first, dispatch second)

Default to one main agent. Switch to an orchestrator plus workers when any of these holds: multiple objects, at least two independent access surfaces, or at least three independent feature clusters in Act 3. Do not split simple research.

1. **Triage before dispatch.** Probe every object/evidence unit and route it to S source / R runtime / D docs. For an uncertain unit, run a 5–10 minute probe first; if that fails, mark it unverified or switch to a workable surface.
2. **Parallelize by channel, not by act number.** S and D can run in parallel; R must stay serial within one state chain. Parallelize only across objects or independent access surfaces.
3. **Workers gather evidence only.** One packet, one question, read-only. Return one conclusion plus `path:line` / screenshot / unverified; never write the report or give a final recommendation.
4. **The main agent reconciles.** Verify every key conclusion against source or a rerun; recheck conflicts; keep evidence labels from different drivers separate.
5. **The reader stays independent.** Start it after the report is written; give it the brief, Acts 1–5, one feature profile, and the evidence appendices only; no source code, no conversation history.

See `references/orchestration.md`.

## Starting gate (ask only once for the whole research)

Step 0 does not count as a question: **first check whether this object has been researched before.** Read `<workspace>/.research/<slug>/index.json` (or let `scripts/new_report.mjs` decide automatically): the first time generates v1, the second time and later generate v2/v3, and **old reports are never overwritten**; a re-research must include a "changes in this version" block.

Then write a **six-line brief** in the reply (decision sentence / object / evidence sources / permission / reader mode / output), and then:

- **Ask only in three cases**: ① the decision sentence cannot be derived; ② it would spend LLM credits or write to disk — **on the object's side**; writing your own report does not count; ③ the output location or form is ambiguous.
- In all other cases, start immediately after the brief without waiting for confirmation.
- When entering a new SOP level (C / D / E), write only a short proposal; do not block.

Reader mode has exactly three values: `evaluator` / `operator` / `maintainer`; default `evaluator`. **Source research is the default** when there is no runnable instance: download / clone the repository, research from source plus docs, and do not write it as a "downgrade".

Template: `assets/research-brief.md`. Operation permission: `assets/permission-ladder.md`: default L0 browsing + L1 harmless interaction; L2 requires per-action authorization; L3 never execute. **L1 can also write to disk** (cache, index, logs); check at wrap-up.

## Delivery

The artifact is **one self-contained HTML file**, whose path is determined by the object and version:

```
<workspace>/.research/<slug>/<YYYY-MM-DD>-v<N>.html
<workspace>/.research/<slug>/index.json
```

Generate it with the scaffold; do not hand-copy styles:

```bash
node scripts/new_report.mjs --slug <kebab-case> --title "<name>" \
  --repo <owner/repo> --version <vX> --commit <sha> \
  --commit-date <YYYY-MM-DD> --local "<path>" \
  --level <A|B|C|D|E> --modes "<mode1,mode2>" \
  --reader evaluator|operator|maintainer --root <workspace>
```

It handles: naming and version-number decision, inline structural baseline, six-row metadata table, **decision brief + five-act skeleton + three evidence appendices**, empty `report-meta` shell, and `index.json` registration. After that, fill in content only.

Four hard rules (details in `assets/report-kernel.md`):

1. **Naming**: `<slug>/<date>-v<N>.html`; `N` = number of existing reports for this object + 1, **never overwrite**. Changing a report = publishing a new version; keep the old one as evidence.
2. **Visuals**: the structure is fixed; the skin comes from the researched object's UI (background / panels / primary color / font character), and write `skin: <object> UI` at the top of `<style>`. The report should look like that product's documentation, not a template — but it should not lose structural consistency.
3. **Metadata**: a fixed six-row label table (object / version commit / report version / clone / method / date); do not compress it into a `·` string.
4. **Machine-readable**: `<script id="report-meta">` with a fixed schema + `index.json` cross-version registry; the report is readable by both humans and agents.

Body structure (template in `assets/report-kernel.md`):

`Decision brief (7 lines + 3 KPIs)` · `01 Entry` · `02 After install` · `03 Core flow (input / process / output)` · `04 Carriers` · `05 Cross-cuts` · `Appendix evidence` · `Appendix self-proof` · `Appendix references`

**The five acts are a state chain, not five parallel chapters.** Features hang under state nodes; each feature is explained fully in one main location, and other locations use `#fn-N` anchors. Summary of each act:

- **1 Entry**: how to run it the first time; host/platform, prerequisites, install/access, first command, first visible result, blocker.
- **2 After install**: what the environment gained; new assets, activated capabilities, good impact, cost/bad impact, unchanged things, rollback.
- **3 Core flow**: input reaches its minimum unit; state table ≥3 rows; output is verifiable; feature profiles ≥6.
- **4 Carriers**: owner, state store, read/write, interrupt/recover, cleanup for each stage.
- **5 Cross-cuts**: impact matrix with four rows (human / host / object / artifact) + unverified and pending decisions.

**Static asset rule**: a `SKILL.md`, config, manifest, hook script, template, or prompt enters the body only if it answers "who reads it / which state it changes / what differs without it / where the evidence is". If it cannot, it is one line in the asset list; put it in the evidence appendix or delete it.

Depth floor: feature profiles ≥6; source references ≥15 across ≥6 files (single-file products may set `research.singleFile: true`); every row of the claimed/visible/implemented table carries a code reference or "no implementation"; at least one consistency check across sources; state table ≥3 rows.

All four must-haves + the version delta **go in the evidence appendices**; the first screen keeps only one sentence:

- **Requirements regression** (`appendix-selfproof`): tick off the user's original words one by one; status only ✅ / ⏳ / ❌.
- **Three-stage reader acceptance** (`appendix-selfproof`): first screen 7 questions / five-act mainline recap / 3 facts from evidence; `[读者验收]` must be in the body, not only in an HTML comment.
- **Self-rebuttal** (`appendix-evidence`): at least 3 "first thought → correction → evidence" items.
- **Non-change self-proof** (`appendix-selfproof`): operation interval, number of write operations, mtimes of changed files, key counts before and after.
- **Changes in this version** (`appendix-selfproof`): the delta block for v≥2; the first research writes "first research, no previous version".

Re-research (v≥2): re-check every feature block from the previous version one by one, writing "still holds / changed / not re-checked", and fill them into `report-meta.research.recheck` and the "changes in this version" block. **"Conclusion not overturned" must be based on re-verification**; the previous version's hardest defect must not quietly disappear.

**Checker**: `node scripts/check_doc.mjs <file>`. v3 checks the five acts, a3 subsections, state table, carrier table, evidence appendices, and `[读者验收]`; v2 keeps nine sections + readability checks; legacy (no `contractVersion`) gets the nine-section structure check only. A v2 report that predates the v3-only `reader` / `brief` fields only gets a warning, so old reports are not falsely rejected. Before delivery it must be all green (an empty scaffold may show the expected "structure passes, content pending" failures).

**Ledger note**: C-007 (plain language first) / C-018 (product profile first) were promoted to delivery gates by C-024; C-025 makes source research a first-class mode.

## Wrap-up (ask once after delivery)

After the report is delivered, append one question and ask only this once:

> Report generated at `<path>`. Clean up this session's temporary files and processes? The report, cloned code, and source are never touched.

If the user says yes, handle three buckets:

| Bucket | Contents | Action |
|---|---|---|
| Keep | Report, `index.json`, cloned repos, source | **Never delete**, do not ask or touch |
| Cleanable | Temporary directories created this session, intermediate screenshots, `_npx` / cache entries, npm debug logs, app-created data directories and DBs, lock files | List paths + sizes first, then delete |
| Must stop | Processes and ports I started; shared caches (`_cacache`, pnpm store) | Confirm 0 listeners / 0 leftover processes first; ask separately about shared caches |

Give the list (path / size / what it is) before deleting; after deleting, re-check ports and surviving files.

## Correction ledger

`assets/correction-ledger.md` is this skill's growth mechanism. After each user correction, append an entry (scenario / what I did / what was corrected / extracted rule / scope).

- **Promote only on two hits**: a similar correction appears twice, or the user explicitly says "remember"; only then write it into SKILL.md as a hard rule. Everything else stays in the ledger as a case.
- Read the ledger at the start of each task and apply relevant entries to this research.
- Update the ledger only when the user explicitly asks; do not rewrite history entries.

## Resources

- `references/dual-lens.md` — dual lens and three-column check (required reading)
- `references/access-surfaces.md` — seven access surfaces: form → driver → evidence → switch
- `references/orchestration.md` — orchestration: triage, S/R/D lanes, worker packets, reconciliation, anti-patterns
- `references/sop-abcde.md` — evidence actions and stop conditions for the five-level SOP
- `references/evidence-rules.md` — evidence levels, source as first-class, citation format, common traps
- `assets/research-brief.md` — six-line starting brief (asked only once)
- `assets/correction-ledger.md` — correction ledger (with seed cases)
- `assets/permission-ladder.md` — operation permission levels
- `assets/report-kernel.md` — v7 SSOT: decision brief / five acts / state chain / static-asset four questions / depth floor / three-stage acceptance / 20 quality lines
- `assets/report-theme.css` — structural baseline (layout fixed; variables reset per object)
- `assets/requirements.md` — original words → acceptance checklist + three-stage reader acceptance
- `scripts/new_report.mjs` — create a report: decide version, inline styles, generate brief + five acts + three appendices, register in index.json
- `scripts/check_doc.mjs` — HTML contract validation (v3 five acts / v2 nine sections / legacy structure)