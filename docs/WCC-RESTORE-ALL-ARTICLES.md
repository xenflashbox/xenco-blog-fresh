# Payload Admin Prompt — Restore 4 Clean Articles + Update 2 Rewrites + Delete 2 Stubs

## What this does:
1. Runs restore script on 4 clean HTML articles → native Lexical
2. PATCHes 2 freshly rewritten articles directly as Lexical JSON
3. Deletes the Wine Refrigerators article and adds a redirect
4. Deletes the 2 emoji-slug stubs

All content goes in as native Lexical. No HTML. No conversion fallbacks.

---

## Step 1 — Verify the export file is on the server

```bash
ls -lh /home/xen/winecountrycorner/data/wcc-article-export.json
```

If not there:
```bash
# SCP from local machine
scp /path/to/wcc-article-export.json \
  xen@[dev-server-ip]:/home/xen/winecountrycorner/data/
```

---

## Step 2 — Run the restore script for the 4 clean articles

The restore script from `scripts/migrate-html-to-lexical.mjs` already
exists. Create a targeted version for just these 4 articles.

Save as `scripts/restore-four-articles.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync } from "fs"
import { parseHTML } from "linkedom"

const CMS_URL = process.env.CMS_URL || "https://cms.winecountrycorner.com"
const CMS_KEY = process.env.CMS_API_KEY

if (!CMS_KEY) { console.error("❌ CMS_API_KEY not set"); process.exit(1) }

// Only these 4 — the other 3 are handled separately
const SLUG_TO_ID = {
  "tasting-experiences-napa-12-essential-secrets-for-the-best": 3743,
  "transportation-included-tours-napa-9-essential-stress-free-tips": 3742,
  "wine-tasting-trends-9-surprising-expert-insights-to-explore": 3741,
  "secret-napa-photography-spots": 3738,
}

function makeText(text, formats = {}) {
  let format = 0
  if (formats.bold) format |= 1
  if (formats.italic) format |= 2
  if (formats.code) format |= 16
  return { type: "text", text, format, mode: "normal", style: "", detail: 0, version: 1 }
}

function inlineChildren(el) {
  const out = []
  for (const node of el.childNodes) {
    const tag = node.tagName?.toLowerCase()
    if (node.nodeType === 3) {
      const t = node.textContent
      if (t?.trim()) out.push(makeText(t))
    } else if (tag === "strong" || tag === "b") {
      const t = node.textContent?.trim()
      if (t) out.push(makeText(t, { bold: true }))
    } else if (tag === "em" || tag === "i") {
      const t = node.textContent?.trim()
      if (t) out.push(makeText(t, { italic: true }))
    } else if (tag === "a") {
      const href = node.getAttribute("href")
      const t = node.textContent?.trim()
      if (t && href) {
        out.push({
          type: "link", url: href,
          children: [makeText(t)],
          direction: "ltr", format: "", indent: 0, version: 1,
          fields: { url: href, newTab: href.startsWith("http") },
        })
      } else if (t) out.push(makeText(t))
    } else if (tag === "br") {
      out.push(makeText("\n"))
    } else {
      const t = node.textContent?.trim()
      if (t) out.push(makeText(t))
    }
  }
  return out
}

function processNode(el) {
  const tag = el.tagName?.toLowerCase()
  const text = el.textContent?.trim()
  if (!tag) {
    if (text) return { type: "paragraph", children: [makeText(text)], direction: "ltr", format: "", indent: 0, version: 1 }
    return null
  }
  if (/^h[1-4]$/.test(tag)) {
    const children = inlineChildren(el)
    if (!children.length) return null
    return { type: "heading", tag, children, direction: "ltr", format: "", indent: 0, version: 1 }
  }
  if (tag === "p") {
    const children = inlineChildren(el)
    if (!children.length) return null
    return { type: "paragraph", children, direction: "ltr", format: "", indent: 0, version: 1 }
  }
  if (tag === "ul" || tag === "ol") {
    const listType = tag === "ul" ? "bullet" : "number"
    const items = []
    for (const li of el.querySelectorAll("li")) {
      const children = inlineChildren(li)
      if (children.length) items.push({ type: "listitem", children, direction: "ltr", format: "", indent: 0, version: 1, value: items.length + 1 })
    }
    if (!items.length) return null
    return { type: "list", listType, children: items, direction: "ltr", format: "", indent: 0, version: 1, tag }
  }
  if (tag === "blockquote") {
    const children = inlineChildren(el)
    if (!children.length) return null
    return { type: "quote", children, direction: "ltr", format: "", indent: 0, version: 1 }
  }
  if (tag === "hr") return { type: "horizontalrule", version: 1 }
  if (["div","section","article","figure","aside"].includes(tag)) {
    const results = []
    for (const child of el.childNodes) {
      const node = processNode(child)
      if (Array.isArray(node)) results.push(...node)
      else if (node) results.push(node)
    }
    return results.length ? results : null
  }
  if (text) {
    const children = inlineChildren(el)
    if (children.length) return { type: "paragraph", children, direction: "ltr", format: "", indent: 0, version: 1 }
  }
  return null
}

function htmlToLexical(html) {
  if (!html?.trim()) throw new Error("Empty HTML input")
  const { document } = parseHTML(`<body>${html}</body>`)
  const body = document.querySelector("body")
  const rawNodes = []
  for (const child of body.childNodes) {
    const result = processNode(child)
    if (Array.isArray(result)) rawNodes.push(...result)
    else if (result) rawNodes.push(result)
  }
  const filtered = rawNodes.filter(n => n && (n.children?.length > 0 || n.type === "horizontalrule"))
  if (!filtered.length) throw new Error("Zero nodes produced")
  return { root: { type: "root", children: filtered, direction: "ltr", format: "", indent: 0, version: 1 } }
}

async function patch(id, content) {
  const res = await fetch(`${CMS_URL}/api/articles/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `users API-Key ${CMS_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text.substring(0, 200)}`)
  }
  const data = await res.json()
  if (!data.doc?.content?.root?.children?.length) throw new Error("Verification failed — empty after PATCH")
  return data.doc
}

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("Restoring 4 clean articles → Lexical")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  const articles = JSON.parse(readFileSync("data/wcc-article-export.json", "utf8"))
  const results = { success: [], failed: [] }

  for (const article of articles) {
    const { slug, content } = article
    const id = SLUG_TO_ID[slug]
    if (!id) continue // Skip articles not in our target list

    if (!content?.trim()) {
      console.error(`❌ SKIP ${slug} — no content in export`)
      results.failed.push({ slug, error: "empty content" })
      continue
    }

    try {
      const lexical = htmlToLexical(content)
      await patch(id, lexical)
      console.log(`✅ DONE  ${slug} — ${lexical.root.children.length} nodes`)
      results.success.push({ slug, id })
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`❌ FAIL  ${slug} — ${err.message}`)
      results.failed.push({ slug, id, error: err.message })
    }
  }

  console.log(`\n✅ Success: ${results.success.length}`)
  console.log(`❌ Failed:  ${results.failed.length}`)
  if (results.failed.length) { results.failed.forEach(f => console.log(`  - ${f.slug}: ${f.error}`)); process.exit(1) }
  process.exit(0)
}

main().catch(err => { console.error("❌ Fatal:", err); process.exit(1) })
```

Run it:
```bash
set -a && source .env.local && set +a
node scripts/restore-four-articles.mjs
```

Expected: 4 successes, 0 failures.

---

## Step 3 — PATCH the 2 rewritten articles directly as Lexical

These two articles have been rewritten fresh by the editorial team.
Paste the content directly via the Payload admin panel or via API.

### Article A: Wine Train (ID 3715)
Go to: cms.winecountrycorner.com/admin/collections/articles/3715

Paste this content into the `content` richText field:

---
WINE TRAIN ARTICLE — paste as Lexical richText in Payload admin:

**Headline (in title field — already set):**
The Napa Valley Wine Train: What It Actually Is, What to Expect, and Whether It's Worth It

**Body content — paste into content field:**

You've seen the pictures. A vintage train rolling through vineyards, white tablecloths, wine glasses catching the afternoon light. The Napa Valley Wine Train has been operating since 1989 and it generates more questions from wine country visitors than almost anything else in the valley. Is it a tourist trap? Is it worth the money? Is the food actually good?

The honest answer is more interesting than either the promotional brochure or the skeptics suggest.

**What the Wine Train Actually Is**

The Napa Valley Wine Train operates a restored set of 1915-1917 Pullman railcars along a 36-mile route between Napa and St. Helena. The journey takes approximately three hours each way, though most packages are roundtrip with the total experience running three to six hours depending on what you book.

The train doesn't stop at wineries in the traditional sense — you're not hopping off to do tastings at multiple estates. The experience is the train itself: a moving dining room traveling through the agricultural heart of Napa Valley, with wine service, a kitchen car producing full meals, and views of vineyards that most visitors never see because they're not accessible from the main roads.

That distinction matters. If you're comparing the Wine Train to a standard winery hopping day, you're comparing different experiences. The Wine Train is closer to a dinner cruise than a tasting tour. Whether that appeals to you depends on what you're looking for.

**The Route**

The train departs from downtown Napa station and travels north through the valley, passing through Yountville, Oakville, Rutherford, and St. Helena before returning. The route runs through the agricultural corridor — the working vineyard land between the highway and the hills — rather than the winery estates themselves. You're seeing the vineyards from the inside of the valley rather than from the road.

The best views are from the Vista Dome car, an upper-level glass-enclosed observation car with panoramic windows. For special occasions or first-time riders, the Vista Dome upgrade is worth the cost. The views during harvest season — September and October — are particularly striking, with active picking crews visible in the vineyard rows.

**The Packages**

There are several configurations worth knowing:

The **Legacy Tour** is the base package — a three-hour roundtrip with lunch service. This is the right choice for first-time visitors who want the experience without the premium pricing of the longer packages.

The **Vista Dome** package upgrades your car and typically includes premium dining. The elevated views and slightly more intimate car make a meaningful difference in the experience.

The **Quattro Vino** package extends the journey to approximately six hours and includes stops at wineries along the route — this is the version closest to a traditional wine country touring day, with the train as the transportation between estates.

**Murder Mystery** dinner packages run on select evenings for guests who want entertainment alongside the meal. These book out quickly and are a completely different vibe — theatrical, interactive, designed for groups celebrating something.

**What the Food Is Actually Like**

The kitchen car produces surprisingly competent food given the constraints of cooking on a moving train. The menu changes seasonally and leans toward classic American with California influences — the kind of cooking that prioritizes execution over experimentation. You're not eating at a Michelin-starred restaurant, but you're also not eating airline food. The wine list focuses on Napa Valley producers and is well-curated for the price point.

**Booking Logistics**

Book well in advance — the Vista Dome cars and Quattro Vino packages fill months out during peak season (May through October). Harvest season (September and October) is the most popular and most visually dramatic time to ride. Winter offers quieter trains, sometimes discounted pricing, and a different kind of valley beauty — dormant vines, lower fog, more intimate atmosphere.

The train departs from the Napa station in downtown Napa. Arrive at least 30 minutes before departure. Dress code is smart casual — the train skews toward a more dressed-up crowd than most Napa Valley experiences.

**Is It Worth It?**

For a solo wine drinker who wants to taste as many different producers as possible in a day, no — a self-guided or chauffeured winery tour will cover more ground and more wine.

For a couple celebrating an anniversary, a group doing a special occasion trip, first-time Napa visitors who want a single curated experience, or anyone who enjoys the romance of train travel — yes, clearly.

The Wine Train occupies a specific niche in the Napa Valley experience ecosystem. It does that thing well. Know what you're booking before you book it, and it won't disappoint.

Book at winetrain.com. Prices start around $150 per person for the base package and increase significantly for premium cars and extended packages.

---

### Article B: California Wine Labels (ID 3727)
Go to: cms.winecountrycorner.com/admin/collections/articles/3727

**Body content — paste into content field:**

A California wine label contains more useful information than most wine drinkers realize — and significantly less than it looks like it does. The trick is knowing which parts actually predict what's in the bottle and which parts are marketing.

Here's what each element on a California wine label means, and how to use it.

**The Producer Name**

The most prominent text on the front label is almost always the producer or brand name. This ranges from historic family estates to négociant brands that buy grapes or finished wine and sell it under their own label. The name alone tells you nothing about quality — it tells you whose reputation is attached to the bottle.

Knowing the producer matters more than any other single factor on the label. A Napa Valley Cabernet Sauvignon from a producer you've tasted and respected is more useful information than the AVA designation or the vintage.

**The Appellation (AVA)**

American Viticultural Areas are federally designated grape-growing regions. If a wine lists an AVA on the label, 85% of the grapes must come from that region. California has more than 100 AVAs — the range runs from massive multi-county designations like California and Central Coast, which allow enormous geographic flexibility, to highly specific designations like Stags Leap District or Coombsville, which indicate a specific microclimate and soil profile.

The narrower the AVA, the more the designation means. A bottle labeled simply "California Cabernet Sauvignon" could contain grapes from anywhere in the state. A bottle labeled "Coombsville Cabernet Sauvignon" is telling you something specific about where those grapes grew and how that affected the wine.

For Napa Valley specifically, the valley-level appellation requires 85% Napa Valley fruit, while sub-appellations like Oakville, Rutherford, Stags Leap District, Howell Mountain, and Atlas Peak require 85% from that specific area. The sub-appellations are not marketing — they reflect genuinely different growing conditions that produce meaningfully different wine.

**The Varietal**

If a varietal name appears on the label, California law requires that 75% of the wine be made from that grape. This is actually a lower threshold than most wine drinkers assume. A wine labeled "Cabernet Sauvignon" can legally contain 25% Merlot, Syrah, or other varieties.

For Napa Valley Cabernet specifically, many producers blend intentionally — Cabernet Franc, Merlot, Petit Verdot, and Malbec are common additions that improve structure, aromatics, or texture. This isn't adulteration. It's winemaking. The label won't tell you what the other 25% is unless the producer chooses to disclose it, which many do on the back label.

**The Vintage**

The year on the label indicates when the grapes were harvested. California requires that 95% of the wine come from that vintage year if a year is listed.

Vintage variation in California is real but less dramatic than in European wine regions. The factors that matter most in a given year are the timing and distribution of spring rain, summer heat events, and the length of the hang time before harvest. Years with extended growing seasons and no major heat spikes or early rains tend to produce wines with more complexity and better aging potential.

For everyday drinking, vintage variation in California matters less than producer consistency. For wines you're buying to age or to spend significant money on, it's worth researching the specific vintage for that AVA.

**The Back Label**

The back label is where producers tell you what they want you to know. This ranges from useful technical information — alcohol level, production size, winemaking notes, vineyard sources — to marketing copy that means nothing. The alcohol percentage is required by law and appears somewhere on the label. In California, wines above 14% alcohol must list the actual percentage rather than using a range.

Higher alcohol doesn't automatically mean lower quality, but it does tell you something about when the grapes were picked and how ripe they were at harvest. A Napa Valley Cabernet at 13.5% and one at 15.5% are likely to taste quite different even from similar appellations.

**Estate vs. Vineyard Designate vs. Reserve**

"Estate" has a legal definition: the winery owns or controls (through a long-term lease) the vineyard, and both the winery and vineyard must be in the same AVA. Estate wines tend to reflect more deliberate site selection and farming philosophy.

"Vineyard designate" wines — identified by a specific vineyard name on the label, like "Hyde Vineyard Chardonnay" or "To Kalon Vineyard Cabernet Sauvignon" — indicate the wine came primarily from that single vineyard source. These wines are typically made in smaller quantities and are priced at a premium for the specificity they represent.

"Reserve" has no legal definition in California. Any producer can call any wine a Reserve. It usually indicates a wine the producer considers their best offering, but the only way to know if that's meaningful is to know the producer.

**Reading a Label in Practice**

When you're standing in front of a wine shop wall or scanning a restaurant list, the most useful three-piece filter is: producer you recognize or trust, a specific AVA rather than a broad one, and a varietal that suits what you're serving.

Everything else on the label is context. The more of it you understand, the more precisely you can predict whether a bottle will match what you're looking for. But knowing the producer is still the most reliable shortcut — which is why wine country visits to small, family-owned estates like the ones Wine Country Corner features matter. Once you've tasted the wine poured by the person who made it, the label becomes a reunion rather than a puzzle.

---

## Step 4 — Delete 3 articles and add redirect

### Delete Wine Refrigerators (ID 3716)
```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

curl -s -X DELETE \
  "https://cms.winecountrycorner.com/api/articles/3716" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{deleted: .doc.id, slug: .doc.slug}'
```

### Delete the 2 emoji-slug stubs (IDs 3676, 3664)
```bash
for id in 3676 3664; do
  curl -s -X DELETE \
    "https://cms.winecountrycorner.com/api/articles/$id" \
    -H "Authorization: users API-Key $CMS_KEY" \
    | jq '{deleted: .doc.id, slug: .doc.slug}'
done
```

### Add redirect for Wine Refrigerators in next.config.mjs
```javascript
// In the redirects array, add:
{
  source: "/best-wine-refrigerators-reviews-buying-guide",
  destination: "/wines/showcase",
  permanent: true,
},
```

Commit this single file change:
```bash
git add next.config.mjs
git commit -m "fix: redirect wine refrigerators article to wine showcase"
git push origin main
```

---

## Step 5 — Verify all 7 articles now have content

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

for id in 3743 3742 3741 3738 3727 3715; do
  result=$(curl -s \
    "https://cms.winecountrycorner.com/api/articles/$id?depth=0" \
    -H "Authorization: users API-Key $CMS_KEY" \
    | jq '{id: .id, slug: .slug, nodes: (.content.root.children | length)}')
  echo "$result"
done
```

All 6 should show nodes > 5. Any showing 0 needs investigation.

(ID 3716 was deleted — not in this check)

---

## Step 6 — Commit restore script

```bash
git add scripts/restore-four-articles.mjs
git commit -m "feat: restore 4 WP article bodies to native Lexical + rewrite Wine Train and CA wine labels"
git push origin main
```

Signal complete with:
- restore-four-articles.mjs output (4 success lines)
- Verification output from Step 5 (all 6 node counts)
- Confirmation 3 articles deleted (IDs 3716, 3676, 3664)
- Redirect added for wine refrigerators → /wines/showcase
