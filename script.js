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








async function chargerOiseauxParDep(codeDep) {
    console.log(`→ Chargement des oiseaux 2015 pour le département ${codeDep}...`);
    try {
        const response = await fetch('donnees_concours/oiseaux_2015.csv');
        const txt = await response.text();
        const sep = txt.includes(';') ? ';' : ',';
        const lignes = txt.split('\n').slice(1);
        oiseauxData = lignes.map(l => {
            const cols = l.split(sep);
            if (cols.length < 13) return null;
            const code = cols[12]?.trim().padStart(5, '0');
            return {
                espece: cols[4]?.trim(),
                codeinseecommune: code
            };
        }).filter(Boolean);
        oiseauxData = oiseauxData.filter(o => o.codeinseecommune.startsWith(codeDep));
        console.log(`Oiseaux chargés pour le ${codeDep} : ${oiseauxData.length} observations`);
    } catch (err) {
        console.error("Erreur chargement oiseaux :", err);
    }
}

async function chargerCommunesParDep(codeDep) {
    if (layerCommunes) map.removeLayer(layerCommunes);
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
                layer.on('click', () =>
                    afficherOiseaux(feature.properties.code, feature.properties.nom)
                );
            }
        }).addTo(map);
    } catch (err) {
        console.error("Erreur chargement communes :", err);
    }
}

// Dans l'événement click du département :
layer.on('click', async () => {
    const codeDep = feature.properties.code.toString().padStart(2, '0');
    console.log("Département cliqué :", codeDep);
    await chargerOiseauxParDep(codeDep); // Attend la fin du chargement des oiseaux
    chargerCommunesParDep(codeDep); // Puis charge les communes
});




