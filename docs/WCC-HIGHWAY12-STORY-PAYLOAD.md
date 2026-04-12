# Payload Admin Prompt — Highway 12 Story → Payload Lexical

## Context
Highway 12 Winery (Payload ID 7) has a featured story written but
never uploaded to the featuredStory richText field. This pastes it
directly via the API as native Lexical JSON.

---

## Step 1 — Verify the field is currently empty

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

curl -s "https://cms.winecountrycorner.com/api/wineries/7?depth=0" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{slug: .slug, storyNodes: (.featuredStory.root.children | length)}'
```

Expected: storyNodes: 0 (empty). If > 0, story already exists — stop.

---

## Step 2 — Upload via Payload admin panel

Go to: cms.winecountrycorner.com/admin/collections/wineries/7

Find the `featuredStory` richText field and paste this content,
formatting section headers as H2 and body as paragraphs:

---

In the early 2000s, something was happening to Sonoma wine country.
Family wineries — the ones built on personal relationships, local
knowledge, and handshake deals with growers — were being acquired by
corporations at a measurable rate. The consolidation that had been
coming for years had arrived.

Two men who had met working at Viansa Winery in Sonoma looked at what
was happening and chose a different road entirely.

Paul Giusto and Michael Sebastiani founded Generations of Sonoma in
2004 and launched Highway 12 Winery. The name was not chosen casually.
Highway 12 is the actual road that connects Sebastopol through the
Russian River Valley, east through Sonoma Valley and Carneros, into
Napa, through the Delta, all the way to Lodi and the San Andreas Fault.
Every vineyard they wanted to work with — Sangiacomo in Carneros, the
McLeod Family Vineyard in Kenwood, Serres Ranch — sat on or adjacent
to this road.

They named the winery after the road because the road is the whole
story.

## Why This Is the Winery You've Been Looking For

Here's the problem with most wine country trips: by the time you've
done the research, booked the tastings, and navigated to the wineries
with the longest waitlists and the most Instagram posts, you've spent
a full day driving around Napa Valley drinking adequate wine in
beautiful rooms. You've seen the marketing. You haven't found the wine.

Highway 12 is the antidote. Two men with three generations of Sonoma
winemaking heritage between them, sourcing from the same legendary
vineyards as producers who charge three times as much, putting 91-point
Sauvignon Blanc and Cabernet on the table at $26 and calling it what
it is: world-class Sonoma fruit at prices built for real people.

The 2024 Sauvignon Blanc scored 91 points and a Best Buy designation
from Wine Enthusiast at $26. The 2022 Cabernet Sauvignon did the same.
These are not compromise wines at accessible prices — they are
genuinely excellent wines from genuinely excellent vineyards that Paul
and Michael have been sourcing from for decades because they know the
farmers personally.

## Three Generations on One Road

Michael Sebastiani was in the vineyards by age ten. His family's
winemaking history in Sonoma predates most of what tourists come to
see. Paul Giusto has spent thirty years in the Sonoma Valley wine
industry, starting at his family's gas station in San Francisco
learning customer service and small business before eventually finding
his way to wine — and never leaving.

They met at Viansa, spent years building their knowledge of the
valley's growers and vineyards, and in 2004 decided to stop making
wine for other people.

The grower relationships at Highway 12 are not contracts. Paul and
Michael describe them as friendships forged over twenty years — built
on trust, not paperwork. When Sangiacomo offers them a specific block,
or the McLeod family in Kenwood holds fruit for them, it's because the
relationships go deep enough that quality flows both directions.

## Two Labels, One Philosophy

Highway 12 is the everyday range. The Sauvignon Blanc. The Cabernet.
The Sonoma Highway Cabernet at $32 delivering Sonoma Valley character
that earns its price without announcing it. Wines built for
accessibility without compromise.

Highwayman is the reserve tier — Paul and Michael's personal
expression of what their best sourcing can produce. The Highwayman
Proprietary Red is the flagship: a Sonoma blend of depth and
complexity that reflects years of knowing exactly which blocks to pick
from and exactly when. The Reserve Cabernet Sauvignon is serious wine
from serious fruit.

The decision to run two tiers was deliberate. Highway 12 gets the
brand in front of people who might otherwise never try an independent
Sonoma winery. Highwayman gives those people somewhere to go when
they're ready to go deeper.

## The Barn

The tasting room is called The Barn. It occupies the historic J.G.
Marcy Stable, one of the original structures adjacent to Sonoma Plaza,
tucked between Vine Alley and Broadway — the space where Katie
Bundschu's Abbott's Passage used to be before the Bundschu family
moved to Valley of the Moon.

Steps from Sonoma Square. From the restaurants. From the tasting rooms
on the east end of downtown. If you're spending a day in Sonoma, you
will walk past The Barn.

The experience inside is exactly what the building suggests: casual,
knowledgeable, genuinely hospitable. Clean jeans beat suits. The wine
slinger pours for you like you've been coming in for years, whether or
not you have. This is Sonoma wine tasting as it was before Sonoma
became famous for wine tasting.

Tastings are $25 per person, by reservation, limited to groups of one
to six. Open daily except Tuesday, 11AM to 5:30PM.

## The Road Ahead

Paul and Michael set out in 2004 to create a hometown winery that
could resist corporate consolidation and stay true to what made Sonoma
wine country worth caring about in the first place. Twenty years later,
they're still on the road. The wines are better than ever. The grower
relationships are deeper than ever. The Barn is exactly what they
promised it would be.

Find it before your next Sonoma trip. Walk in. Ask for a flight of
Highwayman. Let them tell you about the vineyards.

This is what Sonoma wine country actually looks like when you get off
the main road.

---

## Step 3 — Verify the story saved

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

curl -s "https://cms.winecountrycorner.com/api/wineries/7?depth=0" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{
      slug: .slug,
      storyNodes: (.featuredStory.root.children | length),
      firstParagraph: .featuredStory.root.children[0].children[0].text
    }'
```

Expected: storyNodes > 15, firstParagraph starts with "In the early 2000s"

Signal complete with the verification output.
