# Universal Design System

> **History.** This spec describes Site Journal v0.17x and is kept for reference only. The app now uses the iOS design system in `assets/ios.css` (shown on `styleguide.html`); where the two disagree, the CSS wins.

### Site Journal and the Fishing Regulation Map
One theme, two apps. Copy this file into the fishing app repo and treat it as law. Every value below is lifted verbatim from Site Journal v0.174's Default theme, so anything built from this list is pixel compatible.

---

## 1. Colour tokens

Paste this `:root` block unchanged. Do not invent new colours; if a purpose is missing, reuse the closest token.

```css
:root{
  --paper:#F1F6F1;        /* page background, soft green-white */
  --card:#FFFFFF;         /* card and control surfaces */
  --ink:#0F1F17;          /* primary text, near-black green */
  --forest:#00753A;       /* THE accent: headers, active states, links of action */
  --forest-2:#18A05A;     /* lighter accent, gradients and fills */
  --forest-press:#005C2C; /* pressed state of accent */
  --green-tint:#E7F3EB;   /* subtle accent-tinted fill */
  --green-tint-2:#D6EBDC; /* deeper tinted fill */
  --moss:#40564B;         /* secondary text, hints, metadata */
  --mist:#E4EDE4;         /* inset fills: track backgrounds, tiles */
  --mist-2:#C7D7C9;       /* grabber bars, stronger inset lines */
  --line:#D3E0D4;         /* ALL borders, 1px */
  --amber:#EFBF25;        /* wishlist / star / highlight only */
  --amber-soft:#FBEEDC;   /* amber-tinted fill */
}
```

Usage rules:
- Text is `--ink` or `--moss`, never grey hexes.
- The accent (`--forest`) is used sparingly: section labels, the sticky top bar, active chips, primary buttons, key names. In the fishing app the accent may be re-hued (a lake blue like `#1C6FA8` suits it) but every OTHER token stays identical, and the accent must keep similar darkness so white text stays readable on it.
- Destructive links use `#B0574A`, underlined, never a filled red button.

## 2. Geometry tokens

```css
:root{
  --r:16px;       /* cards, sheets */
  --r-sm:12px;    /* inputs, rows, small buttons */
  --r-xs:8px;     /* tiny elements */
  --row-h:64px;
  --gap-s:6px;  --gap-m:10px;  --gap-l:12px;
  --pad-card:14px 16px;
  --pad-row:12px 14px;
  --shadow-sm:0 1px 2px rgba(15,31,23,.06);
  --shadow:0 2px 12px rgba(15,31,23,.08);
  --shadow-btn:0 3px 10px rgba(0,117,58,.30);
}
```

- Pills (chips, score badges, progress tracks, grabbers) are always `border-radius:99px`.
- Page gutters: **18px** left and right, everywhere, without exception.
- Content max width: **720px**, centred (`max-width:720px;margin:0 auto`).
- Section spacing: labels carry `margin:22px 2px 12px`; cards stack with `--gap-m` (10px) between.
- Tap targets: 44pt minimum effective size. Visually smaller controls get invisible expanded hit areas (`::after{position:absolute;inset:-7px}` pattern).

## 3. Typography

Font stack, loaded once and used for everything:

```css
font-family:"Hanken Grotesk",system-ui,sans-serif;
```

(Include Hanken Grotesk 400/600/700/800 from Google Fonts. Monospace is reserved for hidden console output: `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`.)

The complete type scale. Do not add sizes between these:

| Role | Size | Weight | Extras |
|---|---|---|---|
| App title (h1) | 30px | 800 | `letter-spacing:-.02em` |
| Version mark beside title | 15px | 800 | `letter-spacing:-.02em`, colour `--ink` |
| Card title (park name) | 20px | 800 | `letter-spacing:-.01em`, colour accent |
| Row / item name | 16px | 700 | `letter-spacing:-.01em`, colour accent |
| Sheet row | 14.5px | 700 | colour `--ink` |
| Buttons, back label | 14px | 700–800 | |
| Intro sub, empty states | 13.5–14px | 400 | colour `--moss` |
| Item metadata | 13px | 400 | colour `--moss` |
| Chips, hints, score pills | 12.5px | 600–800 | |
| Section label | 12px | 800 | UPPERCASE, `letter-spacing:.1em`, colour accent |
| Sheet kind label | 11px | 800 | UPPERCASE, `letter-spacing:.12em`, colour accent |
| Footer | 11.5px | 400 | colour `--moss`, `line-height:1.55` |

Inputs are always **16px** (anything smaller triggers iOS focus zoom). Numbers that align in columns get `font-variant-numeric:tabular-nums`.

## 4. Component recipes

### App header
```css
.appbar{padding:calc(20px + env(safe-area-inset-top)) 18px 14px;max-width:720px;margin:0 auto}
h1{font-weight:800;font-size:30px;letter-spacing:-.02em;margin:5px 0 0}
.titlebar{display:flex;align-items:baseline;justify-content:space-between;gap:9px}
.sub{color:var(--moss);font-size:13.5px;margin-top:5px}
```

### Card (the primary list unit)
```css
.card{display:block;width:100%;text-align:left;border:1px solid var(--line);background:var(--card);
  border-radius:var(--r);padding:16px;margin-bottom:var(--gap-m);cursor:pointer;
  transition:border-color .15s,transform .14s}
.card:active{transform:scale(.982)}
```

### Search field
```css
.search{display:flex;align-items:center;gap:var(--gap-m);background:var(--card);border:1px solid var(--line);
  border-radius:var(--r-sm);padding:var(--pad-row);margin:2px 0 12px}
.search input{border:none;background:none;outline:none;font-family:inherit;font-size:16px;width:100%;color:var(--ink)}
```

### Filter chips (the pill row under search)
```css
.filters{display:flex;justify-content:flex-start;gap:8px;margin:var(--gap-l) 0}
.fchip{display:inline-flex;align-items:center;gap:var(--gap-s);border:1px solid var(--line);background:var(--card);
  color:var(--moss);font-weight:700;font-size:12.5px;border-radius:99px;padding:9px 14px;transition:background .12s}
.fchip.on{background:var(--forest);border-color:var(--forest);color:var(--paper)}
.fchip:active{transform:scale(.97)}
```

### Section label
```css
.seclabel{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--forest);
  margin:22px 2px 12px;display:flex;align-items:center;gap:var(--gap-m)}
.seclabel::after{content:"";flex:1;height:1px;background:var(--line)}
```

### Bottom sheet
```css
.sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;transform:translateY(102%);
  width:min(540px,100%);background:var(--paper);z-index:50;border-radius:var(--r) var(--r) 0 0;
  padding:8px 22px calc(26px + env(safe-area-inset-bottom));box-shadow:0 -8px 40px rgba(19,32,25,.22);
  transition:transform .34s cubic-bezier(.32,1.22,.38,1);max-height:92vh;overflow:auto}
.sheet.on{transform:translateY(0)}
.grabber{width:40px;height:4px;border-radius:99px;background:var(--mist-2);margin:7px auto 16px}
.kind{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--forest)}
```
Sheets are dismissed by backdrop tap and by swiping down; inner scroll areas get a `scrolly` class and the swipe handler yields to them until they reach the top.

### Sheet rows
```css
.rrow{display:flex;justify-content:space-between;align-items:center;width:100%;border:1px solid var(--line);
  background:var(--card);color:var(--ink);font-weight:700;font-size:14.5px;border-radius:var(--r-sm);
  padding:var(--pad-card);margin-bottom:var(--gap-m)}
.rcount{color:var(--moss);font-weight:600;font-size:12.5px}
```

### Score / value pill (the ONE universal badge)
```css
.pill{flex:none;font-weight:800;font-size:12.5px;border:1px solid var(--line);border-radius:99px;
  padding:8px 13px;color:var(--forest);min-width:54px;text-align:center}
.pill.filled{color:#fff;border-color:transparent /* background set inline to the value's colour */}
```

### Sticky coloured top bar (detail pages)
```css
.topbar{position:sticky;top:0;z-index:20;background:var(--forest);color:var(--paper);
  padding:calc(11px + env(safe-area-inset-top)) 18px 11px}
.backbtn{border:none;background:none;color:var(--paper);font-weight:700;font-size:14px;
  display:inline-flex;align-items:center;gap:var(--gap-s);padding:12px 14px;margin:-12px -14px}
```

### Progress bar
```css
.bar{height:6px;border-radius:99px;background:var(--mist);overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--forest),var(--forest-2))}
```

### Footer (identical in both apps)
```html
<footer>
  Ratings and photos are saved to this device only.<br>
  Created by <a href="https://katsuma0.github.io" target="_blank" rel="noopener"
    style="color:inherit;text-decoration:underline;text-underline-offset:2px">Katsuma Onishi</a>
</footer>
```
```css
footer{max-width:720px;margin:0 auto;padding:20px 18px 40px;color:var(--moss);font-size:11.5px;line-height:1.55}
```
Swap the first line for whatever the fishing app stores ("Saved to this device only." works). Destructive footer links: `color:#B0574A;text-decoration:underline;font-weight:600` with a two-tap arm-and-confirm.

## 5. Motion

One physical personality across both apps:

- Detail pages slide in from the right: `translateX(24%) -> 0`, `.36s cubic-bezier(.32,1.08,.38,1)` (whisper of overshoot, never enough to expose an edge).
- Lists and home views rise: `translateY(10px) + fade`, `.28s cubic-bezier(.3,1.12,.4,1)`.
- Sheets: `.34s cubic-bezier(.32,1.22,.38,1)`.
- Swipe-back cancel springs home with `cubic-bezier(.22,1.28,.36,1)`.
- Press feedback everywhere: `:active{transform:scale(.97–.985)}` with a ~.14s transition.
- Haptics on every meaningful tap (light impact), debounced ~80ms.
- Always honour `@media (prefers-reduced-motion: reduce){animation:none}`.

## 6. Voice and wording

The words are part of the theme. Rules, with Site Journal's phrasing as the model:

- **Sentence case everywhere.** Titles, buttons, labels: "Reset all data", "Pick any Ontario town", never Title Case. Only `.seclabel`/`.kind` render uppercase, and via CSS, not the copy.
- **No em dashes.** Commas and periods only.
- **Middots join metadata**, each segment Capitalized: `Central Park · Head Lake`, `3.5 km · Moderate`.
- **Fractions, not percentages**, in `tabular-nums`: `41/95`, `123 / 123`.
- **Short declarative toasts ending in a period:** "Cleared. Fresh start for this park." Two beats maximum.
- **Empty states are one warm sentence, never apologetic:** "No trails listed for this park yet." / "No matches. Try a park, a campground, or Hemlock 112."
- **Buttons say the action plainly:** "Rate this park", "Plant dummy data", "Tap again to erase everything".
- **Hints are two or three words in `--moss`:** "Driving time", "Most scouted", "A to Z".
- **The intro is one friendly line of instruction plus one line of trust.** Fishing app equivalent, matched to Site Journal's cadence: *"Pick a zone, check the seasons and limits, and know before you cast. Everything is saved to this device only."*
- First person, casual, honest. "There are some spots out there that are not it" energy. No marketing words: never "seamless", "powerful", "experience".

## 7. Structural conventions

- One HTML file per app; no frameworks.
- Views are `<section>`s toggled with `hidden`; each view owns its own `<footer>` so swipes carry it.
- Detail views set `min-height:100dvh` so short pages remain fully swipeable. Never make a view a flex container (it breaks auto-margin centring of children).
- localStorage keys namespaced per app (`site-journal-*` / `fishing-map-*`); never rename a key after shipping.
- Version mark: `<button class="ver">v0.NNN</button>` at the far right of the title row, 15px/800/ink, opening a Versions sheet of one-line entries: `<span class="vv">v0.62</span>Region filters`.
- A hidden diagnostic (`debugsearch` pattern) rendered as a monospace console card: label left in `--moss`, value right in bold, dashed dividers.

---
Built from Site Journal v0.174. When either app changes a shared value, change it here first.
