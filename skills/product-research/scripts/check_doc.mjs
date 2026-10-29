#!/usr/bin/env node
/**
 * Structural contract check for a product-research report (HTML).
 *
 *   node check_doc.mjs report.html [--allow-external-shots] [--allow-inline-images] [--root <dir>]
 *
 * Enforces the delivery contract:
 *   - filename <YYYY-MM-DD>-v<N>.html inside .research/<slug>/
 *   - embedded <script id="report-meta"> (agent-readable) with required fields,
 *     consistent with filename / directory / index.json
 *   - fixed metadata table, sections s1..s9, 本版变化 block for v>=2
 *   - the skill-owned theme marker (no object-derived restyling)
 *   - images inlined as data URIs and collapsed inside <details>
 *   - balanced tags, unique ids, resolvable anchors, sequential figures
 *
 * Legacy flags (reports predating the v2 contract):
 *   --allow-external-shots   permit shots/*.png references
 *   --allow-inline-images    permit expanded images outside <details>
 *   --legacy                 skip contract checks (naming / meta / theme / sections),
 *                            keep structural checks — read-only validation of old reports
 *
 * Exit 1 when any check fails.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const flagValue = (n) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
const root = flagValue('--root')
const allowExternal = flag('--allow-external-shots')
const allowInline = flag('--allow-inline-images')
const legacy = flag('--legacy')
const MAX_BYTES = 8 * 1024 * 1024
const META_SCHEMA = 'product-research/report@1'

if (!file || !existsSync(file)) {
  console.log('usage: node check_doc.mjs <file.html> [--allow-external-shots] [--allow-inline-images] [--legacy] [--root <dir>]')
  process.exit(2)
}

const raw = readFileSync(file, 'utf8')
const baseDir = root ? resolve(root) : dirname(resolve(file))

const text = raw
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<pre\b[\s\S]*?<\/pre>/gi, '')

const TAGS = [
  'div', 'span', 'p', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'a', 'code', 'b', 'i', 'em',
  'strong', 'nav', 'details', 'summary', 'section', 'article', 'header', 'footer',
  'svg', 'g', 'defs', 'marker', 'text', 'tspan', 'button', 'label', 'main',
]

const fails = []
const warns = []
const ok = []

// --- tags --------------------------------------------------------------------
let tagProblem = false
for (const tag of TAGS) {
  const open = (text.match(new RegExp(`<${tag}(?=[\\s>])`, 'g')) || []).length
  const close = (text.match(new RegExp(`</${tag}>`, 'g')) || []).length
  if (open !== close) {
    fails.push(`tag <${tag}>: ${open} open / ${close} close`)
    tagProblem = true
  }
}
if (!tagProblem) ok.push('tags balanced')

// --- contract (v2 reports) ---------------------------------------------------
let meta = null
if (legacy) {
  ok.push('legacy mode: contract checks skipped (naming / meta / theme / sections)')
} else {
// --- theme: structure fixed, skin declared ----------------------------------
const styleTags = (raw.match(/<style\b/gi) || []).length
if (styleTags !== 1) fails.push(`expected exactly 1 <style> block, found ${styleTags}`)
else if (!/--sk-bg:/.test(raw) || !/--sk-ink:/.test(raw)) fails.push('skin tokens missing (--sk-bg / --sk-ink): style was hand-rolled, start from assets/report-theme.css')
else if (!/\bskin:\s*\S/.test(raw)) fails.push('skin not declared: add "/* skin: <object> UI */" at the top of <style>')
else ok.push('structure baseline + declared skin')

// --- embedded meta (agent-readable) ------------------------------------------
const metaMatch = raw.match(/<script[^>]*id="report-meta"[^>]*>([\s\S]*?)<\/script>/)
if (!metaMatch) {
  fails.push('missing <script id="report-meta"> — agent-readable metadata is part of the contract')
} else {
  try {
    meta = JSON.parse(metaMatch[1])
  } catch (e) {
    fails.push(`report-meta is not valid JSON: ${e.message}`)
  }
}
if (meta) {
  const req = [
    ['schema', meta.schema === META_SCHEMA],
    ['slug', typeof meta.slug === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(meta.slug)],
    ['title', typeof meta.title === 'string' && meta.title.length > 0],
    ['object.name', typeof meta.object?.name === 'string' && meta.object.name.length > 0],
    ['research.date', /^\d{4}-\d{2}-\d{2}$/.test(meta.research?.date ?? '')],
    ['research.level', /^[A-E]$/.test(meta.research?.level ?? '')],
    ['research.version', Number.isInteger(meta.research?.version) && meta.research.version >= 1],
    ['verdict.oneLine', typeof meta.verdict?.oneLine === 'string' && meta.verdict.oneLine.trim().length > 0],
    ['verdict.kpis', Array.isArray(meta.verdict?.kpis) && meta.verdict.kpis.length === 3],
    ['profile.positioning', typeof meta.profile?.positioning === 'string' && meta.profile.positioning.trim().length > 0],
    ['profile.features', Array.isArray(meta.profile?.features) && meta.profile.features.length > 0],
    ['selfRefutation', Array.isArray(meta.selfRefutation) && meta.selfRefutation.length >= 3],
  ]
  const bad = req.filter(([, pass]) => !pass).map(([name]) => name)
  if (bad.length) fails.push(`report-meta incomplete: ${bad.join(', ')}`)
  else ok.push('report-meta complete')
}

// --- filename / directory / index consistency --------------------------------
const name = basename(resolve(file))
const m = name.match(/^(\d{4}-\d{2}-\d{2})-v(\d+)\.html$/)
if (!m) {
  fails.push(`filename must be <YYYY-MM-DD>-v<N>.html, got "${name}" (see report-kernel 「文件与命名」)`)
} else if (meta) {
  const before = fails.length
  if (m[1] !== meta.research?.date) fails.push(`filename date ${m[1]} != research.date ${meta.research?.date}`)
  if (Number(m[2]) !== meta.research?.version) fails.push(`filename v${m[2]} != research.version ${meta.research?.version}`)
  const parent = basename(dirname(resolve(file)))
  if (parent !== meta.slug) fails.push(`parent dir "${parent}" != slug "${meta.slug}" (.research/<slug>/)`)
  if (fails.length === before) ok.push('filename / dir / meta consistent')
}

const indexPath = resolve(dirname(resolve(file)), 'index.json')
if (meta && existsSync(indexPath)) {
  try {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    const entry = (index.reports || []).find((r) => r.version === meta.research?.version)
    if (!entry) fails.push(`index.json has no entry for v${meta.research?.version} — regenerate with new_report.mjs`)
    else if (entry.file !== name) fails.push(`index.json v${meta.research.version} points to "${entry.file}", file is "${name}"`)
    else ok.push('index.json entry matches')
  } catch {
    fails.push('index.json is not valid JSON')
  }
} else if (meta) {
  warns.push('no index.json next to the report — cross-version lookup will fall back to filesystem scan')
}

// --- 本版变化 for v>=2 --------------------------------------------------------
if (meta) {
  const v = meta.research?.version ?? 0
  if (v >= 2) {
    if (!/id="delta"/.test(raw)) fails.push('v>=2 report must carry a "本版变化" block (id="delta")')
    else if (!meta.previous || typeof meta.previous !== 'object') fails.push('v>=2 report must set report-meta.previous')
    else ok.push(`v${v} carries delta block + previous pointer`)
  } else if (meta.previous) {
    warns.push('v1 report has previous set — check research.version')
  }
}

// --- metadata table ----------------------------------------------------------
const metaTable = raw.match(/<table class="meta">[\s\S]*?<\/table>/)
if (!metaTable) {
  fails.push('missing <table class="meta"> (fixed 6-row metadata header)')
} else {
  const labels = ['调研对象', '版本 / 提交', '报告版本', '本地克隆', '调研方式', '调研日期']
  const missing = labels.filter((l) => !metaTable[0].includes(l))
  if (missing.length) fails.push(`metadata table missing rows: ${missing.join(', ')}`)
  else ok.push('metadata table complete')
}

// --- fixed sections ----------------------------------------------------------
const sectionIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']
const missingSections = sectionIds.filter((id) => !raw.includes(`id="${id}"`))
if (missingSections.length) fails.push(`missing sections: ${missingSections.join(', ')} (fixed 9 sections)`)
else {
  const order = sectionIds.map((id) => raw.indexOf(`id="${id}"`))
  const inOrder = order.every((pos, i) => i === 0 || pos > order[i - 1])
  if (!inOrder) fails.push(`sections out of order: ${sectionIds.join(' → ')}`)
  else ok.push('9 sections in order')
}

// verdict card
const kpiCount = (raw.match(/<div class="kpi"/g) || []).length
if (!/class="verdict"/.test(raw)) fails.push('missing verdict card (div.verdict) at the top')
else if (kpiCount !== 3) warns.push(`verdict card has ${kpiCount} KPI tile(s), expected 3`)
else ok.push('verdict card present')

// --- function confirmation blocks (one per feature) --------------------------
const fnBlocks = [...raw.matchAll(/<div class="fn" id="(fn-\d+)">/g)]
const fnLinks = new Set([...raw.matchAll(/href="#(fn-\d+)"/g)].map((x) => x[1]))
if (fnBlocks.length < 6) {
  fails.push(`function blocks: ${fnBlocks.length} (need >= 6 — one block per feature, 产品意图 → 代码确认 → 判定)`)
} else {
  const broken = []
  for (let i = 0; i < fnBlocks.length; i++) {
    const from = fnBlocks[i].index
    const to = i + 1 < fnBlocks.length ? fnBlocks[i + 1].index : raw.indexOf('</section>', from)
    const block = raw.slice(from, to > 0 ? to : undefined)
    const missing = ['产品意图', '代码确认', '判定'].filter((m) => !block.includes(m))
    if (missing.length) broken.push(`${fnBlocks[i][1]} missing ${missing.join('/')}`)
    else if (!/[A-Za-z0-9_./-]+\.(ts|js|tsx|vue|mjs|py|go|rs|html|css):\d+/.test(block)) broken.push(`${fnBlocks[i][1]} 无 路径:行号`)
  }
  if (broken.length) fails.push(`function blocks incomplete: ${broken.join('; ')}`)
  else ok.push(`function blocks: ${fnBlocks.length} × (意图 / 代码 / 判定)`)

  const unlinked = fnBlocks.map((m) => m[1]).filter((id) => !fnLinks.has(id))
  if (unlinked.length) warns.push(`function blocks not linked from §4 index: ${unlinked.join(', ')}`)
}

// --- depth floor -------------------------------------------------------------
const codeRefs = [...raw.matchAll(/[A-Za-z0-9_./-]+\.(ts|js|tsx|vue|mjs|py|go|rs|html|css):\d+/g)].map((x) => x[0])
const codeFiles = new Set(codeRefs.map((r) => r.replace(/:\d+$/, '')))
const level = meta?.research?.level ?? 'A'
if ((level === 'A' || level === 'B') && fnBlocks.length >= 6) {
  const singleFile = meta?.research?.singleFile === true
  if (codeRefs.length < 15) fails.push(`source refs: ${codeRefs.length} (need >= 15 for level ${level})`)
  else if (!singleFile && codeFiles.size < 6) fails.push(`distinct source files: ${codeFiles.size} (need >= 6; set research.singleFile for single-file products)`)
  else ok.push(`source refs: ${codeRefs.length} across ${codeFiles.size} files${singleFile ? ' [single-file]' : ''}`)
}
}

// --- recheck for re-research -------------------------------------------------
if (meta && (meta.research?.version ?? 1) >= 2) {
  const re = meta.research.recheck
  const valid = Array.isArray(re) && re.length > 0 && re.every((r) => ['confirmed', 'changed', 'unchecked'].includes(r.status))
  if (!valid) fails.push('v>=2 must fill research.recheck (confirmed / changed / unchecked per previous finding)')
}

// --- ids / anchors -----------------------------------------------------------
const ids = [...raw.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])
const dupIds = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))]
if (dupIds.length) fails.push(`duplicate ids: ${dupIds.join(', ')}`)
else ok.push(`ids unique (${ids.length})`)

const idSet = new Set(ids)
const refs = [...new Set([...raw.matchAll(/href="#([^"]+)"/g)].map((x) => x[1]))]
const dangling = refs.filter((h) => !idSet.has(h))
if (dangling.length) fails.push(`dangling anchors: ${dangling.join(', ')}`)
else ok.push(`anchors resolve (${refs.length})`)

// --- figures -----------------------------------------------------------------
const figs = [...raw.matchAll(/(?:<figcaption[^>]*>|<summary[^>]*>)\s*(?:<[^>]+>\s*)?图\s*(\d+)\s*·/g)].map((x) => Number(x[1]))
if (figs.length === 0) {
  ok.push('no numbered figures')
} else if (figs.some((v, i) => v !== i + 1)) {
  fails.push(`figure numbering: ${figs.join(',')} (expected 1..${figs.length})`)
} else {
  ok.push(`figures sequential 1..${figs.length}`)
}

// --- images ------------------------------------------------------------------
const imgTags = [...raw.matchAll(/<img\b[^>]*>/g)].map((x) => x[0])
const srcOf = (tag) => (tag.match(/\ssrc="([^"]*)"/) || [])[1] || ''
const external = imgTags.filter((t) => !/^data:/.test(srcOf(t)))
const inlineData = imgTags.length - external.length

if (external.length) {
  if (allowExternal) {
    const missing = external
      .map(srcOf)
      .filter((s) => !/^(https?:|data:)/.test(s))
      .filter((s) => !existsSync(resolve(baseDir, s)))
    if (missing.length) fails.push(`missing images: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5})` : ''}`)
    else ok.push(`external images resolve (${external.length}) [legacy mode]`)
  } else {
    fails.push(`external image refs: ${external.length} (single-file requires data URIs; use --allow-external-shots for legacy)`)
  }
} else {
  ok.push(`images inlined (${inlineData} data URIs)`)
}

// Raster images must be collapsed inside <details>
const outsideDetails = text.replace(/<details\b[\s\S]*?<\/details>/gi, '')
const expanded = (outsideDetails.match(/<img\b/g) || []).length
if (expanded > 0) {
  if (allowInline) ok.push(`expanded images allowed (${expanded}) [legacy mode]`)
  else fails.push(`expanded images: ${expanded} raster image(s) outside <details>`)
} else if (imgTags.length) {
  ok.push('all raster images collapsed')
}

// Image hygiene
const noSize = imgTags.filter((t) => !/\swidth="\d+"/.test(t) || !/\sheight="\d+"/.test(t))
const noLazy = imgTags.filter((t) => !/loading="lazy"/.test(t))
if (noSize.length) warns.push(`images without fixed width/height: ${noSize.length}`)
if (noLazy.length) warns.push(`images without loading="lazy": ${noLazy.length}`)

// Details hygiene
const detailsCount = (raw.match(/<details\b/g) || []).length
const summaryCount = (raw.match(/<summary\b/g) || []).length
if (detailsCount !== summaryCount) warns.push(`<details> without <summary>: ${detailsCount - summaryCount}`)

// Size
const bytes = statSync(resolve(file)).size
if (bytes > MAX_BYTES) warns.push(`file is ${(bytes / 1048576).toFixed(1)} MB (> 8 MB, recompress screenshots)`)

const lines = raw.split('\n').length
const tables = (raw.match(/<table[\s>]/g) || []).length

for (const line of ok) console.log(`  ok   ${line}`)
for (const line of warns) console.log(`  warn ${line}`)
for (const line of fails) console.log(`  FAIL ${line}`)
console.log(`  --   ${lines} lines · ${(bytes / 1024).toFixed(0)} KB · ${figs.length} figures · ${tables} tables · ${detailsCount} details`)

process.exit(fails.length ? 1 : 0)
