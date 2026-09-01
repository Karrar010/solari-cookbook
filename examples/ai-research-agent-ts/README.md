# AI Research Agent (TypeScript)

An autonomous research agent that combines a **Solari stealth cloud browser** with **Claude** to research any topic and produce a structured markdown report — no hardcoded steps, no copy-pasting.

**How it works:**

1. **Plan** — Claude generates 4 targeted search queries covering the topic from multiple angles
2. **Search** — a Solari cloud browser navigates DuckDuckGo and visits the top results
3. **Extract** — raw text is pulled from each page
4. **Analyse** — Claude distils the 3–5 most relevant insights from every source
5. **Synthesise** — Claude writes a full research report with executive summary, key findings, market landscape, and trends

The agent makes its own decisions at every step. Change the topic and it adapts completely.

## Run

```bash
cd examples/ai-research-agent-ts
npm install

export SOLARI_API_KEY=slr_live_...     # https://console.getsolari.com
export ANTHROPIC_API_KEY=sk-ant-...    # https://platform.anthropic.com

# Research any topic
npm start "Pinetree Research AI computer use agents"

# Or use the default topic
npm start
```

The report is printed to the console and also saved as `report-<timestamp>.md` in the current directory.

## Requirements

- Node 18+
- Solari API key (free tier at [console.getsolari.com](https://console.getsolari.com))
- Anthropic API key ([platform.anthropic.com](https://platform.anthropic.com))

Source: [`index.ts`](index.ts)
