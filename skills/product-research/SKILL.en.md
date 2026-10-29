---
name: product-research
description: Research any product, repository, or approach and produce a traceable report: first use it as a real user (click, screenshot, walk the main paths), then go into the code to explain the mechanism and boundaries, and answer with both a product lens and a developer lens: "what can it do, how does it do it, and is it worth using / copying / switching / merging?" Use for requests like "research X", "what can this product do", "how is this implemented", "which of these should I choose / can they be merged", or "is this idea worth copying"; also for auditing your own product's feature claims (claimed vs. visible vs. implemented).
---

> English translation of `SKILL.md`. The Chinese `SKILL.md` is the operative file; method details in `references/`, `assets/`, and the report scripts remain in Chinese.

# Product research

## What this is

Turn a research task into a **traceable evidence chain**, not a feature list: use the product lens to judge "what the user gets", the developer lens to explain "what makes it work and where it breaks", and finish with a conclusion that enables a decision.

## Shortest usage

```
/product-research <code path or repo URL> [product URL]
```

Nothing else is required. These are the defaults:

- **Read-only**: do not write, delete, rebuild, or send messages; ask once before any action that spends LLM credits or writes to disk.
- **Scope**: walk every reachable entry point, not just the main path.
- **Output**: `<workspace>/.research/<slug>/<YYYY-MM-DD>-v<N>.html`, a single self-contained file with screenshots inlined; override with `--out`.

## When to use

- "Research / look into / check out this repo / how is this product"
- Choosing between several similar implementations, merging them, or replacing one
- Assessing whether an external approach or implementation is worth absorbing
- Diagnosing why a product / repo is broken and whether it is still usable
- Auditing your own product: are the claimed capabilities actually in the UI and actually in the code

Not for: reverse engineering (a different discipline), pure code review, pure competitor intelligence collection.

## Three non-negotiables

1. **Read-only by default.** Do not change the state of the object under research; never perform irreversible actions (delete / publish / charge / change shared config).
2. **Do not invent rules.** Checks that the user has not confirmed and that do not appear in this round's evidence can only be candidates; do not put them into conclusions.
3. **Traceability.** Every conclusion must point back to an operation, a screenshot, a line of code, or a document; if it cannot, mark it "unverified".

## Dual lens (core)

Every finding must pass through two lenses; see `references/dual-lens.md` for the full method:

- **Product lens**: who uses it, in what scenario, what they see, what they get, what it costs them
- **Developer lens**: what mechanism makes it work, what the data structures are, where the boundaries are, how it breaks, how expensive it is to maintain

Alignment rules:

- A conclusion that fits only one lens → you have not looked deep enough; go back and cover the other side.
- Development problems must be translated into product consequences (e.g., 600 lines with no build → the delete button returns 409 on click); if you cannot translate it, downweight it.
- Product promises must have a code landing point (e.g., the UI has a filter → which function implements it); if there is none, write "no implementation".
- Presentation order is always **product first, code second**: code is evidence, not the outline.

## Three-column check

Fill three columns for each core capability; **the difference is the value of the report**:

| Claimed | Visible | Implemented |
|---|---|---|
| What README / marketing says | What is actually in the UI | What the code actually does |

When the three disagree, the evidence order is: trust the UI first (it is the user's truth), then the docs, and finally your own understanding.

## SOP: A → B → C → D → E

Deepen level by level; **each level can be delivered independently**, and stop when you can decide. See `references/sop-abcde.md`.

| Level | Answers | Main evidence |
|---|---|---|
| **A Product capability** | What can it do, is it usable | Walk every entry point + screenshots + five checklists |
| **B Technical mechanism** | How does it work, where are the boundaries, where does it break | Source-code path + minimal reproduction |
| **C Compare / choose / merge** | Which to choose, can they be merged | A+B for each + one shared yardstick + coexistence conflicts |
| **D Absorb an external approach** | Is it worth copying | Locate the seat first, then criticize, then run a small experiment |
| **E Failure / abandonment postmortem** | Why is it broken, can it be saved | Timeline + issue / PR archaeology + version drift |

When entering a new level, first write **a short proposal** (what to do / what evidence to collect / what to produce), then continue without waiting for confirmation; work continuously within a level without interruption.

## Evidence

Four layers of evidence, top first; see `references/evidence-rules.md`:

1. Hands-on operation (what was clicked, what happened)
2. Screenshots (a screen that can be re-checked)
3. What the UI itself says (copy / empty states / errors / busy states)
4. Source code (descend only when 1–3 cannot answer; used to answer "why / boundaries / where it breaks")

Hard rules:

- A runnable instance must be exercised for real; if it cannot run, mark all capabilities as "claimed" and declare the downgrade on the first page.
- Security / boundary conclusions must be tested for real, or marked "not tested".
- The unverified section must exist and must not be empty.

## Access surfaces (decide how to reach it first)

Form determines the driver; the driver determines evidence strength:

| Form | Driver | Evidence available |
|---|---|---|
| Web page | Browser (browser-use / built-in) | Screenshots + accessibility tree + DOM + network |
| Desktop app | computer-use | Screenshots (weak semantics; rely on looking) |
| CLI / TUI | Terminal | Commands + output text |
| API / SDK | curl / scripts | Request-response |

Rule: **probe before promising** (list pages / list windows / `--help` / status code); on failure, downgrade. Tag every hands-on conclusion with its driver `[browser] [screen] [terminal] [API]`; **evidence from different drivers cannot substitute for each other**. See `references/access-surfaces.md`.

## Starting gate (ask only once for the whole research)

Step 0 does not count as a question: **first check whether this object has been researched before.** Read `<workspace>/.research/<slug>/index.json` (or let `scripts/new_report.mjs` decide automatically): the first time generates v1, the second time and later generate v2/v3, and **old reports are never overwritten**; a re-research must include a "changes in this version" block.

Then write a five-line brief in the reply (decision sentence / object / evidence sources / permission / output), and then:

- **Ask only in three cases**: ① the decision sentence cannot be derived; ② it would spend LLM credits or write to disk — **on the object's side**; writing your own report does not count; ③ the output location or form is ambiguous.
- In all other cases, start immediately after the brief without waiting for confirmation.
- When entering a new SOP level (C / D / E), write only a short proposal; do not block.

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
  --level <A|B|C|D|E> --modes "<mode1,mode2>" --root <workspace>
```

It handles: naming and version-number decision, inline structural baseline, six-line metadata table, nine-section skeleton, empty `report-meta` shell, and `index.json` registration. After that, fill in content only.

Four hard rules (details in `assets/report-kernel.md`):

1. **Naming**: `<slug>/<date>-v<N>.html`; `N` = number of existing reports for this object + 1, **never overwrite**. Changing a report = publishing a new version; keep the old one as evidence.
2. **Visuals**: the structure is fixed; the skin comes from the researched object's UI (background / panels / primary color / font character), and write `skin: <object> UI` at the top of `<style>`. The report should look like that product's documentation, not a template — but it should not lose structural consistency.
3. **Metadata**: a fixed six-row label table (object / version commit / report version / clone / method / date); do not compress it into a `·` string.
4. **Machine-readable**: `<script id="report-meta">` with a fixed schema + `index.json` cross-version registry; the report is readable by both humans and agents.

The body is **a leading conclusion card + fixed nine sections + appendix** (template in `assets/report-kernel.md`):

`Conclusion card (unnumbered)` · 1 Product profile · 2 Scope / boundaries / self-proof · 3 Claimed / visible / implemented · 4 Feature map · 5 Main journeys · 6 Feature confirmation · 7 Mechanism / boundaries / failure · 8 Unverified areas · 9 Decisions pending · Appendix

Section 1 "Product profile" has five subsections: **positioning → goals → current state → problems → solution** (features are not written here). Section 6 is the core: **one feature per block**, with a fixed three-part structure:

```
Product intent (what the user gets, what they would assume)
Code confirmation (path:line + mechanism + boundaries; silent failure or error)
Verdict (true / discounted / surface only)
```

**Design intent comes first; code confirms whether it is real.** The feature table in section 4 is only an index (`→ fn-3`) and carries no conclusions; a block longer than 4 paragraphs means two features were mixed — split it.

Depth floor: feature blocks ≥ 6; source references ≥ 15 covering ≥ 6 files; every row in section 3 carries a code reference; and at least one consistency check across sources (the same fact stated differently in two places is the hardest finding).

Three things are required, not suggested:

- **Requirements regression**: tick off the user's original words one by one (`assets/requirements.md`); put it in section 2.
- **Self-rebuttal**: at least 3 "first thought → correction → evidence" items; put them at the end of section 6.
- **Non-change self-proof**: operation interval, number of write operations, mtimes of changed files; put it in section 2.

Re-research (v≥2): re-check every feature block from the previous version one by one, writing "still holds / changed / not re-checked", and fill them into `report-meta.research.recheck` and the "changes in this version" block. **"Conclusion not overturned" must be based on re-verification**; the previous version's hardest defect must not quietly disappear.

Before delivery run `node scripts/check_doc.mjs <file>` and make it all green.

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
- `references/access-surfaces.md` — access surfaces: form → driver → evidence → downgrade
- `references/sop-abcde.md` — evidence actions and stop conditions for the five-level SOP
- `references/evidence-rules.md` — evidence levels, citation format, common traps
- `assets/research-brief.md` — five-line starting brief (asked only once)
- `assets/correction-ledger.md` — correction ledger (with seed cases)
- `assets/permission-ladder.md` — operation permission levels
- `assets/report-kernel.md` — visual baseline / page metadata / changes and re-check / leading card + nine sections / feature confirmation block / image discipline
- `assets/report-theme.css` — structural baseline (layout fixed; color variables reset per object)
- `assets/requirements.md` — original words → acceptance checklist
- `scripts/new_report.mjs` — create a report: decide version, inline styles, generate skeleton, register in index.json
- `scripts/check_doc.mjs` — HTML contract validation (naming / metadata / nine sections / theme / images)
