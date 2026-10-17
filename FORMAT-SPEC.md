# Exact Format Spec: Title Header and About Sheet

> **History.** This spec describes Site Journal v0.17x and is kept for reference only. The app now uses the iOS design system in `assets/ios.css` (shown on `styleguide.html`); where the two disagree, the CSS wins.

Measured from Site Journal v0.175. Every number is the real one. Paste the HTML and CSS blocks into the fishing regulation summary page and swap only the words.

---

## PART 1. The title header

### The anatomy, top to bottom
1. **Eyebrow** ("ONTARIO PARKS" in the corner) — for the fishing app: "ONTARIO FISHING"
2. **Title row** — big title on the left, small version number far right, on one baseline
3. **Description** (the sub line)
4. Search field, then the filter chip row, then the list

### Exact measurements

**Container (.appbar):**
- Padding top: `calc(20px + env(safe-area-inset-top))` (20px plus the notch)
- Padding sides: **18px** (the universal page gutter)
- Padding bottom: **14px**
- Width: `max-width:720px; margin:0 auto`

**Eyebrow:**
- Font: 11.5px, weight 800, `letter-spacing:.15em`, UPPERCASE via `text-transform`
- Colour: the accent (`--forest`)
- It is written in the HTML as "Ontario Parks" in normal case; CSS uppercases it
- No margins of its own

**Eyebrow to title gap:** the h1 carries `margin:5px 0 0` — so exactly **5px** between the eyebrow's baseline box and the title.

**Title row (.titlebar):**
- `display:flex; align-items:baseline; justify-content:space-between; gap:9px`
- Title (h1): **30px**, weight **800**, `letter-spacing:-.02em`, colour `--ink`, `margin:5px 0 0`
- Version button (far right): **15px**, weight **800**, `letter-spacing:-.02em`, colour `--ink`, no background or border, `padding:0`, `margin:5px 0 0`. Both sit on the same text baseline.

**Title to description gap:** the sub carries `margin-top:5px` — exactly **5px**.

**Description (.sub):**
- Font: **13.5px**, weight 400, colour `--moss` (secondary green-grey)
- Line height inherits the global **1.5**
- Two to three short sentences maximum

**Description to search gap:** the content area below the header starts a `.wrap` (same 18px gutters); the search box has `margin:2px 0 12px` — effectively the header's 14px bottom padding plus 2px = **16px** visual gap.

**Row spacing in the list below:**
- Filter chip row: `margin:12px 0` above and below
- Every list card: `margin-bottom:10px` (that is the universal row gap; nothing else separates rows)
- Section labels, when used: `margin:22px 2px 12px`

### Paste-ready HTML
```html
<div class="appbar">
  <div class="eyebrow">Ontario Fishing</div>
  <div class="titlebar">
    <h1 id="appTitle">Regulation Summary</h1>
    <button class="ver" id="verBtn">v0.1</button>
  </div>
  <div class="sub">Pick a zone, check the seasons and limits, and know before you cast. Everything is saved to this device only.</div>
</div>
```

### Paste-ready CSS
```css
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Hanken Grotesk",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.5}

.appbar{padding:calc(20px + env(safe-area-inset-top)) 18px 14px;max-width:720px;margin:0 auto}
.eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--forest)}
.titlebar{display:flex;align-items:baseline;justify-content:space-between;gap:9px}
h1{font-weight:800;font-size:30px;letter-spacing:-.02em;margin:5px 0 0;cursor:pointer}
.ver{appearance:none;border:none;background:none;cursor:pointer;font-family:inherit;
  font-weight:800;font-size:15px;letter-spacing:-.02em;color:var(--ink);white-space:nowrap;padding:0;margin:5px 0 0}
.sub{color:var(--moss);font-size:13.5px;margin-top:5px}
```

---

## PART 2. The About sheet (tapping the title)

### Behaviour
Tapping the h1 opens a bottom sheet. It slides up from the bottom edge, sits over a dimmed backdrop, and closes by backdrop tap or swiping the sheet down.

### Exact sheet dimensions
- **Width:** `min(540px, 100%)` — full width on phones, capped and centred on wide screens (`margin:0 auto; left:0; right:0`)
- **Height:** grows with content up to **`max-height:92vh`**, then the sheet itself scrolls (`overflow:auto`)
- **Corners:** rounded on top only, **16px** (`border-radius:16px 16px 0 0`)
- **Padding:** `8px 22px calc(26px + env(safe-area-inset-bottom))` — 8 top, **22 sides** (sheets use 22, not the page's 18), 26+safe-area bottom
- **Shadow:** `0 -8px 40px rgba(19,32,25,.22)`
- **Motion:** starts at `translateY(102%)`, animates to 0 in `.34s cubic-bezier(.32,1.22,.38,1)`

### Inside, top to bottom, with every gap
1. **Grabber bar:** 40px wide, 4px tall, fully rounded, colour `--mist-2`, `margin:7px auto 16px` (7 above, 16 below)
2. **Kind label** ("ABOUT"): 11px, weight 800, `letter-spacing:.12em`, uppercase, accent colour, `margin-bottom:12px`
3. **Body paragraphs:** inherit the base font at its natural size with **line-height 1.5**; standard paragraph margins (1em between paragraphs — do not override). Sentence-case, first person, two to four sentences each.
4. **Next section label** ("THEMES" in Site Journal; whatever the fishing app needs): same style as the kind label but `margin:24px 0 12px` — the **24px** top margin is the between-sections rhythm inside sheets
5. **Section content:** stacked rows in a column, `gap:10px`, each row the standard sheet row (border `--line`, background `--card`, radius 12px, padding 14px 16px, 14.5px/700 text)
6. **Closing line** (the fraction in Site Journal): 12px, weight 600, `--moss`, centred, `margin-top:12px` — the very last element before the bottom padding

### Paste-ready HTML
```html
<div class="backdrop" id="settingsBackdrop"></div>
<div class="sheet" id="aboutSheet" role="dialog" aria-modal="true" aria-label="About">
  <div class="grabber"></div>
  <div class="kind" style="margin-bottom:12px">About</div>
  <div class="aboutbody">
    <p>I fish all over Ontario, and every trip starts the same way: digging through the regulation summary trying to figure out what is open, where, and how many I can keep.</p>
    <p>So, I wanted a simple page that answers it fast. Pick your zone, see the seasons and limits laid out plainly, and get back to fishing.</p>
  </div>
  <div class="kind" style="margin:24px 0 12px">Zones</div>
  <!-- rows go here -->
</div>
```

### Paste-ready CSS
```css
.backdrop{position:fixed;inset:0;background:rgba(15,31,23,.35);opacity:0;pointer-events:none;transition:opacity .25s;z-index:40}
.backdrop.on{opacity:1;pointer-events:auto}

.sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;transform:translateY(102%);
  width:min(540px,100%);background:var(--paper);z-index:50;
  border-radius:16px 16px 0 0;
  padding:8px 22px calc(26px + env(safe-area-inset-bottom));
  box-shadow:0 -8px 40px rgba(19,32,25,.22);
  transition:transform .34s cubic-bezier(.32,1.22,.38,1);
  max-height:92vh;overflow:auto}
.sheet.on{transform:translateY(0)}

.grabber{width:40px;height:4px;border-radius:99px;background:var(--mist-2);margin:7px auto 16px}
.kind{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--forest)}
```

### Wiring (identical pattern)
```js
document.getElementById('appTitle').addEventListener('click',openAbout);
function openAbout(){ settingsBackdrop.classList.add('on');
  const sh=document.getElementById('aboutSheet'); sh.classList.add('on'); sh.scrollTop=0; }
function closeAbout(){ settingsBackdrop.classList.remove('on');
  document.getElementById('aboutSheet').classList.remove('on'); }
settingsBackdrop.addEventListener('click',closeAbout);
```
(Site Journal also locks body scroll while a sheet is open and adds swipe-down-to-close; port those helpers if you want the full feel.)

---
Everything above is measured, not remembered. Between this file and universal-design-system.md, the fishing page can be a pixel sibling.
