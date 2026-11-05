#!/usr/bin/env node
/**
 * Scaffold a product-research report with the skill-owned theme and metadata.
 *
 *   node new_report.mjs --slug context-lens --title "Context Lens" \
 *     [--repo owner/repo] [--version v0.8.0] [--commit ce17b9d] [--commit-date 2026-10-21] \
 *     [--local <path>] [--level A] [--modes 实机操作,源码] [--date 2026-10-29] \
 *     [--previous <file>] [--root <workspace>] [--out <file>]
 *
 * Writes <root>/.research/<slug>/<YYYY-MM-DD>-v<N>.html and maintains
 * <root>/.research/<slug>/index.json (cross-version registry).
 *
 * N is derived from prior reports that carry a report-meta block with the same
 * slug. Existing files are never overwritten: a re-run on the same day creates
 * v2, v3, ...
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const THEME = readFileSync(join(SKILL_DIR, 'assets', 'report-theme.css'), 'utf8')
const META_SCHEMA = 'product-research/report@1'
const INDEX_SCHEMA = 'product-research/index@1'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)

const slug = opt('slug')
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.log('usage: node new_report.mjs --slug <kebab-case> --title "<name>" [--repo owner/repo] [--version vX] [--commit sha] [--commit-date YYYY-MM-DD] [--local <path>] [--level A|B|C|D|E] [--modes a,b] [--date YYYY-MM-DD] [--previous <file>] [--skin "<object> UI"] [--root <dir>] [--out <file>]')
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
  ['s1', '产品画像'],
  ['s2', '范围与自证'],
  ['s3', '宣称 / 可见 / 实现'],
  ['s4', '功能地图'],
  ['s5', '主旅程实测'],
  ['s6', '功能确认'],
  ['s7', '机制与边界'],
  ['s8', '未验证区'],
  ['s9', '待拍板'],
  ['appendix', '附录'],
]
const navHtml = nav.map(([id, label], i) => `<a href="#${id}"><span class="n">${i < 9 ? `0${i + 1}` : '附'}</span>${esc(label)}</a>`).join('\n')

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
<a href="#top"><span class="n">—</span>元信息与结论</a>
<div class="sep">正文</div>
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
${deltaBlock}
<div class="verdict">
<p class="one"><strong>一句话：</strong><!-- TODO: 它是什么，用一句大白话 --></p>
<div class="kpis">
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- 口径 --></div></div>
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- 口径 --></div></div>
<div class="kpi"><div class="v"><!-- TODO --></div><div class="l"><!-- 口径 --></div></div>
</div>
<p><strong>适合谁：</strong><!-- TODO --></p>
<p><strong>不适合谁：</strong><!-- TODO --></p>
</div>

<section>
<h2 id="s1"><span class="n">01</span>产品画像</h2>
<h3>1.1 定位：它是什么，不是什么</h3>
<p><!-- TODO: 一句话 + 替代谁 / 被谁替代 --></p>

<h3>1.2 目标：它想解决谁的什么问题</h3>
<p><!-- TODO: README / release note 原话 + 目标是否漂移 --></p>

<h3>1.3 现状：版本、活跃度、维护状态</h3>
<p><!-- TODO: 可核实的数字，带口径与日期 --></p>

<h3>1.4 问题：用户实际遇到什么</h3>
<p><!-- TODO: issue / 报错 / 自己卡住的地方；与"它想解决的问题"分开写 --></p>

<h3>1.5 解决方法：核心机制与关键取舍</h3>
<p><!-- TODO: 一句话机制 + 为什么这样解 + 付出了什么代价 --></p>
<p class="dim">功能细节不在这里写，下沉到第 6 段：一个功能一块「产品意图 → 代码确认 → 判定」。</p>
</section>

<section>
<h2 id="s2"><span class="n">02</span>范围、边界与自证</h2>
<h3>访问面与驱动</h3>
<table>
<thead><tr><th>形态</th><th>驱动</th><th>探针结果</th><th>备注</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td></tr></tbody>
</table>
<h3>降级声明</h3>
<p><!-- TODO: 哪些能力只来自源码 / 文档 --></p>
<h3>需求回归</h3>
<table>
<thead><tr><th>#</th><th>用户原话（摘）</th><th>转成的验收项</th><th>落在哪里</th><th>状态</th></tr></thead>
<tbody><tr><td>1</td><td><!-- TODO --></td><td></td><td></td><td>✅ / ⏳ / ❌</td></tr></tbody>
</table>
<h3>非变更自证</h3>
<pre><code>操作区间：<开始> → <结束>
写操作：0 次
外部调用：<哪些操作花了钱 / 额度>
被改动文件：<路径 + mtime>（没有就写"无"）
自证：<关键计数> 开始 = 结束</code></pre>
</section>

<section>
<h2 id="s3"><span class="n">03</span>宣称 / 可见 / 实现</h2>
<table>
<thead><tr><th>宣称</th><th>可见</th><th>实现</th><th>差集解释</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td><td></td></tr></tbody>
</table>
</section>

<section>
<h2 id="s4"><span class="n">04</span>功能地图</h2>
<h3>入口清单</h3>
<p><!-- TODO: 入口 / 屏幕 / 状态 / 动作 / 权限 五张清单 --></p>
<h3>功能索引</h3>
<p>表里只写入口与状态，结论在第 6 段。一个功能一行，末列链到对应的功能块。</p>
<table>
<thead><tr><th>功能</th><th>入口</th><th>用户得到什么</th><th>状态</th><th>详情</th></tr></thead>
<tbody>
<tr><td><!-- TODO --></td><td></td><td></td><td>✅ / ⏳ / ❌</td><td><a href="#fn-1">→ fn-1</a></td></tr>
</tbody>
</table>
</section>

<section>
<h2 id="s5"><span class="n">05</span>主旅程实测</h2>
<p><!-- TODO: J1..Jn：目标 → 操作 → 看到 → 卡在哪 --></p>
</section>

<section>
<h2 id="s6"><span class="n">06</span>功能确认</h2>
<p>一个功能一块，块数 = 第 4 段索引表的行数。三段顺序不许改。</p>

<div class="fn" id="fn-1">
<h3>fn-1 · <!-- 功能名（用户语言） --></h3>
<p><strong>产品意图</strong>　<!-- TODO: 它想让用户得到什么；用户在这里会假设什么；这个设计的取舍。禁止出现代码名词。 --></p>
<p><strong>代码确认</strong>　<!-- TODO: 路径:行号 —— 数据从哪来、谁算出这个数、关键常量是多少。边界：拿不到数据时怎么显示；失败时静默还是报错。 --></p>
<p><strong>判定</strong>　<!-- TODO: 属实 / 打折扣 / 只是表面 + 一句为什么，指出确认到了哪一行。 --></p>
<p class="dim">证据：<!-- TODO: 图号 / 命令 / 数字 --></p>
</div>

<h3>自我反驳</h3>
<pre><code>先以为 <A>。更正：<B>。证据：<路径:行号 / 截图 / 实测></code></pre>
</section>

<section>
<h2 id="s7"><span class="n">07</span>机制、边界与失效</h2>
<p><!-- TODO: 数据流 · 关键常量 · 静默降级清单 · 维护成本 --></p>
</section>

<section>
<h2 id="s8"><span class="n">08</span>未验证区</h2>
<table>
<thead><tr><th>缺什么</th><th>为什么没验</th><th>错了会怎样</th></tr></thead>
<tbody><tr><td><!-- TODO --></td><td></td><td></td></tr></tbody>
</table>
</section>

<section>
<h2 id="s9"><span class="n">09</span>待拍板</h2>
<p><!-- TODO: 交给用户的判断，每条给默认建议 --></p>
</section>

<section id="appendix">
<h2><span class="n">附</span>附录</h2>
<h3>A 截图索引</h3>
<table>
<thead><tr><th>图号</th><th>内容</th><th>所在段</th></tr></thead>
<tbody><tr><td>—</td><td>—</td><td>—</td></tr></tbody>
</table>
<h3>B 源码引用</h3>
<pre><code>&lt;路径:行号&gt; —— &lt;它证明了什么&gt;</code></pre>
<h3>C 复现命令</h3>
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
  generatedAt: new Date().toISOString(),
  decision: 'pending',
})
index.reports.sort((a, b) => a.version - b.version)
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8')

// --- report ------------------------------------------------------------------
console.log(outPath)
console.log(`version  v${version}  (${version === 1 ? '第一次调研' : `第 ${version} 次调研，上一版 ${previous?.meta?.research?.date ?? basename(previous.file)}`})`)
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
console.log('next     fill sections → node scripts/check_doc.mjs ' + relative(root, outPath).replace(/\\/g, '/'))
