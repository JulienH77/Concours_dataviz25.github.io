// --- STYLES ---
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

// --- CHARGEMENT OISEAUX PAR DEPARTEMENT (ASYNCHRONE) ---
async function chargerOiseauxParDep(codeDep) {
    console.log(`→ Chargement des oiseaux 2015 pour le département ${codeDep}...`);
    try {
        const response = await fetch('donnees_concours/oiseaux_2015.csv');
        const txt = await response.text();
        console.log("Contenu brut du CSV (5 premières lignes) :");
        console.log(txt.split('\n').slice(0, 5).join('\n'));

        const sep = txt.includes(';') ? ';' : ',';
        const lignes = txt.split('\n').slice(1); // Enlève l'entête
        const oiseauxTous = [];
        lignes.forEach((l, i) => {
            const cols = l.split(sep);
            if (cols.length < 13) {
                console.warn(`Ligne ${i+1} ignorée (pas assez de colonnes) :`, l);
                return;
            }
            let code = cols[12]?.trim();
            if (!code) {
                console.warn(`Ligne ${i+1} ignorée (code INSEE vide) :`, l);
                return;
            }
            // Normalisation : on s'assure que le code a 5 chiffres
            code = code.padStart(5, '0');
            oiseauxTous.push({
                espece: cols[4]?.trim(),
                codeinseecommune: code
            });
        });

        oiseauxData = oiseauxTous.filter(o => o.codeinseecommune.startsWith(codeDep.padStart(2, '0')));
        console.log(`Oiseaux chargés pour le ${codeDep} : ${oiseauxData.length} observations`);
        console.log("Exemple de codes INSEE trouvés :", [...new Set(oiseauxData.map(o => o.codeinseecommune).slice(0, 5))]);
    } catch (err) {
        console.error("Erreur chargement oiseaux :", err);
    }
}


// --- CHARGEMENT COMMUNES D'UN DEPARTEMENT (ASYNCHRONE) ---
async function chargerCommunesParDep(codeDep) {
    if (layerCommunes) {
        map.removeLayer(layerCommunes);
    }
    try {
        const response = await fetch("donnees_concours/communes-grand-est.geojson");
        const data = await response.json();
        const communesFiltrees = {
            type: "FeatureCollection",
            features: data.features.filter(f =>
                f.properties.code && f.properties.code.startsWith(codeDep.padStart(2, '0'))
            )
        };
        console.log(`Communes trouvées dans le département ${codeDep} :`, communesFiltrees.features.length);
        layerCommunes = L.geoJSON(communesFiltrees, {
            style: styleCom,
            onEachFeature: (feature, layer) => {
                layer.on('click', () => {
                    afficherOiseaux(feature.properties.code, feature.properties.nom);
                });
            }
        }).addTo(map);
    } catch (err) {
        console.error("Erreur chargement communes :", err);
    }
}

// --- FONCTION : AFFICHAGE OISEAUX PAR COMMUNE ET LECTURE DES CHANTS ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0');
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);
    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);
    console.log("Codes INSEE des oiseaux chargés :", [...new Set(oiseauxData.map(o => o.codeinseecommune))]);

    if (oiseauxCommune.length === 0) {
        alert(`Aucun oiseau observé en 2015 sur ${nomCommune}`);
    } else {
        const especes = [...new Set(oiseauxCommune.map(o => o.espece))];
        alert(`${especes.length} espèces trouvées à ${nomCommune} :\n${especes.slice(0, 7).join(', ')}${especes.length > 7 ? '…' : ''}`);
    }
}

// --- CHARGEMENT DES DEPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code;
                    console.log("Département cliqué :", codeDep);
                    await chargerOiseauxParDep(codeDep); // Attend la fin du chargement des oiseaux
                    chargerCommunesParDep(codeDep); // Puis charge les communes
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements :", err));

