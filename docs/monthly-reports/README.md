# How to make a monthly report

Written 2026-09-29 by Aster, after building the first one with Tyler for Colorado Girl
Coffee. That report is the template. This is how to make the next one without asking
anybody.

Read this end to end before building one. Most of it is about what NOT to do, because
the ways these go wrong are all the same three ways.

---

## The one rule that never changes

**The footer is always Neon Burro. Everything above it is always the client's.**

The client owns the top of the document and the studio owns the bottom. The shape says
it too. The client's letterhead is full bleed, square across the top of the sheet and
rounded below. The Neon Burro footer mirrors it, rounded above and square at the foot.

Nothing else about a report is fixed. Palettes, photography, which figures lead, how
many recommendations, all of that is per client.

---

## The three rules about numbers

These matter more than the design. A report that looks beautiful and says something
untrue costs the client's trust, and it is their staff who see it, not ours.

**1. A figure we cannot derive gets left out, not estimated.** Not zeroed, not dashed,
not filled with something plausible. The section simply does not render, and the report
says in words why. Colorado Girl's September report has a whole block headed *two numbers
are missing on purpose*, and it reads better than a guess would have.

**2. Never type a timestamp.** It got hand written four times while the first report was
being built and it was wrong every time, because whoever types it is guessing. Tyler
caught it. The updated stamp renders from an ISO value on the element, filled from
`client_reports.created_at`, so the document and the row cannot disagree.

```html
<div class="meta-stamp" id="updated" data-iso="2026-09-29T17:02:09Z"></div>
```

**3. The narrative is written by rule, never by a model.** Each sentence restates a
figure printed beside it so a reader can check it. This is already the law in
`netlify/functions/_client-report.js` and it applies to anything hand written too.

---

## Where the figures come from

For a Square client, the whole money section is four queries. Colorado Girl's came out
of these, run against their own token and location.

```js
// completed orders in the period
client.orders.search({ locationIds: [LOC], query: { filter: {
  dateTimeFilter: { closedAt: { startAt: BEGIN, endAt: END } },
  stateFilter: { states: ['COMPLETED'] } } } })

// wages, from the timecards
client.labor.shifts.search({ query: { filter: { start: { startAt: BEGIN, endAt: END } } } })

// what is actually on the menu, and how much of it has a photo
client.catalog.list({ types: 'ITEM' })
```

Two things learned doing it the first time:

- **The SDK is v43 and it dropped `Client` and `Environment`.** It is `SquareClient` and
  `SquareEnvironment` now, and the api namespaces changed too, `client.orders.search`
  rather than `client.ordersApi.searchOrders`. Colorado Girl's own netlify functions
  still use the old names and will fail when they next run.
- **Wages from timecards are not payroll.** No taxes, no employer burden, nobody
  salaried. Label it wages and say so, or the client reads it as their full cost.

---

## What goes in, in what order

1. **Cover.** Client mark, the period, a title. Nothing else in the colour band.
2. **Prepared by and prepared for**, below the band on the client's paper.
3. **The money.** Net sales and wages lead. Anything genuinely unknown is a question
   mark with a sentence saying why, not a blank.
4. **What sold.** Top three each side of the counter. This is where data problems show
   up, Colorado Girl had Cookie selling 595 times as one line and 59 items with no name
   at all, which made the case for the first recommendation better than any argument.
5. **Online presence score.** Five measured parts, no judgement. See below.
6. **What shipped**, in broad strokes with the reason attached, not a change log.
7. **Included either way**, the groundwork that needs no approving.
8. **Recommendations in phases**, each with a **Why** line and approve, pass or talk.
9. **The amount**, framed as a question and never as a price menu.
10. **What are you thinking about**, open, with a microphone.
11. **Submit**, one button, no name field, recipients pre ticked.

---

## The presence score

Five parts, each measured, averaged with the weights visible in the markup so the number
can be defended. Colorado Girl's came to **73**, not the low 80s that was asked for, and
the honest number was the better pitch, because 73 today and 90 in October with one job
in between is a story and 82 is a shrug.

| Part | Measured from |
|---|---|
| Reputation | Google rating and review count |
| Site health | PageSpeed, and what shipped this month |
| Findability | Titles, descriptions and schema coverage |
| Measurement | Whether traffic can be read at all |
| Menu depth | Items with a photo and a description, as a percentage |

If a part cannot be measured for that client, drop it and average the rest. Do not
invent a component to fill the shape.

---

## The share card

1200 by 630, built the way `coloradogirlcoffee/scripts/og-cards.mjs` builds its own.
Client's ground and mark, their title, the prepared for line, and `neonburro.` with the
lime period plus `pulse.neonburro.com` bottom right.

```bash
# the studio wordmark, typeset as one piece and trimmed, so the period lands
# where the type sets it rather than where a guess puts it
magick -background none -fill '#F4F3F1' -font dm-sans-500.ttf -pointsize 25 \
  label:'neonburro' -trim +repage wm-a.png
magick -background none -fill '#C5D957' -font dm-sans-500.ttf -pointsize 25 \
  label:'.' -trim +repage wm-b.png
magick wm-a.png wm-b.png -background none +append wm.png
```

Setting the wordmark and the period as two separate annotations at guessed offsets leaves
a visible gap. Append them.

**A card cannot contain a link.** A link preview is one image and one destination. The
studio mark sits on the card as a mark, and the card links to the report.

ImageMagick is not on Netlify, so cards are rendered by hand and committed, the same
arrangement `og-cards.mjs` already documents.

---

## Neon Burro's colours, for the footer

Straight from `neonburro/src/theme/colors.js`. Do not eyeball these.

| Token | Value | Use |
|---|---|---|
| sunken | `#070708` | the footer ground, their theme names it for exactly this |
| raised | `#141416` | the opt in box, tooltips |
| ink | `#F4F3F1` | the name, warm white, never `#FFF` |
| secondary | `#A8A7A4` | the role, the contact marks |
| muted | `#6E6E6B` | the tagline |
| ember | `#C5D957` | the period, hovers, one accent only |

Tyler's avatar leads, the burros on the account follow in one row at one size, slightly
tucked. Contact marks carry their own tooltips. Role is **Product and Systems Developer**.

---

## The link the owner opens

No account and no password. `/report/:token/` sits above the `ProtectedRoute` block in
`src/App.jsx`, beside login, reset password and accept invite. `netlify/functions/report-public.js`
is the door.

Read that file's header before changing it. The short version is that the token is the
only way in, the timestamp is the server's, and the first submit wins.

---

## Before you send one

- [ ] Every figure traced to a query, none typed
- [ ] Anything underivable left out with a sentence saying why
- [ ] Timestamp rendering from an ISO value
- [ ] Footer untouched, client brand everywhere above it
- [ ] Share card rendered and committed
- [ ] **Link sent to Tyler first.** Every finished report goes to him before it
      reaches an owner. No exceptions, including for routine months.

---

## Not built yet

- The studio notification to hello@neonburro.com on submit, filling `notified_at`
- The owner's confirmation email
- The client portal and its read policy, deliberately its own migration
- Blurred sample reports for showing new clients what they would get, Tyler's idea,
  a `.redact` class with a css blur over the money tiles would cover the html

Two migrations are written and unapplied, `20260927150000_client_reports.sql` and
`20260929170000_client_report_submittals.sql`. The first has to run before the second.
