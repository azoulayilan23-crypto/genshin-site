// --- DONNÉES ---
const charData = [
    {n:"Aino",e:"Hydro",r:4,w:"Épée à deux main"},{n:"Albedo",e:"Géo",r:5,w:"Épée à une main"},{n:"Alhaitham",e:"Dendro",r:5,w:"Épée à une main"},{n:"Aloy",e:"Cryo",r:5,w:"Arc"},{n:"Amber",e:"Pyro",r:4,w:"Arc"},{n:"Arataki Itto",e:"Géo",r:5,w:"Épée à deux main"},{n:"Arlecchino",e:"Pyro",r:5,w:"Lance"},{n:"Baizhu",e:"Dendro",r:5,w:"Catalyseur"},{n:"Barbara",e:"Hydro",r:4,w:"Catalyseur"},{n:"Beidou",e:"Électro",r:4,w:"Épée à deux main"},{n:"Bennett",e:"Pyro",r:4,w:"Épée à une main"},{n:"Candace",e:"Hydro",r:4,w:"Lance"},{n:"Charlotte",e:"Cryo",r:4,w:"Catalyseur"},{n:"Chasca",e:"Anémo",r:5,w:"Arc"},{n:"Chevreuse",e:"Pyro",r:4,w:"Lance"},{n:"Chiori",e:"Géo",r:5,w:"Épée à une main"},{n:"Chongyun",e:"Cryo",r:4,w:"Épée à deux main"},{n:"Citlali",e:"Cryo",r:5,w:"Catalyseur"},{n:"Clorinde",e:"Électro",r:5,w:"Épée à une main"},{n:"Collei",e:"Dendro",r:4,w:"Arc"},{n:"Columbina",e:"Hydro",r:5,w:"Catalyseur"},{n:"Cyno",e:"Électro",r:5,w:"Lance"},{n:"Dahlia",e:"Hydro",r:4,w:"Épée à une main"},{n:"Dehya",e:"Pyro",r:5,w:"Épée à deux main"},{n:"Diluc",e:"Pyro",r:5,w:"Épée à deux main"},{n:"Diona",e:"Cryo",r:4,w:"Arc"},{n:"Dori",e:"Électro",r:4,w:"Épée à deux main"},{n:"Durin",e:"Pyro",r:5,w:"Épée à une main",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Durin_Icon.png"},{n:"Émilie",en:"Emilie",e:"Dendro",r:5,w:"Lance"},{n:"Escoffier",e:"Cryo",r:5,w:"Lance"},{n:"Eula",e:"Cryo",r:5,w:"Épée à deux main"},{n:"Faruzan",e:"Anémo",r:4,w:"Arc"},{n:"Fischl",e:"Électro",r:4,w:"Arc"},{n:"Flins",e:"Électro",r:5,w:"Lance",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Flins_Icon.png"},{n:"Freminet",e:"Cryo",r:4,w:"Épée à deux main"},{n:"Furina",e:"Hydro",r:5,w:"Épée à une main"},{n:"Gaming",e:"Pyro",r:4,w:"Épée à deux main"},{n:"Ganyu",e:"Cryo",r:5,w:"Arc"},{n:"Gorou",e:"Géo",r:4,w:"Arc"},{n:"Hu Tao",e:"Pyro",r:5,w:"Lance"},{n:"Iansan",e:"Électro",r:4,w:"Lance"},{n:"Ifa",e:"Anémo",r:4,w:"Catalyseur"},{n:"Illuga",e:"Géo",r:4,w:"Lance",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Illuga_Icon.png"},{n:"Ineffa",e:"Électro",r:5,w:"Lance"},{n:"Jahoda",e:"Anémo",r:4,w:"Arc",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Jahoda_Icon.png"},{n:"Jean",e:"Anémo",r:5,w:"Épée à une main"},{n:"Kachina",e:"Géo",r:4,w:"Lance"},{n:"Kaedehara Kazuha",e:"Anémo",r:5,w:"Épée à une main"},{n:"Kaeya",e:"Cryo",r:4,w:"Épée à une main"},{n:"Kamisato Ayaka",e:"Cryo",r:5,w:"Épée à une main"},{n:"Kamisato Ayato",e:"Hydro",r:5,w:"Épée à une main"},{n:"Kaveh",e:"Dendro",r:4,w:"Épée à deux main"},{n:"Keqing",e:"Électro",r:5,w:"Épée à une main"},{n:"Kinich",e:"Dendro",r:5,w:"Épée à deux main"},{n:"Kirara",e:"Dendro",r:4,w:"Épée à une main"},{n:"Klee",e:"Pyro",r:5,w:"Catalyseur"},{n:"Kujou Sara",e:"Électro",r:4,w:"Arc"},{n:"Kuki Shinobu",e:"Électro",r:4,w:"Épée à une main"},{n:"Lan Yan",e:"Anémo",r:4,w:"Catalyseur"},{n:"Lauma",e:"Dendro",r:5,w:"Catalyseur"},{n:"Layla",e:"Cryo",r:4,w:"Épée à une main"},{n:"Lisa",e:"Électro",r:4,w:"Catalyseur"},{n:"Linnea",e:"Géo",r:5,w:"Arc",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Linnea_Icon.png"},{n:"Lohen",e:"Cryo",r:5,w:"Lance",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Lohen_Icon.png"},{n:"Lynette",e:"Anémo",r:4,w:"Épée à une main"},{n:"Lyney",e:"Pyro",r:5,w:"Arc"},{n:"Mavuika",e:"Pyro",r:5,w:"Épée à deux main"},{n:"Mika",e:"Cryo",r:4,w:"Lance"},{n:"Mona",e:"Hydro",r:5,w:"Catalyseur"},{n:"Mualani",e:"Hydro",r:5,w:"Catalyseur"},{n:"Nahida",e:"Dendro",r:5,w:"Catalyseur"},{n:"Navia",e:"Géo",r:5,w:"Épée à deux main"},{n:"Nefer",e:"Dendro",r:5,w:"Catalyseur",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Nefer_Icon.png"},{n:"Neuvillette",e:"Hydro",r:5,w:"Catalyseur"},{n:"Nicole",e:"Pyro",r:5,w:"Catalyseur",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Nicole_Icon.png"},{n:"Nilou",e:"Hydro",r:5,w:"Épée à une main"},{n:"Ningguang",e:"Géo",r:4,w:"Catalyseur"},{n:"Noëlle",en:"Noelle",e:"Géo",r:4,w:"Épée à deux main"},{n:"Nomade",en:"Wanderer",e:"Anémo",r:5,w:"Catalyseur"},{n:"Ororon",e:"Électro",r:4,w:"Arc"},{n:"Prune",e:"Anémo",r:4,w:"Catalyseur",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Prune_Icon.png"},{n:"Qiqi",e:"Cryo",r:5,w:"Épée à une main"},{n:"Razor",e:"Électro",r:4,w:"Épée à deux main"},{n:"Rosaria",e:"Cryo",r:4,w:"Lance"},{n:"Sangonomiya Kokomi",e:"Hydro",r:5,w:"Catalyseur"},{n:"Sayu",e:"Anémo",r:4,w:"Épée à deux main"},{n:"Sethos",e:"Électro",r:4,w:"Arc"},{n:"Shenhe",e:"Cryo",r:5,w:"Lance"},{n:"Shikanoin Heizou",e:"Anémo",r:4,w:"Catalyseur"},{n:"Shogun Raiden",en:"Raiden Shogun",e:"Électro",r:5,w:"Lance"},{n:"Sigewinne",e:"Hydro",r:5,w:"Arc"},{n:"Skirk",e:"Cryo",r:5,w:"Épée à une main"},{n:"Sucrose",e:"Anémo",r:4,w:"Catalyseur"},{n:"Tartaglia",e:"Hydro",r:5,w:"Arc"},{n:"Thomas",en:"Thoma",e:"Pyro",r:4,w:"Lance"},{n:"Tighnari",e:"Dendro",r:5,w:"Arc"},{n:"Varesa",e:"Électro",r:5,w:"Catalyseur"},{n:"Varka",e:"Anémo",r:5,w:"Épée à deux main",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Varka_Icon.png"},{n:"Venti",e:"Anémo",r:5,w:"Arc"},{n:"Wriothesley",e:"Cryo",r:5,w:"Catalyseur"},{n:"Xiangling",e:"Pyro",r:4,w:"Lance"},{n:"Xianyun",e:"Anémo",r:5,w:"Catalyseur"},{n:"Xiao",e:"Anémo",r:5,w:"Lance"},{n:"Xilonen",e:"Géo",r:5,w:"Épée à une main"},{n:"Xingqiu",e:"Hydro",r:4,w:"Épée à une main"},{n:"Xinyan",e:"Pyro",r:4,w:"Épée à deux main"},{n:"Yae Miko",e:"Électro",r:5,w:"Catalyseur"},{n:"Yanfei",e:"Pyro",r:4,w:"Catalyseur"},{n:"Yaoyao",e:"Dendro",r:4,w:"Lance"},{n:"Yelan",e:"Hydro",r:5,w:"Arc"},{n:"Yoimiya",e:"Pyro",r:5,w:"Arc"},{n:"Yumemizuki Mizuki",e:"Anémo",r:5,w:"Catalyseur"},{n:"Yun Jin",e:"Géo",r:4,w:"Lance"},{n:"Zhongli",e:"Géo",r:5,w:"Lance"},{n:"Zibai",e:"Géo",r:5,w:"Épée à une main",fullUrl:"https://genshin-impact.fandom.com/wiki/Special:FilePath/Zibai_Icon.png"}
];

const weaponData = [
    {n:"Absolution",t:"Épée à une main",r:"5"},{n:"Ailes de la Voûte d'Azur",en:"Skyward Harp",t:"Arc",r:"5"},{n:"Appel de sérénité",en:"Serenity's Call",t:"Épée à une main",r:"4"},{n:"Arc à poulies",en:"Compound Bow",t:"Arc",r:"4"},{n:"Arc d'Amos",en:"Amos' Bow",t:"Arc",r:5},{n:"Arc d'exorcisme",en:"Hamayumi",t:"Arc",r:"4"},{n:"Arc de chasse de Favonius",en:"Favonius Warbow",t:"Arc",r:"4"},{n:"Arc de chasse verdoyant+",en:"The Viridescent Hunt",t:"Arc",r:"4"},{n:"Arc de guerre de Rochenoire",en:"Blackcliff Warbow",t:"Arc",r:"4"},{n:"Arc pluvial du serpent arc-en-ciel",en:"Rainbow Serpent's Rain Bow",t:"Arc",r:"4"},{n:"Arc rituel",en:"Sacrificial Bow",t:"Arc",r:"4"},{n:"Arc rouiller",en:"Rust",t:"Arc",r:"4"},{n:"Arc royal",en:"Royal Bow",t:"Arc",r:"4"},{n:"Athame Artis",t:"Épée à une main",r:"5"},{n:"Aube du tisse-lune",en:"Moonweaver's Dawn",t:"Épée à une main",r:"4"},{n:"Bâton d'Homa",en:"Staff of Homa",t:"Lance",r:5},{n:"Bâton des sables écarlates",en:"Staff of the Scarlet Sands",t:"Lance",r:"5"},{n:"Berge de la Voûte d'Azur",en:"Skyward Spine",t:"Lance",r:"5"},{n:"Brise-chaîne",en:"Chain Breaker",t:"Arc",r:"4"},{n:"Chalutier",en:"End of the Line",t:"Arc",r:"4"},{n:"Chanson de patrouille de sommet",en:"Peak Patrol Song",t:"Épée à une main",r:"5"},{n:"Chant de quiétude",en:"Song of Stillness",t:"Arc",r:"4"},{n:"Clair de lune de Xiphos",en:"Xiphos' Moonlight",t:"Épée à une main",r:"4"},{n:"Clé de Khaj-Nisut",en:"Key of Khaj-Nisut",t:"Épée à une main",r:"5"},{n:"Corde de pluie blanche",en:"Silvershower Heartstrings",t:"Arc",r:"5"},{n:"Coupeur de jade primordial",en:"Primordial Jade Cutter",t:"Épée à une main",r:"5"},{n:"Crépuscule couchant",en:"Fading Twilight",t:"Arc",r:"4"},{n:"Croc de loup",en:"Wolf-Fang",t:"Épée à une main",r:"4"},{n:"Croc suppurant",en:"Festering Desire",t:"Épée à une main",r:"4"},{n:"Crochet de capture",en:"Snare Hook",t:"Arc",r:"4"},{n:"Dernière corde",en:"The Stringless",t:"Arc",r:"4"},{n:"Descendant du soleil flamboyant",en:"Scion of the Blazing Sun",t:"Arc",r:"4"},{n:"Éclair des impasses",en:"The Alley Flash",t:"Épée à une main",r:"4"},{n:"Éclat lunaire luminescent",en:"Lightbearing Moonshard",t:"Épée à une main",r:"5"},{n:"Éclazur",en:"Azurelight",t:"Épée à une main",r:"5"},{n:"Élegie de Lumidouce",en:"Lumidouce Elegy",t:"Lance",r:"5"},{n:"Épée de Favonius",en:"Favonius Sword",t:"Épée à une main",r:"4"},{n:"Épée de la descente",en:"Sword of Descension",t:"Épée à une main",r:"4"},{n:"Épée du faucon",en:"Aquila Favonia",t:"Épée à une main",r:"5"},{n:"Épée longue de Rochenoire",en:"Blackcliff Longsword",t:"Épée à une main",r:"4"},{n:"Épée longue royale",en:"Royal Longsword",t:"Épée à une main",r:"4"},{n:"Épée noire",en:"The Black Sword",t:"Épée à une main",r:"4"},{n:"Épée rituelle",en:"Sacrificial Sword",t:"Épée à une main",r:"4"},{n:"Étoile polaire",en:"Polar Star",t:"Arc",r:"5"},{n:"Étouffeur de calamités",en:"Calamity Queller",t:"Lance",r:"5"},{n:"Final des profondeurs",en:"Finale of the Deep",t:"Épée à une main",r:"4"},{n:"Flûte",en:"The Flute",t:"Épée à une main",r:"4"},{n:"Flûte d'ezpitzal",en:"Flute of Ezpitzal",t:"Épée à une main",r:"4"},{n:"Fuseau de cinabre",en:"Cinnabar Spindle",t:"Épée à une main",r:"4"},{n:"Halo fracturé",en:"Fractured Halo",t:"Lance",r:"5"},{n:"Jauge de portée",en:"Range Gauge",t:"Arc",r:"4"},{n:"Kagotsurube Isshin",t:"Épée à une main",r:"4"},{n:"L'assistant du docker",en:"The Dockhand's Assistant",t:"Épée à une main",r:"4"},{n:"La calamité d'Eshu",en:"Calamity of Eshu",t:"Épée à une main",r:"4"},{n:"La première grande magie",en:"The First Great Magic",t:"Arc",r:"5"},{n:"La voie du chasseur",en:"Hunter's Path",t:"Arc",r:"5"},{n:"Lame d'aubier",en:"Sapwood Blade",t:"Épée à une main",r:"4"},{n:"Lame de la Voûte d'Azur",en:"Skyward Blade",t:"Épée à une main",r:"5"},{n:"Lame du Narzissenkreuz",en:"Sword of Narzissenkreuz",t:"Épée à une main",r:"4"},{n:"Lame kageuchi d'Amenoma",en:"Amenoma Kageuchi",t:"Épée à une main",r:"4"},{n:"Lance de jade ailée",en:"Primordial Jade Winged-Spear",t:"Lance",r:"5"},{n:"Le valet du roi",en:"King's Squire",t:"Arc",r:"4"},{n:"Les chroniques de l'aube",en:"The Daybreak Chronicles",t:"Arc",r:"5"},{n:"Lumière d'incision foliaire",en:"Light of Foliar Incision",t:"Épée à une main",r:"5"},{n:"Lumière du faucheur",en:"Engulfing Lightning",t:"Lance",r:"5"},{n:"Lune de Mouun",en:"Mouun's Moon",t:"Arc",r:"4"},{n:"Lune ondulante de Futsu",en:"Haran Geppaku Futsu",t:"Épée à une main",r:"5"},{n:"Lune paisible (prototype)",en:"Prototype Crescent",t:"Arc",r:"4"},{n:"Mort-du-Loup",en:"Wolf's Gravestone",t:"Épée à deux main",r:5},{n:"Mouvement Vagabond",en:"The Widsith",t:"Catalyseur",r:4},{n:"Nimbus-forgé",en:"Cloudforged",t:"Arc",r:"4"},{n:"Ode aux alizées",en:"Windblume Ode",t:"Arc",r:"4"},{n:"Os robuste",en:"Sturdy Bone",t:"Épée à une main",r:"4"},{n:"Passeur du Fleuve cendré",en:"Fleuve Cendre Ferryman",t:"Épée à une main",r:"4"},{n:"Perceur d'ibis",en:"Ibis Piercer",t:"Arc",r:"4"},{n:"Perceur prismatique",en:"Vortex Vanquisher",t:"Lance",r:"5"},{n:"Piqûre de fer",en:"Iron Sting",t:"Épée à une main",r:"4"},{n:"Pluie florale",en:"Toukabou Shigure",t:"Épée à une main",r:"4"},{n:"Plumage cramoisi du vautour astral",en:"Astral Vulture's Crimson Plumage",t:"Arc",r:"5"},{n:"Plumard de fleurs",en:"Flower-Wreathed Feathers",t:"Arc",r:"4"},{n:"Predator",t:"Arc",r:"4"},{n:"Pulsation du tonnerre",en:"Thundering Pulse",t:"Arc",r:"5"},{n:"Reflet de tranche-brume", en:"Mistsplitter Reforged",t: "Épée à une main",r: 5},{n:"Rugissement du Lion",en:"Lion's Roar",t:"Épée à une main",r:"4"},{n:"Ruines sanglantes",en:"Bloodsoaked Ruins",t:"Lance",r:"5"},{n:"Semblance de la Lune écarlate",en:"Crimson Moon's Semblance",t:"Lance",r:"5"},{n:"Séquence de solitude",en:"Sequence of Solitude",t:"Arc",r:"4"},{n:"Serment de gel doré",en:"Golden Frostbound Oath",t:"Arc",r:"5"},{n:"Serment de la liberté",en:"Freedom-Sworn",t:"Épée à une main",r:"5"},{n:"Simulacre d'eau",en:"Aqua Simulacra",t:"Arc",r:"5"},{n:"Splendeur des eaux calmes",en:"Splendor of Tranquil Waters",t:"Épée à une main",r:"5"},{n:"Symphoniste des senteurs",en:"Symphonist of Scents",t:"Lance",r:"5"},{n:"Tailleur de pierre (prototype)",en:"Prototype Rancour",t:"Épée à une main",r:"4"},{n:"Tranche-sommets",en:"Summit Shaper",t:"Épée à une main",r:"5"},{n:"Traqueur des impasses",en:"Alley Hunter",t:"Arc",r:"4"},{n:"Ultime soupir",en:"Elegy for the End",t:"Arc",r:"5"},{n:"Valse nocturne",en:"Mitternachts Waltz",t:"Arc",r:"4"},{n:"Uraku Misugiri",t:"Épée à une main",r:"5"},
];

// --- ÉTAT ET STORAGE ---
let rawTeams = JSON.parse(localStorage.getItem('genshinTeamsList'));
let allTeams = (Array.isArray(rawTeams) && rawTeams.length > 0 && typeof rawTeams[0] === 'object' && rawTeams[0].members) 
    ? rawTeams 
    : [{name: "Équipe 1", members: [null, null, null, null]}];

let currentTab = 'chars';
let currentRarity = 'Tous';
let currentElement = 'Tous';
let currentWeaponType = 'Tous';
let currentCharWeapon = 'Tous';
let searchQuery = '';
let pickerSearchQuery = '';
let currentTeamIdx = null;
let currentSlotIdx = null;

// --- FONCTIONS FILTRES ---
function setActive(btn, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}
function setRarity(r, btn) { currentRarity = r; setActive(btn, 'rarityFilters'); render(); }
function setElement(e, btn) { currentElement = e; setActive(btn, 'element-filters'); render(); }
function setWeaponType(t, btn) { currentWeaponType = t; setActive(btn, 'weapon-type-filters'); render(); }
function setCharWeapon(w, btn) { currentCharWeapon = w; setActive(btn, 'char-weapon-filters'); render(); }
function updateSearch(v) { searchQuery = v; render(); }

// --- GESTION ÉQUIPES ---
function saveTeams() { localStorage.setItem('genshinTeamsList', JSON.stringify(allTeams)); }
function addTeam() { allTeams.push({name: "Nouvelle Équipe", members: [null, null, null, null]}); saveTeams(); render(); }
function deleteTeam(index) { if (allTeams.length > 1) { allTeams.splice(index, 1); saveTeams(); render(); } }
function clearTeam(index) { allTeams[index].members = [null, null, null, null]; saveTeams(); render(); }

function switchTab(tab, btn) {
    currentTab = tab;
    if(btn) setActive(btn, 'mainTabs');
    
    // Réinitialisation des filtres
    currentRarity = 'Tous';
    currentElement = 'Tous';
    currentCharWeapon = 'Tous';
    currentWeaponType = 'Tous';

    // --- GESTION DE LA VISIBILITÉ DES FILTRES ---
    const isTeamTab = (tab === 'teams');
    
    // Masquer/Afficher la barre de recherche et les raretés
    document.querySelector('input[oninput="updateSearch(this.value)"]').style.display = isTeamTab ? 'none' : 'block';
    document.getElementById('rarityFilters').style.display = isTeamTab ? 'none' : 'flex';

    // Gestion des autres filtres spécifiques
    document.getElementById('element-filters').style.display = (tab === 'chars') ? 'flex' : 'none';
    document.getElementById('char-weapon-filters').style.display = (tab === 'chars') ? 'flex' : 'none';
    document.getElementById('weapon-type-filters').style.display = (tab === 'weapons') ? 'flex' : 'none'; 
    
    render();
}

// --- RENDU PRINCIPAL ---
function render() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (currentTab === 'teams') {
        grid.innerHTML = `
            <div style="width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:15px; padding: 10px;">
                <button class="add-team-btn" onclick="addTeam()" style="padding:8px 16px; cursor:pointer; background:#4CAF50; color:white; border:none; border-radius:5px; font-weight:bold;">Ajouter une nouvelle équipe</button>
                <div id="teams-container" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; width:100%;">
            </div>`;
        
        const teamsContainer = document.getElementById('teams-container');

        allTeams.forEach((teamObj, tIndex) => {
            const teamRow = document.createElement('div');
            teamRow.style = "width:360px; background:#1a1a1a; padding:10px; border-radius:12px; border:1px solid #333; margin-bottom:5px;";

            teamRow.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <input type="text" value="${teamObj.name}" oninput="allTeams[${tIndex}].name = this.value; saveTeams();" 
                        style="background:#252525; border:1px solid #444; color:white; padding:4px 8px; border-radius:4px; width:140px; font-size:11px;">
                    <div style="display:flex; gap:5px;">
                        <button onclick="clearTeam(${tIndex})" style="background:#444; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:10px;">Vider</button>
                        <button onclick="deleteTeam(${tIndex})" style="background:#cc3333; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:10px;">Suppr.</button>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:nowrap; gap:6px; justify-content:flex-start;">
                    ${teamObj.members.map((charName, sIndex) => {
                        const char = charData.find(c => c.n === charName);
                        let imgUrl = char ? (char.fullUrl || `https://genshin-impact.fandom.com/wiki/Special:FilePath/Character_${(char.en || char.n).replace(/\s+/g, '_')}_Thumb.png?width=200`) : "";
                        
                        return `
                            <div class="slot" onclick="openPicker(${tIndex}, ${sIndex})" 
                                 style="flex: 0 0 80px; width:80px; height:120px; border:${charName ? '2px solid #f3d022' : '1px dashed #444'}; border-radius:8px; overflow:hidden; cursor:pointer; display:flex; justify-content:center; align-items:center; background:#111; position:relative;">
                                 ${charName ? 
                                    `<img src="${imgUrl}" style="width:100%; height:100%; object-fit: cover; object-position: center top;">
                                     <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.8); color:white; font-size:8px; text-align:center; padding:2px 0;">${charName}</div>` : 
                                    `<span style="font-size:24px; color:#333;">+</span>`
                                 }
                            </div>`;
                    }).join('')}
                </div>`;
            teamsContainer.appendChild(teamRow);
        });
        return;
    }

    let data = (currentTab === 'chars') ? charData : weaponData;
    const filtered = data.filter(item => {
        const matchSearch = item.n.toLowerCase().includes(searchQuery.toLowerCase());
        const matchRarity = currentRarity === 'Tous' || item.r == currentRarity;
        if (currentTab === 'chars') {
            return matchSearch && matchRarity && (currentElement === 'Tous' || item.e === currentElement) && (currentCharWeapon === 'Tous' || item.w === currentCharWeapon);
        } else {
            return matchSearch && matchRarity && (currentWeaponType === 'Tous' || item.t === currentWeaponType);
        }
    });

    grid.innerHTML = filtered.map(item => {
        let imgUrl = item.fullUrl || `https://genshin-impact.fandom.com/wiki/Special:FilePath/${(currentTab === 'chars' ? 'Character' : 'Weapon')}_${(item.en || item.n).replace(/\s+/g, '_')}${(currentTab === 'chars' ? '_Thumb' : '')}.png?width=250`;
        return `
            <div class="card r-${item.r}">
                <div class="rarity-badge">${item.r} ⭐</div>
                <div class="img-container">
                    <img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain;">
                </div>
                <div class="card-info">
                    <span class="type-badge ${item.e ? 'bg-'+item.e.toLowerCase().replace('é','e') : 'bg-weapon'}">${item.e || item.t}</span>
                    <h3>${item.n}</h3>
                </div>
            </div>`;
    }).join('');
}

// --- PICKER (CHOIX PERSO) ---
function openPicker(tIndex, sIndex) {
    currentTeamIdx = tIndex;
    currentSlotIdx = sIndex;
    pickerSearchQuery = '';

    const picker = document.getElementById('characterPicker');
    // On recrée dynamiquement la structure interne du Picker pour ajouter la barre de recherche
    picker.innerHTML = `
        <div id="pickerContent" style="background:#1a1a2e; width:90%; max-width:400px; max-height:80vh; border-radius:15px; display:flex; flex-direction:column; padding:15px; border:1px solid #333; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="color:white; text-align:center; font-size:16px; margin-bottom:10px;">Choisir un personnage</h2>
            
            <input type="text" id="pickerSearchInput" placeholder="Rechercher un perso..." 
                oninput="handlePickerSearch(this.value)"
                style="width:100%; padding:8px; margin-bottom:15px; border-radius:5px; border:1px solid #444; background:#252525; color:white; font-size:12px; outline:none;">
            
            <div id="pickerGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap:10px; overflow-y:auto; flex-grow:1; padding-right:5px;"></div>
            
            <button onclick="closePicker()" style="margin-top:15px; padding:10px; background:#cc3333; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%;">Annuler</button>
        </div>
    `;
    picker.style.display = 'flex';
    updatePickerGrid();
}

function updatePickerGrid() {
    const grid = document.getElementById('pickerGrid');
    const alreadyPicked = allTeams[currentTeamIdx].members;
    
    const filtered = charData.filter(char => 
        !alreadyPicked.includes(char.n) && 
        char.n.toLowerCase().includes(pickerSearchQuery.toLowerCase())
    );

    grid.innerHTML = filtered.map(char => {
        const imgUrl = char.fullUrl || `https://genshin-impact.fandom.com/wiki/Special:FilePath/Character_${(char.en || char.n).replace(/\s+/g, '_')}_Thumb.png?width=100`;
        return `
            <div class="picker-item" onclick="selectCharForTeam('${char.n.replace(/'/g, "\\'")}')" style="cursor:pointer; text-align:center;">
                <img src="${imgUrl}" style="width:65px; height:65px; border-radius:10px; object-fit:cover; border:2px solid #333; transition:0.2s;" onmouseover="this.style.borderColor='#f3d022'" onmouseout="this.style.borderColor='#333'">
                <div style="font-size:10px; color:white; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${char.n}</div>
            </div>`;
    }).join('');
}

function handlePickerSearch(val) {
    pickerSearchQuery = val;
    updatePickerGrid();
}

function closePicker() { document.getElementById('characterPicker').style.display = "none"; }

function selectCharForTeam(name) {
    allTeams[currentTeamIdx].members[currentSlotIdx] = name;
    saveTeams();
    closePicker();
    render();
}

// Init
render();
