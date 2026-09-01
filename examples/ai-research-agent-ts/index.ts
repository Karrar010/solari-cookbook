/**
 * AI Research Agent — autonomous research powered by Claude + Solari browsers.
 *
 * Pass any research topic as a CLI argument and the agent will:
 *   1. Ask Claude to plan a multi-angle search strategy
 *   2. Launch a stealth Solari cloud browser
 *   3. Navigate real websites and extract content from top results
 *   4. Have Claude analyse each source for key insights
 *   5. Synthesise everything into a structured markdown report
 *
 * Nothing is hardcoded — Claude drives every decision about what to search,
 * which pages to read, and what conclusions to draw.
 *
 * Usage:
 *   npm start "AI computer use agents market 2026"
 */

import Anthropic from "@anthropic-ai/sdk"
import { Solari } from "@solarisdk/browser"
import type { Page } from "patchright-core"
import { writeFileSync } from "fs"
import path from "path"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const solari = new Solari({ apiKey: process.env.SOLARI_API_KEY! })

const QUERY =
  process.argv.slice(2).join(" ") ||
  "AI computer use agents for enterprise automation 2026"

const MAX_SOURCES = 6

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source {
  url: string
  title: string
  excerpt: string
}

// ─── Step 1: Plan ─────────────────────────────────────────────────────────────

async function planSearches(query: string): Promise<string[]> {
  const { content } = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a research strategist. Generate 4 specific search queries that together give broad, complementary coverage of this topic. Return ONLY a valid JSON array of strings, nothing else.

Topic: "${query}"`,
      },
    ],
  })

  const text = content[0].type === "text" ? content[0].text.trim() : "[]"
  const match = text.match(/\[[\s\S]*\]/)
  try {
    return JSON.parse(match ? match[0] : "[]")
  } catch {
    return [query]
  }
}

// ─── Step 2: Search & Extract ─────────────────────────────────────────────────

// Title words that flag generic educational filler (match anywhere in title)
const SKIP_TITLE_RE = /\b(definition|meaning|synonyms?|what is|how (to|does)|introduction to|overview of|explained?|wikipedia|wikihow|wikimedia)\b/i
// Real domains to skip — checked against the final URL after redirect
const SKIP_URL_DOMAINS = [
  "dictionary.com", "vocabulary.com", "merriam-webster.com",
  "britannica.com", "wikipedia.org", "wikimedia.org",
  "geeksforgeeks.org", "w3schools.com", "enterprise.com",
]

async function fetchSources(page: Page, searchQuery: string): Promise<Source[]> {
  const sources: Source[] = []

  // Bing News — returns real articles, not dictionary/Wikipedia/car-rental pages
  try {
    await page.goto(
      `https://www.bing.com/news/search?q=${encodeURIComponent(searchQuery)}`,
      { waitUntil: "domcontentloaded", timeout: 20_000 },
    )
  } catch {
    return sources
  }

  const links: { href: string; title: string }[] = await page.$$eval(
    "a.title",
    (els) =>
      (els as HTMLAnchorElement[])
        .slice(0, 6)
        .map((a) => ({ href: a.href, title: a.textContent?.trim() ?? "" }))
        .filter((l) => l.href && !l.href.includes("bing.com")),
  )

  // Secondary title filter as a safety net
  const relevant = links.filter(({ title }) => !SKIP_TITLE_RE.test(title.trim()))

  for (const { href, title } of relevant) {
    if (sources.length >= 2) break
    try {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 12_000 })
      const finalUrl = page.url()
      // Skip blocked domains — checked here against the real URL after redirect
      if (SKIP_URL_DOMAINS.some((d) => finalUrl.includes(d))) continue
      const excerpt: string = await page.$$eval("p", (ps) =>
        (ps as HTMLParagraphElement[])
          .map((p) => p.textContent?.trim() ?? "")
          .filter((t) => t.length > 80)
          .slice(0, 8)
          .join("\n\n")
          .slice(0, 2500),
      )
      if (excerpt.length > 200) {
        sources.push({ url: finalUrl, title, excerpt })
      }
    } catch {
      // skip unreachable pages
    }
  }

  return sources
}

// ─── Step 3: Analyse each source ──────────────────────────────────────────────

async function analyseSource(source: Source, query: string): Promise<string> {
  const { content } = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Extract the 3–5 most relevant facts or insights from this page that relate to the research topic. Be concise and factual. Output bullet points only.

Research topic: "${query}"
Page: ${source.title}
Content:
${source.excerpt}`,
      },
    ],
  })

  return content[0].type === "text" ? content[0].text.trim() : ""
}

// ─── Step 4: Synthesise report ────────────────────────────────────────────────

async function synthesise(
  query: string,
  sources: Source[],
  analyses: string[],
): Promise<string> {
  const evidence = sources
    .map(
      (s, i) =>
        `**Source ${i + 1}:** [${s.title}](${s.url})\n${analyses[i]}`,
    )
    .join("\n\n")

  const { content } = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a senior research analyst. Write a comprehensive, insightful research report using the evidence below. Be specific — cite source numbers where relevant.

Use these exact sections:
# Research Report: ${query}
## Executive Summary
## Key Findings
## Market Landscape
## Notable Players & Developments
## Trends & Implications
## Sources

Evidence:
${evidence}`,
      },
    ],
  })

  return content[0].type === "text" ? content[0].text : ""
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const divider = "─".repeat(60)
  console.log(`\n${divider}`)
  console.log(`  AI Research Agent  (Solari + Claude)`)
  console.log(divider)
  console.log(`  Topic: "${QUERY}"`)
  console.log(`${divider}\n`)

  console.log("[1/4] Planning research strategy with Claude...")
  const searches = await planSearches(QUERY)
  searches.forEach((q, i) => console.log(`      ${i + 1}. ${q}`))

  console.log("\n[2/4] Launching Solari stealth browser...")
  const browser = await solari.launch()
  const allSources: Source[] = []

  try {
    const page = await browser.newPage()

    for (const q of searches) {
      if (allSources.length >= MAX_SOURCES) break
      console.log(`\n      Searching: "${q}"`)
      const sources = await fetchSources(page, q)
      allSources.push(...sources)
      console.log(`      +${sources.length} sources  (total: ${allSources.length})`)
    }
  } finally {
    await browser.close()
    await solari.close()
  }

  if (allSources.length === 0) {
    console.error("\nNo sources collected. Check your SOLARI_API_KEY and network.")
    process.exit(1)
  }

  console.log(`\n[3/4] Analysing ${allSources.length} sources with Claude...`)
  const analyses = await Promise.all(
    allSources.map((s, i) => {
      console.log(`      [${i + 1}/${allSources.length}] ${s.title.slice(0, 55)}...`)
      return analyseSource(s, QUERY)
    }),
  )

  console.log("\n[4/4] Synthesising final report...")
  const report = await synthesise(QUERY, allSources, analyses)

  const filename = `report-${Date.now()}.md`
  writeFileSync(path.resolve(filename), report, "utf-8")

  console.log(`\n${divider}`)
  console.log(`  Done. Report saved → ${filename}`)
  console.log(`${divider}\n`)
  console.log(report)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
