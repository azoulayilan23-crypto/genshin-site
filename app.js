let currentTab = 'characters';
let currentElementFilter = 'all';
let currentWeaponTypeFilter = 'all';
let currentRarityFilter = 'all'; 
let currentArtifactFilter = 'all';
let currentSearchQuery = '';
let alphaDirection = 'asc'; 

function getCharacterElement(item) {
    return item.divin || item.gnosis || item.lunaire || item.stellaire || item.serpent || item.trilunaire || item.autorité;
}

function render() {
    const grid = document.getElementById('mainGrid');
    grid.innerHTML = '';

    if (currentTab === 'talents' || currentTab === 'constellation') {
        grid.classList.add('talents-view');
    } else {
        grid.classList.remove('talents-view');
    }

    let dataSource = (currentTab === 'talents' || currentTab === 'constellation') ? 'characters' : currentTab;
    let filtered = [...LOCAL_GENSHIN_DATA[dataSource]];

    if (currentSearchQuery) {
        filtered = filtered.filter(item => item.name && item.name.toLowerCase().includes(currentSearchQuery.toLowerCase()));
    }

    if (currentRarityFilter !== 'all') {
        filtered = filtered.filter(item => item.rarity === parseInt(currentRarityFilter));
    }

    if ((currentTab === 'characters' || currentTab === 'talents' || currentTab === 'constellation') && currentElementFilter !== 'all') {
        filtered = filtered.filter(char => {
            return getCharacterElement(char) === currentElementFilter;
        });
    }

    if (currentTab === 'weapons' && currentWeaponTypeFilter !== 'all') {
        filtered = filtered.filter(weapon => weapon.type === currentWeaponTypeFilter);
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
                    <span class="badge" style="background-color:#111">${item.type}</span>
                </div>
                <h3 style="font-size:1.1rem; margin:10px 0 5px 0;">${item.name}</h3>
                <div class="details">
                    <p style="margin:5px 0 0 0; color: var(--rarity-5);">${'★'.repeat(item.rarity)}</p>
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
                    </div>
                `;
            }
            
            if (item.ultime && item.ultime !== 'Non renseigné') {
                cardHTML += `
                    <div class="talent-box">
                        <div class="talent-name">💥 Déchaînement élémentaire (Q) : ${item.ultime}</div>
                        <p class="talent-desc">${item.ultdesc || 'Aucune description disponible.'}</p>
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

        else if (currentTab === 'constellation') {
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
                    <span class="badge" style="background-color:#111">${item.type}</span>
                </div>
                <h3 style="font-size:1.1rem; margin:10px 0 5px 0;">${item.name}</h3>
                <div class="details">
                    <p style="margin:5px 0 0 0; color: var(--rarity-5);">${'★'.repeat(item.rarity)}</p>
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
    let htmlContent = '';

    if (type === 'characters') {
        const elementValue = getCharacterElement(item);
        htmlContent = `
            <div class="modal-header">
                <img src="${item.icon}" class="modal-img">
                <div class="modal-title">
                    <h2>${item.name}</h2>
                    <p>${'★'.repeat(item.rarity)} <br> Élément : <strong>${elementValue}</strong> | Arme : <strong>${item.weapon}</strong> | Élévation : <strong>${item.elevation}</strong></p>
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
                    <p>${'★'.repeat(item.rarity)} <br> Catégorie : <strong>${item.type}</strong> | Stat. principale : <strong>${item.main}</strong> | Stat. secondaire : <strong>${item.sub}</strong></p>
                </div>
            </div>
            <div class="section-title">📊 Propriétés Légendaires</div>
            <div class="substat-grid">
                <div><strong>Rareté :</strong> ${item.rarity} Étoiles</div>
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
                    <p>${'★'.repeat(item.rarity)} <br> Catégorie : <strong>${item.type}</strong></p>
                </div>
            </div>
            <div class="section-title">📊 Propriétés Légendaires</div>
            <div class="substat-grid">
                <div><strong>Rareté :</strong> ${item.rarity} Étoiles</div>
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
    currentSearchQuery = '';
    document.getElementById('searchBox').value = '';

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
            
            if (currentTab === 'characters' || currentTab === 'talents' || currentTab === 'constellation') {
                document.getElementById('elementFilters').style.display = 'flex';
                document.getElementById('weaponTypeFilters').style.display = 'none';
                document.getElementById('ArtifactFilter').style.display = 'none';    
            } else if (currentTab === 'weapons') {
                document.getElementById('elementFilters').style.display = 'none';
                document.getElementById('weaponTypeFilters').style.display = 'flex';
                document.getElementById('ArtifactFilter').style.display = 'none';
            } else if (currentTab === 'artifacts') {
                document.getElementById('elementFilters').style.display = 'none';
                document.getElementById('weaponTypeFilters').style.display = 'none';
                document.getElementById('ArtifactFilter').style.display = 'flex';
            } else {
                document.getElementById('elementFilters').style.display = 'none';
                document.getElementById('weaponTypeFilters').style.display = 'none';
                document.getElementById('ArtifactFilter').style.display = 'none';
            }                    

            if (currentTab === 'weapons') {
                document.getElementById('btnRarity3').style.display = 'inline-block';
            } else {
                document.getElementById('btnRarity3').style.display = 'none';
            }
            
            resetFilters();
            render();
        });
    });

    document.getElementById('searchBox').addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        render();
    });

    const sortAlphaBtn = document.getElementById('sortAlphaBtn');
    sortAlphaBtn.addEventListener('click', () => {
        alphaDirection = (alphaDirection === 'asc') ? 'desc' : 'asc';
        sortAlphaBtn.innerText = `Tri : ${alphaDirection === 'asc' ? 'A-Z' : 'Z-A'}`;
        render();
    });

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

    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('detailsModal').classList.remove('open');
    });
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailsModal');
        if (e.target === modal) modal.classList.remove('open');
    });
}

setupControls();
render();