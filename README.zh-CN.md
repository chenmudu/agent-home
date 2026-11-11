# agent-home

个人 agent 配置的共享层。ZCode、Qoder、Claude 从各自配置目录读取这里的内容，改动在这里生效。

英文版（默认）：[README.md](README.md)。指令与技能入口的英文副本：[AGENTS.en.md](AGENTS.en.md)、[cc-design-taste-frontend SKILL.en.md](skills/cc-design-taste-frontend/SKILL.en.md)、[cc-product-research SKILL.en.md](skills/cc-product-research/SKILL.en.md)、[cc-teaching-coach SKILL.en.md](skills/cc-teaching-coach/SKILL.en.md)、[cc-unslop SKILL.en.md](skills/cc-unslop/SKILL.en.md)。

## 内容

- `AGENTS.md`：全局指令。被 `~/.zcode/AGENTS.md`、`~/.qoder-cn/AGENTS.md`、`~/.claude/CLAUDE.md` 链接。
- `skills/<name>/`：可移植技能包（`SKILL.md` + assets/references/scripts），由需要的客户端目录读取。

| Skill | 是什么 | 来源 / 许可 | 用在什么场景 | 本仓库改了什么·为什么 |
| --- | --- | --- | --- | --- |
| `cc-design-taste-frontend` | 从零建页面：抽方向、写文案、排字体配色、找图，真浏览器验收 | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) / MIT | 页面/界面还不存在 | 触发词收窄到"从零建"；「已有页面」那节改成转交 `cc-unslop`。两个技能命中同一批词，选中全凭随机 |
| `cc-product-research` | 产品 / 仓库调研报告 | 自有 | 调研、选型、宣称与实现自查 | 未改 | — |
| `cc-teaching-coach` | 自适应教学教练：先探测卡点，建立学习者模型，按每次回答重塑讲法，跨会话跟踪掌握证据；可跑 0→专家的长期课程轨道 | 自有 | 系统学习、检验是否真会、0→专家、明确要求“教我 X” | 新增 |
| `cc-unslop` | 修已有界面：审计 AI 味，按 9 层逐遍改 | [heydamir/unslop](https://github.com/heydamir/unslop) / CC BY 4.0 | 界面已经能跑（源码、线上链接或截图） | 同样反向收窄，另加"modified locally"说明和边界段（CC BY 要求标注改动）。原因同上 |

每个技能的 `SKILL.md` 都是中文（客户端实际加载的就是它），旁边保留英文副本 `SKILL.en.md`。

`cc-design-taste-frontend` 和 `cc-unslop` 的分界线只有一个问题：现在有没有能跑的界面。页面类型和品牌状态不参与判定，两者都覆盖。

## 新增 skill 时

1. 放到 `skills/<name>/`，`SKILL.md` 的 `name` 必须等于目录名。
2. 让需要的客户端技能目录（`~/.zcode/skills`、`~/.qoder-cn/skills` 等）能读到它。
3. 只放进某个客户端目录不会共享。

## 敏感信息

仓库为公开仓库。密钥、token、`.env`、`*.local.json` 一律不入库，见 `.gitignore`。
