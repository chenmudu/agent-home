#!/usr/bin/env node
/**
 * Scaffold a product-research report with the skill-owned theme and metadata.
 *
 *   node new_report.mjs --slug context-lens --title "Context Lens" \
 *     [--repo owner/repo] [--version v0.8.0] [--commit ce17b9d] [--commit-date 2026-10-21] \
 *     [--local <path>] [--level A] [--modes 实机操作,源码] [--date 2026-10-29] \
 *     [--reader evaluator|operator|maintainer] \
 *     [--previous <file>] [--root <workspace>] [--out <file>]
 *
 * Writes <root>/.research/<slug>/<YYYY-MM-DD>-v<N>.html and maintains
 * <root>/.research/<slug>/index.json (cross-version registry).
 *
 * N is derived from prior reports that carry a report-meta block with the same
 * slug. Existing files are never overwritten: a re-run on the same day creates
 * v2, v3, ...
 *
 * The scaffold is contractVersion 3: one-screen brief + five acts + three
 * evidence appendices. Fill it; do not hand-copy the theme.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const THEME = readFileSync(join(SKILL_DIR, 'assets', 'report-theme.css'), 'utf8')
const META_SCHEMA = 'product-research/report@1'
const INDEX_SCHEMA = 'product-research/index@1'
const READER_MODES = ['evaluator', 'operator', 'maintainer']
const CONTRACT_VERSION = 3

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)

const slug = opt('slug')
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.log('usage: node new_report.mjs --slug <kebab-case> --title "<name>" [--repo owner/repo] [--version vX] [--commit sha] [--commit-date YYYY-MM-DD] [--local <path>] [--level A|B|C|D|E] [--modes a,b] [--date YYYY-MM-DD] [--reader evaluator|operator|maintainer] [--previous <file>] [--skin "<object> UI"] [--root <dir>] [--out <file>]')
  process.exit(2)
}

const reader = opt('reader', 'evaluator')
if (!READER_MODES.includes(reader)) {
  console.error(`--reader must be one of ${READER_MODES.join(' | ')}, got "${reader}"`)
  process.exit(2)
}

const root = resolve(opt('root', process.cwd()))
const date = opt('date', new Date().toISOString().slice(0, 10))
const title = opt('title', slug)
const repo = opt('repo', '')
const objVersion = opt('version', '')
const commit = opt('commit', '')
const commitDate = opt('commit-date', '')
const localPath = opt('local', '')
const level = (opt('level', 'A') || 'A').toUpperCase()
const modes = (opt('modes', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const skin = opt('skin', 'TODO — 取对象首屏 3 个色 + 字体气质')
const previousArg = opt('previous', '')

const base = join(root, '.research', slug)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Read a report's embedded meta block without loading the whole file. */
function readMeta(file) {
  try {
    const fd = readFileSync(file, { encoding: 'utf8', flag: 'r' })
    if (fd.length > 2 * 1024 * 1024) {
      const head = fd.slice(0, 256 * 1024)
      const m = head.match(/<script[^>]*id="report-meta"[^>]*>([\s\S]*?)<\/script>/)
      return m ? JSON.parse(m[1]) : null
    }
    const m = fd.match(/<script[^>]*id="report-meta"[^>]*>([\s\S]*?)<\/script>/)
    return m ? JSON.parse(m[1]) : null
  } catch {
    return null
  }
}

/** All .html files under <root>/.research, one recursion. */
function scanResearch() {
  const dir = join(root, '.research')
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue
    out.push(join(entry.parentPath ?? entry.path, entry.name))
  }
  return out
}

// --- version detection -------------------------------------------------------
const prior = []
const legacy = []
for (const file of scanResearch()) {
  const meta = readMeta(file)
  if (meta && meta.slug === slug) prior.push({ file, meta })
  else if (!meta) legacy.push(file)
}
prior.sort((a, b) => (a.meta.research?.version ?? 0) - (b.meta.research?.version ?? 0))

let version = prior.reduce((max, p) => Math.max(max, p.meta.research?.version ?? 0), 0) + 1
let previous = prior.length ? prior[prior.length - 1] : null
if (previousArg) {
  const prevFile = resolve(previousArg)
  if (!existsSync(prevFile)) {
    console.error(`--previous not found: ${prevFile}`)
    process.exit(2)
  }
  const meta = readMeta(prevFile)
  if (meta) {
    previous = { file: prevFile, meta }
    version = Math.max(version, (meta.research?.version ?? 0) + 1)
  } else {
    // Legacy report without report-meta: it still counts as one prior research.
    previous = { file: prevFile, meta: null }
    version = Math.max(version, 2)
  }
}

const fileName = `${date}-v${version}.html`
const outPath = opt('out', join(base, fileName))
if (existsSync(outPath) && !flag('force')) {
  console.error(`${outPath} already exists; reports are never overwritten (bump the version by re-running)`)
  process.exit(1)
}
mkdirSync(dirname(outPath), { recursive: true })

// --- scaffold ----------------------------------------------------------------
const meta = {
  schema: META_SCHEMA,
  slug,
  title,
  object: { name: title, repo, version: objVersion, commit, commitDate, localPath },
  research: {
    date,
    version,
    level,
    modes,
    contractVersion: CONTRACT_VERSION,
    reader,
    accessSurfaces: [],
    degraded: [],
    decision: 'pending',
    recheck: [],
  },
  verdict: { oneLine: '', kpis: [], fitFor: [], notFor: [] },
  profile: {
    positioning: '',
    goal: '',
    status: '',
    problems: [],
    approach: '',
    features: [],
  },
  claims: [],
  unverified: [],
  selfRefutation: [],
  previous: previous
    ? {
        version: previous.meta?.research?.version ?? null,
        file: relative(root, previous.file).replace(/\\/g, '/'),
        date: previous.meta?.research?.date ?? null,
      }
    : null,
  generatedAt: new Date().toISOString(),
}
const metaJson = JSON.stringify(meta, null, 2).replace(/</g, '\\u003c')

const deltaBlock = version >= 2
  ? `
<div class="delta" id="delta">
<div class="h">本版变化 · 相比 ${previous?.meta?.research?.version ? `v${previous.meta.research.version}（${previous.meta.research.date}）` : '上一版'}</div>
<ul>
<li>对象版本：<code>${esc(previous?.meta?.object?.version || '?')}</code> → <code>${esc(objVersion || '?')}</code></li>
<li>结论是否翻转：<!-- TODO: 是 / 否 + 一句为什么 --></li>
<li>新增功能：<!-- TODO --></li>
<li>消失 / 失效功能：<!-- TODO --></li>
<li>逐条复检：<!-- TODO: 上一版每个功能块 → 仍成立 / 已变化 / 未复查（逐条，不许合并） --></li>
<li>被推翻的旧结论：<!-- TODO: 没有就写"无" --></li>
</ul>
</div>
`
  : ''

const nav = [
  ['brief', '决策简报', '—'],
  ['a1', '进入', '01'],
  ['a2', '安装后', '02'],
  ['a3', '核心链路', '03'],
  ['a4', '承载者', '04'],
  ['a5', '横切', '05'],
  ['appendix-evidence', '证据附录', '附'],
  ['appendix-selfproof', '自证附录', '附'],
  ['appendix-refs', '参考附录', '附'],
]
const navHtml = nav
  .map(([id, label, n], i) => `${i === 1 ? '<div class="sep">五幕</div>\n' : ''}${i === 6 ? '<div class="sep">附录</div>\n' : ''}<a href="#${id}"><span class="n">${n}</span>${esc(label)}</a>`)
  .join('\n')

const objectLine = esc(repo || localPath || title)

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} 调研 · ${date} · v${version}</title>
<style>
/* skin: ${skin} */
${THEME.trim()}
</style>
</head>
<body>
<div class="wrap">
<nav>
<div class="brand">${esc(title)}</div>
<div class="sub">${esc(slug)} · v${version} · ${date}</div>
<a href="#top"><span class="n">—</span>元信息</a>
${navHtml}
</nav>
<main id="top">

<h1>${esc(title)} 调研报告</h1>

<table class="meta">
<tr><th>调研对象</th><td>${objectLine}</td></tr>
<tr><th>版本 / 提交</th><td>${esc(objVersion || '—')}${commit ? ` · ${esc(commit)}` : ''}${commitDate ? ` (${esc(commitDate)})` : ''}</td></tr>
<tr><th>报告版本</th><td>v${version} · 第 ${version} 次调研${previous ? ` · 上一版 ${esc(previous.meta?.research?.date || previous.file)}` : ''}</td></tr>
<tr><th>本地克隆</th><td>${esc(localPath || '—')}</td></tr>
<tr><th>调研方式</th><td>${esc(modes.length ? modes.join(' + ') : '—')}</td></tr>
<tr><th>调研日期</th><td>${date}</td></tr>
</table>

<section id="brief" class="verdict brief">
<h2 class="brief-h">决策简报</h2>
<p class="one"><strong>一句话：</strong><!-- TODO: 它是什么，用一句大白话，≤120 字，不含路径 / 函数名 / 机制名 --></p>
<div class="brief-grid">
<div class="brief-row"><div class="k">给谁用</div><div class="c" data-k="who"><!-- TODO: 谁在什么场景用；谁不该用 --></div></div>
<div class="brief-row"><div class="k">怎么用</div><div class="c" data-k="how"><!-- TODO: 最短路径；不贴代码块 --></div></div>
<div class="brief-row"><div class="k">代价</div><div class="c" data-k="cost"><!-- TODO: 钱 / 时间 / 风险 / 不可逆动作 --></div></div>
<div class="brief-row"><div class="k">本次没做到</div><div class="c" data-k="notdone"><!-- TODO: 未实机 / 未验证 / 没权限；没有就写"无" --></div></div>
<div class="brief-row"><div class="k">该不该试</div><div class="c" data-k="try"><!-- TODO: 采纳 / 试用 / 观察 / 放弃 + 一句理由 --></div></div>
<div class="brief-row"><div class="k">下一步</div><div class="c" data-k="next"><!-- TODO: 一个可执行动作 --></div></div>
</div>
<div class="kpis">
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- TODO: 数字指什么 + 统计范围，例如 15 个顶层命令 · 50 个可执行叶子命令 --></div></div>
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- TODO: 数字指什么 + 统计范围 --></div></div>
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- TODO: 数字指什么 + 统计范围 --></div></div>
</div>
</section>

<!-- 术语表（可选，≤5 行；同一行话出现 ≥2 次或影响判断时才启用）
<div class="glossary">
<h3>术语</h3>
<dl>
<dt>术语</dt><dd>一句人话 + 为什么影响判断</dd>
</dl>
</div>
-->

<section id="a1" data-act="entry">
<h2><span class="n">01</span>进入：第一次怎么跑起来</h2>
<p class="act-q">这一幕回答：第一次怎么跑起来，停在哪算成功。</p>
<p><!-- TODO: 最短路径 + 状态交接（S0 → S1） --></p>
<table data-table="first-run">
<thead><tr><th>宿主/平台</th><th>前置条件</th><th>安装/接入</th><th>第一条命令/动作</th><th>第一个可见结果</th><th>卡点</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
</table>
</section>

<section id="a2" data-act="delta">
<h2><span class="n">02</span>安装后：环境多了什么</h2>
<p class="act-q">这一幕回答：装完多了什么、变了什么、怎么退。</p>
<p>先写好影响，再写代价。状态交接：S1 → S1'。</p>
<table data-table="delta">
<thead><tr><th>宿主/平台</th><th>新增资产</th><th>被激活的能力</th><th>好影响</th><th>代价/坏影响</th><th>没变的东西</th><th>回滚</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
</table>
</section>

<section id="a3" data-act="flow">
<h2><span class="n">03</span>核心链路：数据从哪来、经过哪些状态、变成什么</h2>
<p class="act-q">这一幕回答：主链路是否闭合，输出能不能验证。</p>

<h3 id="a3-input">输入</h3>
<table data-table="input">
<thead><tr><th>输入</th><th>来源/路径</th><th>最小单位</th><th>读什么</th><th>不读什么</th><th>权限/隐私</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
</table>
<p>状态交接：S1 → S2。</p>

<h3 id="a3-process">处理（状态表）</h3>
<table data-flow="state">
<thead><tr><th>#</th><th>输入状态</th><th>执行者</th><th>处理</th><th>输出状态</th><th>失败/降级</th><th>证据</th></tr></thead>
<tbody>
<tr data-state="S1"><td>1</td><td>S1</td><td><!-- TODO --></td><td></td><td>S2</td><td></td><td></td></tr>
<tr data-state="S2"><td>2</td><td>S2</td><td><!-- TODO --></td><td></td><td>S3</td><td></td><td></td></tr>
<tr data-state="S3"><td>3</td><td>S3</td><td><!-- TODO --></td><td></td><td>S4</td><td></td><td></td></tr>
</tbody>
</table>
<p>状态交接：S2 → S3 → S4。主链路超过 8 跳时合并中间跳，并在正文说明合并了什么。</p>

<h3>功能档案</h3>
<p>一个功能一块，固定三段；复制到 ≥6 块。功能索引里的每一行都要在这里有一块。</p>
<div class="fn" id="fn-1">
<h4>fn-1 · <!-- 功能名（用户语言） --></h4>
<p><strong>产品意图</strong>　<!-- TODO: 它想让用户得到什么；用户在这里会假设什么；这个设计的取舍。禁止出现代码名词。 --></p>
<p><strong>代码确认</strong>　<!-- TODO: 路径:行号 —— 数据从哪来、谁算出这个数、关键常量是多少。边界：拿不到数据时怎么显示；失败时静默还是报错。 --></p>
<p><strong>判定</strong>　<!-- TODO: 属实 / 打折扣 / 只是表面 + 一句为什么，指出确认到了哪一行。 --></p>
<p class="dim">证据：<!-- TODO: 图号 / 命令 / 数字 --></p>
</div>

<h3 id="a3-output">输出</h3>
<table data-table="output">
<thead><tr><th>产物</th><th>位置/格式</th><th>怎么确认是真的</th><th>状态语义</th><th>误判风险</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td><td></td></tr></tbody>
</table>
<p>状态交接：S4 → Sn。</p>
</section>

<section id="a4" data-act="carrier">
<h2><span class="n">04</span>承载者：谁维持流程和状态</h2>
<p class="act-q">这一幕回答：每个阶段都有 owner、state store、failure path。</p>
<table data-table="carrier">
<thead><tr><th>阶段</th><th>承载者</th><th>状态存放</th><th>谁能读/写</th><th>中断/恢复</th><th>清理</th></tr></thead>
<tbody>
<tr><td>S1</td><td><!-- TODO --></td><td></td><td></td><td></td><td></td></tr>
<tr><td>S2</td><td><!-- TODO --></td><td></td><td></td><td></td><td></td></tr>
<tr><td>S3</td><td><!-- TODO --></td><td></td><td></td><td></td><td></td></tr>
</tbody>
</table>
</section>

<section id="a5" data-act="crosscuts">
<h2><span class="n">05</span>横切：主链路没讲清但影响判断的点</h2>
<p class="act-q">这一幕只留会改变判断的点。</p>

<h3>5.1 会话/数据范围与采样</h3>
<p><!-- TODO: 覆盖了哪些会话 / 数据；采样多少；哪些没覆盖 --></p>

<h3>5.2 使用模式</h3>
<p><!-- TODO: 单人 / 团队 / 自动化；只读 / 写入 --></p>

<h3>5.3 影响面</h3>
<table data-table="impact">
<thead><tr><th>对象</th><th>影响</th><th>证据</th></tr></thead>
<tbody>
<tr data-impact="human"><td>人</td><td><!-- TODO --></td><td></td></tr>
<tr data-impact="host"><td>宿主</td><td><!-- TODO --></td><td></td></tr>
<tr data-impact="object"><td>对象</td><td><!-- TODO --></td><td></td></tr>
<tr data-impact="artifact"><td>产物</td><td><!-- TODO --></td><td></td></tr>
</tbody>
</table>

<h3>5.4 成本与维护</h3>
<p><!-- TODO: 钱 / 时间 / 依赖 / 维护成本 --></p>

<h3>5.5 未验证与待拍板</h3>
<table data-table="unverified">
<thead><tr><th>缺什么</th><th>为什么没验</th><th>错了会怎样</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td></tr></tbody>
</table>
</section>

<section id="appendix-evidence">
<h2><span class="n">附</span>证据附录</h2>
<h3>宣称 / 可见 / 实现</h3>
<table>
<thead><tr><th>宣称</th><th>可见</th><th>实现</th><th>差集解释</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td><!-- TODO: 路径:行号 或 "无实现" --></td><td></td></tr></tbody>
</table>

<h3>功能索引</h3>
<p>一行一个功能，只做索引，不写结论；末列链到 #fn-N。</p>
<table>
<thead><tr><th>功能</th><th>入口</th><th>详情</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td><a href="#fn-1">→ fn-1</a></td></tr></tbody>
</table>

<h3>自我反驳</h3>
<ol>
<li>先以为 &lt;A&gt;。更正：&lt;B&gt;。证据：&lt;路径:行号 / 截图 / 实测&gt;</li>
<li>先以为 &lt;A&gt;。更正：&lt;B&gt;。证据：&lt;路径:行号 / 截图 / 实测&gt;</li>
<li>先以为 &lt;A&gt;。更正：&lt;B&gt;。证据：&lt;路径:行号 / 截图 / 实测&gt;</li>
</ol>
</section>

<section id="appendix-selfproof">
<h2><span class="n">附</span>自证附录</h2>
<h3>访问面与驱动</h3>
<table>
<thead><tr><th>形态</th><th>驱动</th><th>探针结果</th><th>备注</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td></tr></tbody>
</table>

<h3>需求回归</h3>
<table>
<thead><tr><th>#</th><th>用户原话（摘）</th><th>转成的验收项</th><th>落在哪里</th><th>状态</th></tr></thead>
<tbody><tr><td>1</td><td><!-- TODO --></td><td></td><td></td><td>✅ / ⏳ / ❌</td></tr></tbody>
</table>

<h3>读者验收</h3>
<p><!-- TODO: 交付前由独立 reader 完成三段验收，正文填入：[读者验收] 第一屏 Q1 → A1 … Q7 → A7；主线 M1 → A1 … M5 → A5；证据 F1 → A1 … F3 → A3；未解释词：&lt;词 or 无&gt; --></p>

<h3>非变更自证</h3>
<pre><code>操作区间：&lt;开始&gt; → &lt;结束&gt;
写操作：0 次
外部调用：&lt;哪些操作花了钱 / 额度&gt;
被改动文件：&lt;路径 + mtime&gt;（没有就写"无"）
自证：&lt;关键计数&gt; 开始 = 结束</code></pre>

<h3>本版变化</h3>
${version >= 2 ? deltaBlock : '<p>首次调研，无上一版。</p>'}
</section>

<section id="appendix-refs">
<h2><span class="n">附</span>参考附录</h2>
<h3>截图索引</h3>
<table>
<thead><tr><th>图号</th><th>内容</th><th>所在幕</th></tr></thead>
<tbody><tr><td>—</td><td>—</td><td>—</td></tr></tbody>
</table>

<h3>源码引用</h3>
<pre><code>&lt;路径:行号&gt; —— &lt;它证明了什么&gt;</code></pre>

<h3>复现命令</h3>
<pre><code>&lt;命令&gt;</code></pre>
</section>

</main>
</div>
<script type="application/json" id="report-meta">
${metaJson}
</script>
</body>
</html>
`

writeFileSync(outPath, html, 'utf8')

// --- index -------------------------------------------------------------------
const indexPath = join(base, 'index.json')
let index = { schema: INDEX_SCHEMA, slug, title, repo, updatedAt: '', reports: [] }
if (existsSync(indexPath)) {
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf8'))
  } catch {
    console.warn(`index.json unreadable, rewriting: ${indexPath}`)
  }
}
index.schema = INDEX_SCHEMA
index.slug = slug
index.title = title
index.repo = repo || index.repo || ''
index.updatedAt = new Date().toISOString()
index.reports = (index.reports || []).filter((r) => r.version !== version)
index.reports.push({
  version,
  file: relative(base, outPath).replace(/\\/g, '/'),
  date,
  level,
  objectVersion: objVersion,
  commit,
  title,
  contractVersion: CONTRACT_VERSION,
  reader,
  generatedAt: new Date().toISOString(),
  decision: 'pending',
})
index.reports.sort((a, b) => a.version - b.version)
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8')

// --- report ------------------------------------------------------------------
console.log(outPath)
console.log(`version  v${version}  (${version === 1 ? '第一次调研' : `第 ${version} 次调研，上一版 ${previous?.meta?.research?.date ?? basename(previous.file)}`})`)
console.log(`reader   ${reader}`)
if (previous?.meta?.research?.date) {
  console.log(`previous ${relative(root, previous.file).replace(/\\/g, '/')}`)
  console.log('         → 必须填 "本版变化" 块和 meta.previous，不能静默重写')
}
const strays = legacy.filter((f) => !resolve(f).startsWith(base + sep))
if (strays.length) {
  console.log(`legacy   ${strays.length} 个旧格式报告（无 report-meta，无法自动判定对象）：`)
  for (const f of strays.slice(0, 8)) console.log(`         ${relative(root, f).replace(/\\/g, '/')}`)
  console.log('         若其中有同一对象的旧报告，用 --previous <file> 重跑以继承版本号')
}
console.log(`index    ${relative(root, indexPath).replace(/\\/g, '/')}`)
console.log('brief    7 行：一句话 / 给谁用 / 怎么用 / 代价 / 本次没做到 / 该不该试 / 下一步；3 个 KPI，标签写清数字含义 + 统计范围')
console.log('glossary 可选 ≤5 行：同一行话出现 ≥2 次或影响判断时才启用，放在 brief 之后')
console.log('acts     a1 进入 → a2 安装后 → a3 核心链路 → a4 承载者 → a5 横切；五幕是状态链，不是五个章节')
console.log('state    状态表 ≥3 行：输入状态 / 执行者 / 处理 / 输出状态 / 失败/降级 / 证据；功能挂在状态节点上')
console.log('next     fill → node scripts/check_doc.mjs ' + relative(root, outPath).replace(/\\/g, '/'))