// --- RESTAURATION DES AJOUTS FAITS VIA L'ADMIN (personnages, armes, artéfacts) ---
// Les ajouts sont gardés dans le navigateur tant que data.js n'a pas été remplacé par la
// version téléchargée. Dès qu'un élément est présent dans data.js, il est retiré de la
// sauvegarde du navigateur (pas de doublon).
// Chaque ligne ajoutée par l'Admin porte ce commentaire : « Réinitialiser » peut alors la retrouver.
// (Défini ici, avant le chargement des ajouts en attente, qui s'en sert dès le démarrage.)
const ADMIN_TAG = '// ajouté via Admin';
const ADMIN_TAG_RE = /[ \t]*\/\/[ \t]*ajouté via Admin[ \t]*$/;

const CUSTOM_STORAGE_KEYS = {
    characters: 'genshin_custom_chars',
    weapons: 'genshin_custom_weapons',
    artifacts: 'genshin_custom_artifacts'
};

// Noms portés par plusieurs personnages (Aether et Lumine : un par élément) : pour eux, l'identité inclut l'élément.
const characterDuplicateNames = new Set();
function refreshDuplicateNames(data) {
    characterDuplicateNames.clear();
    const count = {};
    ((data && data.characters) || []).forEach(item => {
        const name = (item.name || '').trim().toLowerCase();
        count[name] = (count[name] || 0) + 1;
    });
    Object.entries(count).forEach(([name, n]) => { if (n > 1) characterDuplicateNames.add(name); });
}

// Clé d'identité : un artéfact existe en 4★ et en 5★ avec le même nom, donc nom + type + rareté ;
// les 7 « Aether » (et 7 « Lumine ») se distinguent par leur élément.
function itemKey(category, item) {
    const name = (item.name || '').trim().toLowerCase();
    if (category === 'artifacts') return [name, (item.type || '').trim().toLowerCase(), item.rarity].join('|');
    if (category === 'characters' && characterDuplicateNames.has(name)) return name + '|' + String(getCharacterElement(item) || '').trim().toLowerCase();
    return name;
}

// Nom affiché dans les listes : « Aether (Cryo) » quand plusieurs personnages portent le même nom
function displayName(category, item) {
    const name = item.name || '';
    if (category === 'characters' && characterDuplicateNames.has(name.trim().toLowerCase())) {
        const element = getCharacterElement(item);
        return element ? `${name} (${element})` : name;
    }
    return name;
}

if (typeof LOCAL_GENSHIN_DATA !== 'undefined') refreshDuplicateNames(LOCAL_GENSHIN_DATA);

// data.js au nouveau format : « const LOCAL_GENSHIN_SOURCE = () => ({ ... }) ». Son texte (commentaires
// « //Pour Claude » compris) est lisible avec .toString(), ce qui permet d'insérer les ajouts aux marqueurs.
const HAS_SOURCE = typeof LOCAL_GENSHIN_SOURCE === 'function';
// Texte de data.js servant de base (remplacé après une réinitialisation, avant que le fichier soit remplacé)
let sourceBaseText = HAS_SOURCE ? LOCAL_GENSHIN_SOURCE.toString() : '';
// Texte de data.js tel qu'il a été chargé (sert à savoir si le fichier en ligne est plus récent)
let loadedSourceText = sourceBaseText;

const customItems = { characters: [], weapons: [], artifacts: [] };

// Modifications en attente d'éléments DÉJÀ présents dans data.js : { originalKey, item }
const CUSTOM_EDITS_KEY = 'genshin_custom_edits';
const customEdits = { characters: [], weapons: [], artifacts: [] };

// Deux éléments identiques (l'ordre des clés n'a pas d'importance)
// Ajouts en attente que vous avez choisi de garder définitivement : insérés SANS l'étiquette « ajouté via Admin »
const CUSTOM_KEEP_KEY = 'genshin_custom_keep';
const customKeep = new Set();
function saveCustomKeep() {
    try {
        if (customKeep.size) localStorage.setItem(CUSTOM_KEEP_KEY, JSON.stringify([...customKeep]));
        else localStorage.removeItem(CUSTOM_KEEP_KEY);
    } catch (e) {}
}

// Décisions « garder définitivement » / « effacer » prises sur des éléments DÉJÀ dans data.js.
// Elles restent appliquées après actualisation tant que le data.js chargé (copie locale pas encore remplacée,
// cache de GitHub Pages…) ne les reflète pas : sans cela, l'ancienne copie ferait « revenir » les éléments.
const CUSTOM_FILEOPS_KEY = 'genshin_custom_fileops';
const customFileOps = { untag: new Set(), remove: new Set() };
function saveCustomFileOps() {
    try {
        if (customFileOps.untag.size || customFileOps.remove.size) {
            localStorage.setItem(CUSTOM_FILEOPS_KEY, JSON.stringify({ untag: [...customFileOps.untag], remove: [...customFileOps.remove] }));
        } else {
            localStorage.removeItem(CUSTOM_FILEOPS_KEY);
        }
    } catch (e) {}
}
function applyFileOps(text) {
    return untagAdminItems(removeAdminItems(text, customFileOps.remove), customFileOps.untag);
}

// Suivi des changements en attente déjà publiés sur GitHub (pour dire clairement ce qui n'est visible que chez vous)
const CUSTOM_PUBLISHED_KEY = 'genshin_custom_published';
const customPublished = new Set();
let publishing = false;
function saveCustomPublished() {
    try {
        if (customPublished.size) localStorage.setItem(CUSTOM_PUBLISHED_KEY, JSON.stringify([...customPublished]));
        else localStorage.removeItem(CUSTOM_PUBLISHED_KEY);
    } catch (e) {}
}

// Signature d'un changement : change si son contenu change (une nouvelle modification = à republier)
function changeSignature(kind, category, item) {
    const json = JSON.stringify(Object.keys(item).sort().map(k => [k, item[k]]));
    let hash = 5381;
    for (let i = 0; i < json.length; i++) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
    return `${kind}|${category}|${itemKey(category, item)}|${hash}`;
}

function listPendingChanges() {
    const list = [];
    Object.keys(customItems).forEach(category => customItems[category].forEach(item =>
        list.push({ kind: 'add', category, name: displayName(category, item), key: itemKey(category, item), item, sig: changeSignature('add', category, item) })));
    Object.keys(customEdits).forEach(category => customEdits[category].forEach(edit =>
        list.push({ kind: 'edit', category, name: displayName(category, edit.item), key: itemKey(category, edit.item), item: edit.item, sig: changeSignature('edit', category, edit.item) })));
    return list;
}

function markPendingPublished(includeEdits) {
    listPendingChanges().forEach(change => { if (change.kind === 'add' || includeEdits) customPublished.add(change.sig); });
    saveCustomPublished();
}

// Une modification en attente créée avant ce correctif pointe sur « aether » (ambigu) : on retrouve la bonne variante
function migrateLegacyEdit(category, edit) {
    if (category !== 'characters' || !edit || !edit.item || typeof edit.originalKey !== 'string') return edit;
    if (edit.originalKey.includes('|') || !characterDuplicateNames.has(edit.originalKey)) return edit;
    const element = String(getCharacterElement(edit.item) || '').trim().toLowerCase();
    const candidates = (LOCAL_GENSHIN_DATA.characters || []).filter(item => (item.name || '').trim().toLowerCase() === edit.originalKey);
    const chosen = candidates.find(item => String(getCharacterElement(item) || '').trim().toLowerCase() === element) || candidates[0];
    return chosen ? Object.assign({}, edit, { originalKey: itemKey('characters', chosen) }) : edit;
}

function sameItem(a, b) {
    const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
    return norm(a) === norm(b);
}

function saveCustomEdits() {
    try {
        if (Object.values(customEdits).some(list => list.length)) localStorage.setItem(CUSTOM_EDITS_KEY, JSON.stringify(customEdits));
        else localStorage.removeItem(CUSTOM_EDITS_KEY);
    } catch (e) {}
}
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
    // Ajouts gardés définitivement : on ne conserve que ceux qui sont encore en attente
    let savedKeep = [];
    try { savedKeep = JSON.parse(localStorage.getItem(CUSTOM_KEEP_KEY)) || []; } catch (e) {}
    const pendingKeys = new Set();
    Object.keys(customItems).forEach(category => customItems[category].forEach(item => pendingKeys.add(category + '|' + itemKey(category, item))));
    savedKeep.filter(key => pendingKeys.has(key)).forEach(key => customKeep.add(key));
    saveCustomKeep();

    if (HAS_SOURCE) {
        // Décisions « garder » / « effacer » : conservées tant que l'élément est encore étiqueté dans le data.js chargé
        let savedOps = {};
        try { savedOps = JSON.parse(localStorage.getItem(CUSTOM_FILEOPS_KEY)) || {}; } catch (e) {}
        const taggedNow = new Set(scanAdminLines(sourceBaseText).found.map(f => f.category + '|' + f.key));
        (savedOps.untag || []).filter(key => taggedNow.has(key)).forEach(key => customFileOps.untag.add(key));
        (savedOps.remove || []).filter(key => taggedNow.has(key)).forEach(key => customFileOps.remove.add(key));
        saveCustomFileOps();
        if (customFileOps.untag.size || customFileOps.remove.size) sourceBaseText = applyFileOps(sourceBaseText);
    }

    if (HAS_SOURCE) {
        // Modifications en attente : on retire celles que data.js contient déjà
        let savedEdits = {};
        try { savedEdits = JSON.parse(localStorage.getItem(CUSTOM_EDITS_KEY)) || {}; } catch (e) {}
        Object.keys(customEdits).forEach(category => {
            const baseMap = new Map((LOCAL_GENSHIN_DATA[category] || []).map(item => [itemKey(category, item), item]));
            customEdits[category] = (savedEdits[category] || []).map(edit => migrateLegacyEdit(category, edit)).filter(edit => {
                if (!edit || !edit.item || !edit.item.name) return false;
                const current = baseMap.get(itemKey(category, edit.item));
                return !(current && sameItem(current, edit.item));
            });
        });
        saveCustomEdits();
    }
    if (HAS_SOURCE) {
        let savedPublished = [];
        try { savedPublished = JSON.parse(localStorage.getItem(CUSTOM_PUBLISHED_KEY)) || []; } catch (e) {}
        const currentSigs = new Set(listPendingChanges().map(change => change.sig));
        savedPublished.filter(sig => currentSigs.has(sig)).forEach(sig => customPublished.add(sig));
        saveCustomPublished();
    }
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
const ADMIN_SECRET_CODE = 'changez-moi';   // ← remplacez par votre propre code
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

// Boîte de choix : on coche les éléments, puis on les efface ou on les garde définitivement
function showResetDialog(entries, noteHtml, onChoose) {
    const stateLabel = e => e.edit ? (e.published ? 'modification déjà publiée' : 'modification en attente') + (e.kept ? ', gardée définitivement' : '') : e.state === 'pending' ? (e.kept ? 'en attente, gardé définitivement' : 'en attente, pas encore publié') : 'déjà enregistré dans data.js';
    const keptCount = entries.filter(e => e.kept).length;
    const visibleCount = entries.length - keptCount;
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `<div class="confirm-box reset-box">
        <p><strong>Éléments ajoutés ou modifiés via l'Admin</strong><br><small>Cochez ceux qui vous intéressent (rien n'est coché par défaut). Ceux que vous avez déjà gardés définitivement sont masqués.</small></p>
        <div class="reset-tools">
            <button type="button" class="admin-btn small" data-act="all">Tout cocher</button>
            <button type="button" class="admin-btn small" data-act="none">Tout décocher</button>
            ${keptCount ? `<button type="button" class="admin-btn small" data-act="toggle-kept">Afficher les ${keptCount} déjà gardé(s)</button>` : ''}
        </div>
        ${visibleCount ? '' : '<p class="reset-empty"><small>Rien à réinitialiser : tout ce qui a été ajouté ou modifié est déjà validé.</small></p>'}
        <div class="reset-list">${entries.map((e, i) => `<label class="reset-item${e.kept ? ' reset-kept' : ''}">
            <input type="checkbox" data-idx="${i}"><span>${e.edit ? '✏️ ' : ''}${escapeHtml(e.name)}</span>
            <small>${escapeHtml(ADMIN_CATEGORIES[e.category].switchLabel)} · ${stateLabel(e)}</small></label>`).join('')}</div>
        <p class="reset-note"><small>🗑️ <strong>Effacer</strong> : supprime l'ajout, ou annule la modification (l'élément reprend sa version d'origine).<br>
        ✅ <strong>Garder définitivement</strong> : valide l'ajout (l'étiquette « ajouté via Admin » est retirée) ou la modification ; « Réinitialiser » ne la touchera plus.${noteHtml}</small></p>
        <div class="confirm-actions reset-actions">
            <button type="button" class="admin-btn primary" data-act="erase" disabled>🗑️ Effacer les éléments cochés</button>
            <button type="button" class="admin-btn" data-act="keep" disabled>✅ Garder définitivement</button>
            <button type="button" class="admin-btn" data-act="cancel">Annuler</button>
        </div></div>`;
    const boxes = () => [...overlay.querySelectorAll('input[type="checkbox"]')];
    const isShown = c => overlay.classList.contains('show-kept') || !c.closest('.reset-item').classList.contains('reset-kept');
    const selected = () => boxes().filter(c => c.checked && isShown(c)).map(c => entries[Number(c.getAttribute('data-idx'))]);
    const refresh = () => {
        const chosen = selected();
        const eraseBtn = overlay.querySelector('[data-act="erase"]');
        const keepBtn = overlay.querySelector('[data-act="keep"]');
        eraseBtn.disabled = !chosen.length;
        eraseBtn.textContent = chosen.length ? `🗑️ Effacer les ${chosen.length} élément(s) coché(s)` : '🗑️ Effacer les éléments cochés';
        const keepable = chosen.filter(e => !e.kept);
        keepBtn.disabled = !keepable.length;
        keepBtn.textContent = keepable.length ? `✅ Garder définitivement (${keepable.length})` : '✅ Garder définitivement';
    };
    overlay.addEventListener('change', refresh);
    overlay.addEventListener('click', (e) => {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'all' || act === 'none') { boxes().filter(isShown).forEach(c => { c.checked = act === 'all'; }); refresh(); }
        else if (act === 'toggle-kept') {
            const on = overlay.classList.toggle('show-kept');
            e.target.textContent = on ? `Masquer les ${keptCount} déjà gardé(s)` : `Afficher les ${keptCount} déjà gardé(s)`;
            if (!on) boxes().filter(c => !isShown(c)).forEach(c => { c.checked = false; });
            refresh();
        }
        else if (act === 'erase' || act === 'keep') { const chosen = selected(); overlay.remove(); onChoose(act, chosen); }
        else if (act === 'cancel' || e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
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


// Éléments marqués « ajouté via Admin » dans un texte source
// Lignes étiquetées « ajouté via Admin » : position, catégorie, nom et clé d'identité exacte
function scanAdminLines(text) {
    const lines = text.split(/\r?\n/);
    const found = [];
    let category = null;
    lines.forEach((line, index) => {
        const start = line.match(/^\s*(characters|weapons|artifacts)\s*:\s*\[/);
        if (start) { category = start[1]; return; }
        if (!category || !ADMIN_TAG_RE.test(line)) return;
        let item = null;
        const m = line.match(/^(\s*)(\{.*\})(\s*,?)((?:\s*\/\/.*)?)\s*$/);
        if (m) { try { item = new Function('return (' + m[2] + ');')(); } catch (e) {} }
        const name = item && item.name ? String(item.name) : '(sans nom)';
        found.push({ index, category, name, display: item ? displayName(category, item) : name, key: item ? itemKey(category, item) : name.trim().toLowerCase() });
    });
    return { lines, found };
}

function findAdminItems(text) {
    return scanAdminLines(text).found.map(({ category, name, display, key }) => ({ category, name: display || name, key }));
}

// keys : ensemble de « catégorie|clé » à traiter (sans argument : toutes les lignes étiquetées)
function removeAdminItems(text, keys) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const { lines, found } = scanAdminLines(text);
    const drop = new Set(found.filter(f => !keys || keys.has(f.category + '|' + f.key)).map(f => f.index));
    return lines.filter((_, i) => !drop.has(i)).join(eol);
}

// Garde définitivement : retire seulement le commentaire d'étiquette, la ligne reste
function untagAdminItems(text, keys) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const { lines, found } = scanAdminLines(text);
    found.filter(f => !keys || keys.has(f.category + '|' + f.key)).forEach(f => { lines[f.index] = lines[f.index].replace(ADMIN_TAG_RE, ''); });
    return lines.join(eol);
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
    const kept = customKeep.has(category + '|' + itemKey(category, item));
    lines.splice(spot.index, 0, spot.indent + serializeItem(item) + (kept ? ',' : ', ' + ADMIN_TAG));
    return lines.join(eol);
}

function findMarkerComment(text, category, item) {
    const spot = locateInsertion(text.split(/\r?\n/), category, item);
    return spot ? spot.marker : null;
}

// Texte de data.js d'origine + tous les ajouts en attente, chacun inséré à son marqueur
// Ligne d'un élément (repéré par sa clé d'identité) dans le tableau d'une catégorie
function findItemLine(lines, category, key) {
    const start = lines.findIndex(l => new RegExp(`^\\s*${category}\\s*:\\s*\\[`).test(l));
    if (start === -1) return null;
    const wantedName = key.split('|')[0];
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*\]\s*,?\s*$/.test(line)) break;
        const m = line.match(/^(\s*)(\{.*\})(\s*,?)((?:\s*\/\/.*)?)\s*$/);
        if (!m) continue;
        const nameMatch = m[2].match(/^\{\s*name:\s*("(?:[^"\\]|\\.)*")/);
        if (!nameMatch) continue;
        let name;
        try { name = new Function('return ' + nameMatch[1])(); } catch (e) { continue; }
        if (String(name).trim().toLowerCase() !== wantedName) continue;
        let item;
        try { item = new Function('return (' + m[2] + ');')(); } catch (e) { continue; }
        if (itemKey(category, item) === key) return { index: i, indent: m[1], comment: m[4] || '', item };
    }
    return null;
}

// Remplace la ligne d'un élément en gardant sa place, son indentation et son éventuel commentaire de fin
function replaceItemInSource(text, category, originalKey, newItem) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const found = findItemLine(lines, category, originalKey);
    if (!found) return null;
    lines[found.index] = found.indent + serializeItem(newItem) + ',' + found.comment;
    return lines.join(eol);
}

// Applique les modifications en attente à un texte source (stats : compteurs facultatifs)
function applyEditsToSource(text, stats) {
    Object.keys(customEdits).forEach(category => {
        customEdits[category].forEach(edit => {
            const lines = text.split(/\r?\n/);
            const located = findItemLine(lines, category, edit.originalKey) || findItemLine(lines, category, itemKey(category, edit.item));
            if (!located) { if (stats) stats.skipped++; return; }
            if (sameItem(located.item, edit.item)) return;   // déjà appliquée
            const replaced = replaceItemInSource(text, category, itemKey(category, located.item), edit.item);
            if (replaced) { text = replaced; if (stats) stats.edited++; }
        });
    });
    return text;
}

// Annule des modifications déjà présentes dans un texte source : l'élément reprend sa version d'origine.
// Si la version du texte a changé depuis (modifiée ailleurs), on n'y touche pas.
function revertEditsInSource(text, reverts) {
    const base = getBaseData();
    reverts.forEach(({ category, edit }) => {
        const original = (base[category] || []).find(item => itemKey(category, item) === edit.originalKey);
        if (!original) return;
        const located = findItemLine(text.split(/\r?\n/), category, itemKey(category, edit.item));
        if (!located || !sameItem(located.item, edit.item)) return;
        const replaced = replaceItemInSource(text, category, itemKey(category, edit.item), original);
        if (replaced) text = replaced;
    });
    return text;
}

// Données d'origine (sans aucune modification en attente), pour comparer
let baseDataCache = { text: null, data: null };
function getBaseData() {
    if (baseDataCache.text !== sourceBaseText) {
        baseDataCache = { text: sourceBaseText, data: new Function('return (' + sourceBaseText + ');')()() };
    }
    return baseDataCache.data;
}

function hasPendingChanges() {
    return Object.values(customItems).some(list => list.length) || Object.values(customEdits).some(list => list.length)
        || customFileOps.untag.size > 0 || customFileOps.remove.size > 0;
}

function buildSourceText() {
    let text = applyEditsToSource(sourceBaseText);
    Object.keys(customItems).forEach(category => {
        customItems[category].forEach(item => { text = insertItemIntoSource(text, category, item); });
    });
    return text;
}

// Recharge les données en mémoire depuis ce texte : l'ordre affiché = l'ordre du futur data.js
function rebuildDataFromSource(force = false) {
    if (!HAS_SOURCE) return false;
    if (!force && !hasPendingChanges()) return true;
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
let adminMode = 'add';          // 'add' (ajouter) ou 'edit' (modifier un élément existant)
let adminEditTarget = null;     // élément en cours de modification
let adminEditCtx = null;        // valeurs d'origine du formulaire de modification

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
    const v = (value || '').trim();
    if (!v) return '';
    if (/:\s*$/.test(v)) return v.replace(/\s*:\s*$/, ' :');   // « Nom : » (forme de data.js)
    if (v.includes(':')) return v;                              // déjà un « : » dans le nom : on n'y touche pas
    return v + ' :';
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
        effect: parts.length ? parts.join(' <br>') : ((val.original && val.original.effect) || ''),
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

// Applique au texte source distant les modifications puis les ajouts en attente qui n'y sont pas encore
function applyPendingToSource(sourceText, stats) {
    const afterOps = applyFileOps(sourceText);
    const known = new Function('return (' + afterOps + ');')()();
    let text = applyEditsToSource(afterOps, stats);
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

async function publishPending(commitMessage, label, verb = 'publié') {
    const settings = loadGithubSettings();
    const stats = { edited: 0, skipped: 0 };
    publishing = true;
    renderSyncBanner();
    try {
        const result = await publishToGithub(settings, remoteText => {
            stats.edited = 0; stats.skipped = 0;   // la transformation peut être rejouée après un conflit
            const source = extractSource(remoteText);
            if (!source) throw new Error(GITHUB_FORMAT_ERROR);
            return wrapSourceAsFile(applyPendingToSource(source, stats));
        }, commitMessage);
        markPendingPublished(stats.skipped === 0);   // si une modification a été ignorée, elle n'est pas publiée
        const warn = stats.skipped ? ` ⚠️ ${stats.skipped} modification(s) ignorée(s) : élément introuvable sur GitHub.` : '';
        showToast(`✅ ${label} ${verb} sur GitHub${result.sha ? ' (commit ' + result.sha.slice(0, 7) + ')' : ''}. Le site se met à jour dans 1 à 2 minutes.${warn}`, false, 10000);
    } catch (e) {
        downloadDataJs();
        showToast('❌ Publication sur GitHub impossible : ' + e.message + ' Le data.js a été téléchargé à la place.', true, 15000);
    } finally {
        publishing = false;
        renderSyncBanner();
    }
}

// Publie tous les changements en attente (bouton du bandeau)
async function publishNow() {
    if (!githubReady(loadGithubSettings())) {
        showToast('❌ La publication automatique n\'est pas activée dans ce navigateur : renseignez le dépôt et le jeton dans « ☁️ Publication automatique sur GitHub ».', true, 8000);
        return;
    }
    showToast('⏳ Publication sur GitHub en cours…', false, 3000);
    await publishPending('Publication des changements en attente via l\'Admin', 'Les changements en attente', 'publiés');
}

async function publishAddition(item) {
    return publishPending(`Ajout via l'Admin : ${item.name}`, `« ${item.name} »`);
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

// Enregistre la modification d'un élément déjà présent (ou ajouté mais pas encore publié)
function commitEditedItem(category, original, newItem) {
    const info = ADMIN_CATEGORIES[category];
    const origKey = itemKey(category, original);
    const newKey = itemKey(category, newItem);
    if (newKey !== origKey && LOCAL_GENSHIN_DATA[category].some(existing => itemKey(category, existing) === newKey)) {
        showToast(`❌ ${info.the} « ${newItem.name} » existe déjà : choisissez un autre nom.`, true, 5000);
        return false;
    }
    if (sameItem(original, newItem)) {
        showToast('ℹ️ Aucune modification à enregistrer.', false, 3500);
        return false;
    }

    const pendingIndex = customItems[category].findIndex(item => itemKey(category, item) === origKey);
    if (pendingIndex >= 0) {
        // Élément ajouté via l'Admin mais pas encore dans data.js : on met simplement à jour l'ajout
        customItems[category][pendingIndex] = newItem;
        try { localStorage.setItem(CUSTOM_STORAGE_KEYS[category], JSON.stringify(customItems[category])); } catch (err) { console.error(err); }
    } else {
        const edits = customEdits[category];
        const index = edits.findIndex(edit => itemKey(category, edit.item) === origKey);
        const baseKey = index >= 0 ? edits[index].originalKey : origKey;
        const baseItem = (getBaseData()[category] || []).find(item => itemKey(category, item) === baseKey);
        if (baseItem && sameItem(baseItem, newItem)) {
            if (index >= 0) edits.splice(index, 1);                       // retour à la version d'origine
        } else if (index >= 0) {
            edits[index] = { originalKey: baseKey, item: newItem };
        } else {
            edits.push({ originalKey: baseKey, item: newItem });
        }
        saveCustomEdits();
    }

    if (!rebuildDataFromSource(true)) {
        showToast('❌ Modification impossible : data.js n\'a pas pu être relu correctement.', true, 6000);
        return false;
    }
    const tab = document.querySelector(`.tab-btn[data-tab="${category}"]`);
    if (!hasPendingChanges()) {
        showToast(`ℹ️ « ${newItem.name} » est revenu à sa version d'origine : rien à enregistrer.`, false, 5000);
        if (tab) tab.click();
        return true;
    }
    const sync = githubReady(loadGithubSettings());
    if (sync) {
        showToast(`⏳ « ${newItem.name} » modifié. Publication sur GitHub en cours…`, false, 3000);
        publishPending(`Modification via l'Admin : ${newItem.name}`, `« ${newItem.name} »`, 'modifié et publié');
    } else {
        downloadDataJs();
        showToast(`✅ « ${newItem.name} » modifié ! Remplacez votre ancien data.js par le fichier téléchargé.`, false, 8000);
    }
    if (tab) tab.click();
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

// Styles de texte : gras, italique, souligné, barré
const ADMIN_TEXT_STYLES = [
    { tag: 'b', label: 'B', title: 'Gras (Ctrl+B)', css: 'font-weight:bold' },
    { tag: 'i', label: 'I', title: 'Italique (Ctrl+I)', css: 'font-style:italic' },
    { tag: 'u', label: 'U', title: 'Souligné (Ctrl+U)', css: 'text-decoration:underline' },
    { tag: 's', label: 'S', title: 'Barré', css: 'text-decoration:line-through' }
];

function adminToolbarHtml() {
    const styleButtons = ADMIN_TEXT_STYLES.map(st =>
        `<button type="button" class="style-btn" data-style="${st.tag}" title="${st.title}" style="${st.css}">${st.label}</button>`
    ).join('');
    const swatches = ADMIN_COLOR_PRESETS.map(([color, label]) =>
        `<button type="button" class="color-swatch" data-color="${color}" title="${label}" style="background:${color}"></button>`
    ).join('');
    return `
        <div class="admin-toolbar">
            <span class="admin-toolbar-label">✍️ Style :</span>
            ${styleButtons}
            <span class="admin-toolbar-sep"></span>
            <span class="admin-toolbar-label">🎨 Couleur du texte :</span>
            ${swatches}
            <label class="color-custom" title="Choisir une autre couleur">Autre
                <input type="color" id="adminColorPicker" value="#4a90e2"></label>
            <button type="button" id="adminColorClear" class="admin-btn small">✖ Retirer la couleur</button>
            <span class="admin-hint-inline">Sélectionnez du texte dans une zone de texte, puis choisissez un style ou une couleur (un second clic sur un style le retire). Raccourcis : Ctrl+B, Ctrl+I, Ctrl+U.</span>
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

// --- STYLES DE TEXTE (gras, italique, souligné, barré) ---
function getTextTarget() {
    const ta = adminActiveTextarea;
    if (!ta || !ta.isConnected) {
        showToast('Cliquez dans une zone de texte, puis sélectionnez le texte à mettre en forme.', true, 3500);
        return null;
    }
    return ta;
}

// Le texte HTML est-il équilibré (chaque balise ouverte est refermée dans le bon ordre) ?
function isBalancedHtml(html) {
    const stack = [];
    const re = /<(\/?)(b|i|u|s|span)(?:\s[^>]*)?>/gi;
    let m;
    while ((m = re.exec(html))) {
        const tag = m[2].toLowerCase();
        if (!m[1]) stack.push(tag);
        else if (stack.pop() !== tag) return false;
    }
    return stack.length === 0;
}

// Balises (b, i, u, s, span) qui entourent exactement la sélection, de la plus proche à la plus éloignée
function findWrapperLayers(value, start, end) {
    const layers = [];
    let b = start, e = end;
    for (;;) {
        const m = value.slice(0, b).match(/<(b|i|u|s|span)(?:\s[^>]*)?>$/i);
        if (!m) break;
        const tag = m[1].toLowerCase();
        const close = `</${tag}>`;
        if (value.slice(e, e + close.length).toLowerCase() !== close) break;
        layers.push({ tag, openStart: b - m[0].length, openEnd: b, closeStart: e, closeEnd: e + close.length });
        b -= m[0].length;
        e += close.length;
    }
    return layers;
}

// Met / retire un style sur la sélection (sans sélection : insère la balise et place le curseur à l'intérieur)
function toggleTextStyle(tag) {
    const ta = getTextTarget();
    if (!ta) return;
    const value = ta.value;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const open = `<${tag}>`, close = `</${tag}>`;

    // 1) La sélection est déjà dans ce style (même avec d'autres balises entre les deux) : on le retire
    const layer = findWrapperLayers(value, start, end).find(l => l.tag === tag);
    if (layer) {
        const inner = value.slice(layer.openEnd, layer.closeStart);
        replaceTextareaRegion(ta, layer.openStart, layer.closeEnd, inner, start - layer.openEnd, end - layer.openEnd);
        return;
    }

    // 2) La sélection contient elle-même tout le style (balises comprises) : on le retire
    const whole = selected.match(new RegExp(`^<${tag}>([\\s\\S]*)</${tag}>$`, 'i'));
    if (whole && isBalancedHtml(whole[1])) {
        replaceTextareaRegion(ta, start, end, whole[1], 0, whole[1].length);
        return;
    }

    // 3) Sinon on entoure la sélection (elle ne doit pas couper une balise)
    if (!isBalancedHtml(selected)) {
        showToast('❌ La sélection coupe une balise (couleur ou style) : élargissez-la ou réduisez-la.', true, 4500);
        return;
    }
    const inner = selected.replace(new RegExp(`</?${tag}>`, 'gi'), '');   // pas de balise identique imbriquée
    replaceTextareaRegion(ta, start, end, open + inner + close, open.length, open.length + inner.length);
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
    box.innerHTML = '<span class="admin-preview-label">Aperçu</span>' + newlinesToBr(ta.value.replace(/\\n/g, ' '));
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
    toolbar.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleTextStyle(btn.getAttribute('data-style')));
    });
    // Raccourcis comme dans Word : Ctrl+B, Ctrl+I, Ctrl+U (Cmd sur Mac) dans une zone de texte
    form.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'TEXTAREA' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
        const tag = { b: 'b', i: 'i', u: 'u' }[(e.key || '').toLowerCase()];
        if (!tag) return;
        e.preventDefault();
        adminActiveTextarea = e.target;
        toggleTextStyle(tag);
    });
}

// Éléments dont l'identité apparaît plusieurs fois (signe qu'une ligne a pu être écrasée par erreur)
function duplicateIdentities() {
    const out = [];
    Object.keys(LOCAL_GENSHIN_DATA).forEach(category => {
        const seen = new Map();
        (LOCAL_GENSHIN_DATA[category] || []).forEach(item => {
            if (!item.name || item.name === 'Non renseigné') return;
            const key = itemKey(category, item);
            seen.set(key, { n: (seen.get(key) ? seen.get(key).n : 0) + 1, label: displayName(category, item) });
        });
        seen.forEach(({ n, label }) => { if (n > 1) out.push({ category, label, n }); });
    });
    return out;
}

function adminStatusHtml() {
    if (HAS_SOURCE) {
        const n = countMarkers(sourceBaseText);
        const dups = duplicateIdentities();
        const dupHtml = dups.length
            ? `<p class="admin-status warn">⚠️ <strong>Doublon dans data.js</strong> : ${dups.slice(0, 5).map(d => `« ${escapeHtml(d.label)} » (×${d.n})`).join(', ')}.<br><small>Cela arrive quand une ligne a été écrasée par la modification d'un homonyme. Comparez ces lignes à votre sauvegarde.</small></p>`
            : '';
        return (n
            ? `<p class="admin-status ok">✅ Marqueurs « //Pour Claude » actifs : ${n} détecté(s) dans data.js. Les ajouts y sont insérés automatiquement.</p>`
            : `<p class="admin-status warn">⚠️ Aucun marqueur « //Pour Claude » trouvé dans data.js : les ajouts seront placés en fin de liste.</p>`) + dupHtml;
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

// ---------- Modification d'un élément existant ----------
// Ce que vous tapez avec Entrée devient <br> ; les « \n » d'origine (affichés tels quels dans la zone) redeviennent des retours internes
function editTextToStored(value) {
    const PLACEHOLDER = '\u0000';
    return newlinesToBr(value.replace(/\\n/g, PLACEHOLDER)).replace(/\u0000/g, '\n');
}

// Lit le formulaire. En modification, un champ NON touché renvoie sa valeur d'origine exacte (rien n'est reformaté).
function makeFormVal(form, ctx) {
    const val = (key) => {
        const el = form.querySelector(`[data-key="${key}"]`);
        if (!el) return '';
        if (ctx && key in ctx.initial && el.value === ctx.initial[key]) {
            if (key !== 'iconPart') return ctx.raw[key];
            const typeEl = form.querySelector('[data-key="type"]');
            if (!typeEl || typeEl.value === ctx.initial.type) return ctx.raw.iconPart;   // lien conservé tant que ni le lien ni le type n'ont changé
        }
        const value = el.value.trim();
        if (el.tagName !== 'TEXTAREA') return value;
        return ctx ? editTextToStored(value) : newlinesToBr(value);
    };
    val.original = ctx ? ctx.original : null;
    return val;
}

// Fusionne le formulaire avec l'élément d'origine : mêmes clés, même ordre, clés inconnues du formulaire conservées
function mergeEditedItem(original, collected) {
    const POWER = ADMIN_POWER_KEYS.map(([k]) => k);
    const OPTIONAL = ['infocomp', 'infoult'];
    const result = {};
    const origPower = POWER.find(k => k in original);
    const newPower = POWER.find(k => k in collected);
    Object.keys(original).forEach(k => {
        if (POWER.includes(k)) {
            if (k === origPower && newPower) result[newPower] = collected[newPower];   // même place, éventuellement une autre clé
            return;
        }
        if (k in collected) result[k] = collected[k];
        else if (!OPTIONAL.includes(k)) result[k] = original[k];                        // clé que le formulaire ne connaît pas : conservée
        // champ facultatif vidé : supprimé
    });
    Object.keys(collected).forEach(k => {
        if (k in result || POWER.includes(k)) return;
        if (collected[k] !== '' && collected[k] !== undefined) result[k] = collected[k];   // nouvelle clé, seulement si remplie
    });
    if (newPower && !(newPower in result) && collected[newPower] !== '') result[newPower] = collected[newPower];
    return result;
}

function buildEditedItem(form, category, original, ctx) {
    const val = makeFormVal(form, ctx);
    if (!val('name')) return null;
    const collected = { characters: collectCharacter, weapons: collectWeapon, artifacts: collectArtifact }[category](val);
    return mergeEditedItem(original, collected);
}

// Partie variable du lien d'icône (ce que vous saisiriez), ou le lien entier s'il ne suit pas la règle habituelle
function deriveIconPart(category, item) {
    const icon = item.icon || '';
    let m = null;
    if (category === 'characters') {
        m = icon.match(/^https:\/\/enka\.network\/ui\/UI_AvatarIcon_Side_(.+)\.png$/);
    } else if (category === 'weapons') {
        const token = ADMIN_WEAPON_ICON_TOKENS[item.type];
        if (token) m = icon.match(new RegExp('^https://enka\\.network/ui/UI_EquipIcon_' + token + '_(.+)\\.png$'));
    } else {
        const n = ADMIN_ARTIFACT_ICON_SUFFIX[item.type];
        if (n) m = icon.match(new RegExp('^https://enka\\.network/ui/UI_RelicIcon_(.+)_' + n + '\\.png$'));
    }
    return m ? m[1] : icon;
}

// Remplit le formulaire avec l'élément choisi et mémorise les valeurs d'origine
function prefillForm(form, category, item) {
    const ctx = { initial: {}, raw: {}, original: item };
    const asText = (value) => (typeof value === 'string' ? value.replace(/\n/g, '\\n') : value);
    const setField = (key, raw, display) => {
        const el = form.querySelector(`[data-key="${key}"]`);
        if (!el) return;
        const shown = display !== undefined ? String(display) : (raw === undefined || raw === null ? '' : String(raw));
        if (el.tagName === 'SELECT' && shown !== '' && ![...el.options].some(o => o.value === shown)) {
            const option = document.createElement('option');   // valeur absente des listes (ex : faute de frappe d'origine) : conservée telle quelle
            option.value = shown;
            option.textContent = shown;
            el.appendChild(option);
        }
        el.value = shown;
        ctx.initial[key] = el.value;
        ctx.raw[key] = raw === undefined || raw === null ? '' : raw;
    };
    const setText = (key) => setField(key, item[key], asText(item[key] === undefined || item[key] === null ? '' : item[key]));

    if (category === 'characters') {
        const powerKey = ADMIN_POWER_KEYS.map(([k]) => k).find(k => k in item) || 'divin';
        setField('name', item.name);
        setField('powerKey', powerKey);
        setField('element', item[powerKey]);
        ['weapon', 'rarity', 'elevation', 'nation', 'affiliation', 'constellation', 'anniversaire'].forEach(k => setField(k, item[k]));
        setText('description');
        ADMIN_TALENTS.forEach(([nk, dk]) => { setField(nk, item[nk]); setText(dk); });
        [1, 2, 3, 4, 5, 6].forEach(n => { setField('c' + n, item['c' + n]); setText(`c${n}desc`); });
        setText('infocomp');
        setText('infoult');
    } else if (category === 'weapons') {
        ['name', 'type', 'rarity', 'obtention', 'main', 'sub', 'names'].forEach(k => setField(k, item[k]));
        setText('effect');
        setText('description');
    } else {
        ['name', 'type', 'rarity', 'obtention', 'set'].forEach(k => setField(k, item[k]));
        const m = /^Set de 2 pièce\(s\) : (.*) <br>Set de 4 pièce\(s\) : (.*)$/s.exec(item.effect || '');
        setField('bonus2', m ? m[1] : '', asText(m ? m[1] : ''));
        setField('bonus4', m ? m[2] : '', asText(m ? m[2] : ''));
        setText('description');
    }
    setField('iconPart', item.icon, deriveIconPart(category, item));

    form.querySelectorAll('details.admin-section').forEach(d => { d.open = true; });
    form.querySelectorAll('textarea').forEach(updateAdminPreview);
    return ctx;
}

function describeEditItem(category, item) {
    if (category === 'characters') return `${item.rarity || '?'}★ · ${getCharacterElement(item) || 'élément ?'}`;
    if (category === 'weapons') return `${item.type || 'type ?'} · ${item.rarity || '?'}★`;
    return `${item.type || 'type ?'} · ${item.rarity || '?'}★ · ${(item.set || '').replace(/\s*:\s*$/, '')}`;
}

// Liste filtrable des éléments de la catégorie : un clic charge l'élément dans le formulaire
function setupEditPicker(grid) {
    const search = document.getElementById('editSearch');
    const results = document.getElementById('editResults');
    let shown = [];
    const draw = () => {
        const query = search.value.trim().toLowerCase();
        const items = (LOCAL_GENSHIN_DATA[adminCategory] || [])
            .filter(item => item.name && item.name !== 'Non renseigné' && (!query || item.name.toLowerCase().includes(query)))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        shown = items.slice(0, 60);
        results.innerHTML = shown.map((item, i) =>
            `<button type="button" class="edit-result" data-idx="${i}">${escapeHtml(item.name)} <small>${escapeHtml(describeEditItem(adminCategory, item))}</small></button>`
        ).join('')
            + (items.length > shown.length ? `<p class="admin-hint">… ${items.length - shown.length} autre(s) : précisez votre recherche.</p>` : '')
            + (!items.length ? '<p class="admin-hint">Aucun résultat.</p>' : '');
    };
    results.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-result');
        if (!btn) return;
        adminEditTarget = shown[Number(btn.getAttribute('data-idx'))];
        renderAdmin(grid);
    });
    search.addEventListener('input', draw);
    draw();
    search.focus();
}

function renderAdmin(grid) {
    grid.classList.remove('talents-view');
    renderSyncBanner();

    const editing = HAS_SOURCE && adminMode === 'edit';
    if (!editing) adminEditTarget = null;
    const showForm = !editing || !!adminEditTarget;
    const modeHtml = HAS_SOURCE ? `<div class="admin-mode-switch">
            <button type="button" class="admin-mode-btn${adminMode === 'add' ? ' active' : ''}" data-admin-mode="add">➕ Ajouter</button>
            <button type="button" class="admin-mode-btn${adminMode === 'edit' ? ' active' : ''}" data-admin-mode="edit">✏️ Modifier un élément existant</button>
        </div>` : '';
    const pickerHtml = (editing && !adminEditTarget) ? `<div class="edit-picker">
            <label>Quel élément voulez-vous modifier ? (${escapeHtml(ADMIN_CATEGORIES[adminCategory].switchLabel)})</label>
            <input type="text" id="editSearch" placeholder="Tapez une partie du nom…" autocomplete="off">
            <div id="editResults" class="edit-results"></div>
        </div>` : '';
    // Boutons toujours accessibles (même quand le formulaire est masqué dans le choix d'un élément à modifier)
    const extraButtons = `<button type="button" id="downloadDataBtn" class="admin-btn">⬇️ Télécharger data.js${HAS_SOURCE ? '' : ' (sans commentaires)'}</button>
                    <button type="button" id="resetDataBtn" class="admin-btn">🧹 Réinitialiser / valider les ajouts</button>`;
    const bannerHtml = (editing && adminEditTarget) ? `<div class="edit-banner">✏️ Modification de : <strong>${escapeHtml(adminEditTarget.name)}</strong>
            <button type="button" id="editCancelBtn" class="admin-btn small">↩️ Changer d'élément</button></div>` : '';

    const formHtml = { characters: adminCharacterFormHtml, weapons: adminWeaponFormHtml, artifacts: adminArtifactFormHtml }[adminCategory]();
    const switchHtml = Object.entries(ADMIN_CATEGORIES).map(([cat, c]) =>
        `<button type="button" class="admin-switch-btn${cat === adminCategory ? ' active' : ''}" data-admin-cat="${cat}">${c.icon} ${c.switchLabel}</button>`
    ).join('');

    grid.innerHTML = `
        <div class="admin-panel">
            <div class="admin-panel-head">
                <h2>⚙️ Panneau d'Administration - ${editing ? 'Modifier un élément' : 'Ajouter un élément'}</h2>
                <button type="button" id="adminLogoutBtn" class="admin-btn small" title="Masque l'onglet Admin sur ce navigateur">🔒 Quitter le mode admin</button>
            </div>
            ${modeHtml}
            <div class="admin-switch">${switchHtml}</div>
            ${pickerHtml}
            ${showForm ? '' : `<div class="admin-actions" style="margin-bottom: 15px;">${extraButtons}</div>`}
            ${adminStatusHtml()}
            ${githubReady(loadGithubSettings()) ? `<p class="admin-status ok">☁️ Publication automatique activée → ${escapeHtml(loadGithubSettings().repo)} (${escapeHtml(loadGithubSettings().branch || 'main')}) : plus besoin de remplacer data.js à la main.</p>` : ''}
            <p class="admin-hint">Dans les zones de texte, la touche Entrée crée un retour à la ligne (converti automatiquement en &lt;br&gt;). Le HTML reste accepté si vous préférez l'écrire à la main.</p>
            <form id="adminAddForm" class="admin-form"${showForm ? '' : ' style="display:none"'}>
                ${bannerHtml}
                ${adminToolbarHtml()}
                ${formHtml}
                <div class="admin-actions">
                    <button type="submit" class="admin-btn primary">${editing ? '💾 Enregistrer les modifications' : '➕ ' + ADMIN_CATEGORIES[adminCategory].saveLabel}</button>
                    ${showForm ? extraButtons : ''}
                </div>
                ${HAS_SOURCE ? '<p class="admin-hint">Chaque élément ajouté ici porte le commentaire « // ajouté via Admin » dans data.js. Le bouton « Réinitialiser / valider » vous laisse choisir, élément par élément, de les effacer ou de les garder définitivement (le commentaire est alors retiré).</p>' : ''}
            </form>
            ${adminGithubHtml()}
        </div>
    `;

    grid.querySelectorAll('.admin-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            adminCategory = btn.getAttribute('data-admin-cat');
            adminEditTarget = null;
            renderAdmin(grid);
        });
    });

    const form = document.getElementById('adminAddForm');
    setupAdminToolbar(form);
    // Modification : boutons de mode, choix de l'élément, préremplissage du formulaire
    grid.querySelectorAll('.admin-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            adminMode = btn.getAttribute('data-admin-mode');
            adminEditTarget = null;
            renderAdmin(grid);
        });
    });
    adminEditCtx = null;
    if (editing && !adminEditTarget) setupEditPicker(grid);
    if (editing && adminEditTarget) {
        adminEditCtx = prefillForm(form, adminCategory, adminEditTarget);
        const cancelBtn = document.getElementById('editCancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { adminEditTarget = null; renderAdmin(grid); });
    }
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
        if (editing && adminEditTarget) {
            const edited = buildEditedItem(form, adminCategory, adminEditTarget, adminEditCtx);
            if (edited && commitEditedItem(adminCategory, adminEditTarget, edited)) adminEditTarget = null;
            return;
        }
        const val = makeFormVal(form, null);
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

        // Ancien format de data.js : seulement les ajouts en attente dans ce navigateur (tout ou rien)
        if (!HAS_SOURCE) {
            const list = Object.values(customItems).reduce((n, l) => n + l.length, 0);
            if (!list) { showToast('ℹ️ Aucun ajout en attente à effacer.', false, 5000); return; }
            showConfirmBox(`Effacer les <strong>${list}</strong> ajout(s) en attente dans ce navigateur ?`, 'Oui, effacer', () => {
                Object.values(CUSTOM_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
                location.reload();
            });
            return;
        }

        // 1) Inventaire : ce qui est dans data.js (ou sur GitHub), ce qui est en attente, les modifications en attente
        let inFile = [];
        const remoteKeys = new Set();   // tout ce qui existe déjà sur GitHub (étiqueté ou non)
        const remoteItems = new Map();  // et la version en ligne de chacun
        if (sync) {
            try {
                const remote = await githubGetFile(settings);
                const source = extractSource(remote.text);
                if (!source) throw new Error(GITHUB_FORMAT_ERROR);
                inFile = findAdminItems(applyFileOps(source));
                const remoteData = new Function('return (' + source + ');')()();
                Object.keys(remoteData).forEach(category => remoteData[category].forEach(item => { const id = category + '|' + itemKey(category, item); remoteKeys.add(id); remoteItems.set(id, item); }));
            } catch (e) {
                showToast('❌ Lecture de GitHub impossible : ' + e.message, true, 10000);
                return;
            }
        } else {
            inFile = findAdminItems(sourceBaseText);
        }
        const entries = new Map();
        inFile.forEach(f => entries.set(f.category + '|' + f.key, { category: f.category, key: f.key, name: f.name, state: 'file' }));
        Object.entries(customItems).forEach(([category, list]) => list.forEach(item => {
            const id = category + '|' + itemKey(category, item);
            if (entries.has(id)) entries.get(id).state = 'both';
            else if (sync && remoteKeys.has(id)) return;   // déjà publié et gardé définitivement : plus concerné
            else entries.set(id, { category, key: itemKey(category, item), name: displayName(category, item), state: 'pending', kept: customKeep.has(id) });
        }));
        Object.entries(customEdits).forEach(([category, list]) => list.forEach(edit => {
            const key = itemKey(category, edit.item);
            const online = remoteItems.get(category + '|' + key);
            const published = !!(sync && online && sameItem(online, edit.item));   // la version en ligne est déjà la modifiée
            if (edit.kept && published) return;                                     // validée et déjà publiée : plus concernée
            entries.set('edit|' + category + '|' + key, { category, key, name: displayName(category, edit.item), state: 'edit', edit: true, kept: !!edit.kept, published });
        }));
        const all = [...entries.values()];
        if (!all.length) {
            showToast('ℹ️ Rien à réinitialiser ni à valider : tout ce qui a été ajouté ou modifié via l\'Admin est déjà validé. (Les éléments ajoutés avec une ancienne version de l\'Admin ne sont pas repérables : supprimez leur ligne dans data.js ou restaurez votre sauvegarde.)', false, 10000);
            return;
        }
        const where = sync ? '<br>Les éléments déjà enregistrés seront modifiés <strong>directement sur GitHub</strong> (vos marqueurs sont conservés).'
            : '<br>Si des éléments déjà enregistrés sont concernés, un nouveau <strong>data.js</strong> sera téléchargé : il faudra remplacer votre fichier par celui-ci.';
        const editNote = all.some(e => e.edit) ? '<br>Une modification déjà présente dans votre data.js (fichier remplacé) ne peut plus être annulée ici : restaurez votre sauvegarde.' : '';

        showResetDialog(all, where + editNote, async (action, chosen) => {
            if (!chosen.length) return;
            const fileKeys = new Set(chosen.filter(e => !e.edit && e.state !== 'pending').map(e => e.category + '|' + e.key));
            const pendingChosen = chosen.filter(e => !e.edit && e.state !== 'file');
            const editsChosen = chosen.filter(e => e.edit);
            const erase = action === 'erase';

            // 2) Effets locaux (ajouts en attente, modifications en attente, « gardés »)
            const revertRecords = [];
            if (erase) {
                pendingChosen.forEach(e => {
                    customItems[e.category] = customItems[e.category].filter(item => itemKey(e.category, item) !== e.key);
                    customKeep.delete(e.category + '|' + e.key);
                });
                editsChosen.forEach(e => {
                    const record = customEdits[e.category].find(edit => itemKey(e.category, edit.item) === e.key);
                    if (record && e.published) revertRecords.push({ category: e.category, edit: record });   // déjà en ligne : à annuler aussi sur GitHub
                    customEdits[e.category] = customEdits[e.category].filter(edit => itemKey(e.category, edit.item) !== e.key);
                });
                Object.keys(CUSTOM_STORAGE_KEYS).forEach(category => {
                    try {
                        if (customItems[category].length) localStorage.setItem(CUSTOM_STORAGE_KEYS[category], JSON.stringify(customItems[category]));
                        else localStorage.removeItem(CUSTOM_STORAGE_KEYS[category]);
                    } catch (e) {}
                });
                saveCustomEdits();
            } else {
                pendingChosen.forEach(e => customKeep.add(e.category + '|' + e.key));
                editsChosen.forEach(e => {
                    const record = customEdits[e.category].find(edit => itemKey(e.category, edit.item) === e.key);
                    if (record) record.kept = true;   // modification validée
                });
                saveCustomEdits();
            }
            saveCustomKeep();

            const apply = (text) => erase ? removeAdminItems(text, fileKeys) : untagAdminItems(text, fileKeys);
            // On mémorise la décision : elle survit à l'actualisation tant que data.js ne la reflète pas
            fileKeys.forEach(key => {
                if (erase) { customFileOps.remove.add(key); customFileOps.untag.delete(key); }
                else { customFileOps.untag.add(key); customFileOps.remove.delete(key); }
            });
            saveCustomFileOps();
            const count = chosen.length;
            const verbDone = erase ? 'effacé(s)' : 'gardé(s) définitivement';

            // 3) Effets sur data.js
            try {
                if (fileKeys.size || (sync && revertRecords.length)) {
                    if (sync) {
                        showToast(erase ? '⏳ Suppression sur GitHub en cours…' : '⏳ Validation sur GitHub en cours…', false, 3000);
                        const message = revertRecords.length
                            ? `Annulation de ${revertRecords.length} modification(s)${fileKeys.size ? ` et suppression de ${fileKeys.size} ajout(s)` : ''} via l'Admin`
                            : (erase ? `Suppression de ${fileKeys.size} ajout(s) faits via l'Admin` : `Ajouts validés via l'Admin (${fileKeys.size})`);
                        const result = await publishToGithub(settings, remoteText => {
                            const source = extractSource(remoteText);
                            if (!source) throw new Error(GITHUB_FORMAT_ERROR);
                            return wrapSourceAsFile(revertEditsInSource(apply(source), revertRecords));
                        }, message);
                        showToast(`✅ ${count} élément(s) ${verbDone} sur GitHub${result.sha ? ' (commit ' + result.sha.slice(0, 7) + ')' : ''}. Le site se met à jour dans 1 à 2 minutes.`, false, 10000);
                    }
                    if (fileKeys.size) sourceBaseText = apply(sourceBaseText);
                    if (!sync) {
                        rebuildDataFromSource(true);
                        downloadDataJs();
                        showToast(`✅ ${count} élément(s) ${verbDone}. Remplacez votre data.js par le fichier téléchargé, puis faites Ctrl+F5.`, false, 10000);
                    }
                } else {
                    showToast(`✅ ${count} élément(s) ${verbDone}.`, false, 5000);
                }
                rebuildDataFromSource(true);
                renderAdmin(grid);
            } catch (e) {
                console.error(e);
                sourceBaseText = apply(sourceBaseText);
                rebuildDataFromSource(true);
                downloadDataJs();
                showToast('❌ Publication sur GitHub impossible : ' + e.message + ' Le data.js a été téléchargé à la place.', true, 15000);
                renderAdmin(grid);
            }
        });
    });
}

// --- VÉRIFICATION DE LA MISE EN LIGNE (site ouvert en http/https, ex. github.io) ---
// Le navigateur peut garder une ancienne copie de data.js plusieurs minutes. On recharge donc data.js en contournant ce cache,
// on regarde si vos changements y sont, et on retire de la liste d'attente ceux qui sont déjà en ligne.
let liveCheck = { time: null, states: {}, error: null, running: false };
let liveTimer = null;

function canCheckLive() {
    return /^https?:$/.test(location.protocol);
}

function diffFields(a, b) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

// Adopte le data.js en ligne (plus récent) et retire les changements qu'il contient déjà
function adoptLiveSource(source) {
    const data = new Function('return (' + source + ');')()();
    refreshDuplicateNames(data);
    const taggedNow = new Set(scanAdminLines(source).found.map(f => f.category + '|' + f.key));
    ['untag', 'remove'].forEach(kind => {
        [...customFileOps[kind]].forEach(key => { if (!taggedNow.has(key)) customFileOps[kind].delete(key); });
    });
    saveCustomFileOps();

    Object.keys(customItems).forEach(category => {
        const known = new Set((data[category] || []).map(item => itemKey(category, item)));
        customItems[category] = customItems[category].filter(item => !known.has(itemKey(category, item)));
        try {
            if (customItems[category].length) localStorage.setItem(CUSTOM_STORAGE_KEYS[category], JSON.stringify(customItems[category]));
            else localStorage.removeItem(CUSTOM_STORAGE_KEYS[category]);
        } catch (e) {}
    });
    Object.keys(customEdits).forEach(category => {
        const byKey = new Map((data[category] || []).map(item => [itemKey(category, item), item]));
        customEdits[category] = customEdits[category].filter(edit => {
            const current = byKey.get(itemKey(category, edit.item));
            return !(current && sameItem(current, edit.item));
        });
    });
    saveCustomEdits();

    const pendingKeys = new Set();
    Object.keys(customItems).forEach(category => customItems[category].forEach(item => pendingKeys.add(category + '|' + itemKey(category, item))));
    [...customKeep].forEach(key => { if (!pendingKeys.has(key)) customKeep.delete(key); });
    saveCustomKeep();
    const sigs = new Set(listPendingChanges().map(change => change.sig));
    [...customPublished].forEach(sig => { if (!sigs.has(sig)) customPublished.delete(sig); });
    saveCustomPublished();

    loadedSourceText = source;
    sourceBaseText = applyFileOps(source);
    rebuildDataFromSource(true);
    if (currentTab !== 'admin') render();   // on ne réaffiche pas le formulaire Admin en cours de saisie
}

async function checkLiveData() {
    if (!HAS_SOURCE || !isAdminMode() || !canCheckLive() || liveCheck.running) return;
    if (!listPendingChanges().length) return;
    liveCheck.running = true;
    liveCheck.error = null;
    renderSyncBanner();
    try {
        const res = await fetch('data.js', { cache: 'reload' });   // contourne le cache du navigateur (et le met à jour)
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const source = extractSource(await res.text());
        if (!source) throw new Error('format de data.js non reconnu');
        const live = new Function('return (' + source + ');')()();
        const states = {};
        listPendingChanges().forEach(change => {
            const found = (live[change.category] || []).find(item => itemKey(change.category, item) === change.key);
            if (!found) states[change.sig] = { state: 'missing' };
            else if (change.kind === 'add' || sameItem(found, change.item)) states[change.sig] = { state: 'live' };
            else states[change.sig] = { state: 'different', fields: diffFields(found, change.item) };
        });
        liveCheck.states = states;
        liveCheck.time = new Date();
        if (source !== loadedSourceText) adoptLiveSource(source);
    } catch (e) {
        liveCheck.error = e.message;
        liveCheck.time = new Date();
    } finally {
        liveCheck.running = false;
        renderSyncBanner();
    }
}

function startLiveWatch() {
    if (liveTimer || !HAS_SOURCE || !isAdminMode() || !canCheckLive()) return;
    setTimeout(checkLiveData, 1500);
    liveTimer = setInterval(() => { if (document.visibilityState === 'visible') checkLiveData(); }, 60000);
}

// Bandeau en haut du site (mode admin) : dit si des changements ne sont visibles que dans ce navigateur
function renderSyncBanner() {
    const main = document.querySelector('.main-content');
    if (!main) return;
    let banner = document.getElementById('syncBanner');
    const changes = (isAdminMode() && HAS_SOURCE) ? listPendingChanges() : [];
    if (!changes.length && !publishing) { if (banner) banner.remove(); return; }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'syncBanner';
        main.insertBefore(banner, main.firstChild);
    }
    const unpublished = changes.filter(change => !customPublished.has(change.sig));
    const names = list => list.slice(0, 4).map(c => '« ' + escapeHtml(c.name) + ' »').join(', ') + (list.length > 4 ? ` … (+${list.length - 4})` : '');

    if (publishing) {
        banner.className = 'sync-banner info';
        banner.innerHTML = '<span>⏳ <strong>Publication sur GitHub en cours…</strong></span>';
    } else if (unpublished.length) {
        const sync = githubReady(loadGithubSettings());
        banner.className = 'sync-banner warn';
        banner.innerHTML = `<span>⚠️ <strong>${unpublished.length} changement(s) visible(s) seulement par vous</strong> : ${names(unpublished)}.<br>
            <small>Ils sont stockés dans ce navigateur : les autres visiteurs (navigation privée, autre compte) ne les voient pas tant qu'ils ne sont pas dans le data.js en ligne.
            ${sync ? '' : 'La publication automatique n\'est pas activée dans ce navigateur (les réglages sont propres à chaque navigateur et à chaque adresse). '}
            Si vous venez de mettre votre data.js en ligne, patientez quelques minutes : ce message disparaît tout seul.</small></span>
            ${sync ? '<button type="button" id="publishNowBtn" class="admin-btn small primary">📤 Publier maintenant sur GitHub</button>'
                   : '<button type="button" id="bannerDownloadBtn" class="admin-btn small primary">⬇️ Télécharger data.js</button>'}`;
        const publishBtn = document.getElementById('publishNowBtn');
        if (publishBtn) publishBtn.addEventListener('click', publishNow);
        const downloadBtn = document.getElementById('bannerDownloadBtn');
        if (downloadBtn) downloadBtn.addEventListener('click', downloadDataJs);
    } else {
        const checkable = canCheckLive();
        const differing = changes.filter(c => liveCheck.states[c.sig] && liveCheck.states[c.sig].state === 'different');
        const time = liveCheck.time ? liveCheck.time.toLocaleTimeString('fr-FR') : '';
        const sync = githubReady(loadGithubSettings());
        const checkLine = !checkable
            ? 'Vous ouvrez le site depuis un fichier local : ce message ne disparaîtra qu\'une fois votre data.js local remplacé par celui de GitHub. Ouvrez plutôt l\'adresse github.io.'
            : liveCheck.running ? '🔎 Vérification en cours…'
            : liveCheck.error ? `Dernière vérification (${time}) impossible : ${escapeHtml(liveCheck.error)}.`
            : time ? `Dernière vérification à ${time} : pas encore en ligne. Nouvelle vérification automatique toutes les minutes.`
            : 'Vérification automatique toutes les minutes.';
        const differNote = differing.length
            ? `<br>⚠️ <strong>Présent en ligne mais avec un contenu différent</strong> : ${names(differing)} (champs : ${escapeHtml([...new Set(differing.flatMap(c => liveCheck.states[c.sig].fields))].join(', '))}). Republiez pour remplacer la version en ligne.`
            : '';
        banner.className = 'sync-banner info';
        banner.innerHTML = `<span>⏳ <strong>${changes.length} changement(s) publié(s) sur GitHub</strong> : ${names(changes)}.<br>
            <small>Visibles par tous d'ici quelques minutes (GitHub Pages peut garder l'ancienne version jusqu'à ~10 min). Ce message disparaît tout seul quand le site en ligne est à jour.<br>${checkLine}${differNote}</small></span>
            <span class="sync-actions">
            ${checkable && !liveCheck.running ? '<button type="button" id="checkLiveBtn" class="admin-btn small">🔎 Vérifier maintenant</button>' : ''}
            ${differing.length && sync ? '<button type="button" id="publishNowBtn" class="admin-btn small primary">📤 Republier</button>' : ''}</span>`;
        const checkBtn = document.getElementById('checkLiveBtn');
        if (checkBtn) checkBtn.addEventListener('click', checkLiveData);
        const publishBtn = document.getElementById('publishNowBtn');
        if (publishBtn) publishBtn.addEventListener('click', publishNow);
    }
}

function render() {
    const grid = document.getElementById('mainGrid');
    if (!grid) return;
    renderSyncBanner();
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
            window.scrollTo({ top: 0 });   // on revient en haut (bandeau de publication, nouvel élément…)
            
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
        startLiveWatch();
    });
} else {
    setupControls();
    render();
    startLiveWatch();
}