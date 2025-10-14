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
            if (cols.length < 11) return null; // sécurité
            return {
                espece: cols[4]?.trim(),
                codeinseecommune: cols[10]?.trim().padStart(5, '0') // normalisation
            };
        }).filter(Boolean); // supprime les lignes vides
        console.log("Oiseaux chargés :", oiseauxData.length);
    })
    .catch(err => console.error("Erreur chargement CSV :", err));

// --- FONCTION : communes par département ---
function chargerCommunesParDep(codeDep) {
    if (layerCommunes) map.removeLayer(layerCommunes);

    fetch("donnees_concours/communes-grand-est.geojson")
        .then(r => r.json())
        .then(data => {
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
        })
        .catch(err => console.error("Erreur chargement communes :", err));
}

// --- FONCTION : oiseaux par commune ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0'); // standardisation
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);

    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);

    if (oiseauxCommune.length === 0) {
        alert(`Aucun oiseau observé en 2015 sur ${nomCommune}`);
    } else {
        const especes = [...new Set(oiseauxCommune.map(o => o.espece))];
        alert(`${especes.length} espèces trouvées à ${nomCommune} :\n${especes.slice(0, 7).join(', ')}${especes.length > 7 ? '…' : ''}`);
        // Plus tard → playChant(especes);
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
                    console.log("Département cliqué :", codeDep);
                    chargerCommunesParDep(codeDep);
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements :", err));
