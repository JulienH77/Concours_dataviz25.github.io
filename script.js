// --- INITIALISATION DE LA CARTE ---
const map = L.map('map').setView([48.8, 5.8], 8);

const Esri_WorldTopoMap = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 
    { attribution: '© Esri' }
).addTo(map);

// --- COUCHES GEOJSON ---
let depLayer, comLayer;

// Style départements (plus épais)
const styleDep = {
    color: "white",
    weight: 3,
    opacity: 0.8,
    fill: false
};

// Style communes (plus fin)
const styleCom = {
    color: "white",
    weight: 1,
    opacity: 0.4,
    fill: false
};

// --- Chargement des départements ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(res => res.json())
    .then(geojson => {
        depLayer = L.geoJSON(geojson, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.nom, { sticky: true });
                layer.on('click', () => chargerCommunes(feature.properties.code_insee));
            }
        }).addTo(map);
    });

// --- Chargement initial vide des communes ---
function chargerCommunes(codeDep) {
    // Supprimer les anciennes couches si existantes
    if (comLayer) map.removeLayer(comLayer);

    fetch("donnees_concours/communes-grand-est.geojson")
        .then(res => res.json())
        .then(geojson => {
            comLayer = L.geoJSON(geojson, {
                style: styleCom,
                filter: feat => feat.properties.code_dep === codeDep,
                onEachFeature: (feat, layer) => {
                    layer.bindTooltip(feat.properties.nom);
                    layer.on('click', () => jouerChant(feat.properties.code_insee));
                }
            }).addTo(map);
        });
}

// --- Fonction de lecture de chants ---
async function jouerChant(codeInsee) {
    console.log("Commune cliquée :", codeInsee);

    // Charger dynamiquement le CSV uniquement pour ce département
    // Pour des performances correctes, on pourrait préparer des CSV par département
    const response = await fetch("donnees_concours/01_oiseaux.csv");
    const text = await response.text();

    // Parser rapidement les lignes utiles (uniquement le codeInsee et espece)
    const lignes = text.split("\n");
    const oiseaux = [];

    for (let i = 1; i < lignes.length; i++) {
        const cols = lignes[i].split(",");
        const insee = cols[cols.length - 7]; // à ajuster selon ton CSV
        const espece = cols[4];
        if (insee === codeInsee) oiseaux.push(espece);
    }

    const uniques = [...new Set(oiseaux)];
    console.log(`→ ${uniques.length} espèces trouvées dans la commune.`);

    // Lecture des chants (limite à 7 max pour éviter la cacophonie)
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
