// --- RESTAURATION DES AJOUTS FAITS VIA L'ADMIN (personnages, armes, artéfacts) ---
// Les ajouts sont gardés dans le navigateur tant que data.js n'a pas été remplacé par la
// version téléchargée. Dès qu'un élément est présent dans data.js, il est retiré de la
// sauvegarde du navigateur (pas de doublon).
const CUSTOM_STORAGE_KEYS = {
    characters: 'genshin_custom_chars',
    weapons: 'genshin_custom_weapons',
    artifacts: 'genshin_custom_artifacts'
};

// Clé d'identité : un artéfact existe en 4★ et en 5★ avec le même nom, donc nom + type + rareté.
function itemKey(category, item) {
    const name = (item.name || '').trim().toLowerCase();
    if (category === 'artifacts') return [name, (item.type || '').trim().toLowerCase(), item.rarity].join('|');
    return name;
}

// data.js au nouveau format : « const LOCAL_GENSHIN_SOURCE = () => ({ ... }) ». Son texte (commentaires
// « //Pour Claude » compris) est lisible avec .toString(), ce qui permet d'insérer les ajouts aux marqueurs.
const HAS_SOURCE = typeof LOCAL_GENSHIN_SOURCE === 'function';
// Texte de data.js servant de base (remplacé après une réinitialisation, avant que le fichier soit remplacé)
let sourceBaseText = HAS_SOURCE ? LOCAL_GENSHIN_SOURCE.toString() : '';

const customItems = { characters: [], weapons: [], artifacts: [] };
if (typeof LOCAL_GENSHIN_DATA !== 'undefined') {
    Object.keys(CUSTOM_STORAGE_KEYS).forEach(category => {
        if (!LOCAL_GENSHIN_DATA[category]) return;
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEYS[category])) || []; } catch (e) {}
        const known = new Set(LOCAL_GENSHIN_DATA[category].map(item => itemKey(category, item)));
        const pending = saved.filter(item => item && item.name && !known.has(itemKey(category, item)));
        if (pending.length !== saved.length) {
            try {
                if (pending.length) localStorage.setItem(CUSTOM_STORAGE_KEYS[category], JSON.stringify(pending));
                else localStorage.removeItem(CUSTOM_STORAGE_KEYS[category]);
            } catch (e) {}
        }
        customItems[category] = pending;
    });
    if (!rebuildDataFromSource()) {
        // Ancien format de data.js (sans marqueurs) : ajout en fin de liste
        Object.keys(customItems).forEach(category => {
            if (LOCAL_GENSHIN_DATA[category]) LOCAL_GENSHIN_DATA[category] = [...LOCAL_GENSHIN_DATA[category], ...customItems[category]];
        });
    }
}

// --- MODE ADMIN : l'onglet Admin n'est visible que sur votre navigateur ---
// Pour l'activer, ouvrez le site une fois avec  ?admin=VOTRE_CODE  (ex : https://monsite.github.io/?admin=changez-moi).
// ⚠️ Ce n'est PAS une sécurité (le code est lisible dans ce fichier) : cela masque simplement le bouton aux visiteurs.
// Un visiteur ne peut de toute façon rien modifier pour les autres : le site est statique et il n'a aucun accès à votre GitHub.
const ADMIN_SECRET_CODE = 'MVTMJSUN';   // ← remplacez par votre propre code
const ADMIN_FLAG_KEY = 'genshin_admin';

function isAdminMode() {
    try { return localStorage.getItem(ADMIN_FLAG_KEY) === '1'; } catch (e) { return false; }
}

(function activateAdminFromUrl() {
    try {
        const params = new URLSearchParams(location.search);
        if (!params.has('admin')) return;
        if (params.get('admin') === ADMIN_SECRET_CODE) localStorage.setItem(ADMIN_FLAG_KEY, '1');
        params.delete('admin');
        const query = params.toString();
        history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
    } catch (e) {}
})();

(function hideAdminTabForVisitors() {
    const adminTab = document.querySelector('.tab-btn[data-tab="admin"]');
    if (adminTab && !isAdminMode()) adminTab.style.display = 'none';
})();

let currentTab = 'characters';
let currentElementFilter = 'all';
let currentWeaponTypeFilter = 'all';
let currentRarityFilter = 'all'; 
let currentArtifactFilter = 'all';
let alphaDirection = 'asc'; 

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Boîte de confirmation dans la page (les confirm()/alert() natifs peuvent être bloqués par le navigateur)
function showConfirmBox(messageHtml, confirmLabel, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `<div class="confirm-box">
        <p>${messageHtml}</p>
        <div class="confirm-actions">
            <button type="button" class="admin-btn primary" data-act="ok">${confirmLabel}</button>
            <button type="button" class="admin-btn" data-act="cancel">Annuler</button>
        </div></div>`;
    overlay.addEventListener('click', (e) => {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') { overlay.remove(); onConfirm(); }
        else if (act === 'cancel' || e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

function showToast(message, isError = false, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed; bottom:30px; right:30px; max-width:420px; background:' + (isError ? '#e74c3c' : '#2ecc71') + '; color:#fff; padding:14px 22px; border-radius:8px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.4); z-index:2000; transition:opacity 0.4s;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, duration - 500);
    setTimeout(() => toast.remove(), duration);
}

function getCharacterElement(item) {
    return item.divin || item.gnosis || item.lunaire || item.stellaire || item.serpent || item.trilunaire || item.autorité;
}

// --- EXPORT DE data.js ---
function serializeKey(k) {
    return /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(k) ? k : JSON.stringify(k);
}

function serializeItem(obj) {
    return '{ ' + Object.entries(obj).map(([k, v]) => `${serializeKey(k)}: ${JSON.stringify(v)}`).join(', ') + ' }';
}

// Ancien format : data.js entièrement régénéré à partir des données (les commentaires sont perdus)
function buildDataJsLegacy() {
    const body = Object.keys(LOCAL_GENSHIN_DATA).map(cat => {
        const lines = LOCAL_GENSHIN_DATA[cat].map(item => '        ' + serializeItem(item) + ',').join('\n');
        return `    ${cat}: [\n${lines}\n    ]`;
    }).join(',\n');
    return `const LOCAL_GENSHIN_DATA = {\n${body}\n};\n`;
}

// --- INSERTION AUX MARQUEURS « //Pour Claude » ---
const DATA_JS_HEADER = "// Les lignes « //Pour Claude » indiquent où le panneau Admin insère les nouveaux éléments (il les décale d'un cran vers le bas).\n"
    + "// Ne changez pas la structure « LOCAL_GENSHIN_SOURCE » : app.js lit son texte pour conserver ces commentaires.\n";

// Chaque ligne ajoutée par l'Admin porte ce commentaire : « Réinitialiser » supprime les lignes marquées.
// (Pour garder définitivement un élément, supprimez ce commentaire dans data.js.)
const ADMIN_TAG = '// ajouté via Admin';
const ADMIN_TAG_RE = /[ \t]*\/\/[ \t]*ajouté via Admin[ \t]*$/;

// Éléments marqués « ajouté via Admin » dans un texte source
function findAdminItems(text) {
    const found = [];
    let category = null;
    text.split(/\r?\n/).forEach(line => {
        const start = line.match(/^\s*(characters|weapons|artifacts)\s*:\s*\[/);
        if (start) { category = start[1]; return; }
        if (category && ADMIN_TAG_RE.test(line)) {
            const m = line.match(/\{\s*name:\s*("(?:[^"\\]|\\.)*")/);
            let name = '(sans nom)';
            try { if (m) name = JSON.parse(m[1]); } catch (e) {}
            found.push({ category, name });
        }
    });
    return found;
}

function removeAdminItems(text) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    return text.split(/\r?\n/).filter(line => !ADMIN_TAG_RE.test(line)).join(eol);
}

function wrapSourceAsFile(sourceText) {
    return `${DATA_JS_HEADER}const LOCAL_GENSHIN_SOURCE = ${sourceText};\nconst LOCAL_GENSHIN_DATA = LOCAL_GENSHIN_SOURCE();\n`;
}

// Remplace les données en mémoire par celles d'un texte source
function applyBaseText(text) {
    const data = new Function('return (' + text + ');')()();
    Object.keys(data).forEach(category => { LOCAL_GENSHIN_DATA[category] = data[category]; });
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Le marqueur (texte du commentaire) correspond-il à cet élément ? « 5 étoiles » + type d'arme / d'artéfact
function markerAccepts(markerText, category, item) {
    const text = markerText.toLowerCase();
    const stars = text.match(/(\d)\s*étoile/);
    if (stars && Number(stars[1]) !== Number(item.rarity)) return false;
    if (category === 'characters') return text.includes('personnage');
    const type = (item.type || '').trim().toLowerCase();
    if (!type) return false;
    return new RegExp(`(?<![\\p{L}])${escapeRegExp(type)}(?![\\p{L}])`, 'u').test(text);
}

// Où insérer ? Juste avant le marqueur correspondant, sinon en fin de tableau
function locateInsertion(lines, category, item) {
    const start = lines.findIndex(l => new RegExp(`^\\s*${category}\\s*:\\s*\\[`).test(l));
    if (start === -1) return null;
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\s*\]\s*,?\s*$/.test(lines[i])) { end = i; break; }
    }
    if (end === -1) return null;

    for (let i = start + 1; i < end; i++) {
        const m = lines[i].match(/^(\s*)\/\/\s*Pour Claude\b(.*)$/i);
        if (m && markerAccepts(m[2], category, item)) return { index: i, indent: m[1], marker: lines[i].trim(), fixCommaAt: -1 };
    }

    let prev = end - 1;
    while (prev > start && (lines[prev].trim() === '' || /^\s*\/\//.test(lines[prev]))) prev--;
    const indent = prev > start ? lines[prev].match(/^(\s*)/)[1] : '        ';
    return { index: end, indent, marker: null, fixCommaAt: prev > start ? prev : -1 };
}

function insertItemIntoSource(text, category, item) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const spot = locateInsertion(lines, category, item);
    if (!spot) throw new Error(`Tableau « ${category} » introuvable dans data.js`);
    if (spot.fixCommaAt >= 0) {
        const prevLine = lines[spot.fixCommaAt];
        const bare = prevLine.replace(ADMIN_TAG_RE, '').replace(/[ \t]+$/, '');
        if (!/,$/.test(bare)) lines[spot.fixCommaAt] = bare + ',' + (ADMIN_TAG_RE.test(prevLine) ? ' ' + ADMIN_TAG : '');
    }
    lines.splice(spot.index, 0, spot.indent + serializeItem(item) + ', ' + ADMIN_TAG);
    return lines.join(eol);
}

function findMarkerComment(text, category, item) {
    const spot = locateInsertion(text.split(/\r?\n/), category, item);
    return spot ? spot.marker : null;
}

// Texte de data.js d'origine + tous les ajouts en attente, chacun inséré à son marqueur
function buildSourceText() {
    let text = sourceBaseText;
    Object.keys(customItems).forEach(category => {
        customItems[category].forEach(item => { text = insertItemIntoSource(text, category, item); });
    });
    return text;
}

// Recharge les données en mémoire depuis ce texte : l'ordre affiché = l'ordre du futur data.js
function rebuildDataFromSource() {
    if (!HAS_SOURCE) return false;
    if (!Object.values(customItems).some(list => list.length)) return true;
    try {
        const data = new Function('return (' + buildSourceText() + ');')()();
        Object.keys(data).forEach(category => { LOCAL_GENSHIN_DATA[category] = data[category]; });
        return true;
    } catch (e) {
        console.error('Insertion aux marqueurs impossible, ajout en fin de liste :', e);
        return false;
    }
}

// --- CONVERSION d'un data.js ancien format (avec ses commentaires) vers le format à marqueurs ---
function countMarkers(text) {
    // Seulement les vraies lignes de marqueur (le commentaire d'en-tête du fichier n'en est pas un)
    return (text.match(/^[ \t]*\/\/\s*Pour Claude\b/gim) || []).length;
}

function convertLegacyDataJs(text) {
    const normalized = text.replace(/\r\n/g, '\n');
    const start = /const\s+LOCAL_GENSHIN_DATA\s*=\s*\{/.exec(normalized);
    if (!start || !/\}\s*;?\s*$/.test(normalized)) return null;
    const body = normalized.slice(start.index + start[0].length).replace(/\s*\}\s*;?\s*$/, '');
    const converted = `${DATA_JS_HEADER}const LOCAL_GENSHIN_SOURCE = () => ({${body}\n});\nconst LOCAL_GENSHIN_DATA = LOCAL_GENSHIN_SOURCE();\n`;
    try {
        const sourceOnly = converted.slice(converted.indexOf('const LOCAL_GENSHIN_SOURCE = ') + 'const LOCAL_GENSHIN_SOURCE = '.length, converted.lastIndexOf(';\nconst LOCAL_GENSHIN_DATA'));
        const data = new Function('return (' + sourceOnly + ');')()();
        if (!data || !Array.isArray(data.characters)) return null;
    } catch (e) {
        return null;
    }
    return converted;
}

function handleConvertFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const text = String(reader.result);
        if (/LOCAL_GENSHIN_SOURCE/.test(text)) {
            showToast('ℹ️ Ce fichier est déjà au bon format : rien à convertir.', false, 4000);
            return;
        }
        const converted = convertLegacyDataJs(text);
        if (!converted) {
            showToast('❌ Fichier non reconnu : il doit contenir « const LOCAL_GENSHIN_DATA = { … }; ».', true, 5000);
            return;
        }
        downloadTextFile(converted, 'data.js');
        showToast(`✅ data.js converti (${countMarkers(converted)} marqueur(s) « //Pour Claude » conservé(s)). Remplacez votre fichier par celui téléchargé, puis faites Ctrl+F5.`, false, 9000);
    };
    reader.readAsText(file, 'utf-8');
}

function buildDataJs() {
    if (HAS_SOURCE) {
        try {
            return wrapSourceAsFile(buildSourceText());
        } catch (e) {
            console.error('Export avec marqueurs impossible, export classique :', e);
        }
    }
    return buildDataJsLegacy();
}

function downloadTextFile(text, filename) {
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadDataJs() {
    downloadTextFile(buildDataJs(), 'data.js');
}

// --- FORMULAIRE ADMIN (reprend les champs d'un personnage de data.js) ---
const ADMIN_ELEMENTS = ['Pyro', 'Hydro', 'Anémo', 'Électro', 'Dendro', 'Cryo', 'Géo'];
const ADMIN_POWER_KEYS = [
    ['divin', 'Divin (Vision, par défaut)'], ['gnosis', 'Gnosis'], ['autorité', 'Autorité'],
    ['serpent', 'Serpent'], ['lunaire', 'Lunaire'], ['trilunaire', 'Trilunaire'], ['stellaire', 'Stellaire']
];
const ADMIN_WEAPONS = ['Épée à une main', 'Épée à deux mains', 'Arme d\'hast', 'Arc', 'Catalyseur'];
const ADMIN_ELEVATIONS = ['ATQ %', 'PV %', 'DÉF %', 'Maîtrise élémentaire', 'Recharge d\'énergie', 'Taux CRIT', 'DGT CRIT',
    'Bonus de soins', 'Bonus de DGT Physique', 'Bonus de DGT Pyro', 'Bonus de DGT Hydro', 'Bonus de DGT Anémo',
    'Bonus de DGT Électro', 'Bonus de DGT Dendro', 'Bonus de DGT Cryo', 'Bonus de DGT Géo'];
const ADMIN_NATIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya', 'Aucune', 'Autre'];
// [clé du nom, clé de la description, libellé]
const ADMIN_TALENTS = [
    ['normale', 'desc', 'Attaque normale'],
    ['compétence', 'compdesc', 'Compétence élémentaire (E)'],
    ['ultime', 'ultdesc', 'Déchaînement élémentaire (Q)'],
    ['élévation1', 'elevdesc1', 'Aptitude d\'élévation n°1'],
    ['élévation2', 'elevdesc2', 'Aptitude d\'élévation n°2'],
    ['passive1', 'passdesc1', 'Aptitude passive n°1'],
    ['passive2', 'passdesc2', 'Aptitude passive n°2'],
    ['supplémentaire', 'suppdesc', 'Aptitude supplémentaire']
];

function adminOptions(list) {
    return '<option value=""></option>' + list.map(o => `<option value="${o}">${o}</option>`).join('');
}

function adminTextField(key, label, extra = '') {
    return `<div class="admin-field"><label>${label}</label><input type="text" data-key="${key}" ${extra}></div>`;
}

function adminSelectField(key, label, list) {
    return `<div class="admin-field"><label>${label}</label><select data-key="${key}">${adminOptions(list)}</select></div>`;
}

function adminBlock(nameKey, descKey, label, namePlaceholder) {
    return `
        <div class="admin-block">
            <strong>${label}</strong>
            <input type="text" data-key="${nameKey}" placeholder="${namePlaceholder}">
            <textarea data-key="${descKey}" rows="3" placeholder="Description (Entrée = retour à la ligne, HTML accepté)"></textarea>
        </div>`;
}

// --- ADMIN : personnages, armes, artéfacts ---
const ADMIN_CATEGORIES = {
    characters: { icon: '👤', switchLabel: 'Personnage', nameLabel: 'Nom du personnage * :', saveLabel: 'Enregistrer le personnage', the: 'Le personnage' },
    weapons:    { icon: '⚔️', switchLabel: 'Arme',       nameLabel: 'Nom de l\'arme * :',      saveLabel: 'Enregistrer l\'arme',       the: 'L\'arme' },
    artifacts:  { icon: '🧰', switchLabel: 'Artéfact',   nameLabel: 'Nom de l\'artéfact * :',  saveLabel: 'Enregistrer l\'artéfact',   the: 'L\'artéfact' }
};
let adminCategory = 'characters';

const ADMIN_ARTIFACT_TYPES = ['Fleur de la vie', 'Plume de la mort', 'Sables du temps', 'Coupe d\'éonothème', 'Diadème de Logos'];
const ADMIN_WEAPON_SUBSTATS = ['ATQ %', 'PV %', 'DÉF %', 'Maîtrise élémentaire', 'Recharge d\'énergie', 'Taux CRIT', 'DGT CRIT', 'Bonus de DGT physiques'];
const ADMIN_WEAPON_OBTENTIONS = ['Voeux', 'Acte 1 Snezhnaya'];

function adminTextareaField(key, label, rows = 3, extra = '') {
    return `<div class="admin-field full"><label>${label}</label><textarea data-key="${key}" rows="${rows}" ${extra}></textarea></div>`;
}

// --- LIEN D'ICÔNE : construit à partir du type choisi + de la partie saisie à la main ---
const ADMIN_ICON_BASE = 'https://enka.network/ui/';
const ADMIN_WEAPON_ICON_TOKENS = { 'Épée à une main': 'Sword', 'Épée à deux mains': 'Claymore', 'Arme d\'hast': 'Pole', 'Arc': 'Bow', 'Catalyseur': 'Catalyst' };
const ADMIN_ARTIFACT_ICON_SUFFIX = { 'Coupe d\'éonothème': 1, 'Plume de la mort': 2, 'Diadème de Logos': 3, 'Fleur de la vie': 4, 'Sables du temps': 5 };
const ADMIN_ICON_EXAMPLES = { characters: 'Diluc', weapons: 'Falcon', artifacts: '14001' };

// Début et fin du lien selon la catégorie et le type choisi
function iconParts(category, typeValue) {
    if (category === 'characters') return { prefix: ADMIN_ICON_BASE + 'UI_AvatarIcon_Side_', suffix: '.png', token: '' };
    if (category === 'weapons') {
        const token = ADMIN_WEAPON_ICON_TOKENS[typeValue] || '';
        return { prefix: ADMIN_ICON_BASE + 'UI_EquipIcon_' + (token ? token + '_' : ''), suffix: '.png', token };
    }
    const n = ADMIN_ARTIFACT_ICON_SUFFIX[typeValue];
    return { prefix: ADMIN_ICON_BASE + 'UI_RelicIcon_', suffix: (n ? '_' + n : '') + '.png', token: '' };
}

// Lien complet = début + partie saisie + fin. Un lien complet collé est gardé tel quel.
function buildIconUrl(category, typeValue, part) {
    let p = (part || '').trim();
    if (!p) return '';
    const http = p.lastIndexOf('http');
    if (http >= 0) return p.slice(http);
    const { prefix, suffix, token } = iconParts(category, typeValue);
    if (token && p.toLowerCase().startsWith(token.toLowerCase() + '_')) p = p.slice(token.length + 1);
    return /\.png$/i.test(p) ? prefix + p : prefix + p + suffix;
}

function adminIconField(category) {
    return `<div class="admin-field full" data-icon-category="${category}">
        <label>URL de l'icône : <span class="admin-label-hint">(saisissez seulement la partie variable, le reste se complète selon le type)</span></label>
        <div class="icon-input-group">
            <span class="icon-affix icon-prefix"></span>
            <input type="text" data-key="iconPart">
            <span class="icon-affix icon-suffix"></span>
        </div>
        <div class="icon-preview" style="display:none"><img alt="Aperçu de l'icône"><small></small></div>
        <small class="admin-hint-inline icon-note"></small>
    </div>`;
}

let iconPreviewTimer = null;
function refreshIconField(form) {
    const field = form.querySelector('[data-icon-category]');
    if (!field) return;
    const category = field.getAttribute('data-icon-category');
    const typeEl = form.querySelector('[data-key="type"]');
    const type = typeEl ? typeEl.value : '';
    const parts = iconParts(category, type);
    const input = field.querySelector('[data-key="iconPart"]');
    field.querySelector('.icon-prefix').textContent = parts.prefix;
    field.querySelector('.icon-suffix').textContent = parts.suffix;
    input.placeholder = 'ex : ' + ADMIN_ICON_EXAMPLES[category];
    field.querySelector('.icon-note').textContent = (category !== 'characters' && !type) ? 'Choisissez d\'abord le type : le début et la fin du lien en dépendent.' : '';

    const url = buildIconUrl(category, type, input.value);
    const preview = field.querySelector('.icon-preview');
    const img = preview.querySelector('img');
    preview.style.display = url ? 'flex' : 'none';
    preview.querySelector('small').textContent = url;
    clearTimeout(iconPreviewTimer);
    if (url) {
        // image chargée après une courte pause pour ne pas multiplier les requêtes pendant la frappe
        iconPreviewTimer = setTimeout(() => {
            img.style.visibility = 'visible';
            img.onerror = () => { img.style.visibility = 'hidden'; };
            img.src = url;
        }, 400);
    }
}

function adminRarityField(list) {
    return `<div class="admin-field"><label>Rareté :</label><select data-key="rarity">${list.map(n => `<option value="${n}">${'★'.repeat(n)} (${n} étoiles)</option>`).join('')}</select></div>`;
}

// Champ texte avec suggestions (datalist) et valeur par défaut
function adminListField(key, label, values, defaultValue = '') {
    return `<div class="admin-field"><label>${label}</label>
        <input type="text" data-key="${key}" list="dl-${key}" value="${defaultValue}">
        <datalist id="dl-${key}">${values.map(v => `<option value="${v}"></option>`).join('')}</datalist></div>`;
}

// Les sets sont écrits « Nom du set : » dans data.js
function normalizeSetName(value) {
    const v = (value || '').trim().replace(/[\s:]+$/, '');
    return v ? v + ' :' : '';
}

function artifactSetNames() {
    return [...new Set((LOCAL_GENSHIN_DATA.artifacts || []).map(a => a.set).filter(v => v && /:$/.test(v)))].sort();
}

// ---------- Personnage ----------
function adminCharacterFormHtml() {
    const talentsHtml = ADMIN_TALENTS.map(([nk, dk, label]) => adminBlock(nk, dk, label, 'Nom')).join('')
        + `<div class="admin-block"><strong>Textes d'ambiance (facultatif)</strong>
            <textarea data-key="infocomp" rows="2" placeholder="Texte d'ambiance de la compétence élémentaire (E), affiché en italique"></textarea>
            <textarea data-key="infoult" rows="2" placeholder="Texte d'ambiance du déchaînement élémentaire (Q), affiché en italique"></textarea></div>`;

    const constellationsHtml = [1, 2, 3, 4, 5, 6]
        .map(n => adminBlock('c' + n, `c${n}desc`, `Constellation niv. ${n}`, 'Nom')).join('');

    const powerOptions = ADMIN_POWER_KEYS.map(([k, label]) => `<option value="${k}">${label}</option>`).join('');

    return `
        <div class="admin-grid">
            ${adminTextField('name', ADMIN_CATEGORIES.characters.nameLabel, 'required')}
            ${adminSelectField('element', 'Élément :', ADMIN_ELEMENTS)}
            <div class="admin-field"><label>Source de pouvoir :</label><select data-key="powerKey">${powerOptions}</select></div>
            ${adminSelectField('weapon', 'Type d\'arme :', ADMIN_WEAPONS)}
            ${adminRarityField([5, 4])}
            ${adminSelectField('elevation', 'Stat. d\'élévation :', ADMIN_ELEVATIONS)}
            ${adminSelectField('nation', 'Nation / Région :', ADMIN_NATIONS)}
            ${adminTextField('affiliation', 'Affiliation :')}
            ${adminTextField('constellation', 'Nom de la constellation :')}
            ${adminTextField('anniversaire', 'Anniversaire (jour/mois) :', 'placeholder="Ex: 14/3"')}
            ${adminIconField('characters')}
            ${adminTextareaField('description', 'Description :')}
        </div>

        <details class="admin-section">
            <summary>✨ Aptitudes (facultatif)</summary>
            <p class="admin-hint">Visibles dans l'onglet « Aptitudes ».</p>
            <div class="admin-grid">${talentsHtml}</div>
        </details>

        <details class="admin-section">
            <summary>🌟 Constellations (facultatif)</summary>
            <p class="admin-hint">Visibles dans l'onglet « Constellation » (au minimum la niveau 1).</p>
            <div class="admin-grid">${constellationsHtml}</div>
        </details>`;
}

function collectCharacter(val) {
    // Même ordre de clés que dans data.js
    const item = { name: val('name') };
    item[val('powerKey') || 'divin'] = val('element');
    item.weapon = val('weapon');
    item.rarity = parseInt(val('rarity')) || 5;
    item.elevation = val('elevation');
    item.icon = buildIconUrl('characters', '', val('iconPart')) || 'https://enka.network/ui/UI_AvatarIcon_Side_PlayerBoy.png';
    ['anniversaire', 'nation', 'affiliation', 'constellation', 'description'].forEach(k => { item[k] = val(k); });
    ADMIN_TALENTS.forEach(([nk, dk]) => { item[nk] = val(nk); item[dk] = val(dk); });
    [1, 2, 3, 4, 5, 6].forEach(n => { item['c' + n] = val('c' + n); item[`c${n}desc`] = val(`c${n}desc`); });
    ['infocomp', 'infoult'].forEach(k => { if (val(k)) item[k] = val(k); });
    return item;
}

// ---------- Arme ----------
function adminWeaponFormHtml() {
    return `
        <div class="admin-grid">
            ${adminTextField('name', ADMIN_CATEGORIES.weapons.nameLabel, 'required')}
            ${adminSelectField('type', 'Type d\'arme :', ADMIN_WEAPONS)}
            ${adminRarityField([5, 4, 3])}
            ${adminListField('obtention', 'Obtention :', ADMIN_WEAPON_OBTENTIONS, 'Voeux')}
            ${adminListField('main', 'Stat. principale :', ['ATQ de base'], 'ATQ de base')}
            ${adminSelectField('sub', 'Stat. secondaire :', ADMIN_WEAPON_SUBSTATS)}
            ${adminTextField('names', 'Nom de l\'effet (passif) :')}
            ${adminIconField('weapons')}
            ${adminTextareaField('effect', 'Effet (passif) :', 5, 'placeholder="• Augmente l\'ATQ de 20 %…"')}
            ${adminTextareaField('description', 'Description :')}
        </div>`;
}

function collectWeapon(val) {
    // Même ordre de clés que dans data.js
    return {
        name: val('name'),
        type: val('type'),
        rarity: parseInt(val('rarity')) || 5,
        icon: buildIconUrl('weapons', val('type'), val('iconPart')),
        obtention: val('obtention'),
        main: val('main'),
        sub: val('sub'),
        names: val('names'),
        effect: val('effect'),
        description: val('description')
    };
}

// ---------- Artéfact ----------
function adminArtifactFormHtml() {
    return `
        <div class="admin-grid">
            ${adminTextField('name', ADMIN_CATEGORIES.artifacts.nameLabel, 'required')}
            ${adminSelectField('type', 'Type d\'artéfact :', ADMIN_ARTIFACT_TYPES)}
            ${adminRarityField([5, 4])}
            ${adminListField('obtention', 'Obtention :', ['Donjon'], 'Donjon')}
            ${adminListField('set', 'Nom du set :', artifactSetNames())}
            ${adminIconField('artifacts')}
            ${adminTextareaField('bonus2', 'Bonus de set (2 pièces) :', 2)}
            ${adminTextareaField('bonus4', 'Bonus de set (4 pièces) :', 2)}
            ${adminTextareaField('description', 'Description :')}
        </div>
        <p class="admin-hint">Le nom du set se termine par « : » dans data.js, c'est ajouté automatiquement. Si le set existe déjà, ses bonus sont préremplis.</p>`;
}

function collectArtifact(val) {
    const parts = [];
    if (val('bonus2')) parts.push(`Set de 2 pièce(s) : ${val('bonus2')}`);
    if (val('bonus4')) parts.push(`Set de 4 pièce(s) : ${val('bonus4')}`);
    // Même ordre de clés que dans data.js
    return {
        name: val('name'),
        rarity: parseInt(val('rarity')) || 5,
        type: val('type'),
        icon: buildIconUrl('artifacts', val('type'), val('iconPart')),
        obtention: val('obtention'),
        set: normalizeSetName(val('set')),
        effect: parts.join(' <br>'),
        description: val('description')
    };
}

// ---------- Enregistrement commun ----------
// --- PUBLICATION AUTOMATIQUE SUR GITHUB (API « contents », jeton personnel stocké uniquement dans ce navigateur) ---
const GITHUB_SETTINGS_KEY = 'genshin_github_sync';

function loadGithubSettings() {
    try { return JSON.parse(localStorage.getItem(GITHUB_SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}

function saveGithubSettings(settings) {
    localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
}

function githubReady(settings) {
    return !!(settings && settings.enabled && settings.repo && settings.token);
}

function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

function base64ToUtf8(base64) {
    const binary = atob(base64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}

function githubErrorMessage(status, json) {
    if (status === 401) return 'jeton refusé (invalide ou expiré).';
    if (status === 403) return 'accès refusé : le jeton n\'a pas la permission « Contents : Read and write » sur ce dépôt (ou limite de requêtes atteinte).';
    if (status === 404) return 'dépôt, branche ou fichier introuvable (vérifiez le nom du dépôt, la branche et le chemin), ou le jeton n\'a pas accès à ce dépôt.';
    return `erreur GitHub ${status}${json && json.message ? ' : ' + json.message : ''}.`;
}

async function githubFetch(settings, method, body, raw = false) {
    const url = `https://api.github.com/repos/${settings.repo}/contents/${encodeURI(settings.path || 'data.js')}`
        + (method === 'GET' ? `?ref=${encodeURIComponent(settings.branch || 'main')}` : '');
    const headers = {
        Authorization: `Bearer ${settings.token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
        res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) {
        throw new Error('connexion à GitHub impossible (vérifiez votre connexion Internet).');
    }
    if (raw) return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : '' };
    let json = null;
    try { json = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, json };
}

// Lit data.js tel qu'il est sur GitHub (et pas la copie éventuellement en cache du site)
async function githubGetFile(settings) {
    const res = await githubFetch(settings, 'GET');
    if (!res.ok) throw new Error(githubErrorMessage(res.status, res.json));
    const info = res.json || {};
    let text;
    if (info.content && info.encoding === 'base64') {
        text = base64ToUtf8(info.content);
    } else {
        const rawRes = await githubFetch(settings, 'GET', null, true);   // fichier > 1 Mo : contenu brut
        if (!rawRes.ok) throw new Error(githubErrorMessage(rawRes.status, null));
        text = rawRes.text;
    }
    return { text, sha: info.sha };
}

// Le texte « LOCAL_GENSHIN_SOURCE » d'un data.js (même format que celui produit par l'Admin)
function extractSource(fileText) {
    const m = fileText.match(/const LOCAL_GENSHIN_SOURCE = ([\s\S]*?);\s*\nconst LOCAL_GENSHIN_DATA = LOCAL_GENSHIN_SOURCE\(\);/);
    return m ? m[1] : null;
}

const GITHUB_FORMAT_ERROR = 'le data.js sur GitHub n\'est pas au format à marqueurs (« LOCAL_GENSHIN_SOURCE »). Mettez d\'abord en ligne le data.js converti.';

// Ajoute au texte source distant les ajouts en attente qui n'y sont pas encore
function applyPendingToSource(sourceText) {
    const known = new Function('return (' + sourceText + ');')()();
    let text = sourceText;
    Object.keys(customItems).forEach(category => {
        const keys = new Set((known[category] || []).map(item => itemKey(category, item)));
        customItems[category].forEach(item => {
            if (!keys.has(itemKey(category, item))) text = insertItemIntoSource(text, category, item);
        });
    });
    return text;
}

// Lit le fichier distant, le transforme (transform reçoit le texte distant et renvoie le nouveau texte) puis l'enregistre
async function publishToGithub(settings, transform, message) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const remote = await githubGetFile(settings);
        const newText = transform(remote.text);
        const put = await githubFetch(settings, 'PUT', {
            message,
            content: utf8ToBase64(newText),
            sha: remote.sha,
            branch: settings.branch || 'main'
        });
        if (put.ok) return { sha: put.json && put.json.commit ? put.json.commit.sha : '', text: newText };
        if (put.status === 409 || put.status === 422) continue;   // fichier modifié entre-temps : on relit et on recommence
        throw new Error(githubErrorMessage(put.status, put.json));
    }
    throw new Error('le fichier a été modifié en même temps ailleurs, réessayez.');
}

async function publishAddition(item) {
    const settings = loadGithubSettings();
    try {
        const result = await publishToGithub(settings, remoteText => {
            const source = extractSource(remoteText);
            if (!source) throw new Error(GITHUB_FORMAT_ERROR);
            return wrapSourceAsFile(applyPendingToSource(source));
        }, `Ajout via l'Admin : ${item.name}`);
        showToast(`✅ « ${item.name} » publié sur GitHub${result.sha ? ' (commit ' + result.sha.slice(0, 7) + ')' : ''}. Le site se met à jour dans 1 à 2 minutes.`, false, 10000);
    } catch (e) {
        downloadDataJs();
        showToast('❌ Publication sur GitHub impossible : ' + e.message + ' Le data.js a été téléchargé à la place.', true, 15000);
    }
}

function commitNewItem(category, item) {
    const info = ADMIN_CATEGORIES[category];
    const key = itemKey(category, item);
    if (LOCAL_GENSHIN_DATA[category].some(existing => itemKey(category, existing) === key)) {
        const detail = category === 'artifacts' ? ` (${item.type || 'type inconnu'}, ${item.rarity}★)` : '';
        showToast(`❌ ${info.the} « ${item.name} »${detail} existe déjà.`, true, 4000);
        return false;
    }

    const marker = HAS_SOURCE ? findMarkerComment(sourceBaseText, category, item) : null;
    customItems[category].push(item);
    if (!rebuildDataFromSource()) LOCAL_GENSHIN_DATA[category].push(item);
    try { localStorage.setItem(CUSTOM_STORAGE_KEYS[category], JSON.stringify(customItems[category])); } catch (err) { console.error(err); }

    if (!HAS_SOURCE) {
        showToast('⚠️ « ' + item.name + ' » ajouté sur le site, mais le téléchargement est bloqué : votre data.js est à l\'ancien format et l\'export effacerait vos commentaires « //Pour Claude ». Utilisez « Convertir mon data.js » dans l\'Admin.', true, 12000);
        document.querySelector(`.tab-btn[data-tab="${category}"]`).click();
        return true;
    }
    const sync = githubReady(loadGithubSettings());
    if (!sync) downloadDataJs();
    const where = !HAS_SOURCE ? '' : marker ? ' à l\'emplacement du marqueur « //Pour Claude »' : ' en fin de liste (aucun marqueur correspondant)';
    if (sync) {
        showToast(`⏳ « ${item.name} » ajouté${where}. Publication sur GitHub en cours…`, false, 3000);
        publishAddition(item);
    } else {
        showToast(`✅ « ${item.name} » ajouté${where} ! Remplacez votre ancien data.js par le fichier téléchargé.`, false, 8000);
    }
    document.querySelector(`.tab-btn[data-tab="${category}"]`).click();
    return true;
}

// --- ÉDITEUR DE COULEUR (à la Word) + APERÇU ---
const ADMIN_COLOR_PRESETS = [
    ['#ffa500', 'Orange (titres)'],
    ['#f5a0a0', 'Rose (dégâts élémentaires)']
];
let adminActiveTextarea = null;

// Entrée = retour à la ligne (converti en <br>, sans doubler un <br> déjà tapé en fin de ligne)
function newlinesToBr(value) {
    return value
        .replace(/(<br\s*\/?>)[ \t]*\r?\n/gi, '$1')
        .replace(/\r?\n/g, '<br>');
}

function stripColorSpans(text) {
    return text.replace(/<span style=['"]color:[^>]*>/gi, '').replace(/<\/span>/gi, '');
}

function adminToolbarHtml() {
    const swatches = ADMIN_COLOR_PRESETS.map(([color, label]) =>
        `<button type="button" class="color-swatch" data-color="${color}" title="${label}" style="background:${color}"></button>`
    ).join('');
    return `
        <div class="admin-toolbar">
            <span class="admin-toolbar-label">🎨 Couleur du texte :</span>
            ${swatches}
            <label class="color-custom" title="Choisir une autre couleur">Autre
                <input type="color" id="adminColorPicker" value="#4a90e2"></label>
            <button type="button" id="adminColorClear" class="admin-btn small">✖ Retirer la couleur</button>
            <span class="admin-hint-inline">Sélectionnez du texte dans une zone de texte, puis choisissez une couleur.</span>
        </div>`;
}

// Remplace [regionStart, regionEnd[ par `replacement` (historique Ctrl+Z conservé si possible)
function replaceTextareaRegion(ta, regionStart, regionEnd, replacement, selFrom, selTo) {
    ta.focus();
    ta.setSelectionRange(regionStart, regionEnd);
    let done = false;
    try { done = document.execCommand('insertText', false, replacement); } catch (e) {}
    if (!done) ta.setRangeText(replacement, regionStart, regionEnd, 'end');
    ta.setSelectionRange(regionStart + selFrom, regionStart + selTo);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function getColorTarget() {
    const ta = adminActiveTextarea;
    if (!ta || !ta.isConnected) {
        showToast('Cliquez dans une zone de texte, puis sélectionnez le texte à colorer.', true, 3500);
        return null;
    }
    return ta;
}

// Le texte sélectionné est-il déjà entouré d'un <span style='color: …;'> ?
function findColorWrapper(ta) {
    const before = ta.value.slice(0, ta.selectionStart);
    const after = ta.value.slice(ta.selectionEnd);
    const m = before.match(/<span style='color: #[0-9a-fA-F]{3,8};'>$/);
    return (m && after.startsWith('</span>')) ? m[0] : null;
}

function applyTextColor(color) {
    const ta = getColorTarget();
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const open = `<span style='color: ${color};'>`;
    const wrapper = findColorWrapper(ta);
    if (wrapper) {
        // Déjà coloré : on change seulement la couleur
        const inner = ta.value.slice(start, end);
        replaceTextareaRegion(ta, start - wrapper.length, end + '</span>'.length, open + inner + '</span>', open.length, open.length + inner.length);
    } else {
        const inner = stripColorSpans(ta.value.slice(start, end));
        replaceTextareaRegion(ta, start, end, open + inner + '</span>', open.length, open.length + inner.length);
    }
}

function clearTextColor() {
    const ta = getColorTarget();
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const wrapper = findColorWrapper(ta);
    if (wrapper) {
        const inner = ta.value.slice(start, end);
        replaceTextareaRegion(ta, start - wrapper.length, end + '</span>'.length, inner, 0, inner.length);
    } else {
        const inner = stripColorSpans(ta.value.slice(start, end));
        replaceTextareaRegion(ta, start, end, inner, 0, inner.length);
    }
}

// Aperçu rendu sous la zone de texte (uniquement si elle contient du HTML)
function updateAdminPreview(ta) {
    let box = ta.nextElementSibling;
    if (!box || !box.classList.contains('admin-preview')) {
        box = document.createElement('div');
        box.className = 'admin-preview';
        ta.insertAdjacentElement('afterend', box);
    }
    if (!/</.test(ta.value)) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = '<span class="admin-preview-label">Aperçu</span>' + newlinesToBr(ta.value);
}

function setupAdminToolbar(form) {
    adminActiveTextarea = null;
    form.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'TEXTAREA') adminActiveTextarea = e.target;
    });
    form.addEventListener('input', (e) => {
        if (e.target.tagName === 'TEXTAREA') updateAdminPreview(e.target);
    });

    const toolbar = form.querySelector('.admin-toolbar');
    // Garde la sélection du texte quand on clique sur un bouton de la barre
    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) e.preventDefault();
    });
    toolbar.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', () => applyTextColor(btn.getAttribute('data-color')));
    });
    document.getElementById('adminColorPicker').addEventListener('change', (e) => applyTextColor(e.target.value));
    document.getElementById('adminColorClear').addEventListener('click', clearTextColor);
}

function adminStatusHtml() {
    if (HAS_SOURCE) {
        const n = countMarkers(sourceBaseText);
        return n
            ? `<p class="admin-status ok">✅ Marqueurs « //Pour Claude » actifs : ${n} détecté(s) dans data.js. Les ajouts y sont insérés automatiquement.</p>`
            : `<p class="admin-status warn">⚠️ Aucun marqueur « //Pour Claude » trouvé dans data.js : les ajouts seront placés en fin de liste.</p>`;
    }
    return `<div class="admin-status warn">
        <p>⚠️ <strong>data.js à l'ancien format</strong> : les marqueurs « //Pour Claude » ne sont pas utilisés, les ajouts vont en fin de liste, et le téléchargement est bloqué pour ne pas effacer vos commentaires.</p>
        <label class="admin-btn small primary">📂 Convertir mon data.js
            <input type="file" id="convertDataInput" accept=".js,text/javascript" style="display:none"></label>
        <span class="admin-hint-inline">Choisissez votre data.js actuel : vous récupérez une version convertie qui garde tous vos commentaires.</span>
    </div>`;
}

function adminGithubHtml() {
    const g = loadGithubSettings();
    return `
        <details class="admin-section" id="githubSection"${githubReady(g) ? ' open' : ''}>
            <summary>☁️ Publication automatique sur GitHub${githubReady(g) ? ' — activée' : ''}</summary>
            <p class="admin-hint">Quand c'est activé, chaque ajout (ou réinitialisation) met à jour data.js directement dans votre dépôt, sans téléchargement ni envoi manuel. Le site GitHub Pages se met à jour 1 à 2 minutes plus tard.<br>
            <strong>Jeton :</strong> GitHub → Settings → Developer settings → Personal access tokens → <em>Fine-grained tokens</em> → « Generate new token » : accès limité à <em>ce seul dépôt</em>, permission <em>Contents : Read and write</em>, avec une date d'expiration. Il reste uniquement dans ce navigateur (jamais dans le code ni sur GitHub).</p>
            <div class="admin-grid">
                <div class="admin-field"><label>Dépôt (pseudo/nom-du-depot) :</label><input type="text" id="ghRepo" value="${escapeHtml(g.repo || '')}" placeholder="monpseudo/mon-site" autocomplete="off"></div>
                <div class="admin-field"><label>Branche :</label><input type="text" id="ghBranch" value="${escapeHtml(g.branch || 'main')}" autocomplete="off"></div>
                <div class="admin-field"><label>Fichier :</label><input type="text" id="ghPath" value="${escapeHtml(g.path || 'data.js')}" autocomplete="off"></div>
                <div class="admin-field"><label>Jeton d'accès :</label><input type="password" id="ghToken" placeholder="${g.token ? '•••••••• (enregistré, laissez vide pour le garder)' : 'github_pat_…'}" autocomplete="new-password"></div>
            </div>
            <label class="admin-check"><input type="checkbox" id="ghEnabled"${g.enabled ? ' checked' : ''}> Publier automatiquement sur GitHub à chaque ajout / réinitialisation</label>
            <div class="admin-actions">
                <button type="button" id="ghSaveBtn" class="admin-btn primary">💾 Enregistrer</button>
                <button type="button" id="ghTestBtn" class="admin-btn">🔌 Tester la connexion</button>
                <button type="button" id="ghForgetBtn" class="admin-btn">🗑️ Oublier ces réglages</button>
            </div>
        </details>`;
}

function readGithubInputs() {
    const saved = loadGithubSettings();
    return {
        repo: document.getElementById('ghRepo').value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, ''),
        branch: document.getElementById('ghBranch').value.trim() || 'main',
        path: document.getElementById('ghPath').value.trim().replace(/^\/+/, '') || 'data.js',
        token: document.getElementById('ghToken').value.trim() || saved.token || '',
        enabled: document.getElementById('ghEnabled').checked
    };
}

function setupGithubSection(grid) {
    document.getElementById('ghSaveBtn').addEventListener('click', () => {
        const settings = readGithubInputs();
        if (settings.enabled && (!settings.repo || !settings.token)) {
            showToast('❌ Pour activer la publication, renseignez le dépôt et le jeton.', true, 5000);
            return;
        }
        saveGithubSettings(settings);
        showToast(settings.enabled ? '✅ Réglages enregistrés : la publication automatique est activée.' : '✅ Réglages enregistrés (publication automatique désactivée).', false, 4000);
        renderAdmin(grid);
    });

    document.getElementById('ghTestBtn').addEventListener('click', async () => {
        const settings = readGithubInputs();
        if (!settings.repo || !settings.token) {
            showToast('❌ Renseignez le dépôt et le jeton avant de tester.', true, 4000);
            return;
        }
        showToast('⏳ Test de la connexion…', false, 2500);
        try {
            const remote = await githubGetFile(settings);
            const source = extractSource(remote.text);
            if (!source) throw new Error(GITHUB_FORMAT_ERROR);
            const markers = countMarkers(source);
            showToast(`✅ Connexion OK : « ${settings.path} » trouvé sur ${settings.repo} (${settings.branch}), ${markers} marqueur(s) « //Pour Claude ». Pensez à cliquer sur « Enregistrer ».`, false, 9000);
        } catch (e) {
            showToast('❌ Échec : ' + e.message, true, 10000);
        }
    });

    document.getElementById('ghForgetBtn').addEventListener('click', () => {
        localStorage.removeItem(GITHUB_SETTINGS_KEY);
        showToast('🗑️ Réglages GitHub (et jeton) effacés de ce navigateur.', false, 4000);
        renderAdmin(grid);
    });

    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem(ADMIN_FLAG_KEY);
        location.reload();
    });
}

function renderAdmin(grid) {
    grid.classList.remove('talents-view');

    const formHtml = { characters: adminCharacterFormHtml, weapons: adminWeaponFormHtml, artifacts: adminArtifactFormHtml }[adminCategory]();
    const switchHtml = Object.entries(ADMIN_CATEGORIES).map(([cat, c]) =>
        `<button type="button" class="admin-switch-btn${cat === adminCategory ? ' active' : ''}" data-admin-cat="${cat}">${c.icon} ${c.switchLabel}</button>`
    ).join('');

    grid.innerHTML = `
        <div class="admin-panel">
            <div class="admin-panel-head">
                <h2>⚙️ Panneau d'Administration - Ajouter un élément</h2>
                <button type="button" id="adminLogoutBtn" class="admin-btn small" title="Masque l'onglet Admin sur ce navigateur">🔒 Quitter le mode admin</button>
            </div>
            <div class="admin-switch">${switchHtml}</div>
            ${adminStatusHtml()}
            ${githubReady(loadGithubSettings()) ? `<p class="admin-status ok">☁️ Publication automatique activée → ${escapeHtml(loadGithubSettings().repo)} (${escapeHtml(loadGithubSettings().branch || 'main')}) : plus besoin de remplacer data.js à la main.</p>` : ''}
            <p class="admin-hint">Dans les zones de texte, la touche Entrée crée un retour à la ligne (converti automatiquement en &lt;br&gt;). Le HTML reste accepté si vous préférez l'écrire à la main.</p>
            <form id="adminAddForm" class="admin-form">
                ${adminToolbarHtml()}
                ${formHtml}
                <div class="admin-actions">
                    <button type="submit" class="admin-btn primary">➕ ${ADMIN_CATEGORIES[adminCategory].saveLabel}</button>
                    <button type="button" id="downloadDataBtn" class="admin-btn">⬇️ Télécharger data.js${HAS_SOURCE ? '' : ' (sans commentaires)'}</button>
                    <button type="button" id="resetDataBtn" class="admin-btn">🔄 Réinitialiser les ajouts</button>
                </div>
                ${HAS_SOURCE ? '<p class="admin-hint">Chaque élément ajouté ici porte le commentaire « // ajouté via Admin » dans data.js. « Réinitialiser » supprime ces éléments et télécharge un data.js propre. Pour garder un élément définitivement, supprimez ce commentaire dans son ancienne ligne.</p>' : ''}
            </form>
            ${adminGithubHtml()}
        </div>
    `;

    grid.querySelectorAll('.admin-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            adminCategory = btn.getAttribute('data-admin-cat');
            renderAdmin(grid);
        });
    });

    const form = document.getElementById('adminAddForm');
    setupAdminToolbar(form);
    // Lien d'icône : se met à jour quand on tape la partie variable ou qu'on change le type
    refreshIconField(form);
    form.addEventListener('input', (e) => { if (e.target.matches('[data-key="iconPart"]')) refreshIconField(form); });
    form.addEventListener('change', (e) => { if (e.target.matches('[data-key="type"]')) refreshIconField(form); });
    const collectors = { characters: collectCharacter, weapons: collectWeapon, artifacts: collectArtifact };

    // Artéfacts : nom de set normalisé + bonus préremplis si le set existe déjà
    const setInput = form.querySelector('[data-key="set"]');
    if (setInput) {
        setInput.addEventListener('change', () => {
            const wanted = normalizeSetName(setInput.value);
            if (!wanted) return;
            setInput.value = wanted;
            const known = LOCAL_GENSHIN_DATA.artifacts.find(a => a.set === wanted && a.effect);
            const m = known && /^Set de 2 pièce\(s\) : (.*) <br>Set de 4 pièce\(s\) : (.*)$/s.exec(known.effect);
            const b2 = form.querySelector('[data-key="bonus2"]');
            const b4 = form.querySelector('[data-key="bonus4"]');
            if (m && b2 && b4) {
                if (!b2.value) b2.value = m[1];
                if (!b4.value) b4.value = m[2];
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = (key) => {
            const el = form.querySelector(`[data-key="${key}"]`);
            if (!el) return '';
            const value = el.value.trim();
            if (el.tagName !== 'TEXTAREA') return value;
            return newlinesToBr(value);
        };
        if (!val('name')) return;
        commitNewItem(adminCategory, collectors[adminCategory](val));
    });

    document.getElementById('downloadDataBtn').addEventListener('click', downloadDataJs);
    setupGithubSection(grid);

    const convertInput = document.getElementById('convertDataInput');
    if (convertInput) {
        convertInput.addEventListener('change', () => {
            if (convertInput.files[0]) handleConvertFile(convertInput.files[0]);
            convertInput.value = '';
        });
    }

    document.getElementById('resetDataBtn').addEventListener('click', async () => {
        const settings = loadGithubSettings();
        const sync = HAS_SOURCE && githubReady(settings);
        let inFile = [];
        if (sync) {
            // Avec GitHub : on lit la vraie version en ligne pour lister ce qui sera effacé
            try {
                const remote = await githubGetFile(settings);
                const source = extractSource(remote.text);
                if (!source) throw new Error(GITHUB_FORMAT_ERROR);
                inFile = findAdminItems(source);
            } catch (e) {
                showToast('❌ Lecture de GitHub impossible : ' + e.message, true, 10000);
                return;
            }
        } else if (HAS_SOURCE) {
            inFile = findAdminItems(sourceBaseText);
        }
        const pending = Object.entries(customItems).flatMap(([category, list]) => list.map(item => ({ category, name: item.name })));
        // Un élément déjà publié et encore en attente dans ce navigateur ne doit être listé qu'une fois
        const inFileKeys = new Set(inFile.map(p => p.category + '|' + p.name.toLowerCase()));
        const all = [...inFile, ...pending.filter(p => !inFileKeys.has(p.category + '|' + p.name.toLowerCase()))];
        if (!all.length) {
            showToast('ℹ️ Aucun ajout fait via l\'Admin n\'a été trouvé. (Les éléments ajoutés avec une ancienne version de l\'Admin ne sont pas repérables : supprimez leur ligne dans data.js ou restaurez votre sauvegarde.)', false, 10000);
            return;
        }
        const shown = all.slice(0, 8).map(p => '• ' + escapeHtml(p.name)).join('<br>');
        const more = all.length > 8 ? `<br>… et ${all.length - 8} autre(s)` : '';
        const note = !inFile.length ? ''
            : sync ? '<br><br>Ces éléments seront <strong>supprimés directement sur GitHub</strong> (vos marqueurs sont conservés).'
            : '<br><br>Un nouveau <strong>data.js sans ces ajouts</strong> sera téléchargé (vos marqueurs sont conservés) : il faudra remplacer votre fichier par celui-ci.';
        showConfirmBox(
            `Effacer les <strong>${all.length}</strong> élément(s) ajouté(s) via l'Admin ?<br><small>${shown}${more}${note}</small>`,
            !inFile.length ? 'Oui, effacer' : sync ? 'Oui, effacer et publier' : 'Oui, effacer et télécharger data.js',
            async () => {
                Object.values(CUSTOM_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
                Object.keys(customItems).forEach(category => { customItems[category] = []; });
                if (!inFile.length) {
                    location.reload();
                    return;
                }
                try {
                    if (sync) {
                        showToast('⏳ Suppression sur GitHub en cours…', false, 3000);
                        const result = await publishToGithub(settings, remoteText => {
                            const source = extractSource(remoteText);
                            if (!source) throw new Error(GITHUB_FORMAT_ERROR);
                            return wrapSourceAsFile(removeAdminItems(source));
                        }, 'Réinitialisation des ajouts faits via l\'Admin');
                        showToast(`✅ ${all.length} ajout(s) effacé(s) sur GitHub${result.sha ? ' (commit ' + result.sha.slice(0, 7) + ')' : ''}. Le site se met à jour dans 1 à 2 minutes.`, false, 10000);
                    }
                    sourceBaseText = removeAdminItems(sourceBaseText);
                    applyBaseText(sourceBaseText);
                    if (!sync) {
                        downloadTextFile(wrapSourceAsFile(sourceBaseText), 'data.js');
                        showToast(`✅ ${all.length} ajout(s) effacé(s). Remplacez votre data.js par le fichier téléchargé, puis faites Ctrl+F5.`, false, 10000);
                    }
                    renderAdmin(grid);
                } catch (e) {
                    console.error(e);
                    sourceBaseText = removeAdminItems(sourceBaseText);
                    applyBaseText(sourceBaseText);
                    downloadTextFile(wrapSourceAsFile(sourceBaseText), 'data.js');
                    showToast('❌ Publication sur GitHub impossible : ' + e.message + ' Le data.js nettoyé a été téléchargé à la place.', true, 15000);
                    renderAdmin(grid);
                }
            }
        );
    });
}

function render() {
    const grid = document.getElementById('mainGrid');
    if (!grid) return;
    if (currentTab === 'admin' && !isAdminMode()) currentTab = 'characters';
    const controls = document.getElementById('controlsContainer');
    if (controls) controls.style.display = (currentTab === 'admin') ? 'none' : 'flex';
    
    grid.innerHTML = '';

    // --- VUE ADMINISTRATEUR ---
    if (currentTab === 'admin') {
        renderAdmin(grid);
        return;
    }

    // --- VUES D'ORIGINE DU SITE ---
    if (currentTab === 'talents' || currentTab === 'constellations') {
        grid.classList.add('talents-view');
    } else {
        grid.classList.remove('talents-view');
    }

    let dataSource = (currentTab === 'talents' || currentTab === 'constellations') ? 'characters' : currentTab;
    if (!LOCAL_GENSHIN_DATA || !LOCAL_GENSHIN_DATA[dataSource]) return;

    let filtered = [...LOCAL_GENSHIN_DATA[dataSource]];

    // Récupération dynamique et directe de la valeur de recherche depuis le DOM
    const searchInputElem = document.getElementById('searchBox') || document.getElementById('searchInput');
    const searchQuery = searchInputElem ? searchInputElem.value.toLowerCase().trim() : '';

    if (searchQuery) {
        filtered = filtered.filter(item => item.name && item.name.toLowerCase().includes(searchQuery));
    }

    if (currentRarityFilter !== 'all') {
        filtered = filtered.filter(item => item.rarity === parseInt(currentRarityFilter));
    }

    if ((currentTab === 'characters' || currentTab === 'talents' || currentTab === 'constellations') && currentElementFilter !== 'all') {
        filtered = filtered.filter(char => {
            return getCharacterElement(char) === currentElementFilter;
        });
    }

    if (currentTab === 'weapons' && currentWeaponTypeFilter !== 'all') {
        filtered = filtered.filter(weapon => weapon.type === currentWeaponTypeFilter);
    }

    if (currentTab === 'characters' && currentWeaponTypeFilter !== 'all') {
        filtered = filtered.filter(char => char.weapon === currentWeaponTypeFilter);
    }

    if (currentTab === 'artifacts' && currentArtifactFilter !== 'all') {
        filtered = filtered.filter(artifact => artifact.type === currentArtifactFilter);
    }

    filtered.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return alphaDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = `card stars-${item.rarity || 3}`;

        if (currentTab === 'characters') {
            if (!item.name || item.name === 'Non renseigné') {
                card.style.display = 'none';
                return;
            } else {
                card.style.display = 'block';
            }
            
            const elementValue = getCharacterElement(item);
            card.innerHTML = `
                <div class="media-container">
                    <img src="${item.icon}" class="item-thumb" alt="${item.name}">
                    <span class="badge" style="background-color: var(--input-bg)">${elementValue || ''}</span>
                </div>
                <h3 style="font-size:1.1rem; margin:10px 0 5px 0;">${item.name}</h3>
                <div class="details">
                    <p style="margin:0; color:#aaa; font-size:0.9rem;">${item.weapon || ''}</p>
                    <p style="margin:5px 0 0 0; color: var(--rarity-5);">${item.rarity ? '★'.repeat(item.rarity) : ''}</p>
                </div>
            `;
            card.addEventListener('click', () => openDetails(item, 'characters'));
        } 
        else if (currentTab === 'weapons') {
            if (!item.name || item.name === 'Non renseigné') {
                card.style.display = 'none';
                return;
            } else {
                card.style.display = 'block';
            }

            card.innerHTML = `
                <div class="media-container">
                    <img src="${item.icon}" class="item-thumb" alt="${item.name}">
                    <span class="badge" style="background-color:#111">${item.type || ''}</span>
                </div>
                <h3 style="font-size:1.1rem; margin:10px 0 5px 0;">${item.name}</h3>
                <div class="details">
                    <p style="margin:5px 0 0 0; color: var(--rarity-5);">${'★'.repeat(item.rarity || 3)}</p>
                </div>
            `;
            card.addEventListener('click', () => openDetails(item, 'weapons'));
        } 
        else if (currentTab === 'talents') {
            const hasTalents = (item.normale && item.normale !== 'Non renseigné') || 
                               (item.compétence && item.compétence !== 'Non renseigné') || 
                               (item.ultime && item.ultime !== 'Non renseigné');
            
            if (!hasTalents) {
                card.style.display = 'none';
                return; 
            } else {
                card.style.display = 'block';
            }

            const elementValue = getCharacterElement(item);
            let cardHTML = `
                <div class="media-container">
                    <img src="${item.icon}" class="item-thumb" alt="${item.name}">
                    <span class="badge" style="background-color: var(--input-bg)">${elementValue || ''}</span>
                </div>
                <h3 style="font-size:1.2rem; margin:10px 0 5px 0; color: var(--primary-color);">${item.name}</h3>
            `;
            
            if (item.normale && item.normale !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">⚔️ Attaque Normale : ${item.normale}</div>
                        <p class="talent-desc">${item.desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }
            
            if (item.compétence && item.compétence !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌀 Compétence élémentaire (E) : ${item.compétence}</div>
                        <p class="talent-desc">${item.compdesc || 'Aucune description disponible.'}</p>
                        ${item.infocomp ? `<p class="talent-lore">${item.infocomp}</p>` : ''}
                    </div>
                `;
            }
            
            if (item.ultime && item.ultime !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Déchaînement élémentaire (Q) : ${item.ultime}</div>
                        <p class="talent-desc">${item.ultdesc || 'Aucune description disponible.'}</p>
                        ${item.infoult ? `<p class="talent-lore">${item.infoult}</p>` : ''}
                    </div>
                `;
            }

            if (item.élévation1 && item.élévation1 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Aptitude d'élévation n°1 : ${item.élévation1}</div>
                        <p class="talent-desc">${item.elevdesc1 || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            if (item.élévation2 && item.élévation2 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Aptitude d'élévation n°2 : ${item.élévation2}</div>
                        <p class="talent-desc">${item.elevdesc2 || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }
            
            if (item.passive1 && item.passive1 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Aptitude passive n°1 : ${item.passive1}</div>
                        <p class="talent-desc">${item.passdesc1 || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            if (item.passive2 && item.passive2 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Aptitude passive n°2 : ${item.passive2}</div>
                        <p class="talent-desc">${item.passdesc2 || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            if (item.supplémentaire && item.supplémentaire !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Aptitude supplémentaire : ${item.supplémentaire}</div>
                        <p class="talent-desc">${item.suppdesc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            card.innerHTML = cardHTML;
            card.addEventListener('click', () => openDetails(item, 'characters'));
        }

        else if (currentTab === 'constellations') {
            const hasConstellations = item.c1 && item.c1 !== 'Non renseigné';
            
            if (!hasConstellations) {
                card.style.display = 'none';
                return;
            } else {
                card.style.display = 'block';
            }

            const elementValue = getCharacterElement(item);
            let cardHTML = `
                <div class="media-container">
                    <img src="${item.icon}" class="item-thumb" alt="${item.name}">
                    <span class="badge" style="background-color: var(--input-bg)">${elementValue || ''}</span>
                </div>
                <h3 style="font-size:1.2rem; margin:10px 0 5px 0; color: var(--primary-color);">${item.name}</h3>
            `;
            
            if (item.c1 && item.c1 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.1 : ${item.c1}</div>
                        <p class="talent-desc">${item.c1desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }
            
            if (item.c2 && item.c2 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.2 : ${item.c2}</div>
                        <p class="talent-desc">${item.c2desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }
            
            if (item.c3 && item.c3 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.3 : ${item.c3}</div>
                        <p class="talent-desc">${item.c3desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            if (item.c4 && item.c4 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.4 : ${item.c4}</div>
                        <p class="talent-desc">${item.c4desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            if (item.c5 && item.c5 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.5 : ${item.c5}</div>
                        <p class="talent-desc">${item.c5desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }
            
            if (item.c6 && item.c6 !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">🌟 Constellation Niv.6 : ${item.c6}</div>
                        <p class="talent-desc">${item.c6desc || 'Aucune description disponible.'}</p>
                    </div>
                `;
            }

            card.innerHTML = cardHTML;
            card.addEventListener('click', () => openDetails(item, 'characters'));
        }

        else if (currentTab === 'artifacts') {
            if (!item.name || item.name === 'Non renseigné') {
                card.style.display = 'none';
                return;
            } else {
                card.style.display = 'block';
            }

            card.innerHTML = `
                <div class="media-container">
                    <img src="${item.icon}" class="item-thumb" alt="${item.name}">
                    <span class="badge" style="background-color:#111">${item.type || ''}</span>
                </div>
                <h3 style="font-size:1.1rem; margin:10px 0 5px 0;">${item.name}</h3>
                <div class="details">
                    <p style="margin:5px 0 0 0; color: var(--rarity-5);">${'★'.repeat(item.rarity || 3)}</p>
                </div>
            `;
            card.addEventListener('click', () => openDetails(item, 'artifacts'));
        } 
        grid.appendChild(card);
    });
}

function openDetails(item, type) {
    const modal = document.getElementById('detailsModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;

    let htmlContent = '';

    if (type === 'characters') {
        const elementValue = getCharacterElement(item);
        htmlContent = `
            <div class="modal-header">
                <img src="${item.icon}" class="modal-img">
                <div class="modal-title">
                    <h2>${item.name}</h2>
                    <p>${'★'.repeat(item.rarity || 5)} | Élément : <strong>${elementValue || 'Inconnu'}</strong> | Arme : <strong>${item.weapon || 'Inconnue'}</strong> | Élévation : <strong>${item.elevation || 'N/A'}</strong></p>
                    <p style="font-style: italic; color: #aaa;">"${item.description || ''}"</p>
                </div>
            </div>
            <div class="section-title">📊 Fiche d'Identité</div>
            <div class="substat-grid">
                <div><strong>Région :</strong> ${item.nation || 'Inconnue'}</div>
                <div><strong>Affiliation :</strong> ${item.affiliation || 'Aucune'}</div>
                <div><strong>Constellation :</strong> ${item.constellation || 'Inconnue'}</div>
                <div><strong>Anniversaire :</strong> ${item.anniversaire || 'Inconnu'}</div>
            </div>
        `;
    } else if (type === 'weapons') {
        htmlContent = `
            <div class="modal-header">
                <img src="${item.icon}" class="modal-img">
                <div class="modal-title">
                    <h2>${item.name}</h2>
                    <p>${'★'.repeat(item.rarity || 3)} | Catégorie : <strong>${item.type || 'Inconnue'}</strong> | Stat. principale : <strong>${item.main || 'N/A'}</strong> | Stat. secondaire : <strong>${item.sub || 'N/A'}</strong></p>
                </div>
            </div>
            <div class="section-title">📊 Propriétés Légendaires</div>
            <div class="substat-grid">
                <div><strong>Rareté :</strong> ${item.rarity || 3} Étoiles</div>
                <div><strong>Disponibilité :</strong> ${item.obtention || 'Inconnue'}</div>
            </div>
            <div class="section-title">📊 Description</div>
            <div class="substat-grid">
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;" class="weapon-effect-box">
                    <div class="talent-name">${item.names || 'Non renseigné'}</div>
                    <p class="talent-desc">${item.effect || 'Aucune description disponible.'}</p>
                    <p style="font-style: italic; color: #aaa;">"${item.description || ''}"</p>
                </div>
            </div>
        `;
    } else {
        htmlContent = `
            <div class="modal-header">
                <img src="${item.icon}" class="modal-img">
                <div class="modal-title">
                    <h2>${item.name}</h2>
                    <p>${'★'.repeat(item.rarity || 3)} | Catégorie : <strong>${item.type || 'Inconnue'}</strong></p>
                </div>
            </div>
            <div class="section-title">📊 Propriétés Légendaires</div>
            <div class="substat-grid">
                <div><strong>Rareté :</strong> ${item.rarity || 3} Étoiles</div>
                <div><strong>Disponibilité :</strong> ${item.obtention || 'Inconnue'}</div>
            </div>
            <div class="section-title">📊 Description</div>
            <div class="substat-grid">
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;" class="weapon-effect-box">
                    <div class="talent-name">${item.set || 'Non renseigné'}</div>
                    <p class="talent-desc">${item.effect || 'Aucune description disponible.'}</p>
                    <p style="font-style: italic; color: #aaa;">"${item.description || ''}"</p>
                </div>
            </div>
        `;
    }

    body.innerHTML = htmlContent;
    modal.classList.add('open');
}

function resetFilters() {
    currentElementFilter = 'all';
    currentWeaponTypeFilter = 'all';
    currentRarityFilter = 'all';
    currentArtifactFilter = 'all';
    const searchBox = document.getElementById('searchBox') || document.getElementById('searchInput');
    if (searchBox) searchBox.value = '';

    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.getAttribute('data-element') === 'all' || 
            btn.getAttribute('data-weapon-type') === 'all' || 
            btn.getAttribute('data-artifact-type') === 'all' || 
            btn.getAttribute('data-rarity') === 'all') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setupControls() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.getAttribute('data-tab');
            
            const elemFilters = document.getElementById('elementFilters');
            const weaponFilters = document.getElementById('weaponTypeFilters');
            const artFilters = document.getElementById('ArtifactFilter');
            const btnRarity3 = document.getElementById('btnRarity3');

            if (currentTab === 'characters' || currentTab === 'talents' || currentTab === 'constellations') {
                if (elemFilters) elemFilters.style.display = 'flex';
                if (weaponFilters) weaponFilters.style.display = (currentTab === 'characters') ? 'flex' : 'none';
                if (artFilters) artFilters.style.display = 'none';    
            } else if (currentTab === 'weapons') {
                if (elemFilters) elemFilters.style.display = 'none';
                if (weaponFilters) weaponFilters.style.display = 'flex';
                if (artFilters) artFilters.style.display = 'none';
            } else if (currentTab === 'artifacts') {
                if (elemFilters) elemFilters.style.display = 'none';
                if (weaponFilters) weaponFilters.style.display = 'none';
                if (artFilters) artFilters.style.display = 'flex';
            } else if (currentTab === 'admin') {
                if (elemFilters) elemFilters.style.display = 'none';
                if (weaponFilters) weaponFilters.style.display = 'none';
                if (artFilters) artFilters.style.display = 'none';
            } else {
                if (elemFilters) elemFilters.style.display = 'none';
                if (weaponFilters) weaponFilters.style.display = 'none';
                if (artFilters) artFilters.style.display = 'none';
            }                    

            if (btnRarity3) {
                if (currentTab === 'weapons') {
                    btnRarity3.style.display = 'inline-block';
                } else {
                    btnRarity3.style.display = 'none';
                }
            }
            
            resetFilters();
            render();
        });
    });

    // Écouteur de recherche robuste (gère searchBox et searchInput)
    const searchBox = document.getElementById('searchBox') || document.getElementById('searchInput');
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            render();
        });
    }

    const sortAlphaBtn = document.getElementById('sortAlphaBtn');
    if (sortAlphaBtn) {
        sortAlphaBtn.addEventListener('click', () => {
            alphaDirection = (alphaDirection === 'asc') ? 'desc' : 'asc';
            sortAlphaBtn.innerText = `Tri : ${alphaDirection === 'asc' ? 'A-Z' : 'Z-A'}`;
            render();
        });
    }

    document.querySelectorAll('#rarityFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#rarityFilters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentRarityFilter = e.target.getAttribute('data-rarity');
            render();
        });
    });

    document.querySelectorAll('#elementFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#elementFilters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentElementFilter = e.target.getAttribute('data-element');
            render();
        });
    });

    document.querySelectorAll('#weaponTypeFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#weaponTypeFilters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentWeaponTypeFilter = e.target.getAttribute('data-weapon-type');
            render();
        });
    });

    document.querySelectorAll('#ArtifactFilter .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#ArtifactFilter .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentArtifactFilter = e.target.getAttribute('data-artifact-type');
            render();
        });
    });

    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            const modal = document.getElementById('detailsModal');
            if (modal) modal.classList.remove('open');
        });
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailsModal');
        if (modal && e.target === modal) modal.classList.remove('open');
    });
}

// Initialisation sécurisée
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupControls();
        render();
    });
} else {
    setupControls();
    render();
}