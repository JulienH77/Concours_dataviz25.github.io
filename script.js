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
        const sep = txt.includes(';') ? ';' : ',';
        const lignes = txt.split('\n').slice(1); // Enlève l'entête
        oiseauxData = lignes.map(l => {
            const cols = l.split(sep);
            if (cols.length < 13) return null;
            const code = cols[12]?.trim().padStart(5, '0'); // colonne codeInseeCommune
            return {
                espece: cols[4]?.trim(),
                codeinseecommune: code
            };
        }).filter(Boolean);
        // Filtre pour ne garder que les oiseaux du département
        oiseauxData = oiseauxData.filter(o => o.codeinseecommune.startsWith(codeDep));
        console.log(`Oiseaux chargés pour le ${codeDep} : ${oiseauxData.length} observations`);
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
                f.properties.code && f.properties.code.startsWith(codeDep)
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

    if (oiseauxCommune.length === 0) {
        alert(`Aucun oiseau observé en 2015 sur ${nomCommune}`);
    } else {
        const especes = [...new Set(oiseauxCommune.map(o => o.espece))];
        alert(`${especes.length} espèces trouvées à ${nomCommune} :\n${especes.slice(0, 7).join(', ')}${especes.length > 7 ? '…' : ''}`);

        // Ajoute un bouton pour chaque espèce pour jouer son chant
        especes.forEach(espece => {
            const btn = document.createElement('button');
            btn.textContent = `Écouter ${espece}`;
            btn.onclick = () => playChant(espece);
            document.body.appendChild(btn);
        });
    }
}

// --- FONCTION : JOUER LE CHANT D'UNE ESPECE ---
function playChant(espece) {
    const audioPath = `chants/${espece}.mp3`; // Assure-toi que ce chemin est correct
    const audio = new Audio(audioPath);
    audio.play().catch(err => console.error("Erreur lecture audio :", err));
}

// --- CHARGEMENT DES DEPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString().padStart(2, '0');
                    console.log("Département cliqué :", codeDep);
                    await chargerOiseauxParDep(codeDep); // Attend la fin du chargement des oiseaux
                    chargerCommunesParDep(codeDep); // Puis charge les communes
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements :", err));
