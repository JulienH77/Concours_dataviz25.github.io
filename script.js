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

// --- INIT CARTE ET ÉLÉMENTS DOM ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
}).addTo(map);

let layerCommunes = null;
let oiseauxData = [];
const annees = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
const deptFiles = {
    "08": "communes_08.geojson",
    "10": "communes_10.geojson",
    "51": "communes_51.geojson",
    "52": "communes_52.geojson",
    "54": "communes_54.geojson",
    "55": "communes_55.geojson",
    "57": "communes_57.geojson",
    "67": "communes_67.geojson",
    "68": "communes_68.geojson",
    "88": "communes_88.geojson"
};
const loadingScreen = document.getElementById('loading-screen');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');

// --- MAPPAGE DES SONS (XENO-CANTO) ---
const sonsEspeces = {
    // Exemple : "Merle noir": "https://www.xeno-canto.org/123456/download",
};

// --- AFFICHER/MASQUER LE GIF DE CHARGEMENT ---
function setLoading(isLoading) {
    loadingScreen.style.display = isLoading ? 'flex' : 'none';
}

// --- CHARGEMENT DES OISEAUX ---
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
}

// --- CHARGEMENT DES COMMUNES ---
async function chargerCommunesParDep(codeDep) {
    const fileName = deptFiles[codeDep];
    if (!fileName) {
        console.error(`Fichier GeoJSON non trouvé pour le département ${codeDep}`);
        setLoading(false);
        return;
    }

    try {
        const response = await fetch(`donnees_concours/${fileName}`);
        const data = await response.json();

        if (layerCommunes) map.removeLayer(layerCommunes);

        layerCommunes = L.geoJSON(data, {
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
        console.error(`Erreur chargement communes pour ${codeDep}:`, err);
    } finally {
        setLoading(false);
    }
}

// --- AFFICHAGE DES ESPÈCES (TRI DÉCROISSANT) ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0');
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);
    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);

    const container = document.getElementById('especes-container');
    container.innerHTML = '';

    if (oiseauxCommune.length === 0) {
        container.innerHTML = `<p style="text-align: center; width: 100%;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte le nombre d'observations par espèce
    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    // Trie les espèces par nombre d'observations (DÉCROISSANT)
    const especesTriees = Object.entries(especesCount).sort((a, b) => b[1] - a[1]);

    // Affiche les badges (max 51)
    especesTriees.forEach(([espece, count]) => {
        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        const img = document.createElement('img');
        img.src = `photos/${espece.replace(/ /g, '_')}.jpg`;
        img.alt = espece;
        img.onerror = () => {
            img.src = `https://via.placeholder.com/60?text=${encodeURIComponent(espece.charAt(0))}`;
        };

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        container.appendChild(badge);

        badge.onclick = () => {
            afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune);
        };
    });
}

// --- AFFICHAGE DES STATISTIQUES (POPUP CORRIGÉE) ---
function afficherStatsEspece(espece, observations, nomCommune) {
    // Affiche l'overlay
    popupOverlay.classList.remove('hidden');

    const stats = {
        nomScientifique: observations[0].nomScientifique,
        nomVernaculaire: observations[0].nomVernaculaire,
        observationsParAnnee: {}
    };

    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    let content = `
        <div class="popup-close" onclick="fermerPopup()">×</div>
        <h2 style="color: #5e8c61; font-family: 'Patrick Hand', cursive;">${espece}</h2>
        <p><strong>Nom scientifique:</strong> ${stats.nomScientifique}</p>
        <p><strong>Nom vernaculaire:</strong> ${stats.nomVernaculaire}</p>
        <p><strong>Observations à ${nomCommune}:</strong></p>
        <ul>
    `;

    for (const [annee, count] of Object.entries(stats.observationsParAnnee).sort()) {
        content += `<li>${annee}: ${count} observation(s)</li>`;
    }

    content += `</ul>`;
    popupStats.innerHTML = content;
    popupStats.classList.remove('hidden');
}

// --- FERMETURE DE LA POPUP ---
function fermerPopup() {
    popupStats.classList.add('hidden');
    popupOverlay.classList.add('hidden');
}

// --- CHARGEMENT DES DÉPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString();
                    setLoading(true);
                    await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements:", err));
