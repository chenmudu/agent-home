# agent-home

The shared layer for personal agent configuration. ZCode, Qoder, and Claude read it from each client's own config directory, so changes made here take effect everywhere.

Chinese: [README.zh-CN.md](README.zh-CN.md)

## Contents

- `AGENTS.md`: global instructions. Linked from `~/.zcode/AGENTS.md`, `~/.qoder-cn/AGENTS.md`, and `~/.claude/CLAUDE.md`.
- `skills/<name>/`: portable skill packages (`SKILL.md` + assets/references/scripts), read by the client directories that need them.

| Skill | What it is | Source / licence | Use when | Changed here, and why |
| --- | --- | --- | --- | --- |
| `cc-design-taste-frontend` | Builds a page from zero: deals a direction, writes the copy deck, type, palette, imagery, verifies in a real browser | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) / MIT | No working interface yet | Trigger description narrowed to new builds; the "existing page" section now hands off to `cc-unslop`. Both skills fired on the same words, so the pick was random |
| `cc-product-research` | Product / repo research report | own | Research, comparison, claimed-vs-actual | None | — |
| `cc-teaching-coach` | Adaptive teaching coach: probes the blocker, builds a learner model, reshapes the explanation from each answer, tracks mastery evidence across sessions, and can run a 0→expert curriculum track | own | Systematic learning, real-mastery checks, 0→expert, or "teach me X" | New |
| `cc-unslop` | Repairs an existing screen: audits the AI tells, fixes in nine passes | [heydamir/unslop](https://github.com/heydamir/unslop) / CC BY 4.0 | Interface already runs (source, live URL or screenshot) | Narrowed the same way, plus a "modified locally" note and a boundary paragraph (CC BY asks for changes to be indicated). Same reason |

Every skill here keeps `SKILL.md` in Chinese — that is the file a client loads — and the English copy beside it as `SKILL.en.md`.

The gate between `cc-design-taste-frontend` and `cc-unslop` is one question: does a working interface exist? Page type and brand status do not decide it — both skills cover both.

## Adding a skill

1. Put it under `skills/<name>/`; the `name` in `SKILL.md` frontmatter must equal the directory name.
2. Make it reachable from each client's skills directory (`~/.zcode/skills`, `~/.qoder-cn/skills`, ...).
3. One client directory alone does not share it.

## Sensitive information

The repository is public. Never commit keys, tokens, `.env` files, or `*.local.json`; see `.gitignore`.

## Language versions

- English: this file (default)
- Chinese: [README.zh-CN.md](README.zh-CN.md)
- Instructions: [AGENTS.md](AGENTS.md) / [AGENTS.en.md](AGENTS.en.md)
- Skill entries: [cc-design-taste-frontend](skills/cc-design-taste-frontend/SKILL.md) / [EN](skills/cc-design-taste-frontend/SKILL.en.md); [cc-product-research](skills/cc-product-research/SKILL.md) / [EN](skills/cc-product-research/SKILL.en.md); [cc-teaching-coach](skills/cc-teaching-coach/SKILL.md) / [EN](skills/cc-teaching-coach/SKILL.en.md); [cc-unslop](skills/cc-unslop/SKILL.md) / [EN](skills/cc-unslop/SKILL.en.md)
