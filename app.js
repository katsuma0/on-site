/* Appearance is stamped pre-paint by the inline script in index.html <head>,
   from the shared 'outdoors-appearance' key. The panel wiring lives below. */

/* ================= parks (embedded for instant load; refreshed from network in the background) ================= */
let PARKS=[];
let PARK_BY_ID={};
function setParks(arr){ PARKS=Array.isArray(arr)?arr:[]; PARK_BY_ID=Object.fromEntries(PARKS.map(p=>[p.id,p])); }
function loadParksEmbedded(){
  try{ setParks((window.PARKS_DATA||[])); }
  catch(e){ setParks([]); }
}
async function refreshParksFromNetwork(){
  if(window.Capacitor) return; /* the app ships its data embedded; a local file can only ever be stale */
  /* the compare stringifies ~235KB twice; run it when the main thread is idle
     so it never competes with first paint or a tap */
  const idle=window.requestIdleCallback||function(f){ return setTimeout(function(){ f(); },1200); };
  idle(async function(){
    try{
      const res=await fetch('./parks-data.json',{cache:'no-store'});
      if(!res.ok) return;
      const freshText=await res.text();
      const fresh=JSON.parse(freshText);
      if(!Array.isArray(fresh)||!fresh.length) return;
      // compare the compact re-stringify of both sides (the file may be pretty-printed)
      if(JSON.stringify(fresh)===JSON.stringify(window.PARKS_DATA||[])) return;   // identical, nothing changed
      setParks(fresh); buildSearchIndex();
      if(!document.getElementById('view-parks').hidden) renderParks();   // only redraw home; don't disturb an open park
    }catch(e){}
  });
}
const CG_BY_ID=id=>curPark.campgrounds.find(c=>c.id===id);
function cgSites(cg){ if(cg.sites) return cg.sites.slice(); const a=[]; for(let i=cg.from;i<=cg.to;i++)a.push(String(i)); return a; }
function keyOf(pid,cgId,site){ return pid+'#'+cgId+'#'+site; }
function cidOf(pid,cgId){ return pid+'#'+cgId; }
/* The sites of a campground as the user sees them: the ones in the guide data,
   plus any "missing" site they added and gave data to (a rating, note, wishlist
   or photo saved under a key the data never listed). Derived from what is
   already stored, so an added site persists once used and needs no extra store. */
function sitesOf(pid,cg){
  const known=cgSites(cg), kn=new Set(known.map(String)), pref=pid+'#'+cg.id+'#', extra=new Set();
  const add=key=>{ if(key.slice(0,pref.length)===pref){ const s=key.slice(pref.length); if(s&&!kn.has(s)) extra.add(s); } };
  try{ Object.keys(state.site).forEach(add); }catch(e){}
  try{ if(FAVS&&FAVS.sites) Object.keys(FAVS.sites).forEach(add); }catch(e){}
  try{ photoKeys.forEach(add); }catch(e){}
  if(!extra.size) return known;
  const ex=Array.from(extra).sort((a,b)=>{ const na=parseFloat(a),nb=parseFloat(b);
    if(!isNaN(na)&&!isNaN(nb)&&na!==nb) return na-nb; return a.localeCompare(b,undefined,{numeric:true}); });
  return known.concat(ex);
}

/* ================= state ================= */
let state={site:{},campground:{},trail:{}};
const KEY='ontario-scout-v2';
var APP_VERSION='1.0';
/* true inside the iPhone app: Bridge.swift sets window.Capacitor before this file runs */
var IN_APP=!!window.Capacitor;

/* ================= language =================
   French when the device is set to French, English otherwise; a choice in
   More overrides either. The dictionary is
   keyed by the English string, so TL('Journal') is the whole API: a string
   with no entry simply stays as written. Park and campground names are
   data, never translated. Static markup carries data-i18n="<english>" and
   is walked by applyLang() at boot and on every change. */
var LANG_KEY='oncamp-lang';
var LANG='en';
(function(){ var lg=null; try{ lg=localStorage.getItem(LANG_KEY); }catch(e){}
  if(lg==='fr'||lg==='en') LANG=lg; else if(/^fr(-|$)/i.test(navigator.language||'')) LANG='fr'; })();
var FR={
  /* park facilities (data), shown as chips on a park page */
  'Vault toilets':'Toilettes sèches',
  'Water taps':'Robinets d’eau',
  'Hiking trails':'Sentiers de randonnée',
  'Firewood':'Bois de chauffage',
  'Beaches':'Plages',
  'Flush toilets':'Toilettes à chasse d’eau',
  'Showers':'Douches',
  'Trailer dump station':'Station de vidange',
  'Electrical sites':'Emplacements avec électricité',
  'Boat launch':'Rampe de mise à l’eau',
  'Laundry':'Buanderie',
  'Group camping':'Camping de groupe',
  'Playground':'Terrain de jeux',
  'Canoe/kayak rentals':'Location de canots et de kayaks',
  'Park store':'Magasin du parc',
  'Barrier-free sites':'Emplacements accessibles',
  'Pet beach':'Plage pour animaux',
  'Backcountry sites':'Emplacements en arrière-pays',
  'Cabins / yurts':'Chalets et yourtes',
  'Radio-free areas':'Zones sans radio',
  'Visitor centre':'Centre d’accueil',
  'Bike trail':'Piste cyclable',
  'Winter camping':'Camping d’hiver',
  'Walk-in sites':'Emplacements accessibles à pied',
  'Amphitheatre':'Amphithéâtre',
  'Pet-free areas':'Zones sans animaux',
  'Sand dunes':'Dunes de sable',
  'Canoe launches':'Mises à l’eau pour canots',
  'PFD loan':'Prêt de gilets de sauvetage',
  'EV charging':'Recharge pour véhicules électriques',
  /* tabs and screens */
  'Guide':'Guide','Journal':'Journal','More':'Plus','Profile':'Profil','Photos':'Photos',
  'Parks':'Parcs','Shared with you':'Partagé avec vous',
  /* search */
  'Search':'Recherche','Search parks and sites':'Chercher parcs et emplacements',
  'No matches. Try a park, a campground, or Hemlock 112.':'Aucun résultat. Essayez un parc, un terrain ou Hemlock 112.',
  'Campgrounds':'Terrains de camping','Sites':'Emplacements','Trails':'Sentiers','Cancel':'Annuler',
  /* account and journal */
  'Parks visited':'Parcs visités','Ratings':'Évaluations',
  'That photo could not be saved. Your device storage may be full.':'Cette photo n’a pas pu être enregistrée. Le stockage de votre appareil est peut-être plein.',
  'Favourites':'Favoris','Name':'Nom','Your name':'Votre nom',
  'Favourite parks':'Parcs favoris','Favourite sites':'Emplacements favoris','Visited parks':'Parcs visités',
  'Your favourites live here':'Vos favoris sont ici',
  'Tap the heart on a park to keep it here. Parks you rate show up too.':'Touchez le cœur d’un parc pour le garder ici. Les parcs que vous notez y apparaissent aussi.',
  'Showing every entry':'Toutes les entrées sont affichées',
  'Tap the heart on a park to keep it here.':'Touchez le cœur d’un parc pour le garder ici.',
  'Parks you rate or write in show up here.':'Les parcs que vous notez ou commentez apparaissent ici.',
  'Legal':'Mentions légales','Privacy policy':'Politique de confidentialité',
  'Terms of use':'Conditions d’utilisation','Support':'Assistance',
  'Not affiliated with Ontario Parks.':'Sans lien avec Parcs Ontario.',
  'Parks in guide':'Parcs dans le guide','Version':'Version',
  'Browse the parks':'Parcourir les parcs',
  /* settings */
  'Appearance':'Apparence','Theme':'Thème','Auto':'Auto','Light':'Clair','Dark':'Sombre',
  'Text size':'Taille du texte','Small':'Petit','Medium':'Moyen','Large':'Grand','Extra large':'Très grand',
  'Language':'Langue','English':'English','Français':'Français',
  'Add a favourite':'Ajouter aux favoris','Remove from favourites':'Retirer des favoris',
  'Favourite':'Favori','Favourited':'En favori',
  'Loading':'Chargement',
  'of':'sur','sites rated':'emplacements évalués','site rated':'emplacement évalué','wishlist site':'emplacement en liste de souhaits','wishlist sites':'emplacements en liste de souhaits','average':'de moyenne',
  'Saved to your journal':'Enregistré dans votre journal','Saved to your favourites':'Ajouté à vos favoris',
  'Site':'Emplacement','Every park, campground, site and trail in the guide.':'Chaque parc, terrain, emplacement et sentier du guide.',
  /* guide and park screens */
  'All parks A to Z':'Tous les parcs de A à Z','All regions':'Toutes les régions',
  'Wishlist':'Liste de souhaits','Share':'Partager','Copied.':'Copié.','Top sites':'Meilleurs emplacements','Stats':'Statistiques',
  'Average':'Moyenne','Rated':'Notés','Notes':'Notes','Scouted':'Explorés',
  'Rating spread':'Répartition des notes','By campground':'Par terrain',
  'Star a site to build your booking shortlist.':'Ajoutez un emplacement en favori pour créer votre liste de réservation.',
  'No sites rated yet.':'Aucun emplacement noté pour l’instant.',
  'Added to your wishlist.':'Ajouté à votre liste de souhaits.',
  /* screen-reader labels */
  'Jump to a letter':'Aller à une lettre','Clear search':'Effacer la recherche',
  'Delete photo':'Supprimer la photo','Rate':'Noter','Versions':'Versions','Sections':'Sections',
  'Campground review':'Avis sur le terrain','Campground':'Terrain de camping',
  'North':'Nord','Central':'Centre','South':'Sud','East':'Est','West':'Ouest',
  'Near North':'Proche-Nord','Northern':'Nord','Southeast':'Sud-Est','Southwest':'Sud-Ouest','Other':'Autre',
  'Site review':'Avis sur l’emplacement','Trail review':'Avis sur le sentier','Park review':'Avis sur le parc',
  'Reviewed':'Évalué en','Shared':'Partagé','review':'avis',
  'Easy':'Facile','Moderate':'Modéré','Difficult':'Difficile','Easy to moderate':'Facile à modéré','Moderate to difficult':'Modéré à difficile',
  /* messages */
  'Backup exported. Keep it somewhere safe.':'Sauvegarde exportée. Gardez-la en lieu sûr.',
  'Backup restored. Welcome back.':'Sauvegarde restaurée. Bon retour.',
  'Park data could not be loaded.':'Les données des parcs n’ont pas pu être chargées.',
  'Could not build the backup. Try again.':'Impossible de créer la sauvegarde. Réessayez.',
  'Could not read that file.':'Impossible de lire ce fichier.',
  'Sharing is not available right now. Try again.':'Le partage n’est pas disponible pour le moment. Réessayez.',
  'That file is not an ON site backup.':'Ce fichier n’est pas une sauvegarde ON site.',
  'Link copied, card saved':'Lien copié, carte enregistrée',
  'Park data cleared.':'Données du parc effacées.',
  'Hidden park revealed. Welcome to the Wildlands.':'Parc caché révélé. Bienvenue dans les Wildlands.',
  'Some of the backup could not be saved. Your device storage may be full.':'Une partie de la sauvegarde n’a pas pu être enregistrée. Le stockage de votre appareil est peut-être plein.',
  /* audit fixes: rendered strings, empty states, aria labels */
  'Your journal starts here':'Votre journal commence ici',
  /* journal filters */
  'All':'Toutes','2 or less':'2 ou moins','Show':'Afficher','Sort':'Trier',
  'Recent':'Récents','Best':'Meilleurs','Lowest':'Pires','A to Z':'A à Z',
  'entry matches':'entrée correspond','entries match':'entrées correspondent',
  'Nothing matches these filters.':'Rien ne correspond à ces filtres.','Clear filters':'Effacer les filtres',
  'Tap a photo to open its site.':'Touchez une photo pour ouvrir son emplacement.',
  "No photos yet. Add one from a site's rating sheet.":'Aucune photo pour l’instant. Ajoutez-en une depuis la fiche de notation d’un emplacement.',
  'Fishing':'Pêche',
  'Official park page':'Page officielle du parc',
  'Tap again to restore':'Touchez encore pour restaurer',
  'rating':'évaluation','ratings':'évaluations','photo':'photo','photos':'photos','note':'note','notes':'notes',
  'Explore Ontario parks':'Explorer les parcs de l’Ontario',
  'Open':'Ouvrir',
  'This shared link could not be opened. It may be from a newer version of the app.':'Ce lien partagé n’a pas pu être ouvert. Il provient peut-être d’une version plus récente de l’application.',
  'site photo':'photo de l’emplacement',
  'Check your connection and reopen the app.':'Vérifiez votre connexion et rouvrez l’application.',
  'Nothing to clear yet.':'Rien à effacer pour l’instant.',
  'Reinstall the app from the App Store.':'Réinstallez l’application depuis l’App Store.',
  'Fishing zone':'Zone de pêche',
  'not rated':'non noté','wishlist':'liste de souhaits','has a note':'a une note','has a photo':'a une photo',
  'View photo':'Voir la photo',
  /* learn */
  'Bear safety and food storage':'Sécurité avec les ours et rangement des aliments',
  'Campfire safety':'Sécurité des feux de camp',
  'Ticks and Lyme disease':'Tiques et maladie de Lyme',
  'Leave no trace':'Ne laisser aucune trace',
  'Wildlife on the roads':'La faune sur les routes',
  'Cold water and weather':'Eau froide et météo',
  /* rate sheet */
  'Rating':'Note','Clear rating':'Effacer la note',
  'Camera':'Appareil photo','Add photos':'Ajouter des photos',
  'Please do not photograph occupied sites.':'Veuillez ne pas photographier les emplacements occupés.',
  'Share this review':'Partager cet avis','Clear':'Effacer',
  'Tap again to clear':'Touchez encore pour effacer','Done':'Terminé',
  'Trail':'Sentier','Park':'Parc',
  /* park screen chrome */
  'Rate this park':'Noter ce parc','Park stats':'Statistiques du parc',
  'All Parks':'Tous les parcs','Park rating':'Note du parc',
  'Sites rated here':'Emplacements notés ici','Rate campground':'Noter le terrain',
  'Add a site':'Ajouter un emplacement','Enter the site number to add':'Entrez le numéro de l’emplacement à ajouter',
  'Add a note or photo':'Ajouter une note ou une photo',
  'Previous site':'Emplacement précédent','Next site':'Emplacement suivant',
  'Tap again to erase this park':'Touchez encore pour effacer ce parc',
  'sites':'emplacements','rated':'notés','site':'emplacement',
  'campground':'terrain de camping','campgrounds':'terrains de camping','Day-use park':'Parc d’utilisation diurne',
  /* trailer sites and the equipment setting */
  'Equipment':'Équipement','Car/tent':'Auto/tente','RV/trailer':'VR/roulotte',
  'Trailer sites sit out of the rating':'Les emplacements pour roulottes ne comptent pas dans la note',
  'Trailer sites count like any other':'Les emplacements pour roulottes comptent comme les autres',
  'trailer site':'emplacement pour roulottes','trailer sites':'emplacements pour roulottes',
  'trailer site, set aside':'emplacement pour roulottes, mis de côté',
  'Trailer site':'Pour roulottes','Trailers':'Roulottes',
  'Trailer site, not counted in your progress':'Emplacement pour roulottes, non compté dans votre progression',
  'Trailer site, counted like any other':'Emplacement pour roulottes, compté comme les autres',
  'trailer sites set aside':'emplacements roulotte écartés','trailer site set aside':'emplacement roulotte écarté',
  'sites marked as trailer sites':'emplacements marqués pour roulottes','site marked as a trailer site':'emplacement marqué pour roulottes',
  'trailer marks removed':'marques pour roulottes retirées','trailer mark removed':'marque pour roulottes retirée',
  'Undo':'Annuler','Undone.':'Annulé.','trailer mark':'marque pour roulottes','trailer marks':'marques pour roulottes',
  /* more screen: sections, data rows */
  'About':'À propos','Learn':'Apprendre','Your data':'Vos données',
  'Export a backup':'Exporter une sauvegarde','Import a backup':'Importer une sauvegarde',
  'Reset all data':'Réinitialiser toutes les données',
  'Tap again to erase everything':'Touchez encore pour tout effacer',
  'Export a backup to move your journal to another device. Importing a backup replaces what is on this device.':'Exportez une sauvegarde pour transférer votre journal vers un autre appareil. Importer une sauvegarde remplace ce qui se trouve sur cet appareil.',
  'A park review someone sent you.':'Un avis de parc que quelqu’un vous a envoyé.',
  'Visibility':'Visibilité','Private':'Privé',
  'Everything stays on this device':'Tout reste sur cet appareil',
  /* about the app, three body paragraphs (ON site and Parcs Ontario kept as names) */
  'Ever since I was young, my parents took me camping often. Lately I have been sharing that love with my friends and showing them the beauty of being outdoors. With that comes the responsibility of booking the campsites, and choosing a site you have never seen is a gamble.':'Depuis mon plus jeune âge, mes parents m’emmenaient souvent camper. Ces derniers temps, je partage cette passion avec mes amis et je leur fais découvrir la beauté du plein air. Avec cela vient la responsabilité de réserver les emplacements, et choisir un emplacement que l’on n’a jamais vu est un pari.',
  'ON site is a private journal for Ontario park campgrounds. For the low, low price of a nice walk around the campground, you can rate each site out of five, add a note or a photo, and mark the ones worth booking again. It covers every reservable campground in Ontario’s provincial parks, down to the individual sites, and the trails around them.':'ON site est un journal privé pour les terrains de camping des parcs de l’Ontario. Pour le prix modique d’une belle promenade autour du terrain, vous pouvez noter chaque emplacement sur cinq, ajouter une note ou une photo, et marquer ceux qui valent la peine d’être réservés de nouveau. Il couvre chaque terrain de camping réservable des parcs provinciaux de l’Ontario, jusqu’aux emplacements individuels, ainsi que les sentiers qui les entourent.',
  'Ratings, notes and photos are stored on this device, and you can export a backup to a file and load it on another device. Please do not photograph occupied sites, and leave a site the way you would want to find it.':'Les évaluations, les notes et les photos sont stockées sur cet appareil, et vous pouvez exporter une sauvegarde vers un fichier et la charger sur un autre appareil. Veuillez ne pas photographier les emplacements occupés, et laissez un emplacement tel que vous voudriez le trouver.',
};
function TL(s){ return (LANG==='fr'&&FR[s])||s; }
window.TL=TL;
function setLang(v){
  if(v!=='en'&&v!=='fr') return;
  LANG=v;
  try{ localStorage.setItem(LANG_KEY,v); }catch(e){}
  applyLang();
  renderAppearancePanel();
  /* redraw whatever is on screen, in place */
  try{ if(typeof renderPhotoCount==='function') renderPhotoCount(); }catch(e){}
  try{ if(typeof renderJournal==='function') renderJournal(); }catch(e){}
  try{ if(typeof fillAboutStats==='function') fillAboutStats(); }catch(e){}
  try{ if(learnRendered&&typeof renderLearn==='function') renderLearn(); }catch(e){}
  try{ var vf=document.getElementById('view-favs'); if(vf&&!vf.hidden) renderFavs(); }catch(e){}
  try{ var bl=document.getElementById('backLabel'); if(bl) bl.textContent=TL(PARK_HOST_LABEL[parkHost]||'All Parks'); }catch(e){}
  postAppearance(); postSpotlight();
}
/* translate every tagged node in the static markup */
function applyLang(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    el.textContent=TL(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el){
    el.setAttribute('placeholder',TL(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function(el){
    el.setAttribute('aria-label',TL(el.getAttribute('data-i18n-aria')));
  });
}
/* fishing regulations live in the sibling on-fishing app; in the iPhone app
   the link opens in Safari */
const FISHREG_BASE='https://katsuma.ca/on-fishing/';
try{ history.scrollRestoration='manual'; }catch(e){} /* every open starts at the top */
function load(){ try{ const v=localStorage.getItem(KEY); if(v) state=Object.assign({site:{},campground:{},trail:{}},JSON.parse(v)); }catch(e){}
  /* pins are no longer shown anywhere, but the list a reader built is theirs
     and stays in the record; the stats console still counts it */
  if(!Array.isArray(state.pins)) state.pins=[];
  if(!state.touched||typeof state.touched!=='object'||Array.isArray(state.touched)) state.touched={};
  delete state.eggQE2; }   /* the Wildlands was once hidden behind a search; it is an ordinary park now */
let saveTimer=null;
function persistNow(){ clearTimeout(saveTimer); saveTimer=null; try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }
function persist(){ clearTimeout(saveTimer); saveTimer=setTimeout(persistNow,250); }
/* a rating or note made just before the tab is hidden or closed must not be
   lost in the 250ms debounce: flush the pending write synchronously. iOS
   freezes PWAs on background, where only pagehide/visibilitychange fire. */
window.addEventListener('pagehide',function(){ if(saveTimer) persistNow(); });
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden'&&saveTimer) persistNow(); });

/* ================= photos ================= */
const DB_NAME='scout-photos', STORE='photos'; let photoKeys=new Set();
function openDB(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'siteId'}); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function loadPhotoIndex(){ try{ const db=await openDB(); photoKeys=await new Promise(res=>{ const tx=db.transaction(STORE,'readonly');
  const rq=tx.objectStore(STORE).getAllKeys(); rq.onsuccess=()=>res(new Set(rq.result||[])); rq.onerror=()=>res(new Set()); }); }catch(e){ photoKeys=new Set(); } }
async function getPhotos(k){ try{ const db=await openDB(); return await new Promise(res=>{ const tx=db.transaction(STORE,'readonly');
  const rq=tx.objectStore(STORE).get(k); rq.onsuccess=()=>res(rq.result?rq.result.list:[]); rq.onerror=()=>res([]); }); }catch(e){ return []; } }
async function putPhotos(k,list){ try{ const db=await openDB();
  /* only update the in-memory index if the write actually committed: on a
     failed/aborted transaction (e.g. QuotaExceeded) the row is rolled back,
     so claiming the site has a photo would leave a broken thumbnail */
  var okWrite=await new Promise(res=>{ const tx=db.transaction(STORE,'readwrite');
    const st=tx.objectStore(STORE); if(list.length) st.put({siteId:k,list}); else st.delete(k);
    tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); tx.onabort=()=>res(false); });
  if(!okWrite) return false;
  if(list.length) photoKeys.add(k); else photoKeys.delete(k); return true; }catch(e){ return false; } }
function compress(file,maxDim=1400,q=0.72){ return new Promise((res,rej)=>{ const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{ URL.revokeObjectURL(url); let w=img.naturalWidth,h=img.naturalHeight; const s=Math.min(1,maxDim/Math.max(w,h));
    w=Math.round(w*s); h=Math.round(h*s); const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h); res(c.toDataURL('image/jpeg',q)); };
  img.onerror=()=>{ URL.revokeObjectURL(url); rej(); }; img.src=url; }); }

/* ================= helpers ================= */
/* score colours darkened so white badge/dot text clears WCAG AA (4.5:1) in
   both themes: the old warm and olive stops sat at 3.8-4.2 with white on them */
const STOPS=['#9C4136','#8A5B2C','#5F6A24','#3F6A30','#256E3F','#00602F'];
function scoreColor(s){ return (typeof s==='number'&&s>=0&&s<=5)?('color-mix(in srgb, '+STOPS[s]+' 86%, var(--tint))'):null; }
function sc(type,k){ const e=state[type][k]; return (e&&typeof e.score==='number')?e.score:null; }
function noteOf(type,k){ const e=state[type][k]; return e&&e.note?e.note:''; }
function wantOf(k){ const e=state.site[k]; return !!(e&&e.want); }
/* Trailer sites. A tent camper labels the serviced sites of a loop so they
   drop out of the rating; the label stays whatever the equipment setting in
   Appearance says, and the setting decides whether such a site counts:
   set aside for car/tent camping, counted like any other for RV/trailer. */
function trailerOf(k){ const e=state.site[k]; return !!(e&&e.trailer); }
function gearIsRV(){ return state.gear==='rv'; }
function siteCounts(k){ return gearIsRV()||!trailerOf(k); }
function skipSite(k){ return !siteCounts(k); }
let _lastBuzz=0;
function buzz(ms){
  const _n=Date.now(); if(_n-_lastBuzz<80) return; _lastBuzz=_n;
  try{ const C=window.Capacitor;
    if(C&&C.Plugins&&C.Plugins.Haptics){ C.Plugins.Haptics.impact({style:'LIGHT'}); return; }
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
if(navigator.storage&&navigator.storage.persist){ try{ navigator.storage.persist(); }catch(e){} }
var DEBUG_ERRS=[];
window.addEventListener('error',function(e){ try{ DEBUG_ERRS.push((e.message||'?')+' @'+(e.lineno||'?')); }catch(x){} });
window.addEventListener('unhandledrejection',function(e){ try{ DEBUG_ERRS.push('promise: '+(e.reason&&e.reason.message||e.reason)); }catch(x){} });
document.addEventListener('click',function(e){ if(e.target&&e.target.closest&&e.target.closest('button,.site,.rrow,.fchip')) buzz(5); },{capture:true});
/* the numbers run over the sites that count; set-aside trailer sites are
   reported apart as `aside` so a header can still say how many sit out */
function cgStats(park,cg){ const all=cgSites(cg).map(s=>keyOf(park.id,cg.id,s)), ks=all.filter(siteCounts); const rated=ks.filter(k=>sc('site',k)!=null);
  const sum=rated.reduce((a,k)=>a+sc('site',k),0);
  return {total:ks.length,rated:rated.length,sum,avg:rated.length?sum/rated.length:0,pct:ks.length?Math.round(rated.length/ks.length*100):0,aside:all.length-ks.length}; }
/* the park is a fold over its campgrounds, so the set-aside rule lives in one place */
function parkStats(park){ let total=0,rated=0,sum=0,aside=0;
  park.campgrounds.forEach(cg=>{ const st=cgStats(park,cg); total+=st.total; rated+=st.rated; sum+=st.sum; aside+=st.aside; });
  return {total,rated,sum,pct:total?Math.round(rated/total*100):0,avg:rated?sum/rated:0,aside}; }

/* ================= global search ================= */
let SEARCH_CGS=[], SEARCH_TRAILS=[];
function buildSearchIndex(){ SEARCH_CGS=[]; SEARCH_TRAILS=[];
  PARKS.forEach(p=>{ p.campgrounds.forEach(cg=>{ const sites=cgSites(cg);
    SEARCH_CGS.push({parkId:p.id,parkName:p.name,cgName:cg.id,sub:cg.sub,
      siteSet:new Set(sites.map(s=>s.toLowerCase())), sitesOrig:sites}); });
    (p.trails||[]).forEach(t=>SEARCH_TRAILS.push({parkId:p.id,parkName:p.name,name:t.name,length:t.length,difficulty:t.difficulty})); }); }
function nameHit(name,q,base){ name=name.toLowerCase(); return base+(name===q?12:0)+(name.startsWith(q)?6:0); }
function searchAll(q){ q=q.trim().toLowerCase(); if(!q) return [];
  const toks=q.split(/\s+/).filter(Boolean);
  const siteTok=toks.filter(t=>/\d/.test(t)), nameTok=toks.filter(t=>!/\d/.test(t)), nameQ=nameTok.join(' ');
  const res=[];
  const STOP=['provincial','park','parks','the'];
  const pToks=nameTok.filter(t=>STOP.indexOf(t)<0);
  if(pToks.length && !siteTok.length) PARKS.forEach(p=>{ const pn=p.name.toLowerCase();
    if(pToks.every(t=>pn.includes(t)))
    res.push({type:'park',score:nameHit(p.name,pToks.join(' '),60),parkId:p.id,title:p.name,sub:((p.region||'').split(' · ').slice(1).join(' · ')||p.region)}); });
  SEARCH_CGS.forEach(c=>{ const cgN=c.cgName.toLowerCase(), hay=(c.parkName+' '+c.cgName).toLowerCase();
    if(siteTok.length){ const nameOk=!nameQ||nameTok.every(t=>hay.includes(t)); if(!nameOk) return;
      siteTok.forEach(st=>{ if(c.siteSet.has(st)){ const label=c.sitesOrig.find(s=>s.toLowerCase()===st);
        res.push({type:'site',score:(nameQ?100:40),parkId:c.parkId,cgName:c.cgName,label,title:TL('Site')+' '+label,sub:c.cgName+' · '+c.parkName}); } });
    } else if(nameQ && nameTok.every(t=>cgN.includes(t))){
      res.push({type:'cg',score:nameHit(c.cgName,nameQ,80),parkId:c.parkId,cgName:c.cgName,title:c.cgName,sub:c.parkName+((c.sub||'').split(' · ')[0]?' · '+(c.sub||'').split(' · ')[0]:'')}); }
  });
  if(nameQ && !siteTok.length) SEARCH_TRAILS.forEach(t=>{ if(nameTok.every(x=>t.name.toLowerCase().includes(x)))
    res.push({type:'trail',score:nameHit(t.name,nameQ,75),parkId:t.parkId,trailName:t.name,title:t.name,sub:t.parkName+' · '+TL(t.difficulty)+' · '+fmtLen(t.length)}); });
  /* Universal search: typing a fish surfaces the parks that have it. */
  if(window.ECO && nameQ && !siteTok.length){
    const ECO=window.ECO, keys=Object.keys(ECO.fish);
    const matched=keys.filter(k=>{ const f=ECO.fish[k];
      return f.syn.concat([f.name.toLowerCase()]).some(n=>n===nameQ||n.startsWith(nameQ)||(nameQ.length>=4&&n.indexOf(nameQ)>=0)); });
    if(matched.length){
      const have=new Set(res.filter(r=>r.type==='park').map(r=>r.parkId));
      ECO.parks.forEach(pk=>{
        const hit=pk.fish.find(fk=>matched.indexOf(fk)>=0);
        if(!hit||have.has(pk.id)) return; have.add(pk.id);
        res.push({type:'park',score:55,parkId:pk.id,title:pk.name,
          sub:ECO.fish[hit].name+' · '+(((pk.region||'').split(' · ').slice(1).join(' · '))||pk.region)});
      });
    }
  }
  const TYPE_RANK={park:0,cg:1,site:2,trail:3};
  res.sort((a,b)=>(TYPE_RANK[a.type]-TYPE_RANK[b.type])||(b.score-a.score)); return res.slice(0,15);
}
function onGSearch(){ const gq=document.getElementById('gq'), q=gq.value;
  if(q.trim().toLowerCase()==='debugsearch'){ renderDebug(); return; }
  if(q.trim().toLowerCase()==='statsearch'){ renderStats(); return; }
  document.getElementById('gsearch').classList.toggle('has',!!q.trim());
  const rbox=document.getElementById('gresults'), hint=document.getElementById('searchHint');
  if(!q.trim()){ rbox.hidden=true; rbox.innerHTML=''; if(hint) hint.hidden=false; return; }
  rbox.hidden=false; if(hint) hint.hidden=true;
  const results=searchAll(q);
  if(!results.length){ rbox.innerHTML='<div class="gnone">'+TL('No matches. Try a park, a campground, or Hemlock 112.')+'</div>'; return; }
  /* grouped by kind, the way Settings answers a search: a small label, then
     the rows it owns. The ranked order inside each group is left alone. */
  const groupLabel={park:'Parks',cg:'Campgrounds',site:'Sites',trail:'Trails'};
  const order=['park','cg','site','trail'];
  let ghtml='';
  order.forEach(function(kind){
    const rows=results.filter(r=>r.type===kind);
    if(!rows.length) return;
    ghtml+='<div class="seclabel">'+TL(groupLabel[kind])+'</div><div class="ios-group">';
    rows.forEach(function(r){
      const i=results.indexOf(r);
      ghtml+='<button class="gresult ios-row ios-row--plain" data-i="'+i+'">'+
        '<span class="ios-row-body"><span class="ios-row-title">'+r.title+'</span>'+
        '<span class="ios-row-sub">'+r.sub+'</span></span>'+CHEV_RIGHT+'</button>';
    });
    ghtml+='</div>';
  });
  rbox.innerHTML=ghtml;
  rbox.querySelectorAll('.gresult').forEach(el=>el.addEventListener('click',()=>gotoResult(results[+el.dataset.i])));
}
function clearGSearch(){ const gq=document.getElementById('gq'); if(gq) gq.value='';
  const w=document.getElementById('gsearch'); if(w) w.classList.remove('has');
  const rb=document.getElementById('gresults'); if(rb){ rb.hidden=true; rb.innerHTML=''; }
  const hint=document.getElementById('searchHint'); if(hint) hint.hidden=false; }
function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function renderConsole(cmd,pairs){
  const rbox=document.getElementById('gresults');
  rbox.hidden=false;
  rbox.innerHTML='<div class="dbg"><div class="dhead">&gt; '+esc(cmd)+'</div>'+
    pairs.map(p=>'<div class="drow"><span class="dk">'+esc(p[0])+'</span><span class="dv">'+esc(p[1])+'</span></div>').join('')+
    '</div>';
}
function renderDebug(){
  const pairs=[];
  try{ pairs.push(['parks_loaded',PARKS.length]); }catch(e){ pairs.push(['parks_loaded','ERR '+e.message]); }
  try{ pairs.push(['wildlands_listed',PARKS.some(p=>p.id==='queenelizabethii')?'true':'FALSE']); }catch(e){ pairs.push(['wildlands_listed','ERR']); }
  try{ const r=searchAll('queen'); pairs.push(['searchAll("queen")',r.length+(r.length?' -> '+r[0].title:'')]); }
  catch(e){ pairs.push(['searchAll("queen")','THREW '+e.message]); }
  try{ pairs.push(['searchAll("q")',searchAll('q').length]); }catch(e){ pairs.push(['searchAll("q")','THREW']); }
  pairs.push(['capacitor',window.Capacitor?'true':'false']);
  pairs.push(['errors',DEBUG_ERRS.length?DEBUG_ERRS.slice(-3).join(' | '):'none']);
  renderConsole('debugsearch',pairs);
}
function renderStats(){
  let sites=0,cgs=0,trails=0,dayuse=0,five=0,zero=0,notes=0,want=0,sum=0,n=0;
  const parks=new Set(), perPark={};
  ['site','campground','trail'].forEach(b=>{ const o=state[b]||{};
    for(const k in o){ const e=o[k]; if(!e) continue;
      const sv=(typeof e.score==='number')?e.score:null;
      if(e.note) notes++;
      if(b==='site'&&e.want) want++;
      if(sv==null) continue;
      if(b==='site'&&!siteCounts(k)) continue;   /* a set-aside trailer site's score sits out */
      const pid=k.split('#')[0], park=PARK_BY_ID[pid];
      if(b==='site') sites++;
      else if(b==='trail') trails++;
      else{ const nm=k.slice(pid.length+1); if(park&&park.dayuse&&nm===park.name) dayuse++; else cgs++; }
      parks.add(pid); perPark[pid]=(perPark[pid]||0)+1;
      sum+=sv; n++; if(sv===5) five++; if(sv===0) zero++; } });
  let topPid=null; for(const pid in perPark) if(topPid==null||perPark[pid]>perPark[topPid]) topPid=pid;
  const topName=topPid&&PARK_BY_ID[topPid]?PARK_BY_ID[topPid].name+' ('+perPark[topPid]+')':'none yet';
  renderConsole('statsearch',[
    ['parks_rated',parks.size],
    ['campgrounds_rated',cgs],
    ['sites_rated',sites],
    ['trails_rated',trails],
    ['dayuse_rated',dayuse],
    ['notes_written',notes],
    ['photos_saved',photoKeys.size],
    ['wishlist_sites',want],
    ['trailer_sites',Object.keys(state.site||{}).filter(function(k){ return trailerOf(k); }).length],
    ['parks_pinned',Array.isArray(state.pins)?state.pins.length:0],
    ['five_stars_given',five],
    ['zero_stars_given',zero],
    ['average_score',n?(sum/n).toFixed(2):'n/a'],
    ['most_scouted',topName]
  ]);
}
function gotoResult(r){
  /* the park replaces the search screen and back returns to the tab the
     search began on (Parks when that was not a list of parks) */
  var hostTab=(LAST_TAB_BEFORE_SEARCH==='favs'||LAST_TAB_BEFORE_SEARCH==='journal')?LAST_TAB_BEFORE_SEARCH:'guide';
  LAST_TAB_BEFORE_SEARCH=hostTab;
  var vs=document.getElementById('view-search'); if(vs) vs.hidden=true; setTabActive(hostTab);
  clearGSearch(); openPark(r.parkId,TAB_SECTIONS[hostTab]);
  if(r.type==='cg') expandCg(r.cgName);
  else if(r.type==='site'){ expandCg(r.cgName); openSheet('site',keyOf(r.parkId,r.cgName,r.label),r.cgName,r.label); }
  else if(r.type==='trail'){ openSheet('trail',trailKey(r.trailName),r.trailName); } }
function wireGlobalSearch(){ const gq=document.getElementById('gq');
  gq.addEventListener('input',onGSearch);
  document.getElementById('gclear').addEventListener('click',()=>{ clearGSearch(); gq.focus(); }); }

/* ================= parks list ================= */
var regionFilter='All';
/* a park's rating progress and its trailer marks, for its row */
function parkTouchInfo(p){
  var st=parkStats(p), flagged=0;
  p.campgrounds.forEach(function(cg){ cgSites(cg).forEach(function(s){
    var e=state.site[keyOf(p.id,cg.id,s)]; if(e&&e.trailer) flagged++; }); });
  return {rated:st.rated,total:st.total,avg:st.avg,aside:st.aside,flagged:flagged};
}
/* recency stamp so My parks and the Journal can lead with the latest park */
function touchPark(pid){ if(!state.touched||typeof state.touched!=='object') state.touched={}; state.touched[pid]=Date.now(); }

function broadOf(p){ return (p.region||'').split(' \u00b7 ')[0].replace(' Park','').trim()||'Other'; }
function regionOrder(){ const found=new Set(PARKS.map(broadOf));
  const order=['All','Algonquin','Central','Near North','Northern','Southeast','Southwest'].filter(r=>r==='All'||found.has(r));
  found.forEach(r=>{ if(order.indexOf(r)<0) order.push(r); }); return order; }

/* Parks tab: My parks (touched parks, most recent first), then every park in
   one A to Z list with sticky letter heads and a Contacts style letter rail. */
function regionChipsHtml(){
  return '<div class="filters">'+regionOrder().map(function(r){
    return '<button class="fchip'+(r===regionFilter?' on':'')+'" type="button" data-region="'+r+'">'+
      '<span class="fct">'+(r==='All'?TL('All regions'):TL(r))+'</span></button>'; }).join('')+'</div>';
}

/* ================= favourites =================
   An explicit list, kept apart from the derived Visited list: a favourite
   is something the reader chose, a visit is something the app noticed.
   Parks and individual campsites can both be favourited. */
var FAV_KEY='oncamp-favs';
var FAVS={parks:{},sites:{}};
try{
  var _fv=JSON.parse(localStorage.getItem(FAV_KEY)||'null');
  if(_fv&&typeof _fv==='object'){ FAVS.parks=_fv.parks||{}; FAVS.sites=_fv.sites||{}; }
}catch(e){}
function saveFavs(){ try{ localStorage.setItem(FAV_KEY,JSON.stringify(FAVS)); }catch(e){} }
function isFav(kind,id){ return !!(FAVS[kind]&&FAVS[kind][id]); }
function toggleFav(kind,id){
  if(!FAVS[kind]) FAVS[kind]={};
  if(FAVS[kind][id]) delete FAVS[kind][id]; else FAVS[kind][id]=1;
  saveFavs();
  return isFav(kind,id);
}
/* Favourites took the place pins used to hold, so a park pinned before this
   round arrives as a favourite instead of quietly disappearing. Once only,
   and the pin list itself is left where it is. */
var PIN_FAV_KEY='oncamp-pins-to-favs';
function migratePinsToFavs(){
  try{ if(localStorage.getItem(PIN_FAV_KEY)) return; }catch(e){ return; }
  if(Array.isArray(state.pins)) state.pins.forEach(function(pid){ if(!FAVS.parks[pid]) FAVS.parks[pid]=1; });
  saveFavs();
  try{ localStorage.setItem(PIN_FAV_KEY,'1'); }catch(e){}
}
/* the heart itself: a real button, 44px of target, filled when it is on */
function favBtnHtml(kind,id){
  var on=isFav(kind,id);
  return '<span class="favbtn'+(on?' on':'')+'" role="button" tabindex="0"'+
    ' data-fav="'+kind+'" data-favid="'+String(id).replace(/"/g,'&quot;')+'"'+
    ' aria-pressed="'+(on?'true':'false')+'"'+
    ' aria-label="'+(on?TL('Remove from favourites'):TL('Add a favourite'))+'">'+
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.6 13.3a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 1 1 6.5 6.5z"/></svg></span>';
}
/* The park page is the only place a park can be favourited, so the control
   says so in words rather than leaving a bare glyph to be read. It carries
   no data-fav hook: it is wired on its own, in wireParkControls. */
function parkFavHtml(pid){
  var on=isFav('parks',pid);
  return '<button class="favpill'+(on?' on':'')+'" id="favBtn" type="button" aria-pressed="'+(on?'true':'false')+'">'+
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.6 13.3a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 1 1 6.5 6.5z"/></svg>'+
    '<span class="favpill-t">'+(on?TL('Favourited'):TL('Favourite'))+'</span></button>';
}
/* one delegated listener: hearts live inside rows that are themselves buttons */
document.addEventListener('click',function(ev){
  var h=ev.target.closest?ev.target.closest('[data-fav]'):null;
  if(!h) return;
  ev.preventDefault(); ev.stopPropagation();
  toggleFav(h.getAttribute('data-fav'),h.getAttribute('data-favid'));
  buzz(6);
  renderParks(); var vf=document.getElementById('view-favs'); if(vf&&!vf.hidden) renderFavs();
},true);


/* favourited campsites, listed under the favourite parks. The stored id is
   the same key the ratings use, so a favourite survives every re-render. */
function favSiteRows(visible){
  var ids=Object.keys(FAVS.sites||{});
  if(!ids.length) return '';
  var rows='';
  visible.forEach(function(p){
    (p.campgrounds||[]).forEach(function(c){
      cgSites(c).forEach(function(s){
        var k=keyOf(p.id,c.id,s);
        if(!isFav('sites',k)) return;
        var score=sc('site',k);
        var val=(score!=null)?score+'/5':(trailerOf(k)?TL('Trailer site'):'');
        rows+='<button class="ios-row ios-row--plain" type="button" data-park="'+p.id+'" data-cg="'+c.id+'" data-site="'+String(s).replace(/"/g,'&quot;')+'">'+
          '<span class="ios-row-body"><span class="ios-row-title">'+TL('Site')+' '+s+'</span>'+
          '<span class="ios-row-sub">'+p.name+' · '+c.id+'</span></span>'+
          (val?'<span class="ios-row-value tnum">'+val+'</span>':'')+
          favBtnHtml('sites',k)+CHEV_RIGHT+'</button>';
      });
    });
  });
  return rows;
}
/* a favourited campsite row drills into that exact site, mirroring the search
   result's site branch: open the park, expand its campground, open the sheet.
   Falls back to the park page if the row carries no site (defensive). */
function openFavSite(pid,cgId,site,host){
  if(!PARK_BY_ID[pid]) return;
  openPark(pid,host);
  if(cgId&&site!=null&&site!==''){ expandCg(cgId); openSheet('site',keyOf(pid,cgId,site),cgId,site); }
}

/* ---- Favourites tab: the parks and sites you keep coming back to ----
   Favourite parks A to Z, the campsites you hearted, and every park you have
   rated or written in, most recent first. A favourite park is listed once,
   under Favourite parks, even when you have been there too. */
function parkSubLine(p,st){
  if(st.rated>0) return st.rated+' '+TL(st.rated===1?'site rated':'sites rated');
  if(st.aside>0) return st.aside+' '+TL(st.aside===1?'trailer site set aside':'trailer sites set aside');
  if(st.flagged>0) return st.flagged+' '+TL(st.flagged===1?'trailer site':'trailer sites');
  const town=(p.region||'').split(' · ').slice(1).join(' · ');
  return TL(broadOf(p))+(town?' · '+town:''); }
function renderFavs(){ const box=document.getElementById('favsBody'); if(!box) return;
  const visible=PARKS, info={}; visible.forEach(p=>{ info[p.id]=parkTouchInfo(p); });
  const ts=state.touched||{};
  const favParks=visible.filter(p=>isFav('parks',p.id)).sort((a,b)=>a.name.localeCompare(b.name));
  const vis=new Set(visitedParkIds()), visited=visible.filter(p=>vis.has(p.id)&&!isFav('parks',p.id))
    .sort((a,b)=>((ts[b.id]||0)-(ts[a.id]||0))||a.name.localeCompare(b.name));
  const favSites=favSiteRows(visible);
  if(!favParks.length&&!visited.length&&!favSites){
    box.innerHTML='<div class="jempty">'
      +'<svg aria-hidden="true"><use href="assets/icons.svg#heart"/></svg>'
      +'<h2>'+TL('Your favourites live here')+'</h2>'
      +'<p>'+TL('Tap the heart on a park to keep it here. Parks you rate show up too.')+'</p>'
      +'<button class="btn-share primary" id="fBrowse" type="button">'+TL('Browse the parks')+'</button></div>';
    const fb=document.getElementById('fBrowse'); if(fb) fb.addEventListener('click',function(){ buzz(6); showTab('guide'); });
    return; }
  const rows=list=>'<div class="ios-group">'+list.map(p=>parkRowHtml(p,info[p.id],parkSubLine(p,info[p.id]),'')).join('')+'</div>';
  let html='<div class="seclabel">'+TL('Favourite parks')+'</div>'
    +(favParks.length?rows(favParks):'<p class="favs-hint">'+TL('Tap the heart on a park to keep it here.')+'</p>');
  if(favSites) html+='<div class="seclabel">'+TL('Favourite sites')+'</div><div class="ios-group">'+favSites+'</div>';
  html+='<div class="seclabel">'+TL('Visited parks')+'</div>'
    +(visited.length?rows(visited):'<p class="favs-hint">'+TL('Parks you rate or write in show up here.')+'</p>');
  box.innerHTML=html;
  box.querySelectorAll('[data-park]').forEach(b=>b.addEventListener('click',()=>{
    if(b.hasAttribute('data-site')) openFavSite(b.dataset.park,b.dataset.cg,b.dataset.site,'view-favs'); else openPark(b.dataset.park,'view-favs'); })); }
/* No heart on a park row: the list is a long scroll and the target sat right
   under a scrolling thumb. A park is favourited on its own page. */
function parkRowHtml(p,st,sub,value){
  return '<button class="ios-row ios-row--plain" type="button" data-park="'+p.id+'">'+
    '<span class="ios-row-body"><span class="ios-row-title">'+p.name+'</span>'+
    (sub?'<span class="ios-row-sub">'+sub+'</span>':'')+'</span>'+
    (value?'<span class="ios-row-value tnum">'+value+'</span>':'')+CHEV_RIGHT+'</button>';
}
function renderParks(){ const box=document.getElementById('parkList'); if(!box) return; box.innerHTML='';
  if(!PARKS.length){ box.innerHTML=`<div class="empty" style="border:1px solid var(--separator);border-radius:var(--r);background:var(--bg-elevated);padding:26px 18px">${TL('Park data could not be loaded.')}<br>${TL(IN_APP?'Reinstall the app from the App Store.':'Check your connection and reopen the app.')}</div>`; renderAzRail([]); return; }
  const visible=PARKS;
  const info={}; visible.forEach(p=>{ info[p.id]=parkTouchInfo(p); });
  const ts=state.touched||{};
  let html='';
  /* Favourites and the parks you have rated live in their own tab now, so
     the Parks list is the guide itself: every park, A to Z. */
  /* all parks, one flat alphabetical list split by first letter */
  html+=regionChipsHtml();
  const shown=((regionFilter==='All')?visible:visible.filter(p=>broadOf(p)===regionFilter))
    .slice().sort((a,b)=>a.name.localeCompare(b.name));
  const letters=[], byLetter={};
  shown.forEach(p=>{ const L=p.name[0].toUpperCase();
    if(!byLetter[L]){ byLetter[L]=[]; letters.push(L); } byLetter[L].push(p); });
  letters.forEach(L=>{
    html+='<div class="az-sec" id="az-'+L+'"><div class="az-head">'+L+'</div><div class="ios-group">'+
      byLetter[L].map(p=>{ const st=info[p.id];
        const town=(p.region||'').split(' · ').slice(1).join(' · ');
        const sub=TL(broadOf(p))+(town?' · '+town:'');
        return parkRowHtml(p,st,sub,st.rated>0?st.rated+' '+TL('rated'):''); }).join('')+
      '</div></div>';
  });
  if(!shown.length) html+='<div class="empty">No parks in this region.</div>';
  box.innerHTML=html;
  box.querySelectorAll('[data-park]').forEach(b=>b.addEventListener('click',()=>{ if(b.hasAttribute('data-site')) openFavSite(b.dataset.park,b.dataset.cg,b.dataset.site); else openPark(b.dataset.park); }));
  box.querySelectorAll('.fchip[data-region]').forEach(b=>b.addEventListener('click',()=>{ regionFilter=b.dataset.region; buzz(6); renderParks(); }));
  renderAzRail(letters);
}
/* the letter rail: fixed at the right edge, tap or drag to jump to a letter */
function syncAzRail(){ const rail=document.getElementById('azRail'), pl=document.getElementById('parkList');
  if(rail) rail.hidden=!rail.childElementCount||!pl||pl.hidden;
  /* the list gives up a strip on the right while the rail is up, so the rail
     never sits on the rows' right edge */
  const vp=document.getElementById('view-parks'); if(vp) vp.classList.toggle('rail-on',!!(rail&&!rail.hidden)); }
function renderAzRail(letters){ const rail=document.getElementById('azRail'); if(!rail) return;
  /* the rail is a pointer-only convenience that duplicates the A-Z section
     headers; hide it from assistive tech rather than expose 26 dead spans */
  rail.setAttribute('aria-hidden','true');
  rail.innerHTML=letters.map(L=>'<span data-l="'+L+'">'+L+'</span>').join('');
  syncAzRail(); }
(function(){ const rail=document.getElementById('azRail'); if(!rail) return;
  let active=false, lastL=null;
  function jump(L){ if(!L||L===lastL) return; lastL=L;
    const sec=document.getElementById('az-'+L); if(!sec) return;
    const head=document.getElementById('iosHeader');
    const off=(head&&!head.hidden?head.offsetHeight:0)+2;
    window.scrollTo(0,Math.max(0,sec.getBoundingClientRect().top+window.scrollY-off)); buzz(4); }
  function letterAt(y){ const r=rail.getBoundingClientRect();
    const el=document.elementFromPoint((r.left+r.right)/2,Math.min(r.bottom-1,Math.max(r.top+1,y)));
    return (el&&el.dataset)?el.dataset.l:null; }
  rail.addEventListener('pointerdown',function(e){ e.preventDefault(); active=true; lastL=null;
    try{ rail.setPointerCapture(e.pointerId); }catch(x){} jump(letterAt(e.clientY)); });
  rail.addEventListener('pointermove',function(e){ if(active) jump(letterAt(e.clientY)); });
  ['pointerup','pointercancel'].forEach(t=>rail.addEventListener(t,function(){ active=false; }));
})();

/* ================= single park ================= */
let curPark=null; var homeScrollY=0;
/* the screen a park page was opened from: the Parks list, Favourites or the
   Journal. The tab stays where it was and back returns to it, like a push
   inside an iOS tab. */
var parkHost='view-parks';
var PARK_HOST_LABEL={'view-parks':'All Parks','view-favs':'Favourites','view-journal':'Journal'};
function renderParkHost(){ if(parkHost==='view-favs') renderFavs(); else if(parkHost==='view-journal') renderJournal(); else { clearGSearch(); renderParks(); } }
function facilChip(name){ return `<span class="facil"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l4 4 10-10"/></svg>${TL(name)}</span>`; }
function openPark(pid,host){
  const vpark=document.getElementById('view-park');
  if(host&&PARK_HOST_LABEL[host]) parkHost=host; else if(vpark.hidden) parkHost='view-parks';   /* a re-render keeps its host */
  curPark=PARK_BY_ID[pid]; const p=curPark; const st=parkStats(p);
  document.getElementById('parkBody').innerHTML=`
    <div class="park-head"><div class="titlerow"><h2 id="parkTitle" style="cursor:pointer">${(p.region||'').indexOf('Algonquin')===0?p.name+', Algonquin':p.name}</h2>${parkFavHtml(p.id)}</div>
      <button class="about-toggle" id="aboutToggle" aria-expanded="false">${LANG==='fr'?'En savoir plus sur ':'About '}${p.name}<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="about-body" id="aboutBody" hidden>
        <div class="blurb">${p.blurb}</div>
        <div class="facils">${p.facilities.map(facilChip).join('')}</div>
        <div class="fishing"><b>${TL('Fishing')}:</b> ${p.fishing}</div>
        ${(m=>m?`<a class="fmz" href="${FISHREG_BASE}#zone=${m[1]}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 12c-4 4-8 4-14 0 6-4 10-4 14 0Zm0 0 3-3m-3 3 3 3"/><circle cx="8.5" cy="11.5" r=".5" fill="currentColor"/></svg>${TL('Fishing zone')} ${m[1]} \u2197</a>`:`<div class="fmz"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 12c-4 4-8 4-14 0 6-4 10-4 14 0Zm0 0 3-3m-3 3 3 3"/><circle cx="8.5" cy="11.5" r=".5" fill="currentColor"/></svg>${p.fmz}</div>`)((p.fmz||'').match(/FMZ\s*(\d+)/))}
                <a class="fmz" href="${p.url}" target="_blank" rel="noopener"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4 10 14"/><path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></svg>${TL('Official park page')} \u2197</a>
      </div>
    </div>
    <div class="seclabel">${p.dayuse?TL('Rating'):TL('Park rating')}</div>
    <button class="trail" id="parkRate"><div class="tr-left"><div class="tr-name">${TL('Rate this park')}</div></div><span class="tr-rate" id="prVal" hidden></span></button>
    <div id="parkProg"></div>
    ${p.dayuse?'':'<div class="seclabel">'+TL('Campgrounds')+'</div>'}
    <div id="cgs"></div>

    ${(p.trails&&p.trails.length)?'<div class="seclabel">'+TL('Trails')+'</div><div id="trails"></div>':''}
    <div id="wantSection" hidden><div class="seclabel">${TL('Wishlist')}</div><div id="wantList"></div></div>
    <div id="topSection" hidden><div class="seclabel">${TL('Top sites')}</div><ul class="rank" id="topSites"></ul></div>
    ${p.dayuse?'':`<div id="statsWrap" hidden><div class="seclabel">${TL('Stats')}</div>
    <details class="statscard"><summary>${TL('Park stats')}<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></summary><div class="statsbody" id="statsBody"></div></details></div>`}
`;
  renderCgs(); renderTrails(); wireParkControls(); updatePark(); renderGlance();
  document.getElementById('parkTitle').addEventListener('click',function(){ onParkNameTap(p); });
  if(vpark.hidden) homeScrollY=window.scrollY||document.documentElement.scrollTop||0;
  setHeaderHidden(true);
  const bl=document.getElementById('backLabel'); if(bl) bl.textContent=TL(PARK_HOST_LABEL[parkHost]);
  ALL_VIEWS.forEach(function(id){ if(id!=='view-park'){ const el=document.getElementById(id); if(el) el.hidden=true; } });
  const vp=vpark; vp.hidden=false;
  vp.classList.remove('view-anim'); void vp.offsetWidth; vp.classList.add('view-anim'); window.scrollTo(0,0);
  if(window.parkResetSync) parkResetSync();
  requestAnimationFrame(()=>{ window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0; });
}
function goHome(){ const vp=document.getElementById('view-park');
  vp.classList.add('view-out');
  setTimeout(function(){ vp.classList.remove('view-out'); vp.hidden=true;
    setHeaderHidden(false);
    const vh=document.getElementById(parkHost)||document.getElementById('view-parks'); vh.hidden=false;
    vh.classList.remove('view-anim'); void vh.offsetWidth; vh.classList.add('view-anim');
    renderParkHost(); window.scrollTo(0,homeScrollY); if(window.parkResetSync) parkResetSync(); },150); }
document.getElementById('backBtn').addEventListener('click',function(){
  /* one clean slide, the same the swipe uses; never the double animation */
  if(window.sjExitPark){ window.sjExitPark(); } else { goHome(); } });
(function(){
  const rb=document.getElementById('resetBtn');
  /* the row is an .ios-row, so the confirm copy goes in the title span, not on the
     button itself, or writing textContent would wipe the tile and chevron out */
  const rbT=rb&&(rb.querySelector('.ios-row-title')||rb);
  if(rb){ let armed=false, t=null;
    rb.addEventListener('click',function(){
      if(!armed){ armed=true; rb.classList.add('armed'); rbT.textContent=TL('Tap again to erase everything');
        t=setTimeout(function(){ armed=false; rb.classList.remove('armed'); rbT.textContent=TL('Reset all data'); },4000); return; }
      clearTimeout(t);
      try{ localStorage.removeItem(KEY); }catch(e){}
      /* "erase everything" must take the favourites and the display name too,
         or the Parks screen still shows a populated Favourites section after */
      ['oncamp-favs','outdoors-profile','site-journal-theme','site-journal-theme-vars','site-journal-unlocks','site-journal-sort','site-journal-group','site-journal-origin','site-journal-jfilter'].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
      try{ indexedDB.deleteDatabase('scout-photos'); }catch(e){}
      /* land back at the very top, exactly like a fresh open */
      try{ history.scrollRestoration='manual'; }catch(e){}
      homeScrollY=0; window.scrollTo(0,0);
      setTimeout(function(){ location.reload(); },200); }); }
  const pb=document.getElementById('resetBtnPark');
  if(pb){ let armed=false, t=null;
    window.parkResetSync=function(){ armed=false; clearTimeout(t); pb.classList.remove('armed');
      pb.hidden=!(curPark&&parkHasData(curPark.id));
      pb.textContent=curPark?(LANG==='fr'?('Réinitialiser les données pour '+curPark.name):('Reset '+curPark.name+' data')):''; };
    pb.addEventListener('click',async function(){ if(!curPark) return;
      if(!armed){ armed=true; pb.classList.add('armed'); pb.textContent=TL('Tap again to erase this park');
        t=setTimeout(function(){ window.parkResetSync(); },4000); return; }
      clearTimeout(t); await wipeParkData(curPark.id); window.parkResetSync(); });
    window.parkResetSync(); }
})();
(function(){ /* backup: the whole journal travels as one JSON file, ratings, notes, photos, themes and all */
  var BK_KEYS=['ontario-scout-v2','oncamp-favs','outdoors-profile','site-journal-theme','site-journal-theme-vars','site-journal-unlocks','site-journal-sort','site-journal-group','site-journal-origin'];
  var eb=document.getElementById('exportBtn'), ib=document.getElementById('importBtn'), fi=document.getElementById('importInput');
  if(!eb||!ib||!fi) return;
  /* the Account view carries a second pair of rows wired to the same actions */
  var exportRows=[eb].filter(Boolean);
  var importRows=[ib].filter(Boolean);
  function allPhotos(){ return openDB().then(function(db){ return new Promise(function(res){ var tx=db.transaction(STORE,'readonly');
    var rq=tx.objectStore(STORE).getAll(); rq.onsuccess=function(){ res(rq.result||[]); }; rq.onerror=function(){ res([]); }; }); }).catch(function(){ return []; }); }
  function buildBackup(){ return allPhotos().then(function(rows){
    var photos={}; rows.forEach(function(r){ if(r&&r.siteId&&Array.isArray(r.list)&&r.list.length) photos[r.siteId]=r.list; });
    var data={}; BK_KEYS.forEach(function(k){ try{ var v=localStorage.getItem(k); if(v!=null) data[k]=v; }catch(e){} });
    return {app:'site-journal',format:1,appVersion:APP_VERSION,exported:new Date().toISOString(),data:data,photos:photos}; }); }
  function backupName(){ var d=new Date(); function p(n){ return (n<10?'0':'')+n; }
    return 'ON site backup '+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'.json'; }
  function exportDone(){ showThemeToast(TL('Backup exported. Keep it somewhere safe.')); }
  function downloadFile(file){ if(window.Capacitor){ showThemeToast('Sharing is not available right now. Try again.'); return; }
    var url=URL.createObjectURL(file); var a=document.createElement('a'); a.href=url; a.download=file.name;
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },1200); exportDone(); }
  function deliver(file){
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      return navigator.share({files:[file]}).then(exportDone).catch(function(err){ if(err&&err.name==='AbortError') return; downloadFile(file); }); }
    downloadFile(file); return Promise.resolve(); }
  var exBusy=false;
  function doExport(){ if(exBusy) return; exBusy=true;
    buildBackup().then(function(payload){ var file=new File([JSON.stringify(payload)],backupName(),{type:'application/json'}); return deliver(file); })
      .catch(function(){ showThemeToast('Could not build the backup. Try again.'); })
      .then(function(){ exBusy=false; }); }
  exportRows.forEach(function(b){ b.addEventListener('click',doExport); });
  var pendingPayload=null, armT=null;
  /* keep the tile and chevron, write into the title span only */
  function importTitles(){ return importRows.map(function(b){ return b.querySelector('.ios-row-title')||b; }); }
  function setImportLabel(t){ importTitles().forEach(function(el){ el.textContent=t; }); }
  function disarmImport(){ pendingPayload=null; clearTimeout(armT);
    importRows.forEach(function(b){ b.classList.remove('armed'); }); setImportLabel(TL('Import a backup')); }
  importRows.forEach(function(b){ b.addEventListener('click',function(){
    if(pendingPayload){ clearTimeout(armT); applyBackup(pendingPayload); pendingPayload=null; return; }
    fi.value=''; fi.click(); }); });
  fi.addEventListener('change',function(){
    var f=fi.files&&fi.files[0]; if(!f) return;
    f.text().then(function(txt){ var p=null; try{ p=JSON.parse(txt); }catch(e){}
      if(!p||p.app!=='site-journal'||!p.data||typeof p.data['ontario-scout-v2']!=='string'){ showThemeToast('That file is not an ON site backup.'); return; }
      var n=0; try{ var s=JSON.parse(p.data['ontario-scout-v2']), rv=!!(s&&s.gear==='rv');
        ['site','campground','trail'].forEach(function(t){ var m=s&&s[t]||{}; for(var k in m){ var e=m[k]; if(e&&typeof e.score==='number'&&(t!=='site'||rv||!e.trailer)) n++; } }); }catch(e){}
      pendingPayload=p; importRows.forEach(function(b){ b.classList.add('armed'); });
      setImportLabel(TL('Tap again to restore')+' '+n+' '+(n===1?TL('rating'):TL('ratings')));
      armT=setTimeout(disarmImport,6000); })
      .catch(function(){ showThemeToast('Could not read that file.'); }); });
  function applyBackup(p){
    try{ clearTimeout(saveTimer); }catch(e){}
    /* track every write: a failed localStorage.setItem (quota) or an errored/
       aborted IndexedDB transaction must not be reported as a clean restore */
    var lsOk=true;
    BK_KEYS.forEach(function(k){ try{ if(typeof p.data[k]==='string') localStorage.setItem(k,p.data[k]); else localStorage.removeItem(k); }catch(e){ lsOk=false; } });
    var photos=(p.photos&&typeof p.photos==='object')?p.photos:{};
    openDB().then(function(db){ return new Promise(function(res){ var putErr=false;
      var tx=db.transaction(STORE,'readwrite'); var st=tx.objectStore(STORE); st.clear();
      Object.keys(photos).forEach(function(k){ var list=photos[k]; if(Array.isArray(list)&&list.length){ try{ st.put({siteId:k,list:list}); }catch(e){ putErr=true; } } });
      tx.oncomplete=function(){ res(!putErr); }; tx.onerror=function(){ res(false); }; tx.onabort=function(){ res(false); }; }); }).catch(function(){ return false; })
      .then(function(dbOk){
        if(lsOk&&dbOk){ showThemeToast(TL('Backup restored. Welcome back.')); setTimeout(function(){ location.reload(); },900); }
        /* a write failed: keep the pre-import state (do not reload) and say so */
        else{ showThemeToast(TL('Some of the backup could not be saved. Your device storage may be full.')); }
      }); }
})();
(function(){ /* interactive drag-back: the park page follows your finger and reveals home underneath */
  var vp=document.getElementById('view-park'), vh=document.getElementById('view-parks');
  var sx=0, sy=0, dx=0, lastX=0, lastT=0, vel=0, deciding=false, dragging=false, parkScrollY=0;
  function prep(){ parkScrollY=window.scrollY||document.documentElement.scrollTop||0;
    vh=document.getElementById(parkHost)||document.getElementById('view-parks');   /* reveal the screen it came from */
    vp.classList.remove('view-anim'); vp.classList.add('dragback'); vp.style.top=(-parkScrollY)+'px';
    /* a pop reveal, not a tab switch: no glass-in under the finger. the
       class rides the view until the next tab switch clears it. */
    vh.classList.add('no-anim');
    vh.hidden=false; window.scrollTo(0,homeScrollY); }
  function cancel(){ vp.style.transition='transform .32s cubic-bezier(.22,1.28,.36,1)'; vp.style.transform='translateX(0)';
    setTimeout(function(){ window.scrollTo(0,parkScrollY); vh.hidden=true;
      vp.style.transition=''; vp.style.transform=''; vp.style.top=''; vp.classList.remove('dragback'); },230); }
  function complete(){ buzz(9);
    vp.style.transition='transform .26s cubic-bezier(.32,.72,.35,1)'; vp.style.transform='translateX(105%)';
    setTimeout(function(){ vp.style.transition=''; vp.style.transform=''; vp.style.top=''; vp.classList.remove('dragback'); vp.hidden=true;
      setHeaderHidden(false);
      renderParkHost(); window.scrollTo(0,homeScrollY); if(window.parkResetSync) parkResetSync(); },190); }
  /* the back button uses this same single slide, so it never animates twice */
  window.sjExitPark=function(){ if(vp.hidden) return;
    prep();
    vp.style.transition='none'; vp.style.transform='translateX(0)';
    void vp.offsetWidth;   /* commit the start frame so the slide always animates */
    complete(); };
  vp.addEventListener('touchstart',function(e){ if(e.touches.length!==1) return;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; lastX=sx; lastT=Date.now(); vel=0; dx=0; deciding=true; dragging=false; },{passive:true});
  vp.addEventListener('touchmove',function(e){ if(!deciding&&!dragging) return;
    var x=e.touches[0].clientX, y=e.touches[0].clientY; dx=x-sx; var dy=y-sy;
    if(deciding){ if(Math.abs(dx)>8||Math.abs(dy)>8){ deciding=false;
      if(dx>0&&Math.abs(dx)>Math.abs(dy)*1.2){ dragging=true; prep(); } } }
    if(dragging){ e.preventDefault();
      var now=Date.now(); if(now>lastT) vel=(x-lastX)/(now-lastT); lastX=x; lastT=now;
      vp.style.transition='none'; vp.style.transform='translateX('+Math.max(0,dx)+'px)'; } },{passive:false});
  vp.addEventListener('touchend',function(){ if(!dragging){ deciding=false; return; }
    dragging=false;
    if(dx>window.innerWidth*0.33||vel>0.55) complete(); else cancel(); });
  vp.addEventListener('touchcancel',function(){ if(dragging){ dragging=false; cancel(); } deciding=false; });
})();

function renderCgs(){ const box=document.getElementById('cgs'); box.innerHTML=''; const p=curPark;
  p.campgrounds.forEach(cg=>{ const st=cgStats(p,cg), own=sc('campground',cidOf(p.id,cg.id)), col=scoreColor(own);
    const card=document.createElement('div'); card.className='cg'; card.dataset.cg=cg.id;
    card.innerHTML=`
      <button class="cg-row" data-toggle aria-expanded="false">
        <div class="cg-left"><div class="cg-name">${cg.id}</div><div class="cg-sub">${(cg.sub||'').split(' · ').slice(0,2).join(' · ')}</div></div>
        <div class="cg-right"><div class="cg-prog${(st.total===0&&st.aside>0)?' aside':''}" ${(st.rated>0||(st.total===0&&st.aside>0))?'':'hidden'}><div class="bar"><i style="width:${st.pct}%"></i></div><div class="lbl tnum">${(st.total===0&&st.aside>0)?TL('Trailers'):st.rated+'/'+st.total}</div></div>
        <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></div>
      </button>
      <div class="cg-body"><div class="cg-body-head"><span class="cg-desc">${cgDesc(p.id,cg)}</span>
        <button class="cg-rate ${col?'rated':''}" ${col?`style="background:${col}"`:''} data-cgrate>${col?`${TL('Campground')} · ${own}/5`:TL('Rate campground')}</button></div>
        <div class="grid"></div></div>`;
    card.querySelector('[data-toggle]').addEventListener('click',()=>{ const opening=!card.classList.contains('open'); card.classList.toggle('open'); if(opening) fillGrid(card); card.querySelector('[data-toggle]').setAttribute('aria-expanded',String(card.classList.contains('open'))); });
    card.querySelector('[data-cgrate]').addEventListener('click',e=>{ e.stopPropagation(); openSheet('campground',cidOf(p.id,cg.id),cg.id,null); });
    box.appendChild(card); });
  if(p.campgrounds.length===1){ const only=box.querySelector('.cg'); if(only){ only.classList.add('open'); fillGrid(only); const tg=only.querySelector('[data-toggle]'); if(tg) tg.setAttribute('aria-expanded','true'); } } }
/* "38 sites · 12 trailer sites": the count the rating runs over, then the ones set aside */
function cgDesc(pid,cg){ const all=sitesOf(pid,cg), aside=all.filter(s=>skipSite(keyOf(pid,cg.id,s))).length, n=all.length-aside;
  if(n===0&&aside>0) return aside+' '+TL(aside===1?'trailer site':'trailer sites');
  return n+' '+TL(n===1?'site':'sites')+(aside?' · '+aside+' '+TL(aside===1?'trailer site':'trailer sites'):''); }
function fillGrid(card){ if(card.dataset.filled) return; const cg=CG_BY_ID(card.dataset.cg); const grid=card.querySelector('.grid');
  const frag=document.createDocumentFragment(); sitesOf(curPark.id,cg).forEach(s=>frag.appendChild(makeChip(cg,s)));
  frag.appendChild(makeAddChip(cg,grid)); grid.appendChild(frag); card.dataset.filled='1'; }
/* the "+" tile: add a site number the guide is missing, then rate it right away */
function makeAddChip(cg,grid){ const b=document.createElement('button'); b.type='button'; b.className='site add-site';
  b.setAttribute('aria-label',TL('Add a site')); b.textContent='+';
  b.addEventListener('click',function(){ addSiteFlow(cg,grid); }); return b; }
function addSiteFlow(cg,grid){
  let n=null; try{ n=window.prompt(TL('Enter the site number to add')); }catch(e){ n=null; }
  if(n==null) return; n=String(n).trim().replace(/^#/,'').replace(/^site\s+/i,'').trim(); if(!n) return;
  const k=keyOf(curPark.id,cg.id,n);
  if(grid&&!grid.querySelector(`.site[data-key="${CSS.escape(k)}"]`)){
    const chip=makeChip(cg,n), addBtn=grid.querySelector('.add-site'); grid.insertBefore(chip,addBtn||null); }
  openSheet('site',k,cg.id,n);
}
const MEDAL_SVG='<svg class="medal" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 1a11 11 0 1 0 .01 0z M12 4.4 13.88 9.41 19.23 9.65 15.04 12.99 16.47 18.15 12 15.2 7.53 18.15 8.96 12.99 4.77 9.65 10.12 9.41z"/></svg>';
/* the trailing disclosure chevron on a grouped-list row; same sprite glyph the More screen uses */
const CHEV_RIGHT='<span class="ios-chevron"><svg aria-hidden="true"><use href="assets/icons.svg#chevron-right"/></svg></span>';
function chipInner(cg,s){ const k=keyOf(curPark.id,cg.id,s), v=sc('site',k), c=scoreColor(v), note=!!noteOf('site',k), want=wantOf(k), photo=photoKeys.has(k);
  return `${s}`; }
/* the chip shows only its site number; its state (rating, wishlist, note, photo)
   lives in colour and marker classes, so it is spelled out in the aria-label for
   colour-blind and screen-reader users */
function chipAria(k,s){ const v=sc('site',k);
  return TL('Site')+' '+s
    +(v!=null?', '+v+'/5':(skipSite(k)?'':', '+TL('not rated')))
    +(trailerOf(k)?', '+TL(skipSite(k)?'trailer site, set aside':'trailer site'):'')
    +(wantOf(k)?', '+TL('wishlist'):'')
    +(noteOf('site',k)?', '+TL('has a note'):'')
    +(photoKeys.has(k)?', '+TL('has a photo'):''); }
function makeChip(cg,s){ const k=keyOf(curPark.id,cg.id,s), skip=skipSite(k), c=skip?null:scoreColor(sc('site',k));   /* set aside: no score colour */
  const b=document.createElement('button'); b.className='site'+(c?' rated':'')+(wantOf(k)?' wanted':'')+((noteOf('site',k)||photoKeys.has(k))?' marked':'')+(trailerOf(k)?' trailer':'')+(skip?' aside':''); b.dataset.key=k; b.dataset.site=s; if(c) b.style.background=c;
  b.innerHTML=chipInner(cg,s); b.setAttribute('aria-label',chipAria(k,s)); b.addEventListener('click',()=>openSheet('site',k,cg.id,s)); return b; }
function refreshChip(k){ const b=document.querySelector(`.site[data-key="${CSS.escape(k)}"]`); if(!b) return;
  const parts=k.split('#'), cg=CG_BY_ID(parts[1]), s=parts.slice(2).join('#'), skip=skipSite(k), c=skip?null:scoreColor(sc('site',k));
  b.classList.toggle('rated',!!c); b.classList.toggle('wanted',wantOf(k)); b.classList.toggle('marked',!!(noteOf('site',k)||photoKeys.has(k))); b.classList.toggle('trailer',trailerOf(k)); b.classList.toggle('aside',skip); b.style.background=c||''; b.innerHTML=chipInner(cg,s); b.setAttribute('aria-label',chipAria(k,s)); }
function refreshCgHeader(cgId){ const card=document.querySelector(`.cg[data-cg="${CSS.escape(cgId)}"]`); if(!card) return; const cg=CG_BY_ID(cgId);
  const st=cgStats(curPark,cg), own=sc('campground',cidOf(curPark.id,cgId)), col=scoreColor(own);
  /* a loop set aside whole shows a muted word in place of a fraction; the house
     rule still holds: no "0 of 212" chores, nothing until something is rated */
  const allAside=st.total===0&&st.aside>0;
  const prog=card.querySelector('.cg-prog'); if(prog){ prog.hidden=!(st.rated>0||allAside); prog.classList.toggle('aside',allAside); }
  const desc=card.querySelector('.cg-desc'); if(desc) desc.textContent=cgDesc(curPark.id,cg);
  card.querySelector('.cg-prog .bar i').style.width=st.pct+'%';
  card.querySelector('.cg-prog .lbl').textContent=allAside?TL('Trailers'):`${st.rated}/${st.total}`;
  const rb=card.querySelector('[data-cgrate]'); rb.classList.toggle('rated',!!col); rb.style.background=col||''; rb.textContent=col?`${TL('Campground')} · ${own}/5`:TL('Rate campground'); }
function expandCg(cgId){ const card=document.querySelector(`.cg[data-cg="${CSS.escape(cgId)}"]`); if(!card) return;
  card.classList.add('open'); fillGrid(card); var tg=card.querySelector('[data-toggle]'); if(tg) tg.setAttribute('aria-expanded','true'); card.scrollIntoView({behavior:'smooth',block:'start'}); card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }

function refreshParkRate(){ const el=document.getElementById('prVal'); if(!el||!curPark) return;
  const own=sc('campground',cidOf(curPark.id,curPark.name)), col=scoreColor(own);
  el.hidden=!col; el.classList.toggle('rated',!!col); el.style.background=col||''; el.textContent=col?own+'/5':''; }
function wireParkControls(){
  document.getElementById('aboutToggle').addEventListener('click',function(){ const b=document.getElementById('aboutBody'); const open=b.hidden; b.hidden=!open; this.setAttribute('aria-expanded',open); });
  const pr=document.getElementById('parkRate');
  if(pr){ pr.addEventListener('click',()=>openSheet('campground',cidOf(curPark.id,curPark.name),curPark.name,null)); refreshParkRate(); }
  const fb=document.getElementById('favBtn');
  if(fb){ fb.addEventListener('click',()=>{ const on=toggleFav('parks',curPark.id);
    fb.classList.toggle('on',on); fb.setAttribute('aria-pressed',on?'true':'false');
    const lbl=fb.querySelector('.favpill-t'); if(lbl) lbl.textContent=on?TL('Favourited'):TL('Favourite');
    buzz(9); renderParks(); }); }
}
/* anything this park holds that Reset would erase: a rating, note or mark, or a photo */
function parkHasData(pid){ var pre=pid+'#', hit=false;
  ['site','campground','trail'].forEach(function(b){ var o=state[b]||{}; for(var k in o){ if(k.indexOf(pre)===0){ hit=true; break; } } });
  if(!hit) photoKeys.forEach(function(k){ if(String(k).indexOf(pre)===0) hit=true; });
  return hit; }
async function wipeParkData(pid){
  ['site','campground','trail'].forEach(b=>{ if(!state[b]) return;
    Object.keys(state[b]).forEach(k=>{ if(k.indexOf(pid+'#')===0) delete state[b][k]; }); });
  if(Array.isArray(state.pins)){ const i=state.pins.indexOf(pid); if(i>=0) state.pins.splice(i,1); }
  persist();
  try{ const db=await openDB(); await new Promise(res=>{ const tx=db.transaction(STORE,'readwrite'); const st=tx.objectStore(STORE);
    const rq=st.getAllKeys(); rq.onsuccess=()=>{ (rq.result||[]).forEach(k=>{ if(String(k).indexOf(pid+'#')===0) st.delete(k); }); };
    tx.oncomplete=()=>res(); tx.onerror=()=>res(); }); }catch(e){}
  await loadPhotoIndex();
  showThemeToast('Park data cleared.');
  openPark(pid); renderParks(); }

/* ================= sheet ================= */
/* ================= trails ================= */
function trailKey(name){ return curPark.id+'#'+name; }
function fmtLen(km){ return (km%1===0?km:km).toString()+' km'; }
function renderTrails(){
  const box=document.getElementById('trails'); if(!box) return; box.innerHTML='';
  const trails=curPark.trails||[];
  if(!trails.length){ box.innerHTML='<div class="empty" style="border:1px solid var(--separator);border-radius:var(--r);background:var(--bg-elevated);padding:20px 14px">No trails listed here yet.</div>'; return; }
  trails.forEach(t=>{
    const k=trailKey(t.name), v=sc('trail',k), col=scoreColor(v), note=!!noteOf('trail',k), photo=photoKeys.has(k);
    const card=document.createElement('button'); card.className='trail'; card.dataset.trail=t.name;
    card.innerHTML=`<div class="tr-left"><div class="tr-name">${t.name}</div>
      <div class="tr-meta">${fmtLen(t.length)} · ${TL(t.difficulty)}</div></div>
      <div class="tr-rate ${col?'rated':''}" ${col?`style="background:${col}"`:''} ${col?'':'hidden'}>${col?v+'/5':''}</div>`;
    card.addEventListener('click',()=>openSheet('trail',k,t.name));
    box.appendChild(card);
  });
}
function refreshTrailCard(name){
  const card=document.querySelector(`.trail[data-trail="${CSS.escape(name)}"]`); if(!card) return;
  const k=trailKey(name), v=sc('trail',k), col=scoreColor(v), note=!!noteOf('trail',k), photo=photoKeys.has(k);
  const r=card.querySelector('.tr-rate'); r.hidden=!col; r.classList.toggle('rated',!!col); r.style.background=col||'';
  r.textContent=col?v+'/5':'';
  card.querySelectorAll('.nstar,.medal').forEach(el=>el.remove());
}

let cur={type:null,k:null,cg:null,site:null,trailName:null};
const sheet=document.getElementById('sheet'), backdrop=document.getElementById('backdrop');
/* modal a11y, shared by the rate, legal and versions sheets: on open, save the
   triggering element, make the page behind the scrim inert + aria-hidden (the
   content views, the header and the tab bar, never the sheet divs themselves),
   and move focus into the sheet; on close, undo all of that and restore focus.
   Kept out of lockScroll/unlockScroll and the open/close animation. */
var _sheetLastFocus=null;
function sheetBgEls(){ var els=[];
  document.querySelectorAll('#views > section').forEach(function(el){ els.push(el); });
  var h=document.getElementById('iosHeader'); if(h) els.push(h);
  var t=document.getElementById('tabbar'); if(t) els.push(t);
  return els; }
function sheetA11yOpen(sheetEl){ if(!sheetEl) return;
  if(!_sheetLastFocus) _sheetLastFocus=document.activeElement;
  sheetBgEls().forEach(function(el){ try{ el.setAttribute('inert',''); el.setAttribute('aria-hidden','true'); }catch(e){} });
  setTimeout(function(){
    if(!sheetEl.classList.contains('on')) return;
    if(sheetEl.contains(document.activeElement)) return;
    var f=sheetEl.hasAttribute('data-focus-self')?null:sheetEl.querySelector('button:not([disabled]),input:not([type=hidden]):not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
    if(!f){ f=sheetEl; if(!f.hasAttribute('tabindex')) f.setAttribute('tabindex','-1'); }
    try{ f.focus({preventScroll:true}); }catch(e){ try{ f.focus(); }catch(e2){} }
  },60); }
function sheetA11yClose(){
  sheetBgEls().forEach(function(el){ try{ el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }catch(e){} });
  if(_sheetLastFocus&&_sheetLastFocus.focus){ try{ _sheetLastFocus.focus({preventScroll:true}); }catch(e){} }
  _sheetLastFocus=null; }
/* the wishlist toggle's star: decoration for the eye, the word is the name */
var WANT_STAR='<span class="wstar" aria-hidden="true">\u2605</span> ';
function buildDots(){ const d=document.getElementById('dots'); d.innerHTML=''; d.setAttribute('role','radiogroup'); d.setAttribute('aria-label',TL('Rating'));
  for(let i=0;i<=5;i++){ const b=document.createElement('button'); b.className='dot'; b.textContent=i; b.dataset.v=i; b.setAttribute('role','radio');
    b.setAttribute('aria-label', i+' / 5'); b.setAttribute('aria-checked','false'); b.addEventListener('click',()=>setScore(i)); d.appendChild(b); } }
function paintDots(){ const s=sc(cur.type,cur.k); document.querySelectorAll('#dots .dot').forEach(dot=>{ const v=+dot.dataset.v, on=(s!=null)&&v<=s;
  dot.classList.toggle('on',on); dot.style.background=on?scoreColor(s):'';
  dot.setAttribute('aria-checked', String(s!=null&&s===v)); }); }
/* Fill the sheet for one item, without the open/close chrome. openSheet adds the
   chrome; the swipe/chevron navigation reuses this to swap sites in place. */
function renderSheetBody(type,k,cgId,site){ cur={type,k,cg:cgId,site,trailName:(type==='trail'?cgId:null)};
  if(window.clearBtnSync) window.clearBtnSync();
  const wb=document.getElementById('wantBtn'), pw=document.getElementById('photoWrap'), whr=document.getElementById('d-where');
  if(type==='site'){ document.getElementById('d-kind').textContent=TL('Site'); document.getElementById('d-title').textContent=TL('Site')+' '+site;
    whr.textContent=(cgId===curPark.name?((curPark.region||'').split(' · ')[0]||'')+' · '+cgId:cgId+' · '+curPark.name); whr.style.display='';
    document.getElementById('d-ctx').textContent=''; document.getElementById('togRow').style.display=''; pw.style.display='';
    const w=wantOf(k); wb.setAttribute('aria-pressed',w); wb.innerHTML=WANT_STAR+TL('Wishlist'); renderPhotos(k);
  } else if(type==='trail'){ const t=(curPark.trails||[]).find(x=>x.name===cgId); whr.style.display='none';
    document.getElementById('d-kind').textContent=TL('Trail'); document.getElementById('d-title').textContent=cgId;
    document.getElementById('d-ctx').textContent=(t?fmtLen(t.length)+' · '+TL(t.difficulty):''); document.getElementById('togRow').style.display='none'; pw.style.display=''; renderPhotos(k);
  } else { whr.style.display='none'; const isPark=(cgId===curPark.name);
    document.getElementById('d-kind').textContent=isPark?TL('Park'):TL('Campground'); document.getElementById('d-title').textContent=cgId;
    document.getElementById('d-ctx').textContent=isPark?((curPark.region||'').split(' · ').slice(1).join(' · ')):curPark.name; document.getElementById('togRow').style.display='none'; pw.style.display=''; renderPhotos(k); }
  document.getElementById('photoNote').hidden=(type==='trail');
  document.getElementById('notesLabel').textContent=TL('Notes');
  document.getElementById('d-kind').style.display=(type==='site')?'none':'';
  const nta=document.getElementById('d-notes'); nta.value=noteOf(type,k); autoGrowNotes(nta); paintDots(); paintTrailer(); updateFootAll();
  /* keep the card short for one-handed rating: notes + photos stay tucked away
     unless this item already has one, so the rating row sits low in the thumb's reach */
  setExtraOpen(!!(noteOf(type,k)&&String(noteOf(type,k)).trim()) || photoKeys.has(k));
  updateSiteNav();
}
function openSheet(type,k,cgId,site){ renderSheetBody(type,k,cgId,site);
  backdrop.classList.add('on'); sheet.classList.add('on'); sheet.scrollTop=0; lockScroll(); sheetA11yOpen(sheet);
}
/* ---- swipe / step between the sites of the current campground ---- */
function siteSeqInfo(){ const cg=CG_BY_ID(cur.cg); if(!cg) return {seq:[],idx:-1};
  const s=String(cur.site);
  /* set-aside trailer sites drop out of the loop, except the one on screen */
  let seq=sitesOf(curPark.id,cg).filter(x=>x===s||!skipSite(keyOf(curPark.id,cg.id,x))); let idx=seq.indexOf(s);
  if(idx<0){ seq=seq.concat([s]); idx=seq.length-1; }   /* a just-added site sits at the end until it has data */
  return {seq,idx}; }
function canSiteNav(dir){ if(cur.type!=='site'||!curPark) return false; const {seq,idx}=siteSeqInfo(); const ni=idx+dir; return idx>=0&&ni>=0&&ni<seq.length; }
function updateSiteNav(){ const nav=document.getElementById('siteNav'); if(!nav) return;
  const pv=document.getElementById('sitePrev'), nx=document.getElementById('siteNext');
  /* when hidden, also disable the chevrons so the sheet's focus-management never
     tries to land focus on an invisible button */
  const hide=()=>{ nav.hidden=true; if(pv) pv.disabled=true; if(nx) nx.disabled=true; };
  if(cur.type!=='site'||!curPark) return hide();
  const {seq,idx}=siteSeqInfo();
  if(seq.length<2||idx<0) return hide();
  nav.hidden=false;
  const c=document.getElementById('siteCount'); if(c) c.textContent=(idx+1)+' / '+seq.length;
  if(pv) pv.disabled=(idx<=0); if(nx) nx.disabled=(idx>=seq.length-1); }
function doSiteNav(dir){ const {seq,idx}=siteSeqInfo(); const ni=idx+dir; const cg=CG_BY_ID(cur.cg);
  if(!cg||ni<0||ni>=seq.length) return false; const ns=seq[ni];
  renderSheetBody('site',keyOf(curPark.id,cg.id,ns),cg.id,ns); return true; }
function sheetReducedMotion(){ try{ return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
/* notes + photos collapse so the rating card stays short and thumb-reachable */
function setExtraOpen(open){ const nb=document.getElementById('noteBlock'), tg=document.getElementById('extraToggle');
  if(nb) nb.hidden=!open; if(tg){ tg.hidden=open; tg.setAttribute('aria-expanded',String(open)); } }

/* ---- Card swipe between the sites of a campground (Tinder / iOS feel) ----
   The card tracks the thumb with a slight tilt. A throw past the threshold, by
   distance or a quick flick, flings it off the way it was thrown and the next
   card slides in from the other side; a short drag snaps back. The sheet eases
   to the new card's height instead of jumping. Buttons and arrow keys fling
   too. Cards stay fully opaque the whole time. */
var _sheetBusy=false, _springAnim=null;
function sheetCard(){ return document.getElementById('sheetPane'); }
function settleCard(){ const card=sheetCard(); if(card) card.style.transform=''; _sheetBusy=false; }
/* ease the bottom sheet to the next card's height (it is bottom-anchored, so the
   top edge glides) rather than letting it jump */
function flipSheetHeight(h0){ if(!sheet||sheetReducedMotion()) return; const h1=sheet.offsetHeight; if(Math.abs(h1-h0)<2) return;
  sheet.animate([{height:h0+'px'},{height:h1+'px'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'}); }
function slideInCard(dir){ const card=sheetCard(); if(!card){ _sheetBusy=false; return; }
  const vw=window.innerWidth||400;
  const a=card.animate([{transform:'translateX('+(dir*vw*1.05)+'px) rotate('+(dir*3)+'deg)'},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.9,.25,1.02)'});
  a.onfinish=a.oncancel=settleCard; }
function flingAdvance(dir,startX,startRot,vel){ const card=sheetCard();
  if(!card||sheetReducedMotion()){ if(card) card.style.transform=''; doSiteNav(dir); _sheetBusy=false; return; }
  _sheetBusy=true;
  const vw=window.innerWidth||400, endX=-dir*(vw*1.1), endRot=-dir*12;   /* keep going the way it was thrown */
  const dist=Math.abs(endX-(startX||0)), speed=Math.max(Math.abs(vel||0),1.6), dur=Math.min(260,Math.max(140,dist/speed));
  const a1=card.animate([{transform:'translateX('+(startX||0)+'px) rotate('+(startRot||0)+'deg)'},
                         {transform:'translateX('+endX+'px) rotate('+endRot+'deg)'}],{duration:dur,easing:'cubic-bezier(.3,0,.6,1)'});
  a1.onfinish=function(){ const h0=sheet?sheet.offsetHeight:0;
    card.style.transform='translateX('+(dir*vw*1.05)+'px)';   /* park the next card off the far edge before filling it */
    doSiteNav(dir); flipSheetHeight(h0); slideInCard(dir); };
  a1.oncancel=settleCard; }
function springBack(startX,startRot){ const card=sheetCard(); if(!card) return;
  if(sheetReducedMotion()){ card.style.transform=''; return; }
  _springAnim=card.animate([{transform:'translateX('+(startX||0)+'px) rotate('+(startRot||0)+'deg)'},{transform:'none'}],{duration:320,easing:'cubic-bezier(.22,1.2,.36,1)'});
  _springAnim.onfinish=_springAnim.oncancel=function(){ card.style.transform=''; _springAnim=null; }; }
function siteNav(dir){ if(_sheetBusy||!canSiteNav(dir)) return; if(typeof buzz==='function') buzz(6); flingAdvance(dir,0,0,0); }
(function(){
  const pv=document.getElementById('sitePrev'), nx=document.getElementById('siteNext'), tg=document.getElementById('extraToggle');
  if(pv) pv.addEventListener('click',function(){ siteNav(-1); });
  if(nx) nx.addEventListener('click',function(){ siteNav(1); });
  /* opening the block does not summon the keyboard: that waits for a tap on
     the note itself. Focus lands on the block (not the field) so a screen
     reader is not left on the button that just disappeared. */
  if(tg) tg.addEventListener('click',function(){ setExtraOpen(true); const nb=document.getElementById('noteBlock');
    if(nb){ try{ nb.focus({preventScroll:true}); }catch(e){} revealInSheet(nb); } });
  document.addEventListener('keydown',function(e){
    if(!sheet.classList.contains('on')||cur.type!=='site') return;
    if(e.target&&e.target.closest&&e.target.closest('textarea,input,#dots')) return;
    if(e.key==='ArrowRight'){ e.preventDefault(); siteNav(1); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); siteNav(-1); } });
  const pane=document.getElementById('sheetPane'); if(!pane) return;
  const MAXROT=8, THRESH=64, VFLICK=0.5;
  let sx=0,sy=0,dx=0,tracking=false,dragging=false,decided=false,horiz=false,swiped=false,lastX=0,lastT=0,vel=0;
  function resist(v){ const dir=v<0?1:-1; return canSiteNav(dir)?v:v*0.3; }  /* rubber-band past the ends */
  function clampRot(d){ let r=d/22; if(r>MAXROT) r=MAXROT; if(r<-MAXROT) r=-MAXROT; return r; }
  pane.addEventListener('touchstart',function(e){
    tracking=false; if(_sheetBusy||cur.type!=='site'||e.touches.length!==1) return;
    if(e.target.closest('textarea,input,a')) return;
    if(siteSeqInfo().seq.length<2) return;
    if(_springAnim){ _springAnim.cancel(); }   /* re-grab mid-snap-back */
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; dx=0; vel=0; lastX=sx; lastT=Date.now();
    tracking=true; dragging=false; decided=false; horiz=false;
  },{passive:true});
  pane.addEventListener('touchmove',function(e){
    if(!tracking||!e.touches.length) return;
    const x=e.touches[0].clientX, y=e.touches[0].clientY, tx=x-sx, ty=y-sy;
    if(!decided){ if(Math.abs(tx)>8||Math.abs(ty)>8){ decided=true; horiz=Math.abs(tx)>Math.abs(ty)+4; } }
    if(decided&&horiz){ dragging=true; e.preventDefault();
      const now=Date.now(); if(now>lastT){ vel=(x-lastX)/(now-lastT); lastX=x; lastT=now; }
      dx=tx; const d=resist(dx);
      pane.style.transform='translateX('+d+'px) rotate('+clampRot(d)+'deg)'; }
  },{passive:false});
  function end(){ if(!tracking) return; tracking=false; if(!dragging){ return; } dragging=false;
    const d=resist(dx), dir=dx<0?1:-1;
    if((Math.abs(dx)>=THRESH||Math.abs(vel)>=VFLICK)&&canSiteNav(dir)){
      swiped=true; setTimeout(function(){ swiped=false; },400);
      if(typeof buzz==='function') buzz(6);
      flingAdvance(dir,d,clampRot(d),vel); dx=0; return; }
    springBack(d,clampRot(d)); dx=0; }
  pane.addEventListener('touchend',end); pane.addEventListener('touchcancel',end);
  /* a committed swipe must not also fire the click it ends on (e.g. a rating dot) */
  pane.addEventListener('click',function(e){ if(swiped){ swiped=false; e.stopPropagation(); e.preventDefault(); } },true);
})();
function closeSheet(){ var was=sheet.classList.contains('on'); backdrop.classList.remove('on'); sheet.classList.remove('on'); sheet.style.transform=''; unlockScroll(); if(was) sheetA11yClose(); }
function ensure(){ if(!state[cur.type][cur.k]) state[cur.type][cur.k]={score:null,note:''}; return state[cur.type][cur.k]; }
function flashSaved(){}
function afterChange(){ touchPark(cur.k.split('#')[0]); persist();
  if(cur.type==='site'){ refreshChip(cur.k); refreshCgHeader(cur.cg); updatePark(); renderGlance(); }
  else if(cur.type==='trail'){ refreshTrailCard(cur.trailName); }
  else { refreshCgHeader(cur.cg); refreshParkRate(); } }
function setScore(v){ const e=ensure(); e.score=(e.score===v?null:v); buzz(9); paintDots(); flashSaved(); afterChange(); }
document.getElementById('wantBtn').addEventListener('click',function(){ const e=ensure(); e.want=!e.want; buzz(9);
  this.setAttribute('aria-pressed',e.want); this.innerHTML=WANT_STAR+TL('Wishlist'); if(e.want&&e.score==null) showThemeToast(TL('Added to your wishlist.')); flashSaved(); touchPark(cur.k.split('#')[0]); persist(); if(cur.site) refreshChip(cur.k); renderGlance(); });
/* ---- Trailer site: the right half of the toggle row ----
   One tap labels the site; the label and a rating live side by side, and the
   Equipment setting decides whether the site counts. A labelled card says so
   on its ctx line (the rating row is described by it), and the foot gains a
   state-derived offer to label the rest of the campground in one tap. */
function paintTrailer(){ const tb=document.getElementById('trailerBtn'), ctx=document.getElementById('d-ctx'), dots=document.getElementById('dots');
  const on=cur.type==='site'&&trailerOf(cur.k);
  if(tb){ tb.setAttribute('aria-pressed',String(on)); tb.textContent=(on?'\u2713 ':'')+TL('Trailer site'); }
  if(!dots||!ctx) return;
  if(cur.type==='site'){
    if(on){ ctx.textContent=TL(skipSite(cur.k)?'Trailer site, not counted in your progress':'Trailer site, counted like any other'); dots.setAttribute('aria-describedby','d-ctx'); }
    else { ctx.textContent=''; dots.removeAttribute('aria-describedby'); } }
  else dots.removeAttribute('aria-describedby'); }
/* a site with nothing saved at all: the only kind the bulk action touches */
function siteBlank(k){ const e=state.site[k];
  return (!e||(e.score==null&&!e.want&&!e.trailer&&!(e.note&&String(e.note).trim())))&&!photoKeys.has(k)&&!isFav('sites',k); }
function trailerOthers(){ const out={blank:[],flagged:[]}; if(cur.type!=='site'||!curPark) return out; const cg=CG_BY_ID(cur.cg); if(!cg) return out;
  sitesOf(curPark.id,cg).forEach(s=>{ const k=keyOf(curPark.id,cg.id,s); if(k===cur.k) return;
    if(trailerOf(k)) out.flagged.push(k); else if(siteBlank(k)) out.blank.push(k); });
  return out; }
/* short enough for two lines of the foot in French at the largest text size;
   the accessible name starts with the visible words and adds the campground */
function footAllLabel(mode,n){
  if(mode==='undo') return TL('Undo');
  if(LANG==='fr') return mode==='mark'?'Marquer '+n+' autre'+(n===1?'':'s'):'Retirer '+n+' marque'+(n===1?'':'s');
  return mode==='mark'?'Mark '+n+' more as '+(n===1?'a trailer site':'trailer sites'):'Remove '+n+' other trailer mark'+(n===1?'':'s'); }
function footAllAria(mode,n,cg){
  if(mode==='undo') return TL('Undo')+', '+n+' '+TL(n===1?'trailer mark':'trailer marks');
  return footAllLabel(mode,n)+', '+cg; }
/* after a bulk removal the foot itself offers the undo for the toast's window,
   so it is reachable inside the open sheet and a second tap cannot re-mark */
var _footUndo=null;
function updateFootAll(){ const b=document.getElementById('trailerAllBtn'); if(!b) return;
  let mode=null,n=0;
  if(_footUndo&&Date.now()>=_footUndo.until) _footUndo=null;
  if(cur.type==='site'&&curPark&&_footUndo&&_footUndo.pid===curPark.id&&_footUndo.cg===cur.cg){ mode='undo'; n=_footUndo.n; }
  else if(cur.type==='site'&&curPark&&trailerOf(cur.k)){ const o=trailerOthers();
    if(o.blank.length){ mode='mark'; n=o.blank.length; } else if(o.flagged.length){ mode='unmark'; n=o.flagged.length; } }
  if(!mode){
    /* never hide the control under the focus: hand it to the toggle first */
    if(document.activeElement===b){ const tb=document.getElementById('trailerBtn'); if(tb){ try{ tb.focus({preventScroll:true}); }catch(e){} } }
    b.hidden=true; b.removeAttribute('data-mode'); layoutFoot(); return; }
  b.hidden=false; b.dataset.mode=mode; b.textContent=footAllLabel(mode,n); b.setAttribute('aria-label',footAllAria(mode,n,cur.cg)); layoutFoot(); }
/* The foot is one line: share, the offer, Clear, Done. When the offer's words
   and the buttons cannot share a line (narrow phones, large text, French),
   the offer takes a line of its own above them, so the share glyph stays at
   the bottom left and Done at the bottom right. Measured, not guessed: the
   natural wrap is read once, then the stacked order is applied. */
function layoutFoot(){ const f=document.querySelector('#sheet .sheet-foot'), b=document.getElementById('trailerAllBtn'), s=document.getElementById('shareBtn'), c=document.getElementById('clearBtn'), d=document.getElementById('doneBtn');
  if(!f||!s||!c||!d) return; f.classList.remove('stacked');
  /* wrapped when Clear's or Done's middle sits below the share glyph's
     bottom (on one line they are centred together, at different heights) */
  const below=function(el){ return el.offsetTop+el.offsetHeight/2>s.offsetTop+s.offsetHeight; };
  if(b&&!b.hidden&&(below(c)||below(d))) f.classList.add('stacked'); }
window.addEventListener('resize',function(){ if(sheet&&sheet.classList.contains('on')) layoutFoot(); },{passive:true});
function emptyShell(e){ return !!e&&e.score==null&&!e.want&&!e.trailer&&!(e.note&&String(e.note).trim()); }
document.getElementById('trailerBtn').addEventListener('click',function(){
  if(cur.type!=='site'||!curPark) return;
  const e=ensure(), k=cur.k, ctx=document.getElementById('d-ctx'), hadCtx=!!(ctx&&ctx.textContent);
  if(!e.trailer) e.trailer=true;
  else { delete e.trailer; if(emptyShell(e)) delete state.site[k]; }   /* leave no empty record behind */
  const oldTxt=hadCtx?ctx.textContent:'', oldH=hadCtx?ctx.offsetHeight:0;
  buzz(9); paintTrailer(); afterChange(); updateFootAll(); updateSiteNav();
  /* the explanation slides open (or closed) above the rating row; the sheet is
     bottom-anchored, so the row itself never moves (animating the sheet's height
     instead pinned the old height for a beat and dipped the row) */
  if(ctx&&!sheetReducedMotion()){
    if(!hadCtx&&ctx.textContent){ const h=ctx.offsetHeight;
      if(h){ ctx.style.overflow='hidden'; const a=ctx.animate([{height:'0px',opacity:0},{height:h+'px',opacity:1}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
        a.onfinish=a.oncancel=function(){ ctx.style.overflow=''; }; } }
    else if(hadCtx&&!ctx.textContent&&oldH){ ctx.textContent=oldTxt; ctx.style.overflow='hidden';   /* keep the words while they fold away */
      const a=ctx.animate([{height:oldH+'px',opacity:1},{height:'0px',opacity:0}],{duration:200,easing:'cubic-bezier(.4,0,.6,1)'});
      a.onfinish=a.oncancel=function(){ ctx.style.overflow=''; if(cur.k===k&&!trailerOf(k)) ctx.textContent=''; }; } } });
document.getElementById('trailerAllBtn').addEventListener('click',function(){
  if(cur.type!=='site'||!curPark) return;
  const o=trailerOthers(), cgId=cur.cg, pid=curPark.id, mode=this.dataset.mode;
  /* repaint only what is mounted: the park may have changed under a late undo */
  const repaint=function(keys){
    if(curPark&&curPark.id===pid){ keys.forEach(refreshChip); refreshCgHeader(cgId); updatePark(); renderGlance();
      if(sheet.classList.contains('on')&&cur.type==='site'&&cur.cg===cgId){ paintTrailer(); updateFootAll(); updateSiteNav(); } }
    const vp=document.getElementById('view-parks'); if(vp&&!vp.hidden) renderParks();
    const vj=document.getElementById('view-journal'); if(vj&&!vj.hidden) renderJournal();
    const vf=document.getElementById('view-favs'); if(vf&&!vf.hidden) renderFavs(); };
  if(mode==='undo'&&_footUndo){ const fn=_footUndo.fn; _footUndo=null; hideThemeToast(); fn(); return; }
  if(mode==='mark'&&o.blank.length){ const keys=o.blank, created=[];
    keys.forEach(k=>{ if(!state.site[k]){ state.site[k]={score:null,note:''}; created.push(k); } state.site[k].trailer=true; });
    touchPark(pid); persistNow(); buzz(12); const n=keys.length;
    keys.forEach(refreshChip); refreshCgHeader(cgId); updatePark(); renderGlance(); closeSheet();   /* the hatched grid is the confirmation */
    showThemeToast(n+' '+TL(n===1?'site marked as a trailer site':'sites marked as trailer sites'),function(){
      keys.forEach(k=>{ const e=state.site[k]; if(!e) return; delete e.trailer; if(created.indexOf(k)>=0&&emptyShell(e)) delete state.site[k]; });
      persistNow(); buzz(9); repaint(keys); showThemeToast(TL('Undone.'),null,2000); },6000); }
  else if(mode==='unmark'&&o.flagged.length){ const keys=o.flagged, n=keys.length;
    keys.forEach(k=>{ const e=state.site[k]; if(!e) return; delete e.trailer; if(emptyShell(e)) delete state.site[k]; });
    const undo=function(){ keys.forEach(k=>{ const e=state.site[k]||(state.site[k]={score:null,note:''}); e.trailer=true; });
      _footUndo=null; persistNow(); buzz(9); repaint(keys); showThemeToast(TL('Undone.'),null,2000); };
    _footUndo={pid,cg:cgId,n,fn:undo,until:Date.now()+6000};
    setTimeout(function(){ if(_footUndo&&Date.now()>=_footUndo.until){ _footUndo=null; updateFootAll(); } },6050);
    touchPark(pid); persistNow(); buzz(12); repaint(keys);
    showThemeToast(n+' '+TL(n===1?'trailer mark removed':'trailer marks removed'),undo,6000); }
});
function autoGrowNotes(el){ el.style.height='auto'; el.style.height=Math.max(106,el.scrollHeight)+'px'; }
/* ---- the keyboard never covers what is being typed ----
   iOS lays its keyboard over the page without resizing it, so a sheet pinned
   to the bottom of the screen sat behind it, note and all. While a field in a
   sheet has focus the sheet rides on the keyboard (the strip between the
   layout and visual viewports), shrinks to the space that is left, and keeps
   the line with the caret in view as the note grows. */
function keyboardInset(){ const vv=window.visualViewport; if(!vv) return 0;
  return Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop)); }
/* where the caret's line ends, measured on a hidden copy of the field */
function caretLineBottom(el){ const cs=getComputedStyle(el), m=document.createElement('div');
  ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','paddingTop','paddingLeft','paddingRight',
   'borderTopWidth','borderLeftWidth','borderRightWidth','boxSizing','textTransform','wordSpacing'].forEach(function(k){ m.style[k]=cs[k]; });
  m.style.position='absolute'; m.style.visibility='hidden'; m.style.left='-9999px'; m.style.top='0';
  m.style.whiteSpace='pre-wrap'; m.style.overflowWrap='break-word'; m.style.width=el.offsetWidth+'px';
  m.textContent=el.value.slice(0,el.selectionEnd==null?el.value.length:el.selectionEnd)+'\u200b';
  document.body.appendChild(m); const h=m.offsetHeight; m.remove(); return h; }
/* scroll a sheet so [top,bottom] (viewport px) sits inside its visible part */
function scrollSheetTo(sh,top,bottom){ const sr=sh.getBoundingClientRect(), pad=16;
  const lo=sr.top+pad, hi=sr.bottom-pad;
  if(bottom>hi) sh.scrollTop+=Math.min(bottom-hi,Math.max(0,top-lo));
  else if(top<lo) sh.scrollTop-=lo-top; }
function revealInSheet(el){ const sh=el.closest&&el.closest('.sheet'); if(!sh) return;
  requestAnimationFrame(function(){ const r=el.getBoundingClientRect(); scrollSheetTo(sh,r.top,r.bottom); }); }
function keepCaretInView(el){ const sh=el&&el.closest?el.closest('.sheet.on'):null; if(!sh) return;
  const r=el.getBoundingClientRect(), lh=parseFloat(getComputedStyle(el).lineHeight)||22;
  const lineBottom=r.top+caretLineBottom(el)+4;
  scrollSheetTo(sh,lineBottom-lh-8,lineBottom); }
function fitSheetToKeyboard(){
  const el=document.activeElement, field=el&&/^(TEXTAREA|INPUT)$/.test(el.tagName)?el:null;
  const sh=field&&field.closest?field.closest('.sheet.on'):null, kb=sh?keyboardInset():0, vv=window.visualViewport;
  document.querySelectorAll('.sheet.kb,.sheet.kbcap').forEach(function(x){ if(x!==sh||kb<=40){ x.classList.remove('kb','kbcap'); x.style.bottom=''; x.style.maxHeight=''; } });
  if(sh&&kb>40&&vv){
    /* a bottom sheet rides up on the keyboard. Between 700 and 1099px ios.css
       makes the sheet a dialog pinned near the top (keep this range in step
       with those two blocks); it keeps its place and only stops short of the
       keyboard, unless that leaves too little room, when it rides up too.
       Each call starts clean, so a rotation switches mode without leftovers. */
    sh.classList.remove('kb','kbcap'); sh.style.bottom='';
    const room=Math.floor(vv.offsetTop+vv.height-sh.getBoundingClientRect().top)-8;
    if(matchMedia('(min-width: 700px) and (max-width: 1099.98px)').matches&&room>=160){ sh.classList.add('kbcap'); sh.style.maxHeight=room+'px'; }
    else { sh.classList.add('kb'); sh.style.bottom=kb+'px'; sh.style.maxHeight=Math.max(160,Math.floor(vv.height)-8)+'px'; }
    keepCaretInView(field); } }
(function(){ const vv=window.visualViewport;
  if(vv){ vv.addEventListener('resize',fitSheetToKeyboard); vv.addEventListener('scroll',fitSheetToKeyboard); }
  document.addEventListener('focusin',function(){ fitSheetToKeyboard(); setTimeout(fitSheetToKeyboard,350); });
  document.addEventListener('focusout',function(){ setTimeout(fitSheetToKeyboard,60); });
  const nta=document.getElementById('d-notes');
  if(nta){ ['input','click','keyup'].forEach(function(t){ nta.addEventListener(t,function(){ if(document.activeElement===nta) keepCaretInView(nta); }); }); }
})();
document.getElementById('d-notes').addEventListener('input',e=>{ autoGrowNotes(e.target); const en=ensure(); en.note=e.target.value; flashSaved(); touchPark(cur.k.split('#')[0]); persist(); if(cur.site) refreshChip(cur.k); else if(cur.type==='trail') refreshTrailCard(cur.trailName); });
(function(){
  var cb=document.getElementById('clearBtn'); if(!cb) return;
  var armed=false, t=null;
  function disarm(){ armed=false; clearTimeout(t); cb.classList.remove('armed'); cb.textContent=TL('Clear'); }
  window.clearBtnSync=disarm;   // reset when the sheet reopens on another item
  cb.addEventListener('click',()=>{
    // Nothing saved for this item, so there is nothing to clear.
    if(!state[cur.type] || !state[cur.type][cur.k]){ showThemeToast(TL('Nothing to clear yet.'),null,1800); return; }
    if(!armed){ armed=true; cb.classList.add('armed'); cb.textContent=TL('Tap again to clear');
      t=setTimeout(disarm,4000); return; }
    disarm();
    delete state[cur.type][cur.k];
    const cnta=document.getElementById('d-notes'); cnta.value=''; autoGrowNotes(cnta);
    const wb=document.getElementById('wantBtn'); wb.setAttribute('aria-pressed',false); wb.innerHTML=WANT_STAR+TL('Wishlist');
    paintDots(); paintTrailer(); flashSaved(); afterChange(); updateFootAll(); updateSiteNav();
  });
})();
document.getElementById('doneBtn').addEventListener('click',closeSheet);
backdrop.addEventListener('click',closeSheet);

/* ---- share a rating as text (the share button at the foot of the sheet) ----
   Park, campground, site number and score, joined the way the app joins
   metadata, so it reads the same in iMessage as on the page. In the app the
   bridge hands it to the iOS share sheet; a browser without one copies it. */
function ratingShareText(){
  if(!cur.type||!cur.k||!curPark) return '';
  var alg=(curPark.region||'').indexOf('Algonquin')===0, score=sc(cur.type,cur.k), bits=[];
  /* a campground named after its park (Achray, or Algonquin - Tea Lake) is the park itself */
  var own=!cur.cg||cur.cg===curPark.name||cur.cg==='Algonquin - '+curPark.name;
  if(alg) bits.push('Algonquin');
  bits.push(curPark.name);
  if(cur.type==='site'){ if(!own) bits.push(cur.cg); bits.push(TL('Site')+' '+cur.site); }
  else if(!own) bits.push(cur.cg);   /* a campground or a trail; the park itself adds nothing */
  if(score!=null) bits.push(score+'/5');
  if(cur.type==='site'&&wantOf(cur.k)) bits.push(TL('Wishlist'));
  return bits.join(' \u00b7 ')+'\nON site';
}
function copyShareText(text){
  var fail=function(){ showThemeToast('Sharing is not available right now. Try again.'); };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ showThemeToast('Copied.'); },fail); return; } }catch(e){}
  fail();
}
function shareRating(){
  var text=ratingShareText(); if(!text) return;
  if(navigator.share){
    navigator.share({text:text}).catch(function(err){ if(err&&err.name==='AbortError') return; copyShareText(text); });
    return; }
  copyShareText(text);
}
(function(){ var b=document.getElementById('shareBtn'); if(b) b.addEventListener('click',function(){ buzz(6); shareRating(); }); })();

/* ---- a review someone shared from an older version (#/shared/<data>) ----
   share.js draws the same card the sender saw. No server, nothing tracked. */
function fmtMonthYear(iso){ var d=new Date(iso); if(isNaN(d)) return ''; return d.toLocaleDateString(LANG==='fr'?'fr-CA':undefined,{month:'long',year:'numeric'}); }
function campCard(it){
  var kicker=it.kind==='site'?TL('Site review'):it.kind==='trail'?TL('Trail review'):it.kind==='park'?TL('Park review'):TL('Campground review');
  var emoji=it.kind==='trail'?'🥾':'🏕️';
  var chips=[];
  if(it.score!=null){ var s=Math.max(0,Math.min(5,it.score|0)); chips.push({label:s+'/5'}); }
  if(it.want) chips.push({label:TL('Wishlist')});
  var sub=(it.sub&&it.sub!==it.title)?it.sub:'';
  return { eyebrow:'ON site', kicker:kicker, emoji:emoji, title:it.title, subtitle:sub,
    chips:chips.slice(0,4), meta:(it.when?(TL('Reviewed')+' '+fmtMonthYear(it.when)):'') };
}
/* ---- receive a shared review (#/shared/<data>) ---- */
function showShared(item){
  ['view-parks','view-park','view-favs','view-journal','view-more','view-photos','view-search'].forEach(function(id){ var el=document.getElementById(id); if(el) el.hidden=true; });
  var sec=document.getElementById('view-shared'); if(!sec) return;
  sec.hidden=false;
  var tb=document.getElementById('tabbar');
  if(tb) tb.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); b.removeAttribute('aria-current'); });
  var body=document.getElementById('sharedBody');
  if(!item || item.t!=='camp-review'){
    body.innerHTML='<p class="empty">'+TL('This shared link could not be opened. It may be from a newer version of the app.')+'</p>';
    try{ window.scrollTo(0,0); }catch(e){} return;
  }
  body.innerHTML='<div class="shared-card-wrap"><img id="shared-card-img" class="shared-card" alt="'+esc(TL('Shared')+' '+(item.title||TL('review')))+'"></div>'
    +(item.note?'<p class="shared-note">“'+esc(item.note)+'”</p>':'')
    +'<button class="btn-share primary" id="sh-explore" type="button">'+TL('Explore Ontario parks')+'</button>';
  if(window.OnShare) OnShare.makeCard(campCard(item)).then(function(b){ if(!b) return; var img=document.getElementById('shared-card-img'); if(img) img.src=URL.createObjectURL(b); });
  var ex=document.getElementById('sh-explore'); if(ex) ex.onclick=function(){ history.replaceState(null,'',location.pathname+location.search); showTab('guide'); };
  try{ window.scrollTo(0,0); }catch(e){}
}
/* every overlay at once: the rate sheet, the photo viewer, legal, versions */
function closeOverlays(){
  closeSheet(); document.getElementById('lightbox').classList.remove('on');
  var ls=document.getElementById('legalSheet'); if(ls&&ls.classList.contains('on')) closeLegal();
  var vs=document.getElementById('versionsSheet'); if(vs&&vs.classList.contains('on')) closeVersions(); }
/* Escape must dismiss every overlay, not only the rate sheet, or a keyboard
   user is trapped under an open legal or versions sheet */
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeOverlays(); });
/* the favourite heart is a role=button span, so Enter/Space do not fire a
   click on their own: wire them to the same toggle as the pointer path */
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter'&&ev.key!==' '&&ev.key!=='Spacebar') return;
  var h=ev.target.closest?ev.target.closest('[data-fav]'):null; if(!h) return;
  ev.preventDefault(); toggleFav(h.getAttribute('data-fav'),h.getAttribute('data-favid'));
  buzz(6); renderParks(); var vf=document.getElementById('view-favs'); if(vf&&!vf.hidden) renderFavs();
});

async function renderPhotos(k){ const box=document.getElementById('photos'); box.innerHTML=''; const list=await getPhotos(k);
  list.forEach(p=>{ const d=document.createElement('div'); d.className='photo';
    d.innerHTML=`<img src="${p.data}" alt="" role="button" tabindex="0" aria-label="${TL('View photo')}"><button class="del" aria-label="${TL('Delete photo')}">×</button>`;
    const im=d.querySelector('img'); im.addEventListener('click',()=>openLightbox(p.data));
    im.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '||ev.key==='Spacebar'){ ev.preventDefault(); openLightbox(p.data); } });
    d.querySelector('.del').addEventListener('click',async(e)=>{ e.stopPropagation(); const next=(await getPhotos(k)).filter(x=>x.id!==p.id); await putPhotos(k,next); renderPhotos(k); if(cur.site) refreshChip(k); else if(cur.type==='trail') refreshTrailCard(cur.trailName); });
    box.appendChild(d); });
}
async function handlePhotoFiles(e){ const files=Array.from(e.target.files||[]); if(!files.length) return; const k=cur.k;
  const btns=document.querySelectorAll('.pa-btn'); btns.forEach(b=>b.disabled=true);
  const list=await getPhotos(k);
  for(const f of files){ try{ const data=await compress(f); list.push({id:'p'+Date.now()+Math.random().toString(36).slice(2,6),data}); }catch(err){} }
  var saved=await putPhotos(k,list); e.target.value=''; buzz(9); touchPark(k.split('#')[0]); persist(); renderPhotos(k); if(cur.site) refreshChip(k); else if(cur.type==='trail') refreshTrailCard(cur.trailName); renderGlance(); btns.forEach(b=>b.disabled=false);
  if(!saved) showThemeToast(TL('That photo could not be saved. Your device storage may be full.')); }
document.getElementById('photoInput').addEventListener('change',handlePhotoFiles);
document.getElementById('cameraInput').addEventListener('change',handlePhotoFiles);
document.getElementById('cameraBtn').addEventListener('click',()=>document.getElementById('cameraInput').click());
document.getElementById('libraryBtn').addEventListener('click',()=>document.getElementById('photoInput').click());
function openLightbox(src){ var im=document.getElementById('lightboxImg'); im.src=src; im.alt=TL('site photo'); document.getElementById('lightbox').classList.add('on'); }
document.getElementById('lightbox').addEventListener('click',()=>document.getElementById('lightbox').classList.remove('on'));

/* ================= progress + glance ================= */
function updatePark(){ renderParkStats(); renderParkProgress(); if(window.parkResetSync) parkResetSync(); }
/* How much of this park you have actually walked and rated. A real fraction of a
   real number of sites, so the gap is honest, and the gap is what brings you back
   to finish the loop. Hidden until there is something to show: "0 of 212" on
   arrival is a chore, not an invitation. */
function renderParkProgress(){
  const p=curPark, box=document.getElementById('parkProg'); if(!p||!box) return;
  const st=parkStats(p);
  if(!st.rated||!st.total){ box.innerHTML=''; return; }
  box.innerHTML='<div class="pprog"><div class="pprog-top"><span>'+TL('Sites rated here')+'</span>'
    +'<span class="pprog-n tnum">'+st.rated+' '+TL('of')+' '+st.total+'</span></div>'
    +'<span class="pprog-bar"><span class="pprog-fill" style="width:'+Math.max(2,st.pct)+'%"></span></span>'
    +(st.aside>0?'<div class="pprog-note">'+st.aside+' '+TL(st.aside===1?'trailer site set aside':'trailer sites set aside')+'</div>':'')+'</div>';
}
function renderParkStats(){ const p=curPark, box=document.getElementById('statsBody'), wrap=document.getElementById('statsWrap'); if(!p||!box) return;
  const ps=parkStats(p), rated=ps.rated, total=ps.total; let want=0,notes=0,photos=0; const dist=[0,0,0,0,0,0];
  p.campgrounds.forEach(cg=>{ cgSites(cg).forEach(sit=>{ const k=keyOf(p.id,cg.id,sit);
    if(siteCounts(k)){ const v=sc('site',k); if(v!=null) dist[v]++; }
    if(wantOf(k)) want++; if(noteOf('site',k)) notes++; if(photoKeys.has(k)) photos++; }); });
  if(!rated){ if(wrap) wrap.hidden=true; return; }
  if(wrap) wrap.hidden=false;
  const avg=ps.avg, maxD=Math.max.apply(null,dist)||1;
  let h='<div class="stiles">'
    +'<div class="stile"><b>'+(rated?avg.toFixed(2):'-')+'</b><span>'+TL('Average')+'</span></div>'
    +'<div class="stile"><b>'+rated+'<i>/'+total+'</i></b><span>'+TL('Rated')+'</span></div>'
    +'<div class="stile"><b>'+want+'</b><span>'+TL('Wishlist')+'</span></div>'
    +'<div class="stile"><b>'+photos+'</b><span>'+TL('Photos')+'</span></div>'
    +'<div class="stile"><b>'+notes+'</b><span>'+TL('Notes')+'</span></div>'
    +'<div class="stile"><b>'+Math.round(rated/Math.max(1,total)*100)+'<i>%</i></b><span>'+TL('Scouted')+'</span></div>'
  +'</div>';
  if(rated){
    h+='<div class="glabel">'+TL('Rating spread')+'</div><div class="dbars">';
    for(let v=5; v>=0; v--){ const c=dist[v], w=Math.round(c/maxD*100);
      h+='<div class="dbar"><span class="dl tnum">'+v+'</span><span class="dtrack"><i style="width:'+Math.max(c?6:0,w)+'%;background:'+(scoreColor(v)||'var(--tint)')+'"></i></span><span class="dc tnum">'+c+'</span></div>'; }
    h+='</div>';
  }
  const multi=p.campgrounds.length>1;
  if(multi){
    h+='<div class="glabel">'+TL('By campground')+'</div><div class="cgbars">';
    p.campgrounds.forEach(cg=>{ const st=cgStats(p,cg); if(st.total===0) return;   /* a loop set aside whole has nothing to rate */
      h+='<div class="cgbar"><span class="cn">'+cg.id+'</span><span class="ctrack"><i style="width:'+st.pct+'%"></i></span><span class="cc tnum">'+st.rated+'/'+st.total+'</span></div>'; });
    h+='</div>';
  }
  box.innerHTML=h; }

async function renderGlance(){ const p=curPark; if(!p) return;
  if(p.dayuse){ const w=document.getElementById('wantSection'); if(w) w.hidden=true; return; }
  const st=parkStats(p); const rated=[], wants=[];
  p.campgrounds.forEach(cg=>sitesOf(p.id,cg).forEach(s=>{ const k=keyOf(p.id,cg.id,s), e=state.site[k]; if(e&&typeof e.score==='number'&&siteCounts(k)) rated.push({s,k,e,cg}); if(e&&e.want) wants.push({s,k,e,cg}); }));
  void st;
  const wl=wants.sort((a,b)=>((b.e.score??-1))-((a.e.score??-1))||a.s.localeCompare(b.s,undefined,{numeric:true})).slice(0,5);
  const wantSec=document.getElementById('wantSection'); if(wantSec) wantSec.hidden = wl.length===0;
  const topSec=document.getElementById('topSection'); if(topSec) topSec.hidden = rated.length===0;
  const wlBox=document.getElementById('wantList'); if(!wlBox) return;
  wlBox.innerHTML=wl.length?wl.map(w=>`<div class="want-item" data-key="${w.k}"><div class="h"><span class="wstar">★</span><b>${w.cg.id}, ${TL('Site')} ${w.s}</b>${(w.e.score!=null)?`<span class="tr-rate rated" style="background:${scoreColor(w.e.score)}">${w.e.score}/5</span>`:''}</div><p>${w.e.note&&w.e.note.trim()?w.e.note.replace(/</g,'&lt;'):''}</p><div class="want-thumbs" data-thumbs="${w.k}"></div></div>`).join('')
    : `<div class="empty">${TL('Star a site to build your booking shortlist.')}</div>`;
  wl.forEach(async w=>{ const t=wlBox.querySelector(`[data-thumbs="${CSS.escape(w.k)}"]`); if(!t) return; const ph=await getPhotos(w.k); t.innerHTML=ph.slice(0,6).map(x=>`<img src="${x.data}" alt="">`).join(''); });
  wlBox.querySelectorAll('.want-item').forEach(el=>el.addEventListener('click',(ev)=>{ if(ev.target.tagName!=='IMG'){ const parts=el.dataset.key.split('#'); openSheet('site',el.dataset.key,parts[1],parts.slice(2).join('#')); } }));
  const top=rated.sort((a,b)=>b.e.score-a.e.score).slice(0,5);
  const ts=document.getElementById('topSites');
  ts.innerHTML=top.length?top.map(t=>`<li data-key="${t.k}"><div><div class="who">${TL('Site')} ${t.s}</div><div class="whr">${t.cg.id}</div></div><span class="tr-rate rated" style="background:${scoreColor(t.e.score)}">${t.e.score}/5</span></li>`).join('')
    : `<li class="empty">${TL('No sites rated yet.')}</li>`;
  ts.querySelectorAll('li[data-key]').forEach(li=>li.addEventListener('click',()=>{ const parts=li.dataset.key.split('#'); openSheet('site',li.dataset.key,parts[1],parts.slice(2).join('#')); })); }

/* ---- appearance: one shared key for every outdoors app on this origin ----
   'outdoors-appearance' = { theme, glass, palette, face, size }. Theme, glass
   and text size land on <html> as data-theme / data-glass / data-textsize;
   this app wears the parks look only, so palette and face are read (and
   preserved for the sibling apps) but never stamped here.
   The <head> script stamps pre-paint; this block keeps it live from More. */
var APPEAR_KEY='outdoors-appearance';
var APPEAR_DEFAULTS={theme:'auto',glass:'on',palette:'parks',face:'parks',size:'m'};
var APPEAR_ALLOWED={theme:['auto','light','dark'],glass:['on','off'],palette:['parks','field','granite'],
  face:['parks','system','rounded','serif','avenir','mono'],size:['s','m','l','xl']};
function getAppearance(){
  var a={}; try{ a=JSON.parse(localStorage.getItem(APPEAR_KEY))||{}; }catch(e){ a={}; }
  var save=false;
  /* one time: face "system" saved before the parks round was the old
     default, not a choice, so it moves to the new default. saves made
     from the panel write v2, so a real System pick sticks. */
  if(a.face==='system'&&!a.v2){ delete a.face; a.v2=1; save=true; }
  if(a.palette==='shore'){ a.palette='parks'; save=true; }
  if(save){ try{ localStorage.setItem(APPEAR_KEY,JSON.stringify(a)); }catch(e){} }
  var out={};
  for(var k in APPEAR_DEFAULTS) out[k]=(APPEAR_ALLOWED[k].indexOf(a[k])>=0)?a[k]:APPEAR_DEFAULTS[k];
  return out;
}
function setAppearance(key,val){
  if(!APPEAR_ALLOWED[key]||APPEAR_ALLOWED[key].indexOf(val)<0) return;
  var a=getAppearance(); a[key]=val; a.v2=1;
  try{ localStorage.setItem(APPEAR_KEY,JSON.stringify(a)); }catch(e){}
  /* a settings tap re-renders in place: the class rides the mounted view so
     the entry animation never replays; the next tab switch clears it */
  document.querySelectorAll('#views > section:not([hidden])').forEach(function(el){ el.classList.add('no-anim'); });
  applyAppearance(); renderAppearancePanel();
}
function applyAppearance(){
  var a=getAppearance(), d=document.documentElement;
  function stamp(attr,val,def){ if(val!==def) d.setAttribute(attr,val); else d.removeAttribute(attr); }
  stamp('data-theme',a.theme,'auto');
  stamp('data-glass',a.glass,'on');
  /* this app wears the parks look only: stored palettes and faces from
     the sibling apps are read but never stamped here */
  d.removeAttribute('data-palette');
  d.removeAttribute('data-face');
  stamp('data-textsize',a.size,'m');
  postAppearance();
}
/* in the iPhone app the shell follows the in-app theme (status bar, alerts,
   the share sheet) and labels its own alert buttons in the app's language */
function postAppearance(){
  var h=null; try{ h=window.webkit.messageHandlers.appearance; }catch(e){}
  if(!h) return;
  try{ h.postMessage({theme:getAppearance().theme,lang:LANG}); }catch(e){} }
function apSeg(key,opts,cur,label){
  return '<div class="segmented ap-seg" role="group" aria-label="'+label+'">'+opts.map(function(o){
    var on=o[0]===cur;
    return '<button type="button" class="seg-opt'+(on?' on':'')+'" data-ap="'+key+'" data-val="'+o[0]+'"'
      +' aria-pressed="'+(on?'true':'false')+'" aria-label="'+(o[2]||o[1])+'">'+o[1]+'</button>'; }).join('')+'</div>';
}
/* the equipment choice lives in the journal state, so a backup carries it */
function setGear(v){ if(v!=='tent'&&v!=='rv') return; if((state.gear==='rv')===(v==='rv')&&state.gear) return;
  state.gear=v; persist(); buzz(6); renderAppearancePanel();
  var nb=document.querySelector('#appearancePanel [data-gear="'+v+'"]'); if(nb){ try{ nb.focus({preventScroll:true}); }catch(e){} }
  /* every count, chip and loop reads the setting, so redraw what is mounted */
  try{ renderParks(); }catch(e){}
  try{ renderJournal(); }catch(e){}
  if(typeof curPark!=='undefined'&&curPark){ try{ renderCgs(); updatePark(); renderGlance(); }catch(e){} }
  try{ if(sheet&&sheet.classList.contains('on')&&cur&&cur.type==='site') renderSheetBody(cur.type,cur.k,cur.cg,cur.site); }catch(e){} }
function renderAppearancePanel(){
  var box=document.getElementById('appearancePanel'); if(!box) return;
  var a=getAppearance();
  /* theme and text size, nothing else: the look itself is not a choice
     here, this app simply wears its own colours and type */
  var html='';
  html+='<div class="ios-row ios-row--plain ap-row"><span class="ios-row-body"><span class="ios-row-title">'+TL('Theme')+'</span></span>'
    +apSeg('theme',[['auto',TL('Auto')],['light',TL('Light')],['dark',TL('Dark')]],a.theme,TL('Theme'))+'</div>';
  html+='<div class="ios-row ios-row--plain ap-row"><span class="ios-row-body"><span class="ios-row-title">'+TL('Text size')+'</span></span>'
    +apSeg('size',[['s','S',TL('Small')],['m','M',TL('Medium')],['l','L',TL('Large')],['xl','XL',TL('Extra large')]],a.size,TL('Text size'))+'</div>';
  /* language is this app's own choice, not a shared appearance key */
  html+='<div class="ios-row ios-row--plain ap-row"><span class="ios-row-body"><span class="ios-row-title">'+TL('Language')+'</span></span>'
    +'<div class="segmented ap-seg" role="group" aria-label="'+TL('Language')+'">'
    +'<button type="button" class="seg-opt'+(LANG==='en'?' on':'')+'" data-lang="en" aria-pressed="'+(LANG==='en'?'true':'false')+'">English</button>'
    +'<button type="button" class="seg-opt'+(LANG==='fr'?' on':'')+'" data-lang="fr" aria-pressed="'+(LANG==='fr'?'true':'false')+'">Français</button>'
    +'</div></div>';
  /* camping equipment: a tent camper sets trailer sites aside, an RV camper rates them too */
  var gear=gearIsRV()?'rv':'tent';
  html+='<div class="ios-row ios-row--plain ap-row ap-row--stack"><span class="ios-row-body"><span class="ios-row-title">'+TL('Equipment')+'</span>'
    +'<span class="ios-row-sub">'+TL(gear==='rv'?'Trailer sites count like any other':'Trailer sites sit out of the rating')+'</span></span>'
    +'<div class="segmented ap-seg" role="group" aria-label="'+TL('Equipment')+'">'
    +'<button type="button" class="seg-opt'+(gear==='tent'?' on':'')+'" data-gear="tent" aria-pressed="'+(gear==='tent'?'true':'false')+'">'+TL('Car/tent')+'</button>'
    +'<button type="button" class="seg-opt'+(gear==='rv'?' on':'')+'" data-gear="rv" aria-pressed="'+(gear==='rv'?'true':'false')+'">'+TL('RV/trailer')+'</button>'
    +'</div></div>';
  box.innerHTML=html;
  box.querySelectorAll('[data-gear]').forEach(function(b){
    b.addEventListener('click',function(){ setGear(b.dataset.gear); }); });
  box.querySelectorAll('[data-lang]').forEach(function(b){
    b.addEventListener('click',function(){ setLang(b.dataset.lang); buzz(6); }); });
  box.querySelectorAll('[data-ap]').forEach(function(b){
    b.addEventListener('click',function(){ setAppearance(b.dataset.ap,b.dataset.val); buzz(6); }); });
}
/* ---- one-time migration: single Algonquin -> split campground parks ---- */
var ALG_CG_MAP={'Tea Lake':'algonquintea','Canisbay Lake':'algonquincanisbay','Mew Lake':'algonquinmew','Lake of Two Rivers':'algonquintworivers','Pog Lake':'algonquinpog','Kearney Lake':'algonquinkearney','Raccoon Lake':'algonquinraccoon','Rock Lake':'algonquinrock','Achray':'algonquinachray'};
var ALG_TRAIL_MAP={'Whiskey Rapids':'algonquintea','Hardwood Lookout':'algonquintea','Mizzy Lake':'algonquintea','Peck Lake':'algonquincanisbay','Track and Tower':'algonquincanisbay','Two Rivers':'algonquintworivers','Centennial Ridges':'algonquinpog','Lookout Trail':'algonquinrock',"Booth's Rock":'algonquinrock','Spruce Bog Boardwalk':'algonquinraccoon','Beaver Pond':'algonquinraccoon'};
function migrateScale5(){ if(state._s5) return;
  ['site','campground','trail'].forEach(function(t){ var m=state[t]||{}; Object.keys(m).forEach(function(k){ var e=m[k];
    if(e&&typeof e.score==='number'){ e.score = e.score>0 ? Math.max(1,Math.round(e.score/2)) : null; } }); });
  state._s5=1; persist(); }
function migrateAlgonquin(){ var changed=false;
  ['site','campground','trail'].forEach(function(type){ var m=state[type]||{};
    Object.keys(m).forEach(function(k){ if(k.indexOf('algonquin#')!==0) return;
      var parts=k.split('#'), np=(type==='trail')?ALG_TRAIL_MAP[parts[1]]:ALG_CG_MAP[parts[1]];
      if(np){ var nk=np+'#'+parts.slice(1).join('#'); if(!m[nk]) m[nk]=m[k]; }
      delete m[k]; changed=true; }); });
  if(changed) persist(); }
async function migrateAlgPhotos(){ var olds=Array.from(photoKeys).filter(function(k){return k.indexOf('algonquin#')===0;});
  for(var i=0;i<olds.length;i++){ var k=olds[i], parts=k.split('#'), np=ALG_CG_MAP[parts[1]]||ALG_TRAIL_MAP[parts[1]];
    if(!np){ continue; }
    var nk=np+'#'+parts.slice(1).join('#');
    try{ var list=await getPhotos(k); if(list&&list.length) await putPhotos(nk,list); await putPhotos(k,[]); }catch(e){} } }
/* ---- unlock by tapping a park's name on its page ---- */
var toastEl=null, toastTimer=null;
function showThemeToast(msg,onTap,ms){
  if(!toastEl){ toastEl=document.createElement('div'); toastEl.className='toast';
    toastEl.setAttribute('role','status'); toastEl.setAttribute('aria-live','polite'); toastEl.setAttribute('aria-atomic','true');
    document.body.appendChild(toastEl); }
  /* back into the tree before the text changes, so the live region announces */
  toastEl.removeAttribute('inert'); toastEl.textContent='';
  var tm=document.createElement('span'); tm.className='toast-msg'; tm.textContent=TL(msg); toastEl.appendChild(tm);
  /* an action rides as a real button, so it has a button's role and name;
     a tap on the pill itself only dismisses it */
  if(onTap){ var ta=document.createElement('button'); ta.type='button'; ta.className='toast-act'; ta.textContent=TL('Undo');
    ta.addEventListener('click',function(ev){ ev.stopPropagation(); hideThemeToast(); onTap(); }); toastEl.appendChild(ta); }
  toastEl.onclick=function(){ hideThemeToast(); };
  requestAnimationFrame(function(){ toastEl.classList.add('on'); });
  clearTimeout(toastTimer); toastTimer=setTimeout(hideThemeToast, ms||3500);
}
/* hidden means gone: no handler, no hit area (CSS), out of the focus order */
function hideThemeToast(){ if(toastEl){ toastEl.classList.remove('on'); toastEl.onclick=null; toastEl.setAttribute('inert',''); } }
function onParkNameTap(p){ /* park themes retired in favour of the shared appearance setting */ }

/* ---- about stats (openSettings now shows the More tab) ---- */
var settingsSheet=document.getElementById('settingsSheet'), settingsBackdrop=document.getElementById('settingsBackdrop');
function fillAboutStats(){
  var el=document.getElementById('aboutStats'); if(!el) return;
  var parks=PARKS.length, cgs=0, sites=0;
  PARKS.forEach(function(p){ (p.campgrounds||[]).forEach(function(c){ cgs++; sites+=cgSites(c).length; }); });
  function row(k,v){ return '<div class="ios-row ios-row--plain"><span class="ios-row-body"><span class="ios-row-title">'+k+'</span></span>'+
    '<span class="ios-row-value tnum">'+v+'</span></div>'; }
  el.innerHTML=row(TL('Parks in guide'),parks)+row(TL('Campgrounds'),cgs)+row(TL('Sites'),sites.toLocaleString())+
    '<a class="ios-row ios-row--plain" href="https://katsuma.ca/" target="_blank" rel="noopener">'+
    '<span class="ios-row-body"><span class="ios-row-title">katsuma.ca</span></span>'+CHEV_RIGHT+'</a>';
}
/* ---- saved photos (More, Your data, Photos) ---- */
/* 'outdoors-profile' once held a display name for an avatar the app no
   longer has. The key is left alone (backups still carry it); nothing reads it. */
var PROFILE_KEY='outdoors-profile';
function accountStats(){ var s=journalStats(); return {parks:visitedParkIds().length,sites:s.n}; }
function countPhotosSaved(){ return openDB().then(function(db){ return new Promise(function(res){
    var tx=db.transaction(STORE,'readonly'); var rq=tx.objectStore(STORE).getAll();
    rq.onsuccess=function(){ var n=0; (rq.result||[]).forEach(function(r){ if(r&&Array.isArray(r.list)) n+=r.list.length; }); res(n); };
    rq.onerror=function(){ res(0); }; }); }).catch(function(){ return 0; }); }
function renderPhotoCount(){
  countPhotosSaved().then(function(n){ var pc=document.getElementById('photoCountValue'); if(pc) pc.textContent=n||''; }); }
function photoLabel(k){ var parts=k.split('#'), p=PARK_BY_ID[parts[0]];
  if(parts.length>=3) return TL('Site')+' '+parts.slice(2).join('#')+', '+(p?p.name:parts[0]);
  var name=parts.slice(1).join('#');
  return name+(p&&p.name!==name?', '+p.name:''); }
function openPhotoTarget(k){ var parts=k.split('#'), pid=parts[0]; if(!PARK_BY_ID[pid]) return;
  showTab('guide'); openPark(pid);
  if(parts.length>=3){ var cgId=parts[1], site=parts.slice(2).join('#');
    expandCg(cgId); openSheet('site',k,cgId,site); }
  else{ var name=parts.slice(1).join('#');
    if((curPark.trails||[]).some(function(t){ return t.name===name; })) openSheet('trail',k,name);
    else openSheet('campground',k,name); } }
async function renderPhotosScreen(){
  var box=document.getElementById('photosGrid'); if(!box) return; box.innerHTML='';
  var keys=Array.from(photoKeys).sort();
  if(!keys.length){ box.innerHTML='<div class="empty" style="grid-column:1/-1">'+TL("No photos yet. Add one from a site's rating sheet.")+'</div>'; return; }
  for(const k of keys){ const list=await getPhotos(k); const label=photoLabel(k);
    list.forEach(function(p){
      var b=document.createElement('button'); b.type='button'; b.className='pcell';
      b.setAttribute('aria-label',TL('Open')+' '+label);
      var img=document.createElement('img'); img.src=p.data; img.alt='';
      var cap=document.createElement('span'); cap.className='plabel'; cap.textContent=label;
      b.appendChild(img); b.appendChild(cap);
      b.addEventListener('click',function(){ buzz(6); openPhotoTarget(k); });
      box.appendChild(b); }); } }
(function(){
  var sb=document.getElementById('searchBtn');
  /* its own screen, the way iOS Settings does it: the field is there but
     focus stays manual, because autofocusing pans the page on iOS Safari */
  if(sb) sb.addEventListener('click',function(){ buzz(6); showTab('search'); });
  var sc=document.getElementById('searchCancel');
  if(sc) sc.addEventListener('click',function(){ buzz(6); clearGSearch(); showTab(LAST_TAB_BEFORE_SEARCH||'guide'); });
  var pb=document.getElementById('photosRowBtn');
  if(pb) pb.addEventListener('click',function(){ buzz(6); showTab('photos'); });
  var bk=document.getElementById('photosBack');
  if(bk) bk.addEventListener('click',function(){ buzz(6); showTab('more'); });
})();

/* ---- journal tab: everything rated, grouped by park ---- */
/* rating totals; the visited count is visitedParkIds() */
function journalStats(){ var sites=0, sum=0, n=0;
  ['site','campground','trail'].forEach(function(b){ var o=state[b]||{};
    for(var k in o){ var e=o[k]; if(!e) continue; var pid=k.split('#')[0]; if(!PARK_BY_ID[pid]) continue;
      if(typeof e.score==='number'&&(b!=='site'||siteCounts(k))){ if(b==='site') sites++; sum+=e.score; n++; } } });
  return {sites:sites,n:n,avg:n?sum/n:0}; }
function journalEntries(){ var byPark={};
  function push(pid,en){ if(!PARK_BY_ID[pid]) return; (byPark[pid]=byPark[pid]||[]).push(en); }
  var o=state.site||{}, k, e;
  for(k in o){ e=o[k]; if(!e) continue; var rated=(typeof e.score==='number')&&siteCounts(k);   /* a set-aside trailer site's score stays out of the journal */
    if(!rated&&!e.want&&!(e.note&&String(e.note).trim())&&!photoKeys.has(k)) continue; var sp=k.split('#');
    push(sp[0],{type:'site',k:k,title:TL('Site')+' '+sp.slice(2).join('#'),sub:sp[1],
      score:rated?e.score:null,want:!!e.want,note:!!(e.note&&String(e.note).trim()),photo:photoKeys.has(k),trailer:!!e.trailer}); }
  o=state.campground||{};
  for(k in o){ e=o[k]; if(!e) continue; var cgRated=(typeof e.score==='number');
    if(!cgRated&&!(e.note&&String(e.note).trim())&&!photoKeys.has(k)) continue; var cp=k.split('#'), pid=cp[0],
      name=cp.slice(1).join('#'), p=PARK_BY_ID[pid];
    push(pid,{type:'campground',k:k,title:name,sub:(p&&name===p.name)?TL('Park rating'):TL('Campground'),
      score:cgRated?e.score:null,want:false,note:!!(e.note&&String(e.note).trim()),photo:photoKeys.has(k)}); }
  o=state.trail||{};
  for(k in o){ e=o[k]; if(!e) continue; var trRated=(typeof e.score==='number');
    if(!trRated&&!(e.note&&String(e.note).trim())&&!photoKeys.has(k)) continue; var tp=k.split('#');
    push(tp[0],{type:'trail',k:k,title:tp.slice(1).join('#'),sub:TL('Trail'),
      score:trRated?e.score:null,want:false,note:!!(e.note&&String(e.note).trim()),photo:photoKeys.has(k)}); }
  /* a photo with no rating or note saved beside it is still a visit (adding a
     photo stores only the photo); a two-part key is a trail when the park
     has a trail by that name, otherwise its campground or park rating */
  photoKeys.forEach(function(pk){ var k=String(pk), sp=k.split('#'), pid=sp[0], p=PARK_BY_ID[pid]; if(!p) return;
    if(sp.length>=3){ if(!(state.site||{})[k]) push(pid,{type:'site',k:k,title:TL('Site')+' '+sp.slice(2).join('#'),sub:sp[1],score:null,want:false,note:false,photo:true,trailer:false}); return; }
    if((state.campground||{})[k]||(state.trail||{})[k]) return; var name=sp.slice(1).join('#');
    if((p.trails||[]).some(function(t){ return t.name===name; })) push(pid,{type:'trail',k:k,title:name,sub:TL('Trail'),score:null,want:false,note:false,photo:true});
    else push(pid,{type:'campground',k:k,title:name,sub:name===p.name?TL('Park rating'):TL('Campground'),score:null,want:false,note:false,photo:true}); });
  return byPark; }
/* a park counts as visited once it holds a rating, a note or a photo the
   Journal shows; wishlist and trailer marks are plans, not visits. Journal,
   Favourites and Account all count with this. */
function visitedParkIds(byPark){ byPark=byPark||journalEntries();
  return Object.keys(byPark).filter(function(pid){ return byPark[pid].some(function(e){ return e.score!=null||e.note||e.photo; }); }); }
function openJournalEntry(k,type){ var parts=k.split('#'), pid=parts[0]; if(!PARK_BY_ID[pid]) return;
  openPark(pid,'view-journal');
  if(type==='site'){ expandCg(parts[1]); openSheet('site',k,parts[1],parts.slice(2).join('#')); }
  else if(type==='trail'){ openSheet('trail',k,parts.slice(1).join('#')); }
  else{ openSheet('campground',k,parts.slice(1).join('#')); } }
var _jOpen={};  /* journal parks the user has expanded this session */
/* Journal filters, for someone choosing what to book: a rating range, only
   wishlisted, noted or photographed entries, and an order. Kept on this
   device between visits (a view setting, so it is not in backups). */
var JF_KEY='site-journal-jfilter', JF_DEF={min:'any',want:false,notes:false,photos:false,sort:'recent'};
var JF_MIN=['any','5','4','3','low'], JF_SORT=['recent','top','low','az'];
var _jf=(function(){ var f={}; try{ f=JSON.parse(localStorage.getItem(JF_KEY))||{}; }catch(e){ f={}; }
  return { min:JF_MIN.indexOf(f.min)>=0?f.min:'any', want:!!f.want, notes:!!f.notes, photos:!!f.photos, sort:JF_SORT.indexOf(f.sort)>=0?f.sort:'recent' }; })();
var _jFold={};  /* parks folded by hand while a filter is on */
function saveJF(){ try{ localStorage.setItem(JF_KEY,JSON.stringify(_jf)); }catch(e){} }
function jfActive(){ return _jf.min!=='any'||_jf.want||_jf.notes||_jf.photos; }
function jfMatch(en){
  if(_jf.min!=='any'){ if(en.score==null) return false;
    if(_jf.min==='low'){ if(en.score>2) return false; } else if(en.score<+_jf.min) return false; }
  if(_jf.want&&!en.want) return false; if(_jf.notes&&!en.note) return false; if(_jf.photos&&!en.photo) return false;
  return true; }
function jfFiltersHtml(){
  function chip(attr,val,label,on){ return '<button class="fchip'+(on?' on':'')+'" type="button" '+attr+'="'+val+'" aria-pressed="'+(on?'true':'false')+'"><span class="fct">'+label+'</span></button>'; }
  var mins=[['any',TL('All')],['5','5/5'],['4','4+'],['3','3+'],['low',TL('2 or less')]];
  var sorts=[['recent',TL('Recent')],['top',TL('Best')],['low',TL('Lowest')],['az',TL('A to Z')]];
  return '<div class="jfilters">'
    +'<div class="jf-row"><span class="jf-label" id="jfRateL">'+TL('Rating')+'</span><div class="jf-chips" role="group" aria-labelledby="jfRateL">'
      +mins.map(function(m){ return chip('data-jmin',m[0],m[1],_jf.min===m[0]); }).join('')+'</div></div>'
    +'<div class="jf-row"><span class="jf-label" id="jfShowL">'+TL('Show')+'</span><div class="jf-chips" role="group" aria-labelledby="jfShowL">'
      +chip('data-jtog','want','<span class="wstar" aria-hidden="true">★</span> '+TL('Wishlist'),_jf.want)
      +chip('data-jtog','notes',TL('Notes'),_jf.notes)+chip('data-jtog','photos',TL('Photos'),_jf.photos)+'</div></div>'
    +'<div class="jf-row"><span class="jf-label" id="jfSortL">'+TL('Sort')+'</span><div class="jf-chips" role="group" aria-labelledby="jfSortL">'
      +sorts.map(function(o){ return chip('data-jsort',o[0],o[1],_jf.sort===o[0]); }).join('')+'</div></div>'
    +'</div>'; }
/* a park's average out of five: the 0 to 5 rating control in miniature, five
   small rounded cells filled left to right in the tint to the nearest half,
   so 3.5 reads as three cells and half of the fourth. Never a star: the solid
   orange star means wishlist everywhere in the app. The number sits beside. */
function avgRateHtml(avg,half){
  var cells=[0,1,2,3,4].map(function(i){ var f=half-i; return f>=1?'<i class="on"></i>':f>0?'<i class="half"></i>':'<i></i>'; }).join('');
  var num=avg.toLocaleString(LANG==='fr'?'fr-CA':'en-CA',{minimumFractionDigits:1,maximumFractionDigits:1});   /* 3,5 in French */
  return '<span class="jpark-rate" role="img" aria-label="'+num+' '+TL('of')+' 5"><span class="jmeter" aria-hidden="true">'+cells+'</span><span class="jnum tnum">'+num+'</span></span>'; }
function renderJournal(){ var box=document.getElementById('journalBody'); if(!box) return;
  var byPark=journalEntries(), pids=Object.keys(byPark);
  if(!pids.length){
    box.innerHTML='<div class="jempty">'
      +'<svg aria-hidden="true"><use href="assets/icons.svg#tent"/></svg>'
      +'<h2>'+TL('Your journal starts here')+'</h2>'
      +'<button class="btn-share primary" id="jBrowse" type="button">'+TL('Browse the parks')+'</button></div>';
    var jb=document.getElementById('jBrowse'); if(jb) jb.addEventListener('click',function(){ buzz(6); showTab('guide'); });
    return; }
  var s=journalStats(), ts=state.touched||{}, filtering=jfActive();
  /* entries in the order the sort asks for; the park lists follow suit */
  var ORDER={campground:0,site:1,trail:2};
  function byDefault(a,b){ return (ORDER[a.type]-ORDER[b.type])||String(a.sub).localeCompare(String(b.sub))
      ||String(a.title).localeCompare(String(b.title),undefined,{numeric:true}); }
  function byScore(dir){ return function(a,b){ var as=a.score, bs=b.score;
    if(as==null&&bs==null) return byDefault(a,b); if(as==null) return 1; if(bs==null) return -1;
    return dir*(bs-as)||byDefault(a,b); }; }
  var entrySort=_jf.sort==='top'?byScore(1):_jf.sort==='low'?byScore(-1):byDefault;
  var shown={}, total=0;
  pids.forEach(function(pid){ var l=byPark[pid].filter(filtering?jfMatch:function(){ return true; }).sort(entrySort); if(l.length){ shown[pid]=l; total+=l.length; } });
  var spids=Object.keys(shown);
  /* Best and Lowest order parks by the average their row shows, so the
     list reads top to bottom; more ratings win a tie */
  function avgOf(pid){ var r=byPark[pid].filter(function(e){ return e.score!=null; });
    return r.length?{m:r.reduce(function(x,e){ return x+e.score; },0)/r.length,n:r.length}:null; }
  spids.sort(function(a,b){ var na=PARK_BY_ID[a].name, nb=PARK_BY_ID[b].name;
    if(_jf.sort==='az') return na.localeCompare(nb);
    if(_jf.sort==='top'||_jf.sort==='low'){ var A=avgOf(a), B=avgOf(b), d=_jf.sort==='top'?1:-1;
      if(!A||!B) return (A?-1:B?1:0)||na.localeCompare(nb);
      return d*(B.m-A.m)||(B.n-A.n)||na.localeCompare(nb); }
    return ((ts[b]||0)-(ts[a]||0))||na.localeCompare(nb); });
  var PHOTO_G='<svg aria-hidden="true"><use href="assets/icons.svg#image"/></svg>';
  var html='<div class="acct-stats">'
    +'<div class="acct-stat"><b class="tnum">'+visitedParkIds(byPark).length+'</b><span>'+TL('Parks visited')+'</span></div>'
    +'<div class="acct-stat"><b class="tnum">'+s.n+'</b><span>'+TL('Ratings')+'</span></div>'
    +'<div class="acct-stat"><b class="tnum">'+(s.n?s.avg.toFixed(1):'0')+'</b><span>'+TL('Average')+'</span></div>'
    +'</div>';
  html+=jfFiltersHtml();
  if(filtering) html+='<div class="jf-summary"><span class="jf-count">'
    +(total?total+' '+TL(total===1?'entry matches':'entries match'):TL('Nothing matches these filters.'))
    +'</span> <button class="jf-clear" type="button" id="jfClear">'+TL('Clear filters')+'</button></div>';
  function rowHtml(en){ var col=(en.score!=null)?scoreColor(en.score):null, glyphs=(en.photo?PHOTO_G:'');
    return '<button class="ios-row ios-row--plain jrow" type="button" data-key="'+en.k.replace(/"/g,'&quot;')+'" data-type="'+en.type+'">'
      +'<span class="ios-row-body"><span class="ios-row-title">'+(en.want?'<span class="wstar" aria-hidden="true">★</span><span class="sr-only">'+TL('Wishlist')+', </span>':'')+en.title+'</span>'
      +((en.sub||en.trailer)?'<span class="ios-row-sub">'+(en.sub||'')+(en.trailer?(en.sub?' · ':'')+TL('Trailer site'):'')+'</span>':'')+'</span>'
      +(glyphs?'<span class="j-glyphs">'+glyphs+'</span>':'')
      +(col?'<span class="tr-rate rated" style="background:'+col+'">'+en.score+'/5</span>':'')
      +'</button>'; }
  /* each park is one row shaped like the Parks list: the name, how many of
     its sites are rated beneath, its average at the right, and the entries
     only on tap. A long flat list was noise. */
  spids.forEach(function(pid){ var p=PARK_BY_ID[pid], list=byPark[pid], items=shown[pid];
    var rated=list.filter(function(e){ return e.score!=null; }), n=rated.length;
    var avg=n?rated.reduce(function(a,e){ return a+e.score; },0)/n:0, half=Math.round(avg*2)/2;   /* the mark fills to the nearest half */
    var sitesRated=rated.filter(function(e){ return e.type==='site'; }).length;
    var wants=list.filter(function(e){ return e.want; }).length, photos=list.filter(function(e){ return e.photo; }).length, notes=list.filter(function(e){ return e.note; }).length;
    /* the second line says what the park holds: sites rated, else other
       ratings (a campground or a trail), else what was saved without one */
    var sub=sitesRated?sitesRated+' '+TL(sitesRated===1?'site rated':'sites rated')
      :n?n+' '+TL(n===1?'rating':'ratings')
      :[wants?wants+' '+TL(wants===1?'wishlist site':'wishlist sites'):'',
        photos?photos+' '+TL(photos===1?'photo':'photos'):'',
        notes?notes+' '+TL(notes===1?'note':'notes'):''].filter(Boolean).join(' \u00b7 ');
    /* with a filter on, matching parks open to their entries (that is the
       point of filtering); a park folded by hand stays folded */
    var open=filtering?!_jFold[pid]:!!_jOpen[pid];
    html+='<div class="jpark" data-pid="'+pid+'">'
      +'<button class="ios-row ios-row--plain jpark-head" type="button" aria-expanded="'+(open?'true':'false')+'">'
        +'<span class="ios-row-body"><span class="ios-row-title">'+esc(p.name)+'</span>'
        +(sub?'<span class="ios-row-sub">'+sub+'</span>':'')+'</span>'
        +(n?avgRateHtml(avg,half):'')+'<span class="ios-chevron jchev"><svg aria-hidden="true"><use href="assets/icons.svg#chevron-right"/></svg></span>'
      +'</button>'
      +'<div class="ios-group jpark-list"'+(open?'':' hidden')+'>'+items.map(rowHtml).join('')+'</div>'
      +'</div>';
  });
  box.innerHTML=html;
  box.querySelectorAll('.jpark-head').forEach(function(h){ h.addEventListener('click',function(){ buzz(6);
    var wrap=h.closest('.jpark'), pid=wrap.dataset.pid, lst=wrap.querySelector('.jpark-list'), open=lst.hidden;
    lst.hidden=!open; h.setAttribute('aria-expanded',String(open));
    if(filtering){ if(open) delete _jFold[pid]; else _jFold[pid]=true; }
    else { if(open) _jOpen[pid]=true; else delete _jOpen[pid]; } }); });
  /* filters re-render in place and keep focus on the control that was used */
  function refilter(sel){ saveJF(); _jFold={}; renderJournal(); var f=sel&&box.querySelector(sel); if(f){ try{ f.focus({preventScroll:true}); }catch(e){} }
    var lv=document.getElementById('jfLive'), c=box.querySelector('.jf-count');
    if(lv){ lv.textContent=''; setTimeout(function(){ lv.textContent=c?c.textContent:TL('Showing every entry'); },80); } }
  box.querySelectorAll('[data-jmin]').forEach(function(b){ b.addEventListener('click',function(){ buzz(6);
    _jf.min=(b.dataset.jmin===_jf.min&&b.dataset.jmin!=='any')?'any':b.dataset.jmin; refilter('[data-jmin="'+b.dataset.jmin+'"]'); }); });
  box.querySelectorAll('[data-jtog]').forEach(function(b){ b.addEventListener('click',function(){ buzz(6);
    var k=b.dataset.jtog; _jf[k]=!_jf[k]; refilter('[data-jtog="'+k+'"]'); }); });
  box.querySelectorAll('[data-jsort]').forEach(function(b){ b.addEventListener('click',function(){ buzz(6);
    _jf.sort=b.dataset.jsort; saveJF(); renderJournal(); var f=box.querySelector('[data-jsort="'+_jf.sort+'"]'); if(f){ try{ f.focus({preventScroll:true}); }catch(e){} } }); });
  var jc=document.getElementById('jfClear'); if(jc) jc.addEventListener('click',function(){ buzz(6);
    _jf.min='any'; _jf.want=_jf.notes=_jf.photos=false; refilter('[data-jmin="any"]'); });
  box.querySelectorAll('.jrow').forEach(function(b){ b.addEventListener('click',function(){ buzz(6); openJournalEntry(b.dataset.key,b.dataset.type); }); });
}

/* ---- shared footer tab bar ---- */
var LAST_TAB_BEFORE_SEARCH='guide';
var TAB_SECTIONS={guide:'view-parks',favs:'view-favs',journal:'view-journal',more:'view-more',photos:'view-photos',search:'view-search'};
var ALL_VIEWS=['view-parks','view-park','view-favs','view-journal','view-more','view-shared','view-photos','view-search'];
var learnRendered=false;
function setHeaderHidden(h){ var el=document.getElementById('iosHeader'); if(el) el.hidden=!!h; }
/* blended headers: transparent at rest, frosted only once content actually runs
   underneath. Every header bar on the page gets 'scrolled' past 8px of scroll
   and loses it back at the top; the appearance layer paints the difference. */
(function(){
  function stampScrolled(){
    if(_scrollLocked) return; // a sheet is open; keep the frosted bars as they are
    var on=(window.scrollY||document.documentElement.scrollTop||0)>8;
    document.querySelectorAll('.ios-header,.nav,.backbar').forEach(function(el){
      el.classList.toggle('scrolled',on); });
  }
  window.addEventListener('scroll',stampScrolled,{passive:true});
  window.addEventListener('resize',stampScrolled,{passive:true});
  stampScrolled();
  window.sjStampScrolled=stampScrolled;
})();
function setTabActive(tab){ var tb=document.getElementById('tabbar');
  if(tb) tb.querySelectorAll('.tab').forEach(function(b){ var on=b.dataset.tab===tab; b.classList.toggle('active',on);
    if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); }); }
function showTab(tab){
  if(!TAB_SECTIONS[tab]) tab='guide';
  if(tab!=='search') LAST_TAB_BEFORE_SEARCH=tab;
  ALL_VIEWS.forEach(function(id){ var el=document.getElementById(id); if(el) el.hidden=true; });
  var target=document.getElementById(tab==='guide'?'view-parks':TAB_SECTIONS[tab]);
  if(target){
    /* a tab switch is a fresh mount: shed any push, pop or no-anim class a
       previous visit left behind so the glass-in entry can play */
    target.classList.remove('view-anim','view-out','no-anim');
    target.hidden=false;
  }
  setHeaderHidden(false);
  setTabActive(tab);
  nativeChrome({tab:tab});
  /* always land at the top; the second call catches a browser that scrolls late */
  try{ window.scrollTo(0,0); }catch(e){}
  requestAnimationFrame(function(){ try{ window.scrollTo(0,0); }catch(e){} });
  if(tab==='guide'){ renderParks(); }
  if(tab==='favs'){ renderFavs(); }
  if(tab==='more'){ if(typeof renderAppearancePanel==='function') renderAppearancePanel(); if(typeof fillAboutStats==='function') fillAboutStats(); renderPhotoCount();
    if(!learnRendered){ renderLearn(); learnRendered=true; } }
  if(tab==='journal'){ renderJournal(); }
  if(tab==='photos'){ renderPhotosScreen(); }
}
function openSettings(){ showTab('more'); }
function closeSettings(){}
(function(){ var tb=document.getElementById('tabbar');
  if(tb) tb.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('.tab'); if(b){ showTab(b.dataset.tab); if(typeof buzz==='function') buzz(6); } }); })();
settingsBackdrop.addEventListener('click',closeSettings);

/* ---- learn and safety ---- */
function renderLearn(){
  var el=document.getElementById('learnBody'); if(!el) return;
  var CHEV='<span class="ios-chevron"><svg aria-hidden="true"><use href="assets/icons.svg#chevron-down"/></svg></span>';
  var A=[
    {t:'Bear safety and food storage', b:`<p>Black bears live across cottage country and the north, and most trouble comes down to food. A bear that finds a meal at a campsite comes back, and a bear that keeps coming back usually ends up dead, so a clean site protects the bear as much as you.</p><p>Store all food, garbage, coolers, and anything scented in your vehicle or a bear locker, never in the tent. Cook and eat away from where you sleep, and pack out every scrap. If you meet a bear, do not run. Make yourself look big, speak firmly, back away slowly, and give it a clear exit. Report a bear hanging around a campground to park staff or Bear Wise at 1-866-514-2327.</p>`, bf:`<p>L’ours noir est présent dans toute la région des chalets et dans le nord, et la plupart des problèmes tiennent à la nourriture. Un ours qui trouve un repas sur un emplacement y revient, et un ours qui revient sans cesse finit généralement par être abattu, alors un site propre protège l’ours autant que vous.</p><p>Rangez toute la nourriture, les déchets, les glacières et tout ce qui dégage une odeur dans votre véhicule ou un casier à l’épreuve des ours, jamais dans la tente. Cuisinez et mangez loin de l’endroit où vous dormez, et rapportez le moindre reste. Si vous croisez un ours, ne courez pas. Faites-vous paraître grand, parlez d’une voix ferme, reculez lentement et laissez-lui une voie de sortie dégagée. Signalez un ours qui rôde autour d’un terrain de camping au personnel du parc ou à Bear Wise au 1-866-514-2327.</p>`},
    {t:'Ticks and Lyme disease', b:`<p>Blacklegged ticks carry Lyme disease and are now common across much of southern and eastern Ontario. They wait in long grass and leaf litter and latch on as you brush past.</p><p>Wear light long sleeves and pants, tuck your pants into your socks on trails, and use a repellent with DEET or icaridin. Check yourself, kids, and dogs after every walk, especially the hairline, waist, and behind the knees.</p>`, bf:`<p>La tique à pattes noires transmet la maladie de Lyme et est maintenant répandue dans une grande partie du sud et de l’est de l’Ontario. Elle attend dans les herbes hautes et la litière de feuilles et s’accroche quand vous la frôlez.</p><p>Portez des manches longues et un pantalon de couleur claire, rentrez votre pantalon dans vos chaussettes sur les sentiers, et utilisez un répulsif à base de DEET ou d’icaridine. Examinez-vous, ainsi que les enfants et les chiens, après chaque sortie, surtout la naissance des cheveux, la taille et l’arrière des genoux.</p>`},
    {t:'Campfire safety', b:`<p>Check for a fire ban before you light anything. Bans are common in dry spells and carry real fines.</p><p>Use the existing fire pit, keep the fire small, and never leave it unattended. Keep water and a shovel within reach. Burn only clean wood, and buy or gather it locally, since moving firewood spreads tree-killing insects like the emerald ash borer. Before you sleep or leave, drown the fire, stir the ashes, and drown it again until it is cold to the touch.</p>`, bf:`<p>Vérifiez s’il y a une interdiction de feu avant d’allumer quoi que ce soit. Les interdictions sont fréquentes en période de sécheresse et entraînent de vraies amendes.</p><p>Utilisez le foyer existant, gardez le feu petit et ne le laissez jamais sans surveillance. Gardez de l’eau et une pelle à portée de main. Ne brûlez que du bois propre, et achetez-le ou ramassez-le sur place, car déplacer du bois de chauffage propage des insectes qui tuent les arbres, comme l’agrile du frêne. Avant de dormir ou de partir, noyez le feu, remuez les cendres et noyez-le de nouveau jusqu’à ce qu’il soit froid au toucher.</p>`},
    {t:'Leave no trace', b:`<p>The idea is simple: leave the site the way you would want to find it. Pack out all your trash, including food scraps and dog waste. Use the outhouse, or bury human waste well away from water.</p><p>Keep to the trails and the tent pads so the ground around the site can recover. Do not feed wildlife, and do not carve or nail into trees. Keep the noise down after quiet hours, since sound carries a long way over water at night. A good campsite is one the next person cannot tell you used.</p>`, bf:`<p>L’idée est simple : laissez l’emplacement tel que vous voudriez le trouver. Rapportez tous vos déchets, y compris les restes de nourriture et les excréments de chien. Utilisez la latrine, ou enterrez les matières fécales humaines loin de l’eau.</p><p>Restez sur les sentiers et les plateformes de tente pour que le sol autour de l’emplacement puisse se rétablir. Ne nourrissez pas la faune, et ne gravez ni ne clouez rien dans les arbres. Baissez le ton après l’heure du silence, car le son porte loin au-dessus de l’eau la nuit. Un bon emplacement est un emplacement dont la personne suivante ne peut pas deviner que vous l’avez utilisé.</p>`},
    {t:'Wildlife on the roads', b:`<p>Moose and deer are most active at dawn and dusk, and a collision with a moose is dangerous because the body comes through the windshield. Slow down at night in wildlife areas and watch the shoulders for eye-shine.</p><p>If an animal is crossing, brake in a straight line rather than swerving. Turtles cross roads to nest in June, and you can move one across in the direction it was already headed, well clear of traffic. Never pick a snapping turtle up by the tail, which injures its spine.</p>`, bf:`<p>L’orignal et le cerf sont les plus actifs à l’aube et au crépuscule, et une collision avec un orignal est dangereuse parce que le corps traverse le pare-brise. Ralentissez la nuit dans les zones fauniques et surveillez les accotements pour repérer le reflet des yeux.</p><p>Si un animal traverse, freinez en ligne droite plutôt que de faire une embardée. Les tortues traversent les routes pour pondre en juin, et vous pouvez en faire traverser une dans la direction où elle allait déjà, bien à l’écart de la circulation. Ne saisissez jamais une tortue serpentine par la queue, ce qui blesse sa colonne vertébrale.</p>`},
    {t:'Cold water and weather', b:`<p>Cold water is the real risk on Ontario lakes, even in summer. It saps your strength fast, so wear a lifejacket in any boat or canoe and keep one on children at the shore.</p><p>Watch the sky. Afternoon thunderstorms build quickly, and open water is no place to be when one arrives. If you hear thunder, get off the water and away from tall lone trees. Tell someone your route and when you will be back before a longer paddle or hike.</p>`, bf:`<p>L’eau froide est le vrai danger sur les lacs de l’Ontario, même en été. Elle épuise vos forces rapidement, alors portez un gilet de sauvetage dans tout bateau ou canot et gardez-en un sur les enfants au bord de l’eau.</p><p>Surveillez le ciel. Les orages de l’après-midi se forment rapidement, et le large n’est pas un endroit où se trouver quand l’un d’eux arrive. Si vous entendez le tonnerre, sortez de l’eau et éloignez-vous des grands arbres isolés. Dites à quelqu’un votre itinéraire et l’heure de votre retour avant une longue sortie en canot ou en randonnée.</p>`},
  ];
  el.innerHTML='<div class="ios-group">'+A.map(function(a){
    return '<details class="cell-details"><summary class="ios-row ios-row--plain"><span class="ios-row-body"><span class="ios-row-title">'+TL(a.t)+'</span></span>'+CHEV+'</summary>'+
      '<div class="cell-detail-body">'+((LANG==='fr'&&a.bf)||a.b)+'</div></details>'; }).join('')+'</div>';
}
/* shared: body scroll lock while a sheet is open */
var _lockY=0,_locks=0,_scrollLocked=false;
function lockScroll(){ if(++_locks>1) return; _lockY=window.scrollY||0; var b=document.body;
  b.style.position='fixed'; b.style.top=(-_lockY)+'px'; b.style.left='0'; b.style.right='0'; b.style.width='100%';
  /* body position:fixed zeroes scrollY; without this the scroll handler would
     strip the back bar's glass and its label would collide with the page text
     scrolled behind the open sheet. Freeze the frosted state while locked. */
  _scrollLocked=true;
  document.querySelectorAll('.ios-header,.nav,.backbar').forEach(function(el){ el.classList.add('scrolled'); }); }
function unlockScroll(){ if(_locks===0) return; if(--_locks>0) return; var b=document.body;
  b.style.position=''; b.style.top=''; b.style.left=''; b.style.right=''; b.style.width=''; window.scrollTo(0,_lockY);
  _scrollLocked=false; if(window.sjStampScrolled) window.sjStampScrolled(); }
/* shared: pull down anywhere on a sheet to close it */
function makeSheetSwipe(el,closeFn){
  var sy=0,sx=0,dy=0,dragging=false,horiz=false;
  el.addEventListener('touchstart',function(e){
    if(el.scrollTop>0) return;
    if(e.target.closest('textarea')) return;
    var isc=e.target.closest('.scrolly'); if(isc && isc.scrollTop>0) return;
    sy=e.touches[0].clientY; sx=e.touches[0].clientX; dy=0; dragging=true; horiz=false; el.style.transition='none';
  },{passive:true});
  el.addEventListener('touchmove',function(e){
    if(!dragging) return;
    var ty=e.touches[0].clientY-sy, tx=e.touches[0].clientX-sx;
    if(!horiz && Math.abs(tx)>Math.abs(ty)+8) horiz=true;
    if(horiz) return;
    dy=ty;
    if(dy>0){ e.preventDefault(); el.style.transform='translateY('+dy+'px)'; }
  },{passive:false});
  el.addEventListener('touchend',function(){
    if(!dragging) return; dragging=false; el.style.transition='';
    if(dy>70){ closeFn(); } else { el.style.transform=''; }
  });
}
/* ---- legal, read inside the app ----
   The privacy policy, terms and support live in a sheet rather than a link
   out to katsuma.ca, so they are readable offline and nobody is bounced to
   a browser mid-app. The full pages stay on the site; this is the same
   content, condensed to what a reader of this app needs. */
/* the iPhone app and the web version share these pages; IN_APP picks the
   sentences that differ (where the data lives, updates, links) */
var MAIL='<a href="mailto:katsuma123@gmail.com">katsuma123@gmail.com</a>';
function siteLink(path){ return '<a href="https://katsuma.ca/'+path+'" target="_blank" rel="noopener">katsuma.ca/'+path+'</a>'; }
var ISSUES='<a href="https://github.com/katsuma0/on-site/issues" target="_blank" rel="noopener">github.com/katsuma0/on-site/issues</a>';
var LEGAL_PAGES={
  privacy:{t:'Privacy policy',h:''
    +'<p><b>The short version.</b> There are no accounts, no advertising and no analytics. Nothing you write, rate or photograph is sent to me. It is stored on this device and it stays here. I cannot read it and I never see that it exists.</p>'
    +'<p><b>What the app stores.</b> Your ratings, notes, wishlist marks and photos, your favourites and your settings. All of it is kept on this device, '+(IN_APP?'inside the app':'in this browser’s storage')+'.</p>'
    +'<p><b>What leaves this device.</b> Nothing is sent to me. A backup you export goes only where you send it. '
      +(IN_APP?'The Map tab is Apple Maps: when you are online it loads map images from Apple, under Apple’s privacy policy, and it never sends Apple your journal. Everything else makes no network requests and works the same in airplane mode. A link to an official park page or to katsuma.ca opens in Safari.'
              :'The web version is served from GitHub Pages, which keeps ordinary server logs. A link to an official park page opens that site.')+'</p>'
    +(IN_APP?'<p><b>Home Screen search.</b> So you can find a park by searching from the Home Screen, the app adds the names of the parks in its guide to this device’s search index. Your own ratings, notes and photos are never added. You can turn this off for ON site in the Settings app.</p>':'')
    +'<p><b>Permissions.</b> The camera and photo library are used only when you attach a photo to a site, and a photo is saved to your library only when you choose to save it. The app never asks for your location. If you decline, everything else still works'+(IN_APP?', and you can change your mind in the Settings app at any time':'')+'.</p>'
    +'<p><b>Keeping and deleting.</b> Your data is kept until you delete it. More, then Your data, then Reset all data removes everything, and '+(IN_APP?'deleting the app':'clearing this site’s data')+' does the same. Export a backup writes your whole journal to one file, and Import a backup reads it back on any device, replacing what is there. There is no server copy, so nothing can be recovered once it is gone.</p>'
    +'<p><b>Children.</b> The app is safe for a child to use. Nothing in it collects personal information from anyone, of any age.</p>'
    +'<p>The full policy is at '+siteLink('privacy.html')+'. Questions: '+MAIL+'.</p>',
    hFr:''
    +'<p><b>La version courte.</b> Il n’y a aucun compte, aucune publicité et aucune analyse d’audience. Rien de ce que vous écrivez, notez ou photographiez ne m’est envoyé. C’est stocké sur cet appareil et cela y reste. Je ne peux pas le lire et je ne vois jamais que cela existe.</p>'
    +'<p><b>Ce que l’application stocke.</b> Vos évaluations, vos notes, vos marques de liste de souhaits et vos photos, vos favoris et vos réglages. Tout cela est conservé sur cet appareil, '+(IN_APP?'dans l’application':'dans le stockage de ce navigateur')+'.</p>'
    +'<p><b>Ce qui quitte cet appareil.</b> Rien ne m’est envoyé. Une sauvegarde que vous exportez va seulement là où vous l’envoyez. '
      +(IN_APP?'L’onglet Carte est Plans d’Apple : quand vous êtes en ligne, il charge les images de la carte depuis Apple, selon la politique de confidentialité d’Apple, et il n’envoie jamais votre journal à Apple. Tout le reste ne fait aucune requête réseau et fonctionne de la même façon en mode avion. Un lien vers une page officielle d’un parc ou vers katsuma.ca s’ouvre dans Safari.'
              :'La version Web est servie par GitHub Pages, qui conserve des journaux de serveur ordinaires. Un lien vers une page officielle d’un parc ouvre ce site.')+'</p>'
    +(IN_APP?'<p><b>Recherche de l’écran d’accueil.</b> Pour que vous puissiez trouver un parc en cherchant depuis l’écran d’accueil, l’application ajoute le nom des parcs de son guide à l’index de recherche de cet appareil. Vos propres évaluations, notes et photos n’y sont jamais ajoutées. Vous pouvez désactiver cette fonction pour ON site dans l’app Réglages.</p>':'')
    +'<p><b>Autorisations.</b> L’appareil photo et la photothèque ne sont utilisés que lorsque vous joignez une photo à un emplacement, et une photo n’est enregistrée dans votre photothèque que si vous choisissez de l’enregistrer. L’application ne demande jamais votre position. Si vous refusez, tout le reste fonctionne quand même'+(IN_APP?', et vous pouvez changer d’avis dans l’app Réglages à tout moment':'')+'.</p>'
    +'<p><b>Conservation et suppression.</b> Vos données sont conservées jusqu’à ce que vous les supprimiez. Plus, puis Vos données, puis Réinitialiser toutes les données efface tout, et '+(IN_APP?'supprimer l’application':'effacer les données de ce site')+' fait de même. Exporter une sauvegarde écrit tout votre journal dans un seul fichier, et Importer une sauvegarde le relit sur n’importe quel appareil, en remplaçant ce qui s’y trouve. Il n’y a aucune copie sur un serveur, donc rien ne peut être récupéré une fois que c’est parti.</p>'
    +'<p><b>Enfants.</b> L’application peut être utilisée sans danger par un enfant. Rien en elle ne recueille de renseignements personnels de quiconque, à tout âge.</p>'
    +'<p>La politique complète se trouve à '+siteLink('privacy.html')+'. Questions : '+MAIL+'.</p>'},
  terms:{t:'Terms of use',h:''
    +'<p><b>Safety first.</b> This app is a reference, not safety equipment. It cannot call for help. Carry a way to reach emergency services where you are going, and tell someone your plan. Park and site details are approximate.</p>'
    +'<p><b>Your content is yours.</b> What you write, rate and photograph belongs to you. It is stored on your device and never sent to me, so I acquire no rights to it.</p>'
    +'<p><b>Acceptable use.</b> Do not use the app to break the law, to harass anyone, or to harm a park. Do not photograph occupied sites, and leave a site the way you would want to find it.</p>'
    +'<p><b>No warranty.</b> The app is provided as it is, free of charge, with no warranty of any kind. Park information can be incomplete or out of date. Book through Ontario Parks’ official site.</p>'
    +'<p><b>Data loss.</b> Everything is stored on your device and nothing is backed up to a server, so your journal can be lost if you '+(IN_APP?'delete the app or lose the device':'clear this site’s data or lose the device')+'. Export a backup regularly.</p>'
    +'<p><b>Not affiliated.</b> This is an independent app, not made by or endorsed by Ontario Parks, the Government of Ontario or Apple.</p>'
    +'<p>The full terms are at '+siteLink('terms.html')+'. These terms are governed by the laws of Ontario, Canada.</p>',
    hFr:''
    +'<p><b>La sécurité d’abord.</b> Cette application est une référence, pas un équipement de sécurité. Elle ne peut pas appeler à l’aide. Emportez un moyen de joindre les services d’urgence là où vous allez, et dites à quelqu’un votre plan. Les renseignements sur les parcs et les emplacements sont approximatifs.</p>'
    +'<p><b>Votre contenu vous appartient.</b> Ce que vous écrivez, notez et photographiez vous appartient. C’est stocké sur votre appareil et jamais envoyé à moi, donc je n’acquiers aucun droit dessus.</p>'
    +'<p><b>Utilisation acceptable.</b> N’utilisez pas l’application pour enfreindre la loi, pour harceler qui que ce soit, ou pour nuire à un parc. Ne photographiez pas les emplacements occupés, et laissez un emplacement tel que vous voudriez le trouver.</p>'
    +'<p><b>Aucune garantie.</b> L’application est fournie telle quelle, gratuitement, sans aucune garantie d’aucune sorte. Les renseignements sur les parcs peuvent être incomplets ou périmés. Réservez par le site officiel de Parcs Ontario.</p>'
    +'<p><b>Perte de données.</b> Tout est stocké sur votre appareil et rien n’est sauvegardé sur un serveur, donc votre journal peut être perdu si vous '+(IN_APP?'supprimez l’application ou perdez l’appareil':'effacez les données de ce site ou perdez l’appareil')+'. Exportez une sauvegarde régulièrement.</p>'
    +'<p><b>Sans affiliation.</b> Il s’agit d’une application indépendante, qui n’est ni conçue ni approuvée par Parcs Ontario, le gouvernement de l’Ontario ou Apple.</p>'
    +'<p>Les conditions complètes se trouvent à '+siteLink('terms.html')+'. Ces conditions sont régies par les lois de l’Ontario, au Canada.</p>'},
  support:{t:'Support',h:''
    +'<p><b>Reach me.</b> Email '+MAIL+' and I will reply. Problems can also be filed at '+ISSUES+'.</p>'
    +'<p><b>Moving to a new device.</b> On the old device: More, then Your data, then Export a backup. Send that file to yourself. On the new device: More, then Your data, then Import a backup, and pick the file. Importing replaces what is on that device, so do it before you start rating there.</p>'
    +'<p><b>'+(IN_APP?'Deleted the app?':'Cleared your browser’s data?')+'</b> The journal went with it, because nothing is stored on a server. Export a backup before you '+(IN_APP?'delete the app':'clear your data')+' or change devices. I have no copy and cannot recover anything.</p>'
    +'<p><b>No signal?</b> '+(IN_APP?'Everything works offline, in airplane mode too. Only the map images need a connection; the park pins show either way.':'Every park, site and rating works offline once the app has loaded.')+'</p>'
    +(IN_APP?'<p><b>Updates.</b> Updates come through the App Store, and your journal stays in place when the app updates.</p>'
            :'<p><b>Looks like the old version?</b> Close the app completely and open it again. It keeps its files on your device so it works offline, and swaps in updates the next time you open it.</p>')
    +(IN_APP?'<p><b>Find a park fast.</b> Swipe down on the Home Screen and type a park’s name to open it straight in ON site.</p>':'')
    +'<p><b>Accessibility.</b> Text size is set in the app: More, then Appearance, then Text size. Buttons and controls are labelled for VoiceOver. If something is hard to read, hit or hear announced, tell me. That is a bug, not a preference.</p>',
    hFr:''
    +'<p><b>Me joindre.</b> Écrivez à '+MAIL+' et je répondrai. Les problèmes peuvent aussi être signalés à '+ISSUES+'.</p>'
    +'<p><b>Passer à un nouvel appareil.</b> Sur l’ancien appareil : Plus, puis Vos données, puis Exporter une sauvegarde. Envoyez-vous ce fichier. Sur le nouvel appareil : Plus, puis Vos données, puis Importer une sauvegarde, et choisissez le fichier. L’importation remplace ce qui se trouve sur cet appareil, alors faites-la avant de commencer à noter.</p>'
    +'<p><b>'+(IN_APP?'Vous avez supprimé l’application ?':'Vous avez effacé les données du navigateur ?')+'</b> Le journal est parti avec elle, car rien n’est stocké sur un serveur. Exportez une sauvegarde avant de '+(IN_APP?'supprimer l’application':'effacer vos données')+' ou de changer d’appareil. Je n’ai aucune copie et ne peux rien récupérer.</p>'
    +'<p><b>Pas de signal ?</b> '+(IN_APP?'Tout fonctionne hors ligne, en mode avion aussi. Seules les images de la carte ont besoin d’une connexion ; les repères des parcs s’affichent dans tous les cas.':'Chaque parc, emplacement et évaluation fonctionne hors ligne une fois l’application chargée.')+'</p>'
    +(IN_APP?'<p><b>Mises à jour.</b> Les mises à jour arrivent par l’App Store, et votre journal reste en place quand l’application se met à jour.</p>'
            :'<p><b>On dirait l’ancienne version ?</b> Fermez complètement l’application et rouvrez-la. Elle conserve ses fichiers sur votre appareil pour fonctionner hors ligne, et intègre les mises à jour la prochaine fois que vous l’ouvrez.</p>')
    +(IN_APP?'<p><b>Trouver un parc rapidement.</b> Glissez vers le bas sur l’écran d’accueil et tapez le nom d’un parc pour l’ouvrir directement dans ON site.</p>':'')
    +'<p><b>Accessibilité.</b> La taille du texte se règle dans l’application : Plus, puis Apparence, puis Taille du texte. Les boutons et les commandes sont étiquetés pour VoiceOver. Si quelque chose est difficile à lire, à toucher ou à entendre annoncé, dites-le-moi. C’est un bogue, pas une préférence.</p>'},
};
function openLegal(key){
  var pg=LEGAL_PAGES[key]; if(!pg) return;
  var t=document.getElementById('legalTitle'), b=document.getElementById('legalBody');
  if(t) t.textContent=TL(pg.t);
  if(b) b.innerHTML=(LANG==='fr'&&pg.hFr)?pg.hFr:pg.h;
  settingsBackdrop.classList.add('on');
  var ls=document.getElementById('legalSheet');
  ls.classList.add('on'); ls.scrollTop=0; lockScroll(); sheetA11yOpen(ls);
}
function closeLegal(){
  var ls=document.getElementById('legalSheet');
  var was=ls.classList.contains('on');
  settingsBackdrop.classList.remove('on'); ls.classList.remove('on'); ls.style.transform=''; unlockScroll(); if(was) sheetA11yClose();
}
document.querySelectorAll('[data-legal]').forEach(function(b){
  b.addEventListener('click',function(){ buzz(6); openLegal(b.getAttribute('data-legal')); });
});

/* settings is a tab screen now, not a swipe-to-close sheet */
function openVersions(){ settingsBackdrop.classList.add('on'); const vs=document.getElementById('versionsSheet'); vs.classList.add('on'); vs.scrollTop=0; lockScroll(); sheetA11yOpen(vs); }
function closeVersions(){ const vs=document.getElementById('versionsSheet'); var was=vs.classList.contains('on'); settingsBackdrop.classList.remove('on'); vs.classList.remove('on'); vs.style.transform=''; unlockScroll(); if(was) sheetA11yClose(); }
settingsBackdrop.addEventListener('click',closeVersions);
makeSheetSwipe(document.getElementById('versionsSheet'),closeVersions);
/* the legal pages open in their own sheet, so leaving the app to read a
   policy is never required; the same backdrop and swipe dismiss it */
settingsBackdrop.addEventListener('click',closeLegal);
makeSheetSwipe(document.getElementById('legalSheet'),closeLegal);
/* the version chip left the title; version history opens from the About row */
makeSheetSwipe(sheet,closeSheet);


/* ================= boot ================= */
(async function(){
  applyAppearance(); applyLang();
  buildDots(); load(); migrateAlgonquin(); migrateScale5(); migratePinsToFavs();
  loadParksEmbedded(); buildSearchIndex(); wireGlobalSearch(); renderAppearancePanel();
  renderParks();                 /* instant first paint, no network wait */
  await loadPhotoIndex();        /* fast local IndexedDB */
  migrateAlgPhotos();
  renderParks();                 /* photos now count toward My parks */
  refreshParksFromNetwork();     /* background: pick up any hosted data update */
  postSpotlight();               /* iPhone app: parks for the Home Screen search */
})();
/* the system hands the app a park: iPhone search, a #park= link or a sibling
   app. Whatever is on screen gives way, and the park opens on the Parks tab
   the way a tap on its row would. */
function openParkFromOutside(pid){
  if(!PARK_BY_ID[pid]) return false;
  closeOverlays(); clearGSearch(); hideThemeToast();
  showTab('guide'); openPark(pid,'view-parks');
  try{ window.scrollTo(0,0); }catch(e){}
  return true; }
/* Search in App, from the iPhone's search: the query lands in this search */
function searchFromOutside(q){
  closeOverlays(); hideThemeToast(); showTab('search');
  var gq=document.getElementById('gq'); if(!gq) return;
  gq.value=String(q||'').slice(0,80); onGSearch(); }
window.onsiteOpenPark=openParkFromOutside;
window.onsiteSearch=searchFromOutside;
/* ---- the iPhone and iPad app's native tab bar and map ----
   In the app the tab bar is native (Liquid Glass) and the Map tab is Apple
   Maps, both drawn by the shell over this page; the page's own bar is
   hidden (html.native-tabs). The page tells the shell which tab it is on
   and when a sheet or the photo viewer covers it (the bar steps aside),
   and the shell calls the functions below. */
var NATIVE_TABS=!!window.__onNativeTabs;
function nativeChrome(msg){ if(!window.__onNativeTabs) return;
  try{ window.webkit.messageHandlers.chrome.postMessage(msg); }catch(e){} }
var _lastModal=null;
function postModalState(){ var on=!!document.querySelector('.sheet.on, #lightbox.on');
  if(on===_lastModal) return; _lastModal=on; nativeChrome({modal:on}); }
if(NATIVE_TABS){
  try{ var mo=new MutationObserver(postModalState);
    document.querySelectorAll('.sheet, #lightbox').forEach(function(el){ mo.observe(el,{attributes:true,attributeFilter:['class']}); });
  }catch(e){}
  postModalState(); }
window.onsiteShowTab=function(tab){ closeOverlays(); hideThemeToast(); if(tab!=='search') clearGSearch(); showTab(tab); return true; };
window.onsiteShowRegion=function(region){ closeOverlays(); clearGSearch(); regionFilter=region; showTab('guide'); return true; };
/* what the map needs to colour its pins: favourite and visited parks */
window.onsiteMapState=function(){
  return JSON.stringify({ fav:PARKS.filter(function(p){ return isFav('parks',p.id); }).map(function(p){ return p.id; }),
    visited:visitedParkIds(), lang:LANG }); };
/* iPhone search: the shell indexes what this sends, so a park can be found
   from the Home Screen. Only the guide's own data goes in, never the
   reader's ratings, notes or photos. */
function postSpotlight(){
  var h=null; try{ h=window.webkit.messageHandlers.spotlight; }catch(e){}
  if(!h||!PARKS.length) return;
  var extra=LANG==='fr'?['camping','terrain de camping','parc provincial','Ontario']:['camping','campground','campsite','provincial park','Ontario'];
  var list=PARKS.map(function(p){
    var cgs=p.campgrounds||[], sites=0; cgs.forEach(function(c){ sites+=cgSites(c).length; });
    var alg=(p.region||'').indexOf('Algonquin')===0;
    var bits=[(p.region||'').split(' \u00b7 ').join(', ')];
    bits.push(cgs.length?cgs.length+' '+TL(cgs.length===1?'campground':'campgrounds')+', '+sites.toLocaleString(LANG==='fr'?'fr-CA':'en-CA')+' '+TL(sites===1?'site':'sites'):TL('Day-use park'));
    var kw=[p.name].concat(alg?['Algonquin']:[],cgs.map(function(c){ return c.id; }),(p.trails||[]).slice(0,6).map(function(t){ return t.name; }),extra);
    return {id:p.id,name:alg?p.name+', Algonquin':p.name,text:bits.join(' \u00b7 '),keywords:kw}; });
  try{ h.postMessage({lang:LANG,version:APP_VERSION,parks:list}); }catch(e){} }
(function(){ /* #park=<id> deep links, from the fishing app */
  function fromHash(){
    var m=(location.hash||'').match(/park=([a-z0-9]+)/); if(!m) return;
    var pid=m[1]; if(!PARK_BY_ID[pid]) return;
    openParkFromOutside(pid);
    history.replaceState(null,'',location.pathname+location.search); }
  window.addEventListener('hashchange',fromHash);
  fromHash();
})();
/* back to where the user was when an update reloaded the page */
var SW_PLACE='site-sw-place';
(function(){ var pl=null; try{ pl=JSON.parse(sessionStorage.getItem(SW_PLACE)); sessionStorage.removeItem(SW_PLACE); }catch(e){}
  if(!pl) return;
  if(pl.tab&&pl.tab!=='guide'&&pl.tab!=='search'&&TAB_SECTIONS[pl.tab]) showTab(pl.tab);
  if(pl.park&&PARK_BY_ID[pl.park]) openPark(pl.park,ALL_VIEWS.indexOf(pl.host)>=0?pl.host:'view-parks');
  if(pl.y>0) requestAnimationFrame(function(){ window.scrollTo(0,pl.y); });
})();
if(window.OnShare) OnShare.config({ app:'on-site', base:'https://katsuma.ca/on-site/', accent:'#007AFF' });
(function(){ /* #/shared/<data> receive route */
  function fromSharedHash(){
    var m=(location.hash||'').match(/^#\/shared\/(.+)$/); if(!m) return;
    var it=window.OnShare?OnShare.decode(m[1]):null;
    if(typeof showShared==='function') showShared(it);
  }
  window.addEventListener('hashchange',fromSharedHash);
  fromSharedHash();
})();
if('serviceWorker' in navigator){
  if(window.Capacitor){
    /* inside the iOS app the files are local; a service worker only serves stale copies. Kill any old one. */
    try{ navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())); }catch(e){}
    try{ if(window.caches&&caches.keys) caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))); }catch(e){}
  } else {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
    /* A new release takes over while this page still runs the old one. It
       loads at once when the app has just been shown and not yet touched;
       otherwise the next time the app is put away, unless the camera or a
       file picker is what hid it (the photo would be lost with the page).
       Either way the tab, the park and the scroll come back after the
       reload. A first install's own takeover is not a new release. */
    var swHad=!!navigator.serviceWorker.controller, swShownAt=Date.now(), swTouched=false, swPicker=false, swWaiting=false, swReloading=false;
    navigator.serviceWorker.getRegistration().then(function(r){ if(r&&r.active) swHad=true; }).catch(function(){});
    var swBusy=function(){ var a=document.activeElement; return swPicker||document.querySelector('.sheet.on')||(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
    var swReload=function(){ if(swReloading) return; swReloading=true;
      try{ var t=document.querySelector('#tabbar .tab.active'), vp=document.getElementById('view-park');
        sessionStorage.setItem(SW_PLACE,JSON.stringify({tab:t?t.dataset.tab:'guide',park:(curPark&&vp&&!vp.hidden)?curPark.id:null,host:parkHost,y:Math.round(window.scrollY||0)})); }catch(e){}
      location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(!swHad){ swHad=true; return; }
      if(!swTouched&&!swBusy()&&Date.now()-swShownAt<10000) swReload(); else swWaiting=true; });
    ['pointerdown','keydown'].forEach(function(t){ document.addEventListener(t,function(){ swTouched=true; },true); });
    document.addEventListener('click',function(e){ if(e.target&&e.target.type==='file') swPicker=true; },true);
    ['change','cancel'].forEach(function(t){ document.addEventListener(t,function(e){ if(e.target&&e.target.type==='file') swPicker=false; },true); });
    /* a home screen app is resumed, not relaunched, so look for a release then too */
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){ if(swWaiting&&!swPicker) swReload(); return; }
      swShownAt=Date.now(); swTouched=false;
      setTimeout(function(){ swPicker=false; },1000);   /* a picker with no cancel event cannot hold it forever */
      navigator.serviceWorker.getRegistration().then(function(r){ if(r) return r.update(); }).catch(function(){}); });
  }
}
