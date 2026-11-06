#!/usr/bin/env node
/**
 * Structural contract check for a product-research report (HTML).
 *
 *   node check_doc.mjs report.html [--allow-external-shots] [--allow-inline-images] [--root <dir>]
 *
 * Contract versions:
 *   - contractVersion >= 3: one-screen brief + five acts + three evidence appendices
 *   - contractVersion === 2: v2 readability checks + nine sections s1..s9
 *   - no contractVersion / < 2: legacy, nine-section structure check only (no brief required)
 *
 * Preserved checks: filename <YYYY-MM-DD>-v<N>.html inside .research/<slug>/,
 * embedded <script id="report-meta">, fixed metadata table, theme/skin marker,
 * function blocks, depth floor, recheck, ids/anchors, figures, images.
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
const READER_MODES = ['evaluator', 'operator', 'maintainer']

if (!file || !existsSync(file)) {
  console.log('usage: node check_doc.mjs <file.html> [--allow-external-shots] [--allow-inline-images] [--legacy] [--root <dir>]')
  process.exit(2)
}

const raw = readFileSync(file, 'utf8')
const baseDir = root ? resolve(root) : dirname(resolve(file))
const clean = raw
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
const text = clean.replace(/<pre\b[\s\S]*?<\/pre>/gi, '')

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

/**
 * Section by id, with nested-section depth tracking.
 * The id may sit on the <section> itself (v3) or on its <h2> (v2/legacy),
 * so locate the enclosing section rather than requiring the id on the tag.
 */
function sectionRangeFrom(html, id) {
  const idMatch = new RegExp(`\\sid="${id}"`).exec(html)
  if (!idMatch) return null
  const openRe = /<section\b[^>]*>/gi
  let open = null
  let m
  while ((m = openRe.exec(html)) && m.index < idMatch.index) open = m
  if (!open) return null
  const start = open.index
  const openEnd = start + open[0].length
  const tagRe = /<\/?section\b[^>]*>/gi
  tagRe.lastIndex = openEnd
  let depth = 1
  while ((m = tagRe.exec(html))) {
    if (m[0][1] === '/') depth--
    else depth++
    if (depth === 0) {
      return {
        start,
        openEnd,
        end: m.index + m[0].length,
        inner: html.slice(openEnd, m.index),
        html: html.slice(start, m.index + m[0].length),
      }
    }
  }
  return { start, openEnd, end: html.length, inner: html.slice(openEnd), html: html.slice(start) }
}
const sectionRange = (id) => sectionRangeFrom(clean, id)
const sectionHtml = (id) => sectionRange(id)?.html ?? ''
const sectionInner = (id) => sectionRange(id)?.inner ?? ''

function stripTags(s) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Text of the element carrying data-k="key" (handles nested same-name tags). */
function dataElementText(html, key) {
  const open = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bdata-k="${key}"[^>]*>`, 'i').exec(html)
  if (!open) return null
  const tag = open[1].toLowerCase()
  const openEnd = open.index + open[0].length
  const tagRe = new RegExp(`</?${tag}\\b[^>]*>`, 'gi')
  tagRe.lastIndex = openEnd
  let depth = 1
  let m
  while ((m = tagRe.exec(html))) {
    if (m[0][1] === '/') depth--
    else depth++
    if (depth === 0) return html.slice(openEnd, m.index)
  }
  return html.slice(openEnd)
}

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

// --- contract (v2/v3 reports) ------------------------------------------------
let meta = null
let contractV2 = false
let contractV3 = false
if (legacy) {
  ok.push('legacy mode: contract checks skipped (naming / meta / theme / sections)')
} else {
  // --- theme: structure fixed, skin declared --------------------------------
  const styleTags = (raw.match(/<style\b/gi) || []).length
  if (styleTags !== 1) fails.push(`expected exactly 1 <style> block, found ${styleTags}`)
  else if (!/--sk-bg:/.test(raw) || !/--sk-ink:/.test(raw)) fails.push('skin tokens missing (--sk-bg / --sk-ink): style was hand-rolled, start from assets/report-theme.css')
  else if (!/\bskin:\s*\S/.test(raw)) fails.push('skin not declared: add "/* skin: <object> UI */" at the top of <style>')
  else ok.push('structure baseline + declared skin')

  // --- embedded meta (agent-readable) ---------------------------------------
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
    const cvRaw = meta.research?.contractVersion
    if (cvRaw !== undefined && (!Number.isInteger(cvRaw) || cvRaw < 1)) {
      fails.push(`research.contractVersion must be an integer >= 1, got ${JSON.stringify(cvRaw)}`)
    }
    const cv = Number.isInteger(cvRaw) ? cvRaw : 1
    contractV2 = cv >= 2
    contractV3 = cv >= 3

    const reader = meta.research?.reader
    const readerOk = READER_MODES.includes(reader)

    const baseReq = [
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
    const contractReq = []
    if (contractV2) {
      contractReq.push(
        ['research.contractVersion', Number.isInteger(cvRaw) && cvRaw >= 2],
        ['research.degraded', Array.isArray(meta.research?.degraded)],
      )
      // reader is new in v3; requiring it on v2 would reject reports written before this contract.
      if (contractV3) contractReq.push(['research.reader', readerOk])
      else if (!readerOk) warns.push('v2 report has no valid research.reader (required only for v3)')
      const kpis = Array.isArray(meta.verdict?.kpis) ? meta.verdict.kpis : []
      if (kpis.length === 3) {
        const kpiBad = kpis
          .map((k, i) => {
            const missing = []
            if (typeof k?.value !== 'string' || !k.value.trim()) missing.push('value')
            if (typeof k?.label !== 'string' || !k.label.trim()) missing.push('label')
            return missing.length ? `kpis[${i}].${missing.join('/')}` : null
          })
          .filter(Boolean)
        if (kpiBad.length) contractReq.push([`verdict.kpis fields: ${kpiBad.join(', ')}`, false])
      }
    }
    const req = [...baseReq, ...contractReq]
    const bad = req.filter(([, pass]) => !pass).map(([name]) => name)
    if (bad.length) fails.push(`report-meta incomplete: ${bad.join(', ')}`)
    else ok.push('report-meta complete')

    // one-line readability (v2+ and legacy reports with the field)
    if (typeof meta.verdict?.oneLine === 'string' && meta.verdict.oneLine.trim()) {
      const one = meta.verdict.oneLine
      if (one.replace(/\s+/g, '').length > 120) fails.push(`verdict.oneLine is ${one.replace(/\s+/g, '').length} chars after whitespace removal (max 120)`)
      if (/`/.test(one)) fails.push('verdict.oneLine must not contain backticks')
      if (/[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+:\d+/.test(one)) fails.push('verdict.oneLine must not contain path:line code references')
    }
    if (meta.profile && typeof meta.profile.positioning !== 'string') {
      warns.push('meta.profile.positioning is not a string')
    }
  }

  // --- filename / directory / index consistency ------------------------------
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

  // --- 本版变化 for v>=2 -------------------------------------------------------
  if (meta) {
    const v = meta.research?.version ?? 0
    if (v >= 2) {
      if (!/id="delta"/.test(clean)) fails.push('v>=2 report must carry a "本版变化" block (id="delta")')
      else if (!meta.previous || typeof meta.previous !== 'object') fails.push('v>=2 report must set report-meta.previous')
      else ok.push(`v${v} carries delta block + previous pointer`)
    } else if (meta.previous) {
      warns.push('v1 report has previous set — check research.version')
    }
  }

  // --- metadata table --------------------------------------------------------
  const metaTable = raw.match(/<table class="meta">[\s\S]*?<\/table>/)
  if (!metaTable) {
    fails.push('missing <table class="meta"> (fixed 6-row metadata header)')
  } else {
    const labels = ['调研对象', '版本 / 提交', '报告版本', '本地克隆', '调研方式', '调研日期']
    const missing = labels.filter((l) => !metaTable[0].includes(l))
    if (missing.length) fails.push(`metadata table missing rows: ${missing.join(', ')}`)
    else ok.push('metadata table complete')
  }

  // --- fixed sections --------------------------------------------------------
  const sectionIds = contractV3
    ? ['a1', 'a2', 'a3', 'a4', 'a5']
    : ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']
  const missingSections = sectionIds.filter((id) => !sectionRange(id))
  if (missingSections.length) fails.push(`missing sections: ${missingSections.join(', ')} (${contractV3 ? 'fixed 5 acts' : 'fixed 9 sections'})`)
  else {
    const order = sectionIds.map((id) => sectionRange(id).start)
    const inOrder = order.every((pos, i) => i === 0 || pos > order[i - 1])
    if (!inOrder) fails.push(`sections out of order: ${sectionIds.join(' → ')}`)
    else ok.push(contractV3 ? '5 acts in order' : '9 sections in order')
  }

  // --- brief (v3 required; v2 readability check; legacy not required) --------
  const briefRange = sectionRange('brief')
  if (contractV3) {
    if (!briefRange) fails.push('missing <section id="brief"> — v3 report needs a one-screen decision brief')
    else {
      const a1 = sectionRange('a1')
      if (a1 && briefRange.start > a1.start) fails.push('brief must come before a1')
      else ok.push('brief before five acts')
    }
  } else if (contractV2 && !briefRange) {
    warns.push('v2 report has no <section id="brief"> — old v2 report kept readable as-is')
  }

  if (briefRange) {
    const brief = briefRange.html
    const inner = briefRange.inner
    if (contractV2) {
      if (/<(pre|table|img|details)\b/i.test(brief)) fails.push('brief must not contain <pre> / <table> / <img> / <details>')
      const dataK = [...brief.matchAll(/data-k="([^"]+)"/g)].map((x) => x[1])
      const requiredK = ['who', 'how', 'cost', 'notdone', 'try', 'next']
      const missingK = requiredK.filter((k) => !dataK.includes(k))
      if (missingK.length) fails.push(`brief missing data-k: ${missingK.join(', ')}`)
      else ok.push('brief has who / how / cost / notdone / try / next')

      const notdone = dataElementText(inner, 'notdone')
      if (notdone === null || !stripTags(notdone)) fails.push('brief "本次没做到" is empty')

      const oneMatch = inner.match(/<p class="one"[^>]*>([\s\S]*?)<\/p>/)
      const oneText = oneMatch ? stripTags(oneMatch[1]).replace(/^一句话\s*[：:]\s*/, '') : ''
      const metaOne = typeof meta?.verdict?.oneLine === 'string' ? meta.verdict.oneLine.replace(/\s+/g, ' ').trim() : ''
      if (oneText !== metaOne) fails.push('brief first line != report-meta.verdict.oneLine')

      const kpiCount = (brief.match(/<div class="kpi"/g) || []).length
      if (kpiCount !== 3) fails.push(`brief has ${kpiCount} KPI tile(s), expected exactly 3`)
      const kpiValues = [...brief.matchAll(/<div class="v"[^>]*>([\s\S]*?)<\/div>/g)].map((x) => stripTags(x[1]))
      const kpiLabels = [...brief.matchAll(/<div class="l"[^>]*>([\s\S]*?)<\/div>/g)].map((x) => stripTags(x[1]))
      if (kpiValues.length !== 3 || kpiValues.some((v) => !v)) fails.push('brief KPI value missing (need 3 values)')
      if (kpiLabels.length !== 3 || kpiLabels.some((l) => !l)) fails.push('brief KPI label missing (need 3 labels)')
      for (const label of kpiLabels) {
        const core = label.replace(/[\s\p{P}\p{S}]/gu, '')
        if (core.length > 0 && core.length < 6) warns.push(`KPI label too short: "${label}" (write what the number means + scope)`)
      }

      const glossary = clean.match(/<div class="glossary"[^>]*>([\s\S]*?)<\/div>/)
      if (glossary) {
        if (briefRange && glossary.index < briefRange.end) fails.push('glossary must come after the brief, not inside it')
        const dts = [...glossary[1].matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/g)].map((x) => stripTags(x[1]))
        const dds = [...glossary[1].matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((x) => stripTags(x[1]))
        if (dts.length === 0) fails.push('glossary has no <dt> terms')
        if (dts.length !== dds.length) fails.push(`glossary dt/dd mismatch: ${dts.length} dt / ${dds.length} dd`)
        if (dds.some((d) => !d)) fails.push('glossary has an empty <dd>')
        if (dts.length > 5) warns.push(`glossary has ${dts.length} terms (max 5)`)
        if (dts.length && dts.length === dds.length && dds.every(Boolean)) ok.push('glossary complete')
      }
    }
  }

  // --- v3 five-act artifacts -------------------------------------------------
  if (contractV3) {
    const act = (id) => sectionHtml(id)
    const a3 = act('a3')
    const subPos = ['a3-input', 'a3-process', 'a3-output'].map((id) => {
      const m = new RegExp(`<h[1-6]\\b[^>]*\\sid="${id}"[^>]*>`).exec(a3)
      return m ? m.index : -1
    })
    if (subPos.some((p) => p < 0)) fails.push('a3: missing a3-input / a3-process / a3-output')
    else if (!(subPos[0] < subPos[1] && subPos[1] < subPos[2])) fails.push('a3: input → process → output out of order')
    else ok.push('a3: input → process → output in order')

    const markers = [
      ['a1', 'data-table="first-run"'],
      ['a2', 'data-table="delta"'],
      ['a3', 'data-table="input"'],
      ['a3', 'data-flow="state"'],
      ['a3', 'data-table="output"'],
      ['a4', 'data-table="carrier"'],
      ['a5', 'data-table="impact"'],
      ['a5', 'data-table="unverified"'],
    ]
    const missingMarkers = markers.filter(([id, mark]) => !act(id).includes(mark))
    if (missingMarkers.length) fails.push(`missing five-act artifacts: ${missingMarkers.map(([id, mark]) => `${id} ${mark}`).join(', ')}`)
    else ok.push('five-act artifacts present')

    const stateCount = (a3.match(/data-state="/g) || []).length
    if (stateCount < 3) fails.push(`state chain: ${stateCount} transition(s) (need >= 3)`)
    else ok.push(`state chain: ${stateCount} transitions`)

    const stateTable = a3.match(/<table\b[^>]*data-flow="state"[^>]*>[\s\S]*?<\/table>/)
    if (stateTable) {
      const cols = ['输入状态', '执行者', '处理', '输出状态', '失败/降级', '证据']
      const missingCols = cols.filter((c) => !stateTable[0].includes(c))
      if (missingCols.length) warns.push(`state table columns missing: ${missingCols.join(', ')}`)
    }

    const impact = ['human', 'host', 'object', 'artifact'].filter((x) => !act('a5').includes(`data-impact="${x}"`))
    if (impact.length) warns.push(`impact matrix missing rows: ${impact.join(', ')}`)

    const ae = sectionRange('appendix-evidence')
    const as = sectionRange('appendix-selfproof')
    const ar = sectionRange('appendix-refs')
    if (!ae || !as || !ar) {
      const missing = [['appendix-evidence', ae], ['appendix-selfproof', as], ['appendix-refs', ar]].filter(([, r]) => !r).map(([id]) => id)
      fails.push(`missing evidence appendices: ${missing.join(', ')}`)
    } else if (!(ae.start < as.start && as.start < ar.start)) {
      fails.push('evidence appendices out of order: appendix-evidence → appendix-selfproof → appendix-refs')
    } else {
      const between1 = clean.slice(ae.start, as.start)
      const need1 = ['宣称', '自我反驳'].filter((k) => !between1.includes(k))
      const between2 = clean.slice(as.start, ar.start)
      const need2 = ['需求回归', '读者验收', '非变更自证', '本版变化'].filter((k) => !between2.includes(k))
      const readerAcceptance = between2.includes('[读者验收]')
      if (need1.length) fails.push(`appendix-evidence missing: ${need1.join(', ')}`)
      if (need2.length) fails.push(`appendix-selfproof missing: ${need2.join(', ')}`)
      if (!readerAcceptance) fails.push('appendix-selfproof missing [读者验收] in body text (comments do not count)')
      if (!need1.length && !need2.length) ok.push('evidence appendices complete')
    }

    if (meta?.profile && typeof meta.profile.positioning !== 'string') warns.push('meta.profile.positioning is not a string')
  }

  // --- verdict card ----------------------------------------------------------
  const verdictRe = /class="[^"]*\bverdict\b[^"]*"/
  if (!verdictRe.test(clean)) {
    if (contractV2) fails.push('missing verdict card (section.brief.verdict or div.verdict) at the top')
    else warns.push('no verdict card found (legacy report kept readable as-is)')
  } else if (!contractV2) {
    const kpiCount = (clean.match(/<div class="kpi"/g) || []).length
    if (kpiCount !== 3) warns.push(`verdict card has ${kpiCount} KPI tile(s), expected 3`)
    else ok.push('verdict card present')
  }

  // --- function confirmation blocks (one per feature) ------------------------
  const fnBlocks = [...clean.matchAll(/<div class="fn" id="(fn-\d+)">/g)]
  const fnLinks = new Set([...clean.matchAll(/href="#(fn-\d+)"/g)].map((x) => x[1]))
  if (fnBlocks.length < 6) {
    fails.push(`function blocks: ${fnBlocks.length} (need >= 6 — one block per feature, 产品意图 → 代码确认 → 判定)`)
  } else {
    const broken = []
    for (let i = 0; i < fnBlocks.length; i++) {
      const from = fnBlocks[i].index
      const to = i + 1 < fnBlocks.length ? fnBlocks[i + 1].index : clean.indexOf('</section>', from)
      const block = clean.slice(from, to > 0 ? to : undefined)
      const missing = ['产品意图', '代码确认', '判定'].filter((m) => !block.includes(m))
      if (missing.length) broken.push(`${fnBlocks[i][1]} missing ${missing.join('/')}`)
      else if (!/[A-Za-z0-9_./-]+\.(ts|js|tsx|vue|mjs|py|go|rs|html|css):\d+/.test(block)) broken.push(`${fnBlocks[i][1]} 无 路径:行号`)
    }
    if (broken.length) fails.push(`function blocks incomplete: ${broken.join('; ')}`)
    else ok.push(`function blocks: ${fnBlocks.length} × (意图 / 代码 / 判定)`)

    const unlinked = fnBlocks.map((m) => m[1]).filter((id) => !fnLinks.has(id))
    if (unlinked.length) warns.push(`function blocks not linked from the feature index: ${unlinked.join(', ')}`)
  }

  // --- depth floor -----------------------------------------------------------
  const codeRefs = [...clean.matchAll(/[A-Za-z0-9_./-]+\.(ts|js|tsx|vue|mjs|py|go|rs|html|css):\d+/g)].map((x) => x[0])
  const codeFiles = new Set(codeRefs.map((r) => r.replace(/:\d+$/, '')))
  const level = meta?.research?.level ?? 'A'
  // Check the depth floor even when fn blocks are missing, so an empty scaffold reports both gaps.
  if (level === 'A' || level === 'B') {
    const singleFile = meta?.research?.singleFile === true
    if (codeRefs.length < 15) fails.push(`source refs: ${codeRefs.length} (need >= 15 for level ${level})`)
    else if (!singleFile && codeFiles.size < 6) fails.push(`distinct source files: ${codeFiles.size} (need >= 6; set research.singleFile for single-file products)`)
    else ok.push(`source refs: ${codeRefs.length} across ${codeFiles.size} files${singleFile ? ' [single-file]' : ''}`)
  }
}

// --- recheck for re-research --------------------------------------------------
if (meta && (meta.research?.version ?? 1) >= 2) {
  const re = meta.research.recheck
  const valid = Array.isArray(re) && re.length > 0 && re.every((r) => ['confirmed', 'changed', 'unchecked'].includes(r.status))
  if (!valid) fails.push('v>=2 must fill research.recheck (confirmed / changed / unchecked per previous finding)')
}

// --- ids / anchors ------------------------------------------------------------
const ids = [...raw.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])
const dupIds = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))]
if (dupIds.length) fails.push(`duplicate ids: ${dupIds.join(', ')}`)
else ok.push(`ids unique (${ids.length})`)

const idSet = new Set(ids)
const refs = [...new Set([...raw.matchAll(/href="#([^"]+)"/g)].map((x) => x[1]))]
const dangling = refs.filter((h) => !idSet.has(h))
if (dangling.length) fails.push(`dangling anchors: ${dangling.join(', ')}`)
else ok.push(`anchors resolve (${refs.length})`)

// --- figures ------------------------------------------------------------------
const figs = [...raw.matchAll(/(?:<figcaption[^>]*>|<summary[^>]*>)\s*(?:<[^>]+>\s*)?图\s*(\d+)\s*·/g)].map((x) => Number(x[1]))
if (figs.length === 0) {
  ok.push('no numbered figures')
} else if (figs.some((v, i) => v !== i + 1)) {
  fails.push(`figure numbering: ${figs.join(',')} (expected 1..${figs.length})`)
} else {
  ok.push(`figures sequential 1..${figs.length}`)
}

// --- images -------------------------------------------------------------------
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