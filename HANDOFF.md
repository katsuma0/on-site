# ON site, project handoff

The full context for working on ON site: what it is, why it exists, how its
owner thinks, the writing voice, and where things stand. Read it before a big
change. `CLAUDE.md` has the hard technical rules and the release loop;
`ios/SUBMISSION.md` has the App Store submission.

---

## 1. What this is

ON site is a private journal for Ontario's provincial park campgrounds, built
by **Katsuma Onishi**, who books the camping trips for friends and family and
got tired of gambling on sites nobody had seen. Walk a campground, rate each
site out of five, add a note or a photo, mark the ones worth booking again,
and rate campgrounds, trails and whole parks too.

The guide inside it covers 124 parks, 372 campgrounds, 20,031 individual
campsites (site counts checked against reservations.ontarioparks.ca on
21 July 2026) and 211 trails. That includes site-by-site backcountry at parks
like Killarney, French River and The Massasauga. Algonquin's interior is not
in it yet. Queen Elizabeth II Wildlands is listed like any other park; it has
no campground, only the wilderness section of the Ganaraska Trail.

It is a vanilla web app (no framework, no build step) that ships two ways:
the App Store app for iPhone and iPad (`ios/`, a SwiftUI shell around a
WKWebView with the web app bundled in) and the web version at
katsuma.ca/on-site. Everything lives on the device: localStorage for the
journal, IndexedDB for photos. There is no server, no account and no
analytics, and that is the point.

Names over time: Site Journal, then on-camp, then on-site (v0.205, which is
why the repo and the URL still say on-site), then ON site (v0.237). The
sibling app is on-fishing (Ontario fishing regulations), at
katsuma.ca/on-fishing. on-wildlife is not active.

## 2. How Katsuma thinks about it (read this twice)

- **A personal tool with craft.** Changes come in small, specific steps, and
  the details matter: whether a pill is vertically centred, whether two
  "5/5" badges are the same size, whether every margin is the same. When
  something "looks weird", the cause is almost always real.
- **Uniformity is the aesthetic.** One score chip everywhere. One row
  rhythm. Equal-height rows. The same space between every card and the edge.
  Fractions, never percentages.
- **Native and plain.** It should feel like an app Apple might have made: calm
  surfaces, system behaviours (swipe back, sheets that swipe down, haptics),
  nothing that needs explaining.
- **Honest in data and in words.** Site numbers come from real maps, with
  estimates marked. The app never claims what it cannot do, never implies it
  is official, and says plainly what stays on the device.
- **Teach, do not just fix.** When something breaks, explain the cause in
  plain words (the service worker saga, the flexbox compression bug).
- **Motion is bubbly but subtle.** Small spring overshoots, press-scale on
  everything touchable, haptics on meaningful taps, and never enough bounce
  to show an edge behind a page.

## 3. What is in the app (v1.0)

- **Parks:** every park A to Z with a letter rail, a region filter, and one
  search box that finds parks, campgrounds, sites ("Hemlock 112") and trails.
  Parks show up in the iPhone and iPad Home Screen search too.
- **Park page:** park rating, campgrounds with site grids coloured by score,
  wishlist, top sites, stats (once something is rated), trails, and About:
  the blurb, facilities, fishing (with a link to on-fishing for the zone) and
  the official park page. Favourite pill, and a reset row for that park.
- **Rating sheet:** 0 to 5, Wishlist, Trailer site, then "Add a note or
  photo" with the camera or the photo library. Typing stays above the
  keyboard. A share button at the bottom left sends the rating as a line of
  text (park, campground, site, score) through the iOS share sheet.
- **Map (app only):** Apple Maps with a pin for each of the 116 visitable
  provincial parks; a tapped pin opens the park in the app or its official
  page.
- **Favourites:** favourite parks, favourite sites, and visited parks that
  are not already favourites.
- **Journal:** everything rated, with filters (score, wishlist, notes,
  photos) and sorting, built for deciding what to book. Each park is a row
  like the Parks list, "N sites rated" under the name, with its average as a
  five-cell meter at the right. Stars mean wishlist and nothing else.
- **More:** Learn (bear safety, ticks, campfires, leave no trace, wildlife on
  the roads, cold water), Appearance (theme, text size S to XL, language,
  Car/tent or RV/trailer), Your data (export, import, reset), About, and
  Legal (privacy, terms, support).
- **Read-only consoles:** `debugsearch` and `statsearch`, typed into the
  Parks search. They are disclosed to App Review and are the only hidden
  things in the app.

## 4. Design

The iOS design system lives in `assets/ios.css` and is shown on
`styleguide.html`. Since 1.0 the app wears iOS itself: the system font, the
system blue tint, system greys and black in dark, and the metrics of iOS 26
Settings (16pt margins, 24pt corners, 48pt rows, 17pt semibold section
names, glass circle buttons). In the app the tab bar is native Liquid Glass,
modelled on Find My, and the Map tab is native MapKit. Light and dark follow
the system unless the person picks one under Appearance. Text sizes run S to
XL, and controls grow with them, never below 44pt. The older `DESIGN.md`,
`FORMAT-SPEC.md` and `SEARCH-SPEC.md` describe the v0.17x look and are kept
for history only.

## 5. Writing voice (this is part of the design)

- Sentence case everywhere; uppercase only through CSS on labels.
- **No em dashes, ever.** Commas and periods.
- Middots join metadata: `Central Park · Head Lake`, `3.5 km · Moderate`.
- Fractions, not percentages: `41/95`.
- Toasts are short, declarative and end with a period: "Cleared. Fresh start
  for this park."
- Empty states are one warm, unapologetic sentence: "No trails listed for
  this park yet."
- Buttons name the action plainly: "Rate this park", "Export a backup".
- First person, casual, honest, a little dry. Never marketing words.
- Say "device", not "phone" or "browser", in anything the app shows, since it
  runs on iPhone, iPad and the web.
- Versions entries: one line each, varied phrasing, milestones only.
- French is a full translation, not an afterthought; see `CLAUDE.md`.

## 6. Working rules that have burned us before

1. **Release lockstep:** `APP_VERSION`, `MARKETING_VERSION` and the service
   worker cache move together. `node tools/check.js` checks it.
2. **Never rename storage keys.** The list is in `CLAUDE.md`.
3. **The service worker never runs inside the app.** It once served a stale
   page forever.
4. **Bundled data is the truth inside the app.** A stale `parks-data.json`
   once silently replaced 124 parks with an old 123-park file.
5. **Verify a patch applied before you bump or commit.** Phantom commits
   have shipped when a script aborted halfway.
6. **Never make a view a flex container.** It broke auto-margin centring and
   compressed every page.
7. **Nothing hidden.** App Review rejects hidden or dormant features. The two
   consoles are disclosed; anything new must be too.
8. **Test before shipping.** Drive the app in a browser at phone size, in
   light and dark, in English and French, at text size XL.

## 7. Where things stand

1.0 is the first App Store release, ready to be built in Xcode and
submitted: a native Liquid Glass tab bar, Apple Maps with every park, the
look of iOS, no Profile, and the ON site logo as its icon.
Everything that can be done in the repo is done: Home Screen search, French
throughout (permission prompts included), accurate privacy, terms and
support pages inside the app, one window on iPad, iOS 17 or later, the
launch colour, a crisp icon, AA contrast in both themes, side safe areas,
and the submission guide. What is left is the owner's: the device test in
Xcode, the archive and upload, the App Store Connect fields and the
screenshots (`ios/SUBMISSION.md`).

Ideas for later live on katsuma.ca as Planned features: offline campground
maps, missing backcountry sites, public accounts, site availability and
reserving, and your feedback.

Work in small steps, explain causes, protect the data, and never let two
"5/5" chips disagree about their size.
