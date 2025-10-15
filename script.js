// --- STYLES LEAFLET ---
const styleDep = {
    color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75
};
const styleCom = {
    color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001
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
    "08": "communes_08.geojson", "10": "communes_10.geojson", "51": "communes_51.geojson",
    "52": "communes_52.geojson", "54": "communes_54.geojson", "55": "communes_55.geojson",
    "57": "communes_57.geojson", "67": "communes_67.geojson", "68": "communes_68.geojson",
    "88": "communes_88.geojson"
};
const loadingScreen = document.getElementById('loading-screen');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');
const popupContent = document.getElementById('popup-content');

// --- MAPPAGE DES SONS (XENO-CANTO) ---
const sonsEspeces = {
    "Turdus merula": "https://xeno-canto.org/1047850/download" // Merle noir
};

// --- AFFICHER/MASQUER LE GIF DE CHARGEMENT ---
function setLoading(isLoading) {
    loadingScreen.classList.toggle('hidden', !isLoading);
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

    // Affiche un badge par espèce
    especesTriees.forEach(([espece, count]) => {
        const badge = document.createElement('div');
        badge.className = 'espece-badge';
        badge.style.width = '60px';
        badge.style.height = '60px';
        badge.style.borderRadius = '50%';
        badge.style.backgroundColor = '#f9f9f9';
        badge.style.border = '2px solid #5e8c61';
        badge.style.cursor = 'pointer';
        badge.style.position = 'relative';
        badge.style.margin = '5px';

        const img = document.createElement('img');
        img.src = `https://via.placeholder.com/60?text=${encodeURIComponent(espece.charAt(0))}`;
        img.alt = espece;
        img.style.width = '90%';
        img.style.height = '90%';
        img.style.borderRadius = '50%';

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;
        countSpan.style.position = 'absolute';
        countSpan.style.top = '-8px';
        countSpan.style.right = '-8px';
        countSpan.style.backgroundColor = '#e74c3c';
        countSpan.style.color = 'white';
        countSpan.style.borderRadius = '50%';
        countSpan.style.width = '22px';
        countSpan.style.height = '22px';
        countSpan.style.display = 'flex';
        countSpan.style.alignItems = 'center';
        countSpan.style.justifyContent = 'center';
        countSpan.style.fontSize = '11px';
        countSpan.style.fontWeight = 'bold';

        badge.appendChild(img);
        badge.appendChild(countSpan);
        container.appendChild(badge);

        // Événement pour afficher la popup
        badge.onclick = () => {
            const observation = oiseauxCommune.find(o => o.espece === espece);
            afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune, observation.nomScientifique);
        };
    });
}

// --- AFFICHAGE DES STATISTIQUES (POPUP CORRIGÉE) ---
function afficherStatsEspece(espece, observations, nomCommune, nomScientifique) {
    // Affiche l'overlay et la popup
    popupOverlay.classList.remove('hidden');
    popupStats.classList.remove('hidden');

    // Récupère les infos
    const stats = {
        nomScientifique: nomScientifique,
        nomVernaculaire: observations[0]?.nomVernaculaire || "Inconnu",
        observationsParAnnee: {}
    };

    // Compte les observations par année
    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    // Crée le contenu de la popup
    let content = `
        <h2 style="color: #5e8c61; font-family: 'Patrick Hand', cursive; margin-top: 0;">${espece}</h2>
        <p><strong>Nom scientifique:</strong> ${stats.nomScientifique}</p>
        <p><strong>Nom vernaculaire:</strong> ${stats.nomVernaculaire}</p>
        <p><strong>Observations à ${nomCommune}:</strong></p>
        <ul style="list-style-type: none; padding: 0;">
    `;

    // Ajoute les observations par année (triées)
    for (const [annee, count] of Object.entries(stats.observationsParAnnee).sort()) {
        content += `<li>• ${annee}: ${count} observation(s)</li>`;
    }

    content += `</ul>`;

    // Ajoute un bouton pour écouter le chant (si disponible)
    if (sonsEspeces[stats.nomScientifique]) {
        content += `
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="playChant('${stats.nomScientifique}')" style="
                    background-color: #5e8c61;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-family: 'Cormorant Garamond', serif;
                ">Écouter le chant</button>
            </div>
        `;
    } else {
        content += `
            <div style="margin-top: 15px; text-align: center; color: #7f8c8d;">
                <p>Aucun chant disponible pour cette espèce.</p>
            </div>
        `;
    }

    popupContent.innerHTML = content;
}

// --- LECTURE DU SON (XENO-CANTO) ---
function playChant(nomScientifique) {
    const urlSon = sonsEspeces[nomScientifique];
    if (!urlSon) {
        alert(`Aucun chant configuré pour cette espèce.`);
        return;
    }

    // Vérifie que l'API Xeno-Canto est accessible
    fetch(urlSon, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                const audio = new Audio(urlSon);
                audio.play().catch(e => {
                    console.error("Erreur de lecture:", e);
                    alert(`Impossible de lire le chant. Vérifie ta connexion.`);
                });
            } else {
                alert(`Le chant n'est pas accessible. L'URL peut être invalide.`);
            }
        })
        .catch(() => {
            alert(`Impossible de vérifier le chant. Vérifie ta connexion.`);
        });
}

// --- FERMETURE DE LA POPUP ---
function fermerPopup() {
    popupOverlay.classList.add('hidden');
    popupStats.classList.add('hidden');
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
