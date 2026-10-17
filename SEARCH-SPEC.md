# Exact Format Spec: Search Bar and Results

> **History.** This spec describes Site Journal v0.17x and is kept for reference only. The app now uses the iOS design system in `assets/ios.css` (shown on `styleguide.html`); where the two disagree, the CSS wins.

Measured from Site Journal v0.175. Paste the blocks, swap the words and categories, and the fishing regulation page's search will be an exact visual copy.

---

## 1. The search bar

### Anatomy
A single rounded row: magnifier icon, the input, and a clear "✕" that only appears once there's text.

### Exact measurements
- Container: background `--card`, border `1px solid var(--line)`, radius **12px**, padding **12px 14px**, `display:flex; align-items:center; gap:10px`, margins `2px 0 12px`
- Icon: an 18×18 stroked SVG magnifier, colour `--moss`, `flex:none`
- Input: **16px** (never smaller — under 16px iOS zooms the page on focus), family inherit, colour `--ink`, no border/background/outline, `width:100%`
- Placeholder: sentence case, names the categories: "Search parks, sites, or trails" → fishing version: "Search zones, species, or lakes"
- Clear button: 16px "✕", colour `--moss`, `padding:2px 4px`, hidden by default; shown by toggling a `has` class on the container whenever the input has text

### Paste-ready HTML
```html
<div class="gsearch" id="gsearch">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  <input id="gq" inputmode="search" autocomplete="off" placeholder="Search zones, species, or lakes">
  <button class="gclear" id="gclear" aria-label="Clear search">✕</button>
</div>
<div id="gresults" class="gresults" hidden></div>
```

### Paste-ready CSS
```css
.gsearch{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);
  border-radius:12px;padding:12px 14px;margin:2px 0 12px}
.gsearch svg{flex:none;color:var(--moss)}
.gsearch input{border:none;background:none;outline:none;font-family:inherit;font-size:16px;width:100%;color:var(--ink)}
.gclear{appearance:none;border:none;background:none;color:var(--moss);cursor:pointer;font-size:16px;
  line-height:1;padding:2px 4px;display:none}
.gsearch.has .gclear{display:block}
.gresults{margin:0 0 14px}
```

---

## 2. Result rows

### Anatomy
Each result is one full-width button: a small **category bubble** on the left, then a two-line text block — bold title on top, one-line grey description under it.

### The category bubble (.tag) — the signature element
- **Fixed size: 46px wide × 22px tall.** Never sizes to its text; every bubble in the column is identical, which is what makes the list read as designed.
- **Perfectly centred vertically.** The bubble sits dead-centre against the two-line text block: equal space above and below it. Three rules working together guarantee this: the row has `align-items:center`, the pill has `align-self:center` plus `margin:auto 0`, and the pill centres its own label with `display:flex; align-items:center; justify-content:center; line-height:1`. Include all three or the pill drifts toward the top on taller rows.
- Fully rounded (`border-radius:99px`), text perfectly centred via flex
- Font: **9.5px**, weight **800**, `letter-spacing:.03em`, UPPERCASE, `line-height:1`, colour `--paper` (i.e. light text on a coloured pill)
- Labels are 4–5 characters max so they fit the fixed pill: Park / Camp / Site / Trail. Fishing versions: Zone / Fish / Lake / Rule
- **One colour per category**, assigned by a class on the pill:
  - primary category: `var(--forest)` (the accent)
  - secondary: `var(--forest-2)` (lighter accent)
  - third: `var(--amber)` (#EFBF25)
  - fourth: a steel blue `#3E7CA6`
  Reuse these four exact colours; they're chosen to stay legible with light text and to be distinguishable at 22px tall.

### The text block
- Wrapper: `flex:1; min-width:0` (the min-width is what lets the description ellipsize instead of stretching the row)
- **Title (.gt):** 15px, weight 700, colour `--ink`, one line
- **Description (.gs):** 12.5px, weight 400, colour `--moss`, `margin-top:3px`, single line with `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
- Description content pattern: the parent or context, middot-joined when multiple parts: "Near North Park · Grundy Lake" / "3.5 km · Moderate". Fishing: "Zone 15 · Open Jan 1 to Mar 31"

### The row itself
- Full-width button, background `--card`, border `1px solid var(--line)`, radius **12px**, padding **12px 14px**
- `display:flex; align-items:center; gap:10px`
- **10px** between rows (`margin-bottom`)
- Results capped at ~15; ordered by category rank first (Zone before Fish before Lake before Rule), then by match score

### Empty state (.gnone)
Same card treatment, centred: 14px `--moss` text, padding 18px 6px, border and 12px radius. One helpful sentence naming what can be searched: "No matches. Try a zone, a species, or a lake."

### Paste-ready CSS
```css
.gresult{width:100%;text-align:left;appearance:none;background:var(--card);border:1px solid var(--line);
  border-radius:12px;padding:12px 14px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:10px}
.tag{flex:0 0 46px;width:46px;height:22px;display:flex;align-items:center;justify-content:center;align-self:center;margin:auto 0;
  font-size:9.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;line-height:1;padding:0;
  color:var(--paper);background:var(--forest);border-radius:99px}
.tag.fish{background:var(--forest-2)}
.tag.lake{background:var(--amber)}
.tag.rule{background:#3E7CA6}
.grow{flex:1;min-width:0}
.gt{display:block;font-weight:700;font-size:15px}
.gs{display:block;font-size:12.5px;color:var(--moss);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gnone{color:var(--moss);font-size:14px;padding:18px 6px;text-align:center;border:1px solid var(--line);border-radius:12px;background:var(--card)}
```

---

## 3. Behaviour and wiring

The interaction contract, identical in both apps:

1. Typing anything: the main list below hides, the results container shows. Clearing: results hide, list returns. No minimum query length.
2. The `has` class on the search container toggles with input text (shows the ✕).
3. The ✕ clears the input, hides results, restores the list.
4. Search matches **by words, not whole phrases**, with filler words ignored (Site Journal drops "provincial", "park", "the"; fishing should drop "zone", "lake", "the") — so "zone 15 walleye" and "walleye 15" both hit.
5. Ranking: exact-name match +12, name-starts-with +6, then base score by category; sort category rank first, then score; slice to 15.

### Paste-ready render + wiring skeleton
```js
const tagLabel={zone:'Zone',fish:'Fish',lake:'Lake',rule:'Rule'};
function renderResults(results){
  const rbox=document.getElementById('gresults');
  if(!results.length){ rbox.innerHTML='<div class="gnone">No matches. Try a zone, a species, or a lake.</div>'; return; }
  rbox.innerHTML=results.map((r,i)=>`<button class="gresult" data-i="${i}">`
    +`<span class="tag ${r.type}">${tagLabel[r.type]}</span>`
    +`<span class="grow"><span class="gt">${r.title}</span><span class="gs">${r.sub}</span></span></button>`).join('');
  rbox.querySelectorAll('.gresult').forEach(el=>el.addEventListener('click',()=>gotoResult(results[+el.dataset.i])));
}
function onSearch(){
  const gq=document.getElementById('gq'), q=gq.value;
  document.getElementById('gsearch').classList.toggle('has',!!q.trim());
  const rbox=document.getElementById('gresults'), list=document.getElementById('mainList');
  if(!q.trim()){ rbox.hidden=true; rbox.innerHTML=''; list.hidden=false; return; }
  list.hidden=true; rbox.hidden=false;
  renderResults(searchAll(q));
}
document.getElementById('gq').addEventListener('input',onSearch);
document.getElementById('gclear').addEventListener('click',()=>{ document.getElementById('gq').value=''; onSearch(); });
```

---
Uses the shared tokens from universal-design-system.md (`--card --line --ink --moss --forest --forest-2 --amber --paper`). With those defined, these blocks drop in and match Site Journal to the pixel.
