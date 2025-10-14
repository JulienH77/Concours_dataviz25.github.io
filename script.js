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

// --- CHARGEMENT OISEAUX PAR DEPARTEMENT ---
/*function chargerOiseauxParDep(codeDep) {
    console.log(`→ Chargement des oiseaux 2015 pour le département ${codeDep}...`);

    fetch('donnees_concours/oiseaux_2015.csv')
        .then(r => r.text())
        .then(txt => {
            const sep = txt.includes(';') ? ';' : ',';
            const lignes = txt.split('\n').slice(1); // enleve l'entête

            const oiseauxTous = lignes.map(l => {
                const cols = l.split(sep);
                if (cols.length < 13) return null;
                const code = cols[12]?.trim().padStart(5, '0'); // colonne codeInseeCommune
                return {
                    espece: cols[4]?.trim(),
                    codeinseecommune: code
                };
            }).filter(Boolean);

            // On ne garde que les oiseaux dont le code commune commence par le code département
            oiseauxData = oiseauxTous.filter(o => o.codeinseecommune.startsWith(codeDep));

            console.log(`Oiseaux chargés pour le ${codeDep} : ${oiseauxData.length} observations`);
            console.log("Exemple :", oiseauxData.slice(0, 5));
        })
        .catch(err => console.error("Erreur chargement oiseaux :", err));
}*/
function chargerOiseauxParDep(codeDep) {
    console.log(`→ Chargement des oiseaux 2015 pour le département ${codeDep}...`);

    fetch('donnees_concours/oiseaux_2015.csv')
        .then(r => r.text())
        .then(txt => {
            // split robuste pour Windows ou Linux
            const lignes = txt.split(/\r?\n/).slice(1);

            // détection séparateur
            const sep = txt.includes(';') ? ';' : ',';

            const oiseauxTous = lignes.map(l => {
                const cols = l.split(sep);
                if (cols.length < 13) return null;
                return {
                    espece: cols[4]?.trim(),
                    codeinseecommune: cols[12]?.trim().padStart(5,'0')
                };
            }).filter(Boolean);

            const codeDepNorm = codeDep.toString().padStart(2,'0');
            oiseauxData = oiseauxTous.filter(o => o.codeinseecommune.startsWith(codeDepNorm));

            console.log(`Oiseaux chargés pour le département ${codeDepNorm} : ${oiseauxData.length} observations`);
            console.log("Premier oiseau :", oiseauxData[0]);
        })
        .catch(err => console.error("Erreur chargement oiseaux :", err));
}


// --- CHARGEMENT COMMUNES D'UN DEPARTEMENT ---
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

// --- FONCTION : AFFICHAGE OISEAUX PAR COMMUNE ---
function afficherOiseaux(codeCommune, nomCommune) {
    const codeNorm = codeCommune.toString().padStart(5, '0');
    const oiseauxCommune = oiseauxData.filter(o => o.codeinseecommune === codeNorm);

    console.log(`Recherche oiseaux pour ${nomCommune} (${codeNorm}) → ${oiseauxCommune.length} résultats`);

    if (oiseauxCommune.length === 0) {
        alert(`Aucun oiseau observé en 2015 sur ${nomCommune}`);
    } else {
        const especes = [...new Set(oiseauxCommune.map(o => o.espece))];
        alert(`${especes.length} espèces trouvées à ${nomCommune} :\n${especes.slice(0, 7).join(', ')}${especes.length > 7 ? '…' : ''}`);
        // playChant(especes);
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
                    chargerOiseauxParDep(codeDep); // charge d'abord les oiseaux
                    chargerCommunesParDep(codeDep); // puis les communes
                });
            }
        }).addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements :", err));


