// ============================
// script.js - version stable
// ============================

// --- INIT CARTE ET ÉLÉMENTS DOM ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const loadingScreen = document.getElementById('loading-screen');
const especesContainer = document.getElementById('especes-container');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');
const popupContent = document.getElementById('popup-content');

// Safety: ensure popup hidden on load
popupOverlay.style.display = 'none';
popupStats.style.display = 'none';

// Close on overlay click (already set in HTML but keep safe)
popupOverlay.addEventListener('click', fermerPopup);

// --- STYLES LEAFLET ---
const styleDep = { color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75 };
const styleCom = { color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001 };

// --- SONS : mapping par nom scientifique (utiliser clé 'nomscientifiqueref') ---
const sonsEspeces = {
    "Turdus merula": {
        son: "https://xeno-canto.org/1047850/download",
        iframe: "https://xeno-canto.org/1047850/embed?simple=1"
    },
    "Passer domesticus": {
        son: "https://xeno-canto.org/1047609/download",
        iframe: "https://xeno-canto.org/1047609/embed?simple=1"
    }
};

// --- UTILITAIRES ---
function setLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}
function afficherPopup() {
    popupOverlay.style.display = 'block';
    popupStats.style.display = 'flex';
    popupStats.setAttribute('aria-hidden', 'false');
}
function fermerPopup() {
    if (window.currentAudio) {
        try { window.currentAudio.pause(); } catch(e){}
        window.currentAudio = null;
    }
    popupOverlay.style.display = 'none';
    popupStats.style.display = 'none';
    popupStats.setAttribute('aria-hidden', 'true');
    popupContent.innerHTML = '';
}

// parse CSV robust
function parseCSVWithHeader(txt, sep=';') {
    const lines = txt.replace(/\r/g,'').split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return [];
    const header = lines[0].split(sep).map(h => h.trim());
    const rows = lines.slice(1);
    return rows.map(r => {
        const cols = r.split(sep);
        while (cols.length < header.length) cols.push('');
        const obj = {};
        for (let i=0;i<header.length;i++) obj[header[i]] = (cols[i]||'').trim();
        return obj;
    }).filter(r => Object.values(r).some(v => v !== ''));
}

// find probable code column
function trouveChampCode(headerKeys) {
    const candidats = ['codeinseecommune','code_commune','code_insee','commune_code','insee','code'];
    for (const c of candidats) {
        const found = headerKeys.find(h => h.toLowerCase().includes(c));
        if (found) return found;
    }
    return null;
}

// normalize boolean values
function parseBool(s) {
    if (s === undefined || s === null) return false;
    const t = String(s).trim().toLowerCase();
    return ['true','1','oui','o','yes','y'].includes(t);
}

// --- CHARGEMENT DES OISEAUX ---
async function chargerTousLesOiseaux(codeDep) {
    setLoading(true);
    const annees = [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022];
    const all = [];

    const promises = annees.map(async annee => {
        try {
            const resp = await fetch(`donnees_concours/oiseaux_${annee}.csv`);
            if (!resp.ok) return [];
            const txt = await resp.text();
            const parsed = parseCSVWithHeader(txt, ';');
            if (!parsed.length) return [];

            const headerKeys = Object.keys(parsed[0]);
            const champCode = trouveChampCode(headerKeys);

            return parsed.map(row => {
                // Try several header names
                const nomscientifiqueref = row.nomscientifiqueref || row.nom_scientifique || row['nom scientifique'] || row['nomScientifique'] || row['scientifique'] || row['nomScientifiqueRef'] || '';
                const nomvernaculaire = row.nomvernaculaire || row.nom_vernaculaire || row['nom vernaculaire'] || row['nomVernaculaire'] || row['vernaculaire'] || '';
                const espece = row.espece || row['espèce'] || row['species'] || '';
                const genre = row.genre || '';
                const famille = row.famille || '';
                const especeevalueelr = parseBool(row.especeevalueelr || row.especee_valeurlr || row.liste_rouge || row['liste_rouge']);
                const especereglementee = parseBool(row.especereglementee || row.espece_reglementee || row.reglementee);

                // determine code commune
                let codeCommune = champCode ? (row[champCode] || '') : '';
                if (!codeCommune) {
                    for (const k of headerKeys) {
                        if (/insee|code.*commune|commune.*code/i.test(k)) {
                            if (row[k]) { codeCommune = row[k]; break; }
                        }
                    }
                }
                codeCommune = (codeCommune || '').replace(/\D/g,'').padStart(5,'0');

                return {
                    nomscientifiqueref: nomscientifiqueref,
                    nomvernaculaire: nomvernaculaire,
                    espece: espece,
                    genre: genre,
                    famille: famille,
                    especeevalueelr: especeevalueelr,
                    especereglementee: especereglementee,
                    codeinseecommune: codeCommune,
                    annee: annee
                };
            }).filter(o => o.codeinseecommune && o.codeinseecommune.startsWith(codeDep.padStart(2,'0')));
        } catch (err) {
            console.error('Erreur lecture CSV', annee, err);
            return [];
        }
    });

    const results = await Promise.all(promises);
    const flat = results.flat();
    setLoading(false);
    console.log(`Chargé ${flat.length} obs pour département ${codeDep}`);
    window.oiseauxData = flat;
    return flat;
}

// --- CHARGEMENT COMMUNES ---
async function chargerCommunesParDep(codeDep) {
    const deptFiles = {
        "08": "communes_08.geojson", "10": "communes_10.geojson", "51": "communes_51.geojson",
        "52": "communes_52.geojson", "54": "communes_54.geojson", "55": "communes_55.geojson",
        "57": "communes_57.geojson", "67": "communes_67.geojson", "68": "communes_68.geojson",
        "88": "communes_88.geojson"
    };
    const file = deptFiles[codeDep];
    if (!file) { console.error('Fichier communes absent pour', codeDep); return; }

    try {
        const r = await fetch(`donnees_concours/${file}`);
        if (!r.ok) throw new Error('GeoJSON non trouvé');
        const geo = await r.json();

        if (window.layerCommunes) map.removeLayer(window.layerCommunes);

        window.layerCommunes = L.geoJSON(geo, {
            style: styleCom,
            pointToLayer: (f, latlng) => L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#8b6f47",
                color: "#5e8c61",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            }),
            onEachFeature: (feature, layer) => {
                layer.on('click', () => {
                    const props = feature.properties || {};
                    const codeCommune = (props.code || props.insee || props.code_insee || props.code_commune || '').toString().padStart(5,'0');
                    const nomCommune = props.nom || props.nom_commune || props.NOM || 'Commune';

                    const oiseauxCommune = (window.oiseauxData || []).filter(o => o.codeinseecommune === codeCommune);

                    // popup champêtre content
                    const total = oiseauxCommune.length;
                    const countsByYear = {};
                    oiseauxCommune.forEach(o => countsByYear[o.annee] = (countsByYear[o.annee]||0) + 1);

                    let contenu = `<div class="popup-commune"><h3>${nomCommune}</h3><p style="font-weight:700; margin:6px 0;">Total d'observations : ${total}</p>`;
                    contenu += `<div style="font-size:0.95em; color:#444;"><strong>Détails par année :</strong><ul>`;
                    const years = Object.keys(countsByYear).sort();
                    if (years.length === 0) contenu += `<li>Aucun recensement connu</li>`;
                    else years.forEach(y => contenu += `<li>${y} : ${countsByYear[y]} observation(s)</li>`);
                    contenu += `</ul></div></div>`;

                    layer.bindPopup(contenu, { className: 'popup-champetre' }).openPopup();

                    // Fill bottom panel with species badges of this commune
                    afficherOiseaux(codeCommune, nomCommune, oiseauxCommune);

                    // Optional: play first available species audio
                    const especeSci = [...new Set(oiseauxCommune.map(o => o.nomscientifiqueref))].find(s => sonsEspeces[s]?.son);
                    if (especeSci) {
                        playChant(especeSci);
                    }
                });
            }
        }).addTo(map);

    } catch (err) {
        console.error('Erreur chargement communes', err);
    }
}

// --- AFFICHAGE BADGES DANS PANEL (corrigé : group by nomscientifiqueref pour éviter fusion) ---
function afficherOiseaux(codeCommune, nomCommune, oiseauxCommune) {
    especesContainer.innerHTML = '';

    if (!oiseauxCommune || oiseauxCommune.length === 0) {
        especesContainer.innerHTML = `<p style="text-align:center; padding:10px;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // group by nomscientifiqueref (fallback order)
    const mapEsp = new Map(); // key -> {nomSci, nomVern, count, exemples[]}
    oiseauxCommune.forEach(o => {
        const key = o.nomscientifiqueref || o.espece || o.nomvernaculaire || 'Inconnu';
        const nomSci = o.nomscientifiqueref || '';
        const nomV = o.nomvernaculaire || o.espece || nomSci || 'Inconnu';
        if (!mapEsp.has(key)) mapEsp.set(key, { nomSci: nomSci, nomV: nomV, count: 0, exemples: [] });
        const entry = mapEsp.get(key);
        entry.count += 1;
        entry.exemples.push(o);
    });

    // transform and sort descending by count
    const entries = Array.from(mapEsp.values()).sort((a,b) => b.count - a.count);

    entries.forEach(entry => {
        const labelV = entry.nomV;
        const nomSci = entry.nomSci || labelV;
        const count = entry.count;
        const examples = entry.exemples;

        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        const img = document.createElement('img');
        const nomImage = (labelV || nomSci).replace(/ /g,'_').replace(/"/g,'').replace(/\//g,'_');
        img.src = `photos/${nomImage}.jpg`;
        img.alt = labelV;
        img.onerror = () => { img.src = `https://via.placeholder.com/60?text=${encodeURIComponent((labelV||'').charAt(0)||'?')}`; };

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        especesContainer.appendChild(badge);

        // click opens popup for that species (all observations in commune)
        badge.addEventListener('click', () => {
            // observations for that species in this commune:
            const obs = examples.slice(); // already collected
            afficherStatsEspece(labelV, obs, nomCommune, nomSci);
        });
    });
}

// --- AFFICHAGE POPUP D'UNE ESPÈCE ---
function afficherStatsEspece(nomVernaculaire, observations, nomCommune, nomScientifique) {
    afficherPopup();

    // counts by year
    const counts = {};
    observations.forEach(o => counts[o.annee] = (counts[o.annee]||0) + 1);

    // use first for extra metadata
    const first = observations[0] || {};
    const genre = first.genre || '';
    const famille = first.famille || '';
    const especeevalueelr = !!first.especeevalueelr;
    const especereglementee = !!first.especereglementee;
    const nomSci = nomScientifique || first.nomscientifiqueref || '';

    // left column: image + iframe under image (fixed width)
    const sanitized = (nomVernaculaire || nomSci || 'espece').replace(/ /g,'_').replace(/"/g,'').replace(/\//g,'_');
    let html = `<div><div class="left-col"><img src="photos/${sanitized}.jpg" alt="${nomVernaculaire}" class="popup-image" style="width:260px;height:200px;object-fit:cover;border-radius:8px;" onerror="this.src='https://via.placeholder.com/260x200?text=${encodeURIComponent((nomVernaculaire||'').charAt(0)||'?')}'" />`;

    // add iframe if available
    const sonEntry = sonsEspeces[nomSci] || sonsEspeces[first.nomscientifiqueref];
    if (sonEntry && sonEntry.iframe) {
        html += `<div style="margin-top:10px; max-width:260px;"><iframe src="${sonEntry.iframe}" scrolling="no" frameborder="0" width="100%" height="100" style="border-radius:6px; display:block;"></iframe></div>`;
    } else {
        html += `<div style="margin-top:10px; font-size:0.9em; color:#7f8c8d;">Aucun enregistrement audio disponible.</div>`;
    }
    html += `</div>`; // close left-col

    // right column
    html += `<div class="right-col" style="padding-left:12px; position:relative;"><div class="popup-close" onclick="fermerPopup()">×</div>`;
    html += `<h2 style="color:#5e8c61; margin-top:0;">${nomVernaculaire}</h2>`;
    html += `<p style="margin:4px 0;"><em>${nomSci || ''}</em></p>`;
    html += `<p style="margin:4px 0;"><strong>Commune :</strong> ${nomCommune}</p>`;
    html += `<p style="margin:4px 0;"><strong>Genre :</strong> ${genre || '-'}</p>`;
    html += `<p style="margin:4px 0;"><strong>Famille :</strong> ${famille || '-'}</p>`;
    html += `<p style="margin:4px 0;"><strong>Liste Rouge :</strong> ${especeevalueelr ? 'Oui' : 'Non'}</p>`;
    html += `<p style="margin:4px 0;"><strong>Réglementée :</strong> ${especereglementee ? 'Oui' : 'Non'}</p>`;
    html += `<div style="margin-top:8px;"><strong>Observations :</strong><ul style="margin:6px 0 0 14px;padding:0;">`;
    const years = Object.keys(counts).sort();
    if (years.length === 0) html += `<li>Aucune observation détaillée</li>`;
    else years.forEach(y => html += `<li>• ${y} : ${counts[y]} observation(s)</li>`);
    html += `</ul></div></div></div>`;

    popupContent.innerHTML = html;

    // Attempt to preload and autoplay audio (may be blocked by browser)
    if (sonEntry && sonEntry.son) {
        try {
            if (window.currentAudio) { try { window.currentAudio.pause(); } catch(e){} window.currentAudio = null; }
            window.currentAudio = new Audio(sonEntry.son);
            window.currentAudio.volume = 1.0;
            window.currentAudio.play().catch(err => {
                // autoplay blocked: we keep iframe visible so user can click to play in it
                console.warn('Autoplay bloqué :', err);
            });
        } catch (e) {
            console.error('Erreur création audio:', e);
        }
    }
}

// --- UTIL: lancer chant explicitement ---
function playChant(nomScientifique) {
    const entry = sonsEspeces[nomScientifique];
    if (!entry || !entry.son) { console.warn('Aucun son pour', nomScientifique); return; }
    if (window.currentAudio) { try { window.currentAudio.pause(); } catch(e){} window.currentAudio = null; }
    window.currentAudio = new Audio(entry.son);
    window.currentAudio.play().catch(err => { console.warn('Lecture auto impossible', err); });
}

// --- CHARGEMENT DÉPARTEMENTS ET LOGIQUE ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(geo => {
        L.geoJSON(geo, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = (feature.properties.code || feature.properties.CODE || feature.properties.code_dept || '').toString().padStart(2,'0');
                    if (!codeDep) { console.error('Code dep introuvable'); return; }
                    setLoading(true);
                    await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                    setLoading(false);
                });
            }
        }).addTo(map);
    }).catch(err => console.error('Erreur départements:', err));
