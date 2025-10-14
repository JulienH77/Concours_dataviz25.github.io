// --- STYLES LEAFLET ---
const styleDep = {
    color: "black",
    weight: 3,
    opacity: 0.8,
    fill: true,
    fillColor: "white",
    fillOpacity: 0.75
};

const styleCom = {
    color: "black",
    weight: 1,
    opacity: 0.5,
    fill: true,
    fillColor: "white",
    fillOpacity: 0.001
};

// --- INIT CARTE ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
}).addTo(map);

let layerCommunes = null;
let oiseauxData = [];
const annees = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];

// --- CHARGEMENT DE TOUS LES CSV (2012-2022) ---
async function chargerTousLesOiseaux(codeDep) {
    oiseauxData = [];
    for (const annee of annees) {
        const url = `donnees_concours/oiseaux_${annee}.csv`;
        try {
            const response = await fetch(url);
            const txt = await response.text();
            const lignes = txt.split('\n').slice(1); // Enlève l'entête
            lignes.forEach((l, i) => {
                const cols = l.split(';');
                if (cols.length < 10) return;
                let code = cols[9]?.trim(); // codeinseecommune (index 9)
                if (!code) return;
                code = code.padStart(5, '0');
                if (code.startsWith(codeDep.padStart(2, '0'))) {
                    oiseauxData.push({
                        nomScientifique: cols[0]?.trim(),
                        nomVernaculaire: cols[1]?.trim(),
                        espece: cols[3]?.trim(),
                        genre: cols[4]?.trim(),
                        famille: cols[5]?.trim(),
                        especeDirectiveEuropeenne: cols[6]?.trim(),
                        especeEvalueeLR: cols[7]?.trim(),
                        especeReglementee: cols[8]?.trim(),
                        dateObservation: cols[10]?.trim(),
                        codeinseecommune: code,
                        annee: annee
                    });
                }
            });
        } catch (err) {
            console.error(`Erreur chargement oiseaux ${annee}:`, err);
        }
    }
    console.log(`Données chargées pour le département ${codeDep}: ${oiseauxData.length} observations`);
}

// --- CHARGEMENT DES COMMUNES (inchangé) ---
async function chargerCommunesParDep(codeDep) {
    if (layerCommunes) map.removeLayer(layerCommunes);
    try {
        const response = await fetch("donnees_concours/communes-grand-est.geojson");
        const data = await response.json();
        const communesFiltrees = {
            type: "FeatureCollection",
            features: data.features.filter(f =>
                f.properties.code && f.properties.code.startsWith(codeDep.padStart(2, '0'))
            )
        };
        layerCommunes = L.geoJSON(communesFiltrees, {
            style: styleCom,
            onEachFeature: (feature, layer) => {
                layer.on('click', () => {
                    afficherOiseaux(feature.properties.code, feature.properties.nom);
                });
            }
        }).addTo(map);
    } catch (err) {
        console.error("Erreur chargement communes:", err);
    }
}

// --- AFFICHAGE DES ESPÈCES SOUS LA CARTE ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0');
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);
    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);

    const container = document.getElementById('especes-container');
    container.innerHTML = '';

    if (oiseauxCommune.length === 0) {
        container.innerHTML = `<p>Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte le nombre d'observations par espèce
    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    // Affiche un badge par espèce
    for (const [espece, count] of Object.entries(especesCount)) {
        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        // Image placeholder (à remplacer par tes photos)
        const img = document.createElement('img');
        img.src = `https://via.placeholder.com/70?text=${encodeURIComponent(espece.charAt(0))}`;
        img.alt = espece;

        // Nombre d'observations en exposant
        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        container.appendChild(badge);

        // Événement pour afficher la popup
        badge.onclick = () => afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune);
    }
}

// --- AFFICHAGE DES STATISTIQUES DANS UNE POPUP ---
function afficherStatsEspece(espece, observations, nomCommune) {
    const popup = document.getElementById('popup-stats');
    popup.innerHTML = '';

    // Récupère les infos de la première observation (toutes ont les mêmes métadonnées)
    const stats = {
        nomScientifique: observations[0].nomScientifique,
        nomVernaculaire: observations[0].nomVernaculaire,
        genre: observations[0].genre,
        famille: observations[0].famille,
        especeDirectiveEuropeenne: observations[0].especeDirectiveEuropeenne,
        especeEvalueeLR: observations[0].especeEvalueeLR,
        especeReglementee: observations[0].especeReglementee,
        observationsParAnnee: {}
    };

    // Compte le nombre d'observations par année
    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    // Crée le contenu de la popup
    let content = `
        <div class="popup-close" onclick="document.getElementById('popup-stats').classList.add('popup-hidden')">×</div>
        <h2>${espece}</h2>
        <p><strong>Nom scientifique:</strong> ${stats.nomScientifique}</p>
        <p><strong>Nom vernaculaire:</strong> ${stats.nomVernaculaire}</p>
        <p><strong>Genre:</strong> ${stats.genre}</p>
        <p><strong>Famille:</strong> ${stats.famille}</p>
        <p><strong>Espèce directive européenne:</strong> ${stats.especeDirectiveEuropeenne}</p>
        <p><strong>Espèce évaluée Liste Rouge:</strong> ${stats.especeEvalueeLR}</p>
        <p><strong>Espèce réglementée:</strong> ${stats.especeReglementee}</p>
        <p><strong>Observations à ${nomCommune}:</strong></p>
        <ul>
    `;

    // Ajoute les observations par année
    for (const [annee, count] of Object.entries(stats.observationsParAnnee).sort()) {
        content += `<li>${annee}: ${count} observation(s)</li>`;
    }

    content += `</ul>`;
    popup.innerHTML = content;
    popup.classList.remove('popup-hidden');
}

// --- CHARGEMENT DES DÉPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code;
                    console.log("Département cliqué:", codeDep);
                    await chargerTousLesOiseaux(codeDep);
                    chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements:", err));
