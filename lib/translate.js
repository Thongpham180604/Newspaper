// Optional: translate titles/summaries into Vietnamese and English with the Claude API.
// Runs only when ANTHROPIC_API_KEY is set. Translates the text given by the feed; never adds facts.
const LANG_NAMES = { vi: 'Vietnamese', en: 'English', ja: 'Japanese', de: 'German', fr: 'French', zh: 'Chinese', ko: 'Korean', ru: 'Russian' };

const SYSTEM = `You translate news headlines and short summaries for a bilingual Vietnamese–English news digest.
Rules:
- Translate faithfully. Do not add, remove, or infer facts, numbers, names, dates, or quotes.
- Keep proper names in their standard form in the target language (e.g. Vietnamese conventions for country and leader names).
- If the summary is empty, return an empty string for the translated summary.
- Neutral news register. No commentary.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          vi_title: { type: 'string' },
          vi_summary: { type: 'string' },
          en_title: { type: 'string' },
          en_summary: { type: 'string' },
        },
        required: ['id', 'vi_title', 'vi_summary', 'en_title', 'en_summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

function needs(item) {
  return !item.tr || (!item.tr.vi && item.l !== 'vi') || (!item.tr.en && item.l !== 'en');
}

async function translateItems(items, { model = process.env.CLAUDE_MODEL || 'claude-opus-5-5', max = +(process.env.MAX_TRANSLATE || 400), batch = 25, log = console.log } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    log('translate: ANTHROPIC_API_KEY not set, skipping translation');
    return 0;
  }
  const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const todo = items.filter(needs).slice(0, max);
  let done = 0;
  for (let i = 0; i < todo.length; i += batch) {
    const chunk = todo.slice(i, i + batch);
    const payload = chunk.map((x) => ({ id: x.id, source_language: LANG_NAMES[x.l] || x.l, title: x.ti, summary: x.su }));
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: `Translate each item into Vietnamese (vi_*) and English (en_*). If the source is already that language, copy it unchanged.\n\n${JSON.stringify(payload)}` }],
      });
      if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
        log(`translate: batch ${i / batch} stopped (${res.stop_reason}), skipped`);
        continue;
      }
      const textBlock = res.content.find((b) => b.type === 'text');
      const out = JSON.parse(textBlock.text);
      const byId = new Map(chunk.map((x) => [x.id, x]));
      for (const r of out.items) {
        const it = byId.get(r.id);
        if (!it) continue;
        it.tr = it.tr || {};
        if (it.l !== 'vi') it.tr.vi = { ti: r.vi_title, su: r.vi_summary };
        if (it.l !== 'en') it.tr.en = { ti: r.en_title, su: r.en_summary };
        it.trBy = 'machine';
        done++;
      }
    } catch (err) {
      log(`translate: batch ${i / batch} failed: ${err.status || ''} ${err.message}`);
      if (err.status === 401 || err.status === 403) break;
    }
  }
  log(`translate: ${done}/${todo.length} items translated`);
  return done;
}

module.exports = { translateItems };
