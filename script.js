// ============================
// script.js - version complète
// ============================

// --- INIT CARTE ET ÉLÉMENTS DOM ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Éléments DOM
const loadingScreen = document.getElementById('loading-screen');
const especesContainer = document.getElementById('especes-container');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');
const popupContent = document.getElementById('popup-content');

// Assure que la popup est bien cachée au chargement (sécurité si CSS a une coquille)
popupOverlay.style.display = 'none';
popupStats.style.display = 'none';

// Fermer la popup en cliquant sur l'overlay
popupOverlay.addEventListener('click', () => {
    fermerPopup();
});

// --- STYLES LEAFLET ---
const styleDep = { color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75 };
const styleCom = { color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001 };

// --- MAPPAGE DES SONS ET IFRAMES (format : clé = nom scientifique) ---
const sonsEspeces = {
    "Turdus merula": {
        son: "https://xeno-canto.org/1047850/download",
        iframe: "https://xeno-canto.org/1047850/embed?simple=1"
    },
    "Passer domesticus": {
        son: "https://xeno-canto.org/1047609/download",
        iframe: "https://xeno-canto.org/1047609/embed?simple=1"
    }
    // Ajoute d'autres espèces ici si besoin
};

// --- UTIL : afficher/masquer loading ---
function setLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}

// --- UTIL : afficher/masquer popup custom ---
function afficherPopup() {
    popupOverlay.style.display = 'block';
    popupStats.style.display = 'flex'; // on veut un layout flex (CSS gère l'apparence)
}
function fermerPopup() {
    // Stoppe audio courant si besoin
    if (window.currentAudio) {
        try { window.currentAudio.pause(); } catch(e){ }
        window.currentAudio = null;
    }
    popupOverlay.style.display = 'none';
    popupStats.style.display = 'none';
    popupContent.innerHTML = '';
}

// --- PARSE CSV: lit le header et retourne array d'objets (colonnes nommées) ---
function parseCSVWithHeader(txt, sep=';') {
    const lines = txt.replace(/\r/g,'').split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const header = lines[0].split(sep).map(h => h.trim());
    const rows = lines.slice(1);
    return rows.map(row => {
        const cols = row.split(sep);
        // Complète manquant par chaîne vide pour éviter undefined
        while (cols.length < header.length) cols.push('');
        const obj = {};
        for (let i=0;i<header.length;i++){
            obj[header[i]] = (cols[i] || '').trim();
        }
        return obj;
    }).filter(r => Object.values(r).some(v => v !== ''));
}

// --- DÉTECTION colonne code commune dans un CSV (nom possible) ---
function trouveChampCode(headerKeys) {
    const candidats = ['codeinseecommune','code_commune','code_insee','commune_code','code'];
    for (const c of candidats) {
        const found = headerKeys.find(h => h.toLowerCase().includes(c));
        if (found) return found;
    }
    // fallback : cherche champ contenant 'insee' ou 'code'
    const found = headerKeys.find(h => /insee/i.test(h) || /code/i.test(h));
    return found || null;
}

// --- CHARGEMENT DES OISEAUX (tous fichiers années) ---
// Cette version : lit les headers et fournit objets avec champs si présents : 
// nomscientifiqueref, nomvernaculaire, espece, genre, famille, especeevalueelr, especereglementee, codecommune, annee
async function chargerTousLesOiseaux(codeDep) {
    setLoading(true);
    const annees = [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022];
    let oiseauxData = [];

    const promises = annees.map(async annee => {
        try {
            const r = await fetch(`donnees_concours/oiseaux_${annee}.csv`);
            if (!r.ok) return [];
            const txt = await r.text();
            const parsed = parseCSVWithHeader(txt, ';');
            if (!parsed.length) return [];

            const headerKeys = Object.keys(parsed[0]);
            const champCode = trouveChampCode(headerKeys);

            // Normalise pour chaque ligne
            const mapped = parsed.map(row => {
                // Tentatives pour récupérer champs avec noms différents
                const nomSci = row.nomscientifiqueref || row.nom_scientifique || row['nom scientifique'] || row['nomScientifique'] || row['scientifique'] || row['nomscientifique'] || '';
                const nomV = row.nomvernaculaire || row.nom_vernaculaire || row['nom vernaculaire'] || row['nomVernaculaire'] || '';
                const espece = row.espece || row['espèce'] || row['espece'] || row['species'] || '';
                const genre = row.genre || '';
                const famille = row.famille || '';
                // Peut être "true"/"false" ou "1"/"0" ou "oui"/"non"
                const parseBool = s => {
                    if (s === undefined || s === null) return false;
                    const t = String(s).trim().toLowerCase();
                    return ['true','1','oui','o','yes','y'].includes(t);
                };
                const especeevalueelr = parseBool(row.especeevalueelr || row.especee_valeur_elr || row.especee_valeurlr || row['especeevalueelr'] || row['liste_rouge'] || row.liste_rouge || '');
                const especereglementee = parseBool(row.especereglementee || row.espece_reglementee || row.espece_reglementée || row['especereglementee'] || row.reglementee || '');

                let codeCommune = '';
                if (champCode) codeCommune = (row[champCode] || '').trim();
                // essaie aussi colonnes contenant "code" + "commune" si vide
                if (!codeCommune) {
                    for (const k of headerKeys) {
                        if (/code.*commune|commune.*code|insee/i.test(k)) {
                            codeCommune = (row[k] || '').trim();
                            if (codeCommune) break;
                        }
                    }
                }
                // nettoie code et pad
                codeCommune = codeCommune.replace(/[^0-9]/g,'').padStart(5,'0');

                return {
                    nomscientifiqueref: nomSci,
                    nomvernaculaire: nomV,
                    espece: espece,
                    genre: genre,
                    famille: famille,
                    especeevalueelr: especeevalueelr,
                    especereglementee: especereglementee,
                    codeinseecommune: codeCommune,
                    annee: annee
                };
            });

            // Filtre par département (2 premiers chiffres du code INSEE)
            const filtered = mapped.filter(o => {
                if (!o.codeinseecommune) return false;
                return o.codeinseecommune.startsWith(codeDep.padStart(2,'0'));
            });

            return filtered;
        } catch (err) {
            console.error(`Erreur lecture oiseaux ${annee}:`, err);
            return [];
        }
    });

    const results = await Promise.all(promises);
    oiseauxData = results.flat();
    console.log(`Données oiseaux chargées pour ${codeDep} : ${oiseauxData.length} observations`);
    setLoading(false);
    return oiseauxData;
}

// --- CHARGEMENT DES COMMUNES (selon codeDep) ---
async function chargerCommunesParDep(codeDep) {
    const deptFiles = {
        "08": "communes_08.geojson", "10": "communes_10.geojson", "51": "communes_51.geojson",
        "52": "communes_52.geojson", "54": "communes_54.geojson", "55": "communes_55.geojson",
        "57": "communes_57.geojson", "67": "communes_67.geojson", "68": "communes_68.geojson",
        "88": "communes_88.geojson"
    };
    const fileName = deptFiles[codeDep];
    if (!fileName) {
        console.error(`Fichier GeoJSON non trouvé pour le département ${codeDep}`);
        return;
    }

    try {
        const resp = await fetch(`donnees_concours/${fileName}`);
        if (!resp.ok) throw new Error('GeoJSON non trouvé');
        const data = await resp.json();

        if (window.layerCommunes) map.removeLayer(window.layerCommunes);

        window.layerCommunes = L.geoJSON(data, {
            style: styleCom,
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#8b6f47",
                color: "#5e8c61",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            }),
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeCommune = (feature.properties.code || feature.properties.insee || feature.properties.code_insee || feature.properties.code_commune || '').toString().padStart(5,'0');
                    // Filtre observations pour cette commune
                    const oiseauxCommune = (window.oiseauxData || []).filter(o => o.codeinseecommune === codeCommune);

                    // Construis popup champêtre (total + par année)
                    const total = oiseauxCommune.length;
                    const countsByYear = {};
                    oiseauxCommune.forEach(o => { countsByYear[o.annee] = (countsByYear[o.annee]||0) + 1; });

                    let contenu = `<div class="popup-commune"><h3 style="margin:0 0 6px 0;">${feature.properties.nom || feature.properties.nom_commune || feature.properties.NOM || 'Commune'}</h3>`;
                    contenu += `<p style="font-weight:700; margin:0 0 8px 0;">Total d'observations : ${total}</p>`;
                    contenu += `<div style="font-size:0.9em; color:#555;"><strong>Détails par année :</strong><ul style="margin:6px 0 0 14px; padding:0;">`;
                    const years = Object.keys(countsByYear).sort();
                    if (years.length === 0) {
                        contenu += '<li>Aucun recensement connu</li>';
                    } else {
                        years.forEach(y => { contenu += `<li>${y} : ${countsByYear[y]} observation(s)</li>`; });
                    }
                    contenu += `</ul></div></div>`;

                    // Ouvre popup leaflet personnalisée (classe pour styliser champêtre via CSS)
                    layer.bindPopup(contenu, { className: 'popup-champetre' }).openPopup();

                    // Optionnel : affiche les badges d'espèces dans le panneau inférieur
                    afficherOiseaux(codeCommune, feature.properties.nom || feature.properties.nom_commune || 'Commune', oiseauxCommune);

                    // Si tu veux lancer les chants de cette commune automatiquement : 
                    // Rassemble les espèces disponibles et joue (on évite superposition si plusieurs)
                    // Ici on ne lance que la première espèce avec son dispo pour ne pas spammer
                    const especesAvecSon = [...new Set(oiseauxCommune.map(o => o.nomscientifiqueref))].filter(s => sonsEspeces[s]?.son);
                    if (especesAvecSon.length > 0) {
                        playChant(especesAvecSon[0]); // jouer la première disponible
                    }
                });
            }
        }).addTo(map);

    } catch (err) {
        console.error('Erreur chargement communes:', err);
    }
}

// --- AFFICHAGE DES ESPÈCES (badges) dans le panneau inférieur ---
function afficherOiseaux(codeCommune, nomCommune, oiseauxCommune) {
    especesContainer.innerHTML = '';
    if (!oiseauxCommune || oiseauxCommune.length === 0) {
        especesContainer.innerHTML = `<p style="text-align:center; padding:10px;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte par nom vernaculaire (ou espece si vide)
    const counts = {};
    oiseauxCommune.forEach(o => {
        const key = o.nomvernaculaire || o.espece || o.nomscientifiqueref || 'Inconnu';
        counts[key] = (counts[key] || 0) + 1;
    });

    // Trie décroissant
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);

    entries.forEach(([label, count]) => {
        // Récupère une observation représentative
        const obs = oiseauxCommune.find(o => (o.nomvernaculaire || o.espece || o.nomscientifiqueref) === label) || oiseauxCommune[0];
        const nomScientifique = obs.nomscientifiqueref || '';
        const nomVernac = obs.nomvernaculaire || label;

        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        const img = document.createElement('img');
        const nomImage = (label || '').replace(/ /g,'_').replace(/"/g,'');
        img.src = `photos/${nomImage}.jpg`;
        img.alt = label;
        img.onerror = () => {
            img.src = `https://via.placeholder.com/60?text=${encodeURIComponent((label||'').charAt(0) || '?')}`;
        };

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        especesContainer.appendChild(badge);

        // click ouvre popup espèce (avec toutes les observations de cette espèce dans la commune)
        badge.addEventListener('click', () => {
            const obsEspece = oiseauxCommune.filter(o => (o.nomvernaculaire || o.espece || o.nomscientifiqueref) === label);
            afficherStatsEspece(nomVernac, obsEspece, nomCommune, nomScientifique);
        });
    });
}

// --- AFFICHAGE STATISTIQUES ESPÈCE (popup custom) ---
// Titre : nomvernaculaire (comme demandé)
// Photo à gauche, infos à droite en paysage; iframe audio sous la photo (même largeur)
function afficherStatsEspece(nomVernaculaire, observations, nomCommune, nomScientifique) {
    afficherPopup();

    // Regroupe par année
    const counts = {};
    observations.forEach(o => { counts[o.annee] = (counts[o.annee] || 0) + 1; });

    // Récupère infos complémentaires depuis la première observation (si disponibles)
    const first = observations[0] || {};
    const genre = first.genre || '';
    const famille = first.famille || '';
    const especeevalueelr = first.especeevalueelr || false;
    const especereglementee = first.especereglementee || false;

    // Nom scientifique : privilégie champ, sinon vide
    const nomSci = nomScientifique || first.nomscientifiqueref || '';

    // Construis la popup HTML
    // On veut que l'iframe ait la même largeur que l'image : on place image dans container de largeur fixe 260px
    let html = `<div style="display:flex; gap:20px; width:100%; align-items:flex-start;">
        <div style="flex:0 0 260px;">
            <img
                src="photos/${(nomVernaculaire||'').replace(/ /g,'_').replace(/"/g,'')}.jpg"
                alt="${nomVernaculaire}"
                class="popup-image"
                style="width:260px; height:200px; object-fit:cover; border-radius:12px;"
                onerror="this.src='https://via.placeholder.com/260x200?text=${encodeURIComponent((nomVernaculaire||'').charAt(0) || '?')}'"
            >
    `;

    // Ajout de l'iframe directement sous la photo, de même largeur
    const sonEntry = sonsEspeces[nomSci] || sonsEspeces[first.nomscientifiqueref];
    if (sonEntry && sonEntry.iframe) {
        // iframe responsive au container (260px)
        html += `<div style="margin-top:10px;">
                    <iframe
                        src="${sonEntry.iframe}"
                        scrolling="no"
                        frameborder="0"
                        width="100%"
                        height="100"
                        style="border-radius: 6px; max-width:260px; display:block;"
                    ></iframe>
                 </div>`;
    } else {
        html += `<div style="margin-top:10px; font-size:0.9em; color:#7f8c8d;">Aucun enregistrement audio disponible.</div>`;
    }

    html += `</div>`; // close left column

    // Right column with textual info
    html += `<div style="flex:1; position:relative;">
                <div class="popup-close" onclick="fermerPopup()" style="position:absolute; right:0; top:-4px; font-size:22px; cursor:pointer;">×</div>
                <h2 style="color:#5e8c61; margin-top:0;">${nomVernaculaire}</h2>
                <p style="margin:4px 0;"><em>${nomSci || ''}</em></p>
                <p style="margin:4px 0;"><strong>Commune :</strong> ${nomCommune}</p>
                <p style="margin:4px 0;"><strong>Genre :</strong> ${genre || '-'}</p>
                <p style="margin:4px 0;"><strong>Famille :</strong> ${famille || '-'}</p>
                <p style="margin:4px 0;"><strong>Liste Rouge :</strong> ${especeevalueelr ? 'Oui' : 'Non'}</p>
                <p style="margin:4px 0 8px 0;"><strong>Réglementée :</strong> ${especereglementee ? 'Oui' : 'Non'}</p>
                <div style="margin-top:8px;">
                    <strong>Observations :</strong>
                    <ul style="margin:6px 0 0 14px; padding:0;">`;
    const years = Object.keys(counts).sort();
    if (years.length === 0) {
        html += `<li>Aucune observation détaillée</li>`;
    } else {
        years.forEach(y => html += `<li>• ${y} : ${counts[y]} observation(s)</li>`);
    }
    html += `</ul></div></div></div>`; // close right column and main container

    popupContent.innerHTML = html;

    // Précharge et tente de lancer le son (si disponible)
    if (sonEntry && sonEntry.son) {
        // Stoppe audio courant
        if (window.currentAudio) {
            try { window.currentAudio.pause(); } catch(e){}
            window.currentAudio = null;
        }
        // Crée audio et tente de jouer
        try {
            window.currentAudio = new Audio(sonEntry.son);
            window.currentAudio.play().catch(err => {
                // Lecture bloquée (autoplay) : on informe mais l'iframe restera visible pour interaction manuelle
                console.warn('Lecture automatique bloquée par le navigateur.', err);
                // Pas d'alert intrusif ; l'utilisateur peut cliquer sur lecteur (iframe) pour lancer
            });
        } catch (e) {
            console.error('Erreur création audio:', e);
        }
    }
}

// --- PLAY CHANT (utilitaire réutilisable) ---
function playChant(nomScientifique) {
    const entry = sonsEspeces[nomScientifique];
    if (!entry || !entry.son) {
        console.warn(`Aucun son configuré pour ${nomScientifique}`);
        return;
    }
    // stoppe audio précédent
    if (window.currentAudio) {
        try { window.currentAudio.pause(); } catch(e){}
        window.currentAudio = null;
    }
    window.currentAudio = new Audio(entry.son);
    window.currentAudio.play().catch(err => {
        console.warn('Impossible de lancer automatiquement le son :', err);
    });
}

// --- CHARGEMENT DES DÉPARTEMENTS ET LOGIQUE D'INTERACTION ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(resp => resp.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = (feature.properties.code || feature.properties.CODE || feature.properties.code_dept || '').toString().padStart(2,'0');
                    if (!codeDep) {
                        console.error('Code département introuvable pour la feature', feature);
                        return;
                    }
                    setLoading(true);
                    // Charge toutes les observations du département (ou réutilise en cache)
                    window.oiseauxData = await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                    setLoading(false);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error('Erreur chargement départements:', err));
