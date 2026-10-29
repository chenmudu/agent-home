# agent-home

The shared layer for personal agent configuration. ZCode, Qoder, and Claude reach it through symlinks / junctions in their own config directories, so changes made here take effect everywhere.

Chinese: [README.zh-CN.md](README.zh-CN.md)

## Contents

- `AGENTS.md`: global instructions. Linked from `~/.zcode/AGENTS.md`, `~/.qoder-cn/AGENTS.md`, and `~/.claude/CLAUDE.md`.
- `skills/<name>/`: portable skill packages (`SKILL.md` + assets/references/scripts). Currently `product-research` is referenced by `.zcode` and `.qoder-cn` via junctions.

## Adding a skill

1. Put it under `skills/<name>/`; the `name` in `SKILL.md` frontmatter must equal the directory name.
2. Create a junction in each client directory that should see it:

   ```
   mklink /J "%USERPROFILE%\.zcode\skills\<name>" "%USERPROFILE%\.agent\skills\<name>"
   ```

3. Putting it only in one client directory does not share it.

## Links are not in the repository

Links are machine-local state; recreate them after moving machines. On Windows, file symlinks require Developer Mode or administrator rights; directory junctions do not.

## Sensitive information

The repository is public. Never commit keys, tokens, `.env` files, or `*.local.json`; see `.gitignore`.

## Language versions

- English: this file (default)
- Chinese: [README.zh-CN.md](README.zh-CN.md)
- Instructions: [AGENTS.md](AGENTS.md) / [AGENTS.en.md](AGENTS.en.md)
- Skill entry: [SKILL.md](skills/product-research/SKILL.md) / [SKILL.en.md](skills/product-research/SKILL.en.md)
