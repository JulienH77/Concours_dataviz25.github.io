// --- STYLES LEAFLET (COULEURS D'ORIGINE) ---
const styleDep = {
    color: "black",       // Bordure noire
    weight: 3,           // Épaisseur 3
    opacity: 0.8,        // Opacité bordure
    fill: true,          // Remplissage activé
    fillColor: "white",  // Blanc
    fillOpacity: 0.75   // Opacité remplissage
};

const styleCom = {
    color: "black",       // Bordure noire
    weight: 1,           // Épaisseur 1
    opacity: 0.5,        // Opacité bordure
    fill: true,          // Remplissage activé
    fillColor: "white",  // Blanc
    fillOpacity: 0.001   // Quasi transparent
};

// --- INIT CARTE ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
}).addTo(map);

let layerCommunes = null;
let oiseauxData = [];
const annees = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
const loader = document.getElementById('loader');

// --- AFFICHER/MASQUER LE LOADER ---
function setLoading(isLoading) {
    loader.classList.toggle('hidden', !isLoading);
}

// --- CHARGEMENT OPTIMISÉ DES CSV ---
async function chargerTousLesOiseaux(codeDep) {
    setLoading(true);
    oiseauxData = [];
    const promises = annees.map(annee =>
        fetch(`donnees_concours/oiseaux_${annee}.csv`)
            .then(r => r.text())
            .then(txt => {
                const lignes = txt.split('\n').slice(1);
                return lignes.map(l => {
                    const cols = l.split(';');
                    if (cols.length < 10) return null;
                    let code = cols[9]?.trim();
                    if (!code) return null;
                    code = code.padStart(5, '0');
                    if (code.startsWith(codeDep.padStart(2, '0'))) {
                        return {
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
                        };
                    }
                    return null;
                }).filter(Boolean);
            })
            .catch(err => {
                console.error(`Erreur chargement oiseaux ${annee}:`, err);
                return [];
            })
    );

    const results = await Promise.all(promises);
    oiseauxData = results.flat();
    console.log(`Données chargées pour le département ${codeDep}: ${oiseauxData.length} observations`);
    setLoading(false);
}

// --- CHARGEMENT DES COMMUNES (avec popup Leaflet) ---
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
                const codeCommune = feature.properties.code.padStart(5, '0');
                const count = oiseauxData.filter(o => o.codeinseecommune === codeCommune).length;
                layer.bindPopup(`<b>${feature.properties.nom}</b><br>Recensements: ${count}`);
                layer.on('click', () => {
                    afficherOiseaux(feature.properties.code, feature.properties.nom);
                });
            }
        }).addTo(map);
    } catch (err) {
        console.error("Erreur chargement communes:", err);
    }
}

// --- AFFICHAGE DES ESPÈCES (exposants visibles) ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0');
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);
    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);

    const container = document.getElementById('especes-container');
    container.innerHTML = '';

    if (oiseauxCommune.length === 0) {
        container.innerHTML = `<p style="text-align: center; width: 100%; color: #5e8c61;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte le nombre d'observations par espèce
    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    // Trie les espèces par nombre d'observations
    const especesTriees = Object.entries(especesCount).sort((a, b) => b[1] - a[1]);

    // Affiche un badge par espèce
    especesTriees.forEach(([espece, count]) => {
        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        const img = document.createElement('img');
        img.src = `https://via.placeholder.com/60?text=${encodeURIComponent(espece.charAt(0))}`;
        img.alt = espece;

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        container.appendChild(badge);

        badge.onclick = () => afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune);
    });
}

// --- AFFICHAGE DES STATISTIQUES (inchangé) ---
function afficherStatsEspece(espece, observations, nomCommune) {
    const popup = document.getElementById('popup-stats');
    popup.innerHTML = '';

    const stats = {
        nomScientifique: observations[0].nomScientifique,
        nomVernaculaire: observations[0].nomVernaculaire,
        genre: observations[0].genre,
        famille: observations[0].famille,
        especeDirectiveEuropeenne: observations[0].especeDirectiveEuropeenne === 'true' ? "Oui" : "Non",
        especeEvalueeLR: observations[0].especeEvalueeLR === 'true' ? "Oui" : "Non",
        especeReglementee: observations[0].especeReglementee === 'true' ? "Oui" : "Non",
        observationsParAnnee: {}
    };

    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    let content = `
        <div class="popup-close" onclick="document.getElementById('popup-stats').classList.add('popup-hidden')">×</div>
        <h2 style="margin-top: 0; color: #5e8c61; font-family: 'Patrick Hand', cursive;">${espece}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-family: 'Cormorant Garamond', serif;">
            <div>
                <p><strong>Nom scientifique:</strong> ${stats.nomScientifique}</p>
                <p><strong>Nom vernaculaire:</strong> ${stats.nomVernaculaire}</p>
                <p><strong>Genre:</strong> ${stats.genre}</p>
            </div>
            <div>
                <p><strong>Famille:</strong> ${stats.famille}</p>
                <p><strong>Espèce directive européenne:</strong> ${stats.especeDirectiveEuropeenne}</p>
                <p><strong>Espèce évaluée Liste Rouge:</strong> ${stats.especeEvalueeLR}</p>
            </div>
        </div>
        <p><strong>Espèce réglementée:</strong> ${stats.especeReglementee}</p>
        <p><strong>Observations à ${nomCommune}:</strong></p>
        <ul style="columns: 2; list-style-type: none; padding: 0; font-family: 'Cormorant Garamond', serif;">
    `;

    const anneesTriees = Object.keys(stats.observationsParAnnee).sort();
    anneesTriees.forEach(annee => {
        content += `<li style="padding: 5px 0;">• ${annee}: ${stats.observationsParAnnee[annee]} observation(s)</li>`;
    });

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
