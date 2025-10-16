
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

// --- STYLES LEAFLET ---
const styleDep = { color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75 };
const styleCom = { color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001 };

// --- MAPPAGE DES SONS ET IFRAMES (corrigé) ---
const sonsEspeces = {
    "Turdus merula": {
        son: "https://xeno-canto.org/1047850/download",
        iframe: "https://xeno-canto.org/1047850/embed?simple=1"
    },
    "Passer domesticus": {
        son: "https://xeno-canto.org/1047609/download",
        iframe: "https://xeno-canto.org/1047609/embed?simple=1"
    }
    // Ajoute d'autres espèces ici avec le même format
};

// --- AFFICHER/MASQUER LE CHARGEMENT ---
function setLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}

// --- AFFICHER/MASQUER LA POPUP ---
function afficherPopup() {
    popupOverlay.style.display = 'block';
    popupStats.style.display = 'flex';
}


function fermerPopup() {
    popupOverlay.style.display = 'none';
    popupStats.style.display = 'none';
}

// --- CHARGEMENT DES OISEAUX ---
async function chargerTousLesOiseaux(codeDep) {
    setLoading(true);
    let oiseauxData = [];
    const annees = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];

    const promises = annees.map(annee =>
        fetch(`donnees_concours/oiseaux_${annee}.csv`)
            .then(r => r.text())
            .then(txt => {
                const lignes = txt.split('\n').slice(1);
                return lignes.map(l => {
                    if (!l.trim()) return null; // Ignore les lignes vides
                    const cols = l.split(';');
                    // Vérifie qu’il y a au moins 8 colonnes pour éviter les erreurs
                    if (cols.length < 8) return null;

                    let code = cols[9]?.trim();
                    if (!code) return null;

                    code = code.padStart(5, '0');

                    if (code.startsWith(codeDep.padStart(2, '0'))) {
                        return {
                            nomScientifique: cols[0]?.trim(),
                            nomVernaculaire: cols[1]?.trim(),
                            espece: cols[3]?.trim(),
                            especeEvalueeLR: cols[5]?.trim()?.toLowerCase() === "true",
                            especeReglementee: cols[6]?.trim()?.toLowerCase() === "true",
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
    return oiseauxData;
}


// --- CHARGEMENT DES COMMUNES (corrigé) ---
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
        const response = await fetch(`donnees_concours/${fileName}`);
        const data = await response.json();

        if (window.layerCommunes) map.removeLayer(window.layerCommunes);

        window.layerCommunes = L.geoJSON(data, {
            style: styleCom,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeCommune = feature.properties.code.padStart(5, '0');
                    const oiseauxCommune = window.oiseauxData.filter(o => o.codeinseecommune === codeCommune);

                    // Joue TOUS les chants disponibles pour cette commune
                    const especesAvecSon = [...new Set(oiseauxCommune.map(o => o.nomScientifique))]
                        .filter(nomScientifique => sonsEspeces[nomScientifique]);

                    if (especesAvecSon.length > 0) {
                        especesAvecSon.forEach(nomScientifique => {
                            playChant(nomScientifique);
                            afficherPopup();
});
                    }

                    afficherOiseaux(codeCommune, feature.properties.nom, oiseauxCommune);
                });
            }
        }).addTo(map);
    } catch (err) {
        console.error(`Erreur chargement communes:`, err);
    }
}

// --- AFFICHAGE DES ESPÈCES (corrigé pour les images) ---
function afficherOiseaux(codeCommune, nomCommune, oiseauxCommune) {
    especesContainer.innerHTML = '';

    if (!oiseauxCommune || oiseauxCommune.length === 0) {
        especesContainer.innerHTML = `<p style="text-align: center;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte les observations par espèce
    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    // Trie les espèces par nombre d'observations (décroissant)
    const especesTriees = Object.entries(especesCount).sort((a, b) => b[1] - a[1]);

    // Affiche tous les badges avec images (correction des guillemets)
    especesTriees.forEach(([espece, count]) => {
        const observation = oiseauxCommune.find(o => o.espece === espece);
        const nomScientifique = observation?.nomScientifique || "";

        const badge = document.createElement('div');
        badge.className = 'espece-badge';

        // Image avec fallback (correction du nom de fichier)
        const img = document.createElement('img');
        const nomImage = espece.replace(/ /g, '_').replace(/"/g, ''); // Supprime les guillemets
        img.src = `photos/${nomImage}.jpg`;
        img.alt = espece;
        img.onerror = () => {
            img.src = `https://via.placeholder.com/60?text=${encodeURIComponent(espece.charAt(0))}`;
        };

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        especesContainer.appendChild(badge);

        // Événement pour afficher la popup
        badge.onclick = () => {
            afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune, nomScientifique);
        };
    });
}

// --- AFFICHAGE DES STATISTIQUES (avec iframe corrigée) ---
function afficherStatsEspece(espece, observations, nomCommune, nomScientifique) {
    afficherPopup();

    // Sécurité : récupère la 1ère observation si elle existe
    const firstObs = observations && observations.length > 0 ? observations[0] : {};

    const stats = {
        nomScientifique: nomScientifique || firstObs.nomScientifique || "",
        nomVernaculaire: firstObs.nomVernaculaire || "Inconnu",
        observationsParAnnee: {},
        // récupère les booléens (fallback à false si undefined)
        especeEvalueeLR: !!firstObs.especeEvalueeLR,
        especeReglementee: !!firstObs.especeReglementee
    };

    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    // Crée le contenu avec photo + infos en format paysage
    let content = `
        <div style="display: flex; gap: 20px; width: 100%;">
            <img
                src="photos/${espece.replace(/ /g, '_').replace(/"/g, '')}.jpg"
                alt="${espece}"
                class="popup-image"
                onerror="this.src='https://via.placeholder.com/200?text=${encodeURIComponent(espece.charAt(0))}'"
            >
            <div class="popup-right">
                <div class="popup-close" onclick="fermerPopup()">×</div>
                <h2 style="color: #5e8c61; margin-top: 0;">${stats.nomVernaculaire}</h2>
                <p><strong>Nom scientifique:</strong> ${stats.nomScientifique}</p>
                <p><strong>Nom vernaculaire:</strong> ${stats.nomVernaculaire}</p>

                <p><strong>Espèce Liste Rouge :</strong> ${stats.especeEvalueeLR ? "✅ Oui" : "❌ Non"}</p>
                <p><strong>Espèce réglementée :</strong> ${stats.especeReglementee ? "⚠️ Oui" : "Non"}</p>

                <p><strong>Observations à ${nomCommune}:</strong></p>
                <ul style="list-style-type: none; padding: 0;">
    `;

    // tri par année croissante
    const anneesTriees = Object.keys(stats.observationsParAnnee).sort();
    for (const annee of anneesTriees) {
        const count = stats.observationsParAnnee[annee];
        content += `<li>• ${annee}: ${count} observation(s)</li>`;
    }

    content += `</ul>`;

    // Ajoute l'iframe SI un enregistrement existe
    if (sonsEspeces[stats.nomScientifique]?.iframe) {
        content += `
            <div style="margin-top: 15px; text-align: center;">
                <iframe
                    src="${sonsEspeces[stats.nomScientifique].iframe}"
                    scrolling="no"
                    frameborder="0"
                    width="100%"
                    height="100"
                    style="border-radius: 5px; max-width: 320px;"
                ></iframe>
            </div>
        `;
    } else {
        content += `<p style="color: #7f8c8d; margin-top: 10px;">Aucun enregistrement audio disponible.</p>`;
    }

    content += `</div></div>`;
    popupContent.innerHTML = content;

    // Précharge le son si disponible
    if (sonsEspeces[stats.nomScientifique]?.son) {
        preloadAudio(sonsEspeces[stats.nomScientifique].son);
    }
}

        
// --- PRÉCHARGEMENT DES SONS (nouvelle fonction) ---
function preloadAudio(url) {
    const audio = new Audio();
    audio.src = url;
    audio.load();
    // Pas besoin de jouer, juste de précharger
}

        
// --- LECTURE DU SON (version corrigée avec gestion des erreurs) ---
function playChant(nomScientifique) {
    const sonData = sonsEspeces[nomScientifique];
    if (!sonData?.son) {
        console.warn(`Aucun son configuré pour ${nomScientifique}`);
        return;
    }

    // Vérifie si l'audio est déjà en cours de lecture
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }

    // Crée et joue l'audio
    window.currentAudio = new Audio(sonData.son);
    window.currentAudio.play().catch(e => {
        console.error("Erreur de lecture audio:", e);
        alert("Impossible de lire le chant. Le navigateur bloque peut-être les lectures automatiques. Cliquez sur le lecteur dans la popup.");
    });
}

// --- CHARGEMENT DES DÉPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: async (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString();
                    setLoading(true);
                    window.oiseauxData = await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements:", err));







