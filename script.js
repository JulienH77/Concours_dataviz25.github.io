
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
function chargerTousLesOiseaux() {
    const fichiers = [
        "oiseaux_2012.csv",
        "oiseaux_2013.csv",
        "oiseaux_2014.csv",
        "oiseaux_2015.csv",
        "oiseaux_2016.csv",
        "oiseaux_2017.csv",
        "oiseaux_2018.csv",
        "oiseaux_2019.csv",
        "oiseaux_2020.csv",
        "oiseaux_2021.csv",
        "oiseaux_2022.csv",
        "oiseaux_2023.csv",
        "oiseaux_2024.csv"
    ];

    const promises = fichiers.map(fichier =>
        fetch(`data/${fichier}`)
            .then(response => response.text())
            .then(csvText => {
                const lignes = csvText.trim().split("\n");
                const header = lignes[0].split(";");
                const annee = parseInt(fichier.match(/\d{4}/)[0]);

                return lignes.slice(1).map(ligne => {
                    const cols = ligne.split(";").map(c => c.trim().replace(/^"|"$/g, "")); 
                    // supprime les guillemets en début/fin de chaque champ

                    // Ajuste les indices ci-dessous selon ton CSV
                    return {
                        espece: cols[0],
                        nomScientifique: cols[1],
                        nomVernaculaire: cols[2],
                        codeinseecommune: cols[3],
                        annee: annee,
                        especeEvalueeLR: normaliserBooleen(cols[4]),
                        especeReglementee: normaliserBooleen(cols[5])
                    };
                });
            })
    );

    Promise.all(promises).then(resultats => {
        oiseauxData = resultats.flat();
        console.log("Données chargées :", oiseauxData.slice(0, 10));
        afficherCouchesSurCarte();
    });
}

function normaliserBooleen(val) {
    if (!val) return false;
    const v = val.toString().trim().toLowerCase().replace(/^"|"$/g, "");
    return v === "true" || v === "oui" || v === "1" || v === "x";
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

    if (!observations || observations.length === 0) {
        popupContent.innerHTML = "<p>Aucune donnée disponible pour cette espèce.</p>";
        return;
    }

    // --- Récupération des infos de base ---
    const firstObs = observations[0];
    const stats = {
        nomScientifique: nomScientifique || firstObs.nomScientifique || "",
        nomVernaculaire: firstObs.nomVernaculaire || "Inconnu",
        observationsParAnnee: {}
    };

    // --- Calcul des observations par année ---
    observations.forEach(o => {
        const annee = o.annee;
        stats.observationsParAnnee[annee] = (stats.observationsParAnnee[annee] || 0) + 1;
    });

    // --- Détermination de la première année "true" pour chaque statut ---
    let premiereAnneeLR = null;
    let premiereAnneeReglementee = null;

    observations.forEach(o => {
        if (o.especeEvalueeLR && !premiereAnneeLR) premiereAnneeLR = o.annee;
        if (o.especeReglementee && !premiereAnneeReglementee) premiereAnneeReglementee = o.annee;
    });

    // --- Texte pour affichage ---
    const texteLR = premiereAnneeLR
        ? `Oui (${premiereAnneeLR})`
        : `Non`;
    const texteReglementee = premiereAnneeReglementee
        ? `⚠️ Oui (depuis ${premiereAnneeReglementee})`
        : `Non`;

    // --- Construction du contenu HTML ---
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
                <p><strong>Espèce Liste Rouge :</strong> ${texteLR}</p>
                <p><strong>Espèce réglementée :</strong> ${texteReglementee}</p>

                <p><strong>Observations à ${nomCommune} :</strong></p>
                <ul style="list-style-type: none; padding: 0;">
    `;

    // --- Tri et affichage des observations ---
    const anneesTriees = Object.keys(stats.observationsParAnnee).sort();
    for (const annee of anneesTriees) {
        const count = stats.observationsParAnnee[annee];
        content += `<li>• ${annee}: ${count} observation(s)</li>`;
    }

    content += `</ul>`;

    // --- Ajout de l'iframe si disponible ---
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

    // Précharge le son si dispo
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









