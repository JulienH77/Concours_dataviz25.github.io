// --- INITIALISATION DE LA CARTE ---
const map = L.map('map').setView([48.8, 5.8], 8);

const Esri_WorldTopoMap = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri' }
).addTo(map);

// --- STYLES ---
const styleDep = {
    color: "black",
    weight: 3,
    opacity: 0.8,
    fill: false
};

const styleCom = {
    color: "black",
    weight: 1,
    opacity: 0.001,
    fill: true
};

// --- COUCHES ---
let depLayer, comLayer;

// --- Chargement des départements ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(res => {
        if (!res.ok) throw new Error("Impossible de charger les départements.");
        return res.json();
    })
    .then(geojson => {
        depLayer = L.geoJSON(geojson, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.nom, { sticky: true });
                layer.on('click', () => chargerCommunes(feature.properties.code_insee));
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur de chargement départements :", err));

// --- Chargement des communes ---
function chargerCommunes(codeDep) {
    if (comLayer) map.removeLayer(comLayer);

    fetch("donnees_concours/communes-grand-est.geojson")
        .then(res => {
            if (!res.ok) throw new Error("Impossible de charger les communes.");
            return res.json();
        })
        .then(geojson => {
            comLayer = L.geoJSON(geojson, {
                style: styleCom,
                filter: feat => feat.properties.code_dep === codeDep,
                onEachFeature: (feat, layer) => {
                    layer.bindTooltip(feat.properties.nom);
                    layer.on('click', () => jouerChant(feat.properties.code_insee));
                }
            }).addTo(map);
        })
        .catch(err => console.error("Erreur de chargement communes :", err));
}

// --- Fonction de lecture de chants (inchangée) ---
async function jouerChant(codeInsee) {
    console.log("Commune cliquée :", codeInsee);

    const annees = [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022];
    const toutesEspeces = new Set();

    for (const annee of annees) {
        const fichier = `donnees_concours/oiseaux_${annee}.csv`;
        try {
            const response = await fetch(fichier);
            if (!response.ok) continue;
            const text = await response.text();
            const lignes = text.split("\n");

            for (let i = 1; i < lignes.length; i++) {
                const cols = lignes[i].split(",");
                const insee = cols[cols.length - 7];
                const espece = cols[4];
                if (insee === codeInsee && espece) {
                    toutesEspeces.add(espece.trim());
                }
            }
        } catch (err) {
            console.warn(`⚠️ Fichier ${fichier} illisible`, err);
        }
    }

    const uniques = Array.from(toutesEspeces);
    console.log(`→ ${uniques.length} espèces trouvées dans la commune ${codeInsee}.`);

    if (uniques.length === 0) {
        alert("Aucune espèce observée ici dans les données disponibles.");
        return;
    }

    const max = Math.min(uniques.length, 7);
    for (let i = 0; i < max; i++) {
        const nom = uniques[i].replace(" ", "+");
        const url = `https://xeno-canto.org/api/2/recordings?query=${nom}`;
        const data = await fetch(url).then(r => r.json());
        if (data.recordings && data.recordings.length > 0) {
            const mp3 = data.recordings[0].file;
            const audio = new Audio(mp3);
            audio.volume = 0.4;
            audio.play();
        }
    }
}


