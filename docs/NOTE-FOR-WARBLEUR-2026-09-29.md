# Note for Warbleur, 29 September 2026

Warbleur, this is Aster. Tyler and I worked through the client report this morning and
he asked me to tell you what I touched here and why.

## What I added

One file, and nothing else in this repo:

    supabase/migrations/20260929170000_client_report_submittals.sql

It is **not applied**. It follows the same arrangement Volt used on the 27th, written
here, run by you or Tyler, with a ledger row at the bottom so a hand applied run shows
up in the connector's migration list.

**Run 20260927150000_client_reports.sql first.** That one is still unapplied too, and
mine alters the table it creates, so mine fails on its own. I checked the connector this
session and it only reaches the spencer fuller project, so I could not verify the live
schema state myself. Worth confirming before either runs.

## Why

Tyler had me build an interactive monthly report for Colorado Girl Coffee. The owner
marks each recommendation approved, passed or worth talking about, writes notes, picks
what he wants to spend next month and leaves a closing thought by microphone. It is the
template for every client's monthly report from here.

`client_reports.html` already keeps what we send. Nothing kept what came back.

That matters because the studio starts work on the strength of those answers. If we
build in October because Matt ticked things in September, the record of what he ticked
has to be the document he actually saw, frozen, with the server's time on it. An answers
blob on its own does not do that, because the report it answered can change underneath
it. So the migration keeps both, `responses` and `submitted_html`, in the same row.

`submitted_at` is written from the server clock and never from the request body. A
timestamp we rely on must not be settable by the person it binds.

## What I deliberately left out

**The client portal read policy.** Tyler wants an owner to log in and find their own
timestamped reports, and that is the right next step. I did not put it in this migration.
Volt's header says a client does not read this table from the portal yet and calls that
deliberate, and a read policy needs its own thinking about which rows an owner sees and
what happens when one company has two owners. Shipping it inside a migration about
submittals is how one client ends up reading another's revenue. It should be its own
change, reviewed on its own.

**A pdf column.** The frozen copy is html, which is what a pdf would be rendered from.
Storing both invites them to drift. When the portal lands it can render the pdf from
`submitted_html` on demand.

## Where these belong in Pulse, traced not guessed

I read the app before proposing spots, so these are the real ones.

**The owner's link is a public route.** `src/App.jsx` keeps four routes above the
`ProtectedRoute` block, login, reset password, accept invite and pin approval. A tokened
report belongs there as `/report/:token/`, no account, the same arrangement
cimarron-pulse uses for `PublicCard.jsx`. That route is also where the meta tags live, so
a texted link previews as the client's card rather than as Pulse.

**The client's own reports belong on the client.** `clients/:clientId/` already renders a
seven tab detail page, Overview, Sprints, Invoices, Recurring, Projects, Sites and
Messages, driven off `TAB_OPTIONS` in `ClientDetail.jsx`. Reports is an eighth tab beside
Invoices, listing that client's rows by period with sent and submitted state. That is the
spot Tyler asked for, everything under the exact client.

**The generate and preview loop mostly exists.** `client-report-preview.js` renders
without sending, `client-report-send.js` sends one, `client-report-monthly.js` is the
schedule and the Reports page gates each client behind approve once. What is missing is
the return trip, which is what this migration is for.

## An idea of Tyler's, recorded not built

Keep past reports as samples for new clients, figures blurred. A `.redact` class with a
css blur over the money tiles covers the html, a pdf would need the regions blurred
before render. Worth doing when somebody asks, not before.

## Two more files, added the same session

    netlify/functions/report-public.js
    docs/monthly-reports/README.md

**report-public.js is the owner's door and it is the only one in Pulse that answers
somebody with no session.** Every line assumes the caller might not be who we think. GET
by token answers one report, POST records the submittal. It takes no client id, no report
id and no period, because a door that accepts a row id is a way to read every client's
revenue by guessing numbers. `submitted_at` is the server clock and never the body, first
submit wins and a second is refused, and a bad token, an expired one and one that never
existed all answer identically, since a door that says "expired" has told an unknown
caller they guessed a real one.

It imports `createDb` and `json` from `_social.js` and needs the route registering above
`ProtectedRoute` in `src/App.jsx`. I have not touched App.jsx, that is a one line change
and it belongs with the page that renders it.

**The README is the helper Tyler asked for**, so these can be made by anyone without
asking. It carries the branding rule, the three rules about numbers, the Square queries
the figures came from, the presence score parts, the ImageMagick for the share card and a
checklist. It also records two things worth knowing, that the square SDK is v43 and the
old `Client` and `Environment` exports are gone, which means coloradogirlcoffee's own
functions will fail when they next run, and that wages off timecards are not payroll and
must not be labelled as such.

## Warbleur, this one is for you specifically

**Every link to pulse.neonburro.com previews as the fishbowl.** Tyler texted himself a
pulse link this morning and got the boardroom card and "Pulse the client portal", which
is correct for the portal and wrong for everything else we will ever share from here.

The cause is structural and not a bad image. `index.html` carries one hardcoded og block,
and `netlify.toml` rewrites `/*` to `/index.html` at 200, so every url on the domain
serves the same head. A crawler never runs our javascript, so react changing the tags
after mount changes nothing about what iMessage renders. Swapping the image does not fix
it either, because any one image is wrong for a per client report.

**The fix is an edge function on the share routes.** There are none in this repo yet so
this would be the first. It sits above the SPA catch all, matches `/r/*`, reads the slug,
fetches that report's client name, period and card url, rewrites the four og tags in
index.html and serves it. Crawlers get the right card, humans get the SPA exactly as
before, and nothing about the app changes. Roughly forty lines. It also pays off for
every future shareable thing here, plan rooms, proposals, invoices, each can carry its
own card off the same function.

**Tyler floated hosting the report on neonburro.com instead, and I would push back.**
It solves the preview because that site prerenders, but it puts a client's revenue and
payroll on the studio's public marketing site, which is the same objection that got the
report pulled off coloradogirlcoffee.com earlier today and he agreed with the reasoning
then. The data should stay on Pulse. The edge function is the smaller change and the
better boundary.

## How the link is meant to arrive

Tyler wants these going out by text, and SMS changes the security shape. A texted link is
the thing that leaks, previews render it, threads get forwarded, screenshots travel. So
the credential is deliberately NOT in the link.

    Matt, your September report from neonburro.

    pulse.neonburro.com/r/K3M9QP

    Code: 418 207

Short slug in the link, safe to preview and forward and useless alone. Six digits beside
it, pasteable. On iOS a last line formatted `@pulse.neonburro.com #418207` makes the code
a one tap autofill. The migration now carries `slug`, `access_code` and `code_attempts`
for this, and `submit_token` became the long single use half the door issues after the
code is accepted, so it never appears in a link or a text.

I have NOT reworked the door or the page for the two step exchange yet. Both currently
assume token in link. They change together and I would rather they be right than quick.

Tyler also asked for a request a new code path, with an admin notification to
hello@neonburro.com when somebody uses it. That is worth building alongside, a report
nobody can open is a report nobody answers, and the notification is how we find out
before he gives up.

## Still to build, not started

- The public submit function, looking a report up by `submit_token` and writing the four
  submit columns. Cimarron's `netlify/functions/plan-room-public.js` is the closest
  working example.
- The studio notification to hello@neonburro.com on submit, filling `notified_at`.
- The owner's own confirmation email.
- The portal page and its read policy.

The report itself is a Claude artifact at the moment, not in this repo. Tyler has the
link and has approved the format.

Nothing in this repo runs differently until somebody applies a migration.

Aster
