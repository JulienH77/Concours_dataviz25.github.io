// --- STYLES LEAFLET (COULEURS D'ORIGINE) ---
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
const popupStats = document.getElementById('popup-stats');

// --- MAPPAGE DES SONS (XENO-CANTO) ---
const sonsEspeces = {
    "Merle noir": "https://www.xeno-canto.org/123456/download",
    // Ajoute ici tes autres espèces manuellement
};

// --- AFFICHER/MASQUER LE GIF DE CHARGEMENT ---
function setLoading(isLoading) {
    loadingScreen.classList.toggle('hidden', !isLoading);
}

// --- CHARGEMENT DES OISEAUX (TOUTES ANNÉES) ---
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
}

// --- CHARGEMENT DES COMMUNES (PAR DÉPARTEMENT) ---
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
        setLoading(false); // Masque le GIF une fois chargé
    }
}

// --- AFFICHAGE DES ESPÈCES (AVEC SONS) ---
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

    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    const especesTriees = Object.entries(especesCount).sort((a, b) => b[1] - a[1]);

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
            playChant(espece);
            afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune);
        };
    });
}

// --- LECTURE DU SON (XENO-CANTO) ---
function playChant(espece) {
    const urlSon = sonsEspeces[espece];
    if (!urlSon) {
        console.warn(`Aucun son configuré pour ${espece}`);
        alert(`Le chant de ${espece} n'est pas encore disponible.`);
        return;
    }

    const audio = new Audio(urlSon);
    audio.play().catch(e => {
        console.error(`Erreur lecture pour ${espece}:`, e);
        alert(`Impossible de lire le chant. Vérifie ta connexion.`);
    });
}

// --- AFFICHAGE DES STATISTIQUES (AVEC FERMETURE CORRIGÉE) ---
function afficherStatsEspece(espece, observations, nomCommune) {
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
        <div class="popup-close" onclick="fermerPopup()">×</div>
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
    popupStats.innerHTML = content;
    popupStats.classList.remove('popup-hidden');

    // Fermeture au clic à l'extérieur
    setTimeout(() => {
        document.addEventListener('click', fermerPopupSiExterieur);
    }, 100);
}

// --- FERMETURE DE LA POPUP (CORRIGÉE) ---
function fermerPopup() {
    popupStats.classList.add('popup-hidden');
}

function fermerPopupSiExterieur(e) {
    if (!popupStats.contains(e.target) && !e.target.closest('#especes-container')) {
        fermerPopup();
        document.removeEventListener('click', fermerPopupSiExterieur);
    }
}

// --- CHARGEMENT DES DÉPARTEMENTS (AVEC GIF) ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString();
                    setLoading(true); // Affiche le GIF
                    await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements:", err));
