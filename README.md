# agent-home

个人 agent 配置的共享层。ZCode、Qoder、Claude 通过各自配置目录里的软链 / Junction 指回这里，改动在这里生效。

英文版：[README.en.md](README.en.md)。指令与技能入口的英文副本：[AGENTS.en.md](AGENTS.en.md)、[SKILL.en.md](skills/product-research/SKILL.en.md)。

## 内容

- `AGENTS.md`：全局指令。被 `~/.zcode/AGENTS.md`、`~/.qoder-cn/AGENTS.md`、`~/.claude/CLAUDE.md` 链接。
- `skills/<name>/`：可移植技能包（`SKILL.md` + assets/references/scripts）。目前 `product-research` 被 `.zcode` 和 `.qoder-cn` 以 Junction 引用。

## 新增 skill 时

1. 放到 `skills/<name>/`，`SKILL.md` 的 `name` 必须等于目录名。
2. 在需要的客户端目录里建 Junction：

   ```
   mklink /J "%USERPROFILE%\.zcode\skills\<name>" "%USERPROFILE%\.agent\skills\<name>"
   ```

3. 只放进某个客户端目录不会共享。

## 链接不在仓库里

链接是本机状态，换机后重建。Windows 上文件软链需要开发者模式或管理员权限，目录 Junction 不需要。

## 敏感信息

仓库保持私有。密钥、token、`.env`、`*.local.json` 不入库，见 `.gitignore`。
