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

// --- CHARGEMENT OISEAUX (2015 UNIQUEMENT POUR L'INSTANT) ---
fetch('donnees_concours/oiseaux_2015.csv')
    .then(r => r.text())
    .then(txt => {
        const lignes = txt.split('\n').slice(1); // enlève l'entête
        oiseauxData = lignes.map(l => {
            const cols = l.split(',');
            return {
                espece: cols[4]?.trim(),
                codeinseecommune: cols[10]?.trim()
            };
        });
        console.log("Oiseaux chargés :", oiseauxData.length);
    });

// --- FONCTION : communes par département ---
function chargerCommunesParDep(codeDep) {
    if (layerCommunes) map.removeLayer(layerCommunes);

    fetch("donnees_concours/communes-grand-est.geojson")
        .then(r => r.json())
        .then(data => {
            const communesFiltrees = {
                type: "FeatureCollection",
                features: data.features.filter(f => f.properties.code.startsWith(codeDep))
            };

            layerCommunes = L.geoJSON(communesFiltrees, {
                style: styleCom,
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => afficherOiseaux(feature.properties.code, feature.properties.nom));
                }
            }).addTo(map);
        })
        .catch(err => console.error("Erreur chargement communes :", err));
}

// --- FONCTION : oiseaux par commune ---
function afficherOiseaux(codeCommune, nomCommune) {
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeCommune);

    if (oiseauxCommune.length === 0) {
        alert(`Aucun oiseau observé en 2015 sur ${nomCommune}`);
    } else {
        const espece = oiseauxCommune[0].espece;
        alert(`Exemple : ${espece} trouvé à ${nomCommune}`);
        // Ici on pourrait appeler une API de chant :
        // playChant(espece);
    }
}

// --- CHARGEMENT DES DEPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleDep,
            onEachFeature: (feature, layer) => {
                layer.on('click', () => {
                    const codeDep = feature.properties.code.toString().padStart(2, '0');
                    chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements :", err));
