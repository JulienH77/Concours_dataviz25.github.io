// --- INIT CARTE ET ÉLÉMENTS DOM ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

map.on('click', () => {
    // ferme popup leaflet
    map.closePopup();
    // ferme popup overlay si ouverte
    if (typeof fermerPopup === 'function') fermerPopup();
    // retire highlight
    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
});

// DOM
const loadingScreen = document.getElementById('loading-screen');
const especesContainer = document.getElementById('especes-container');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');
const popupContent = document.getElementById('popup-content');
const soundToggleBtn = document.getElementById('sound-toggle');

let windowOiseauxData = []; // toutes les observations pour le département courant
window.oiseauxData = []; // compatibilité si on l'utilise ailleurs
window.soundAuto = true; // par défaut lecture auto lors du clic commune

// --- Styles leaflet ---
const styleDep = { color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75 };
const styleCom = { color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001 };

document.addEventListener('DOMContentLoaded', () => {

// --- sons mapping (garde le tien) ---
const sonsEspeces = {
    "Turdus merula": {
        son: "https://xeno-canto.org/1047850/download",
        iframe: "https://xeno-canto.org/1047850/embed?simple=1"
    },
    "Passer domesticus": {
        son: "https://xeno-canto.org/1047609/download",
        iframe: "https://xeno-canto.org/1047609/embed?simple=1"
    }
    // etc...
};

// --- utilitaires ---
function setLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}
function afficherPopup() {
    popupOverlay.style.display = 'block';
    popupStats.style.display = 'block';
}
function fermerPopup() {
    popupOverlay.style.display = 'none';
    popupStats.style.display = 'none';
    popupContent.innerHTML = '';
}

// ferme popup si on clique sur overlay
popupOverlay.addEventListener('click', fermerPopup);
document.addEventListener('keydown', (e) => { if (e.key === "Escape") fermerPopup(); });

// --- normalisation booléen et nettoyage champs ---
function stripQuotes(s) {
    if (s === undefined || s === null) return "";
    return s.toString().trim().replace(/^"|"$/g, "");
}
function normaliserBooleen(val) {
    if (val === undefined || val === null) return false;
    const v = stripQuotes(val).toString().toLowerCase();
    return v === "true" || v === "oui" || v === "1" || v === "x";
}

// --- PRÉCHARGEMENT SONS (caché) ---
function preloadAudio(url) {
    try {
        const audio = new Audio();
        audio.src = url;
        audio.load();
    } catch (e) {
        console.warn("Préchargement audio impossible:", e);
    }
}

// --- LECTURE DU SON (sans alert) ---
function playChant(nomScientifique) {
    const sonData = sonsEspeces[nomScientifique];
    if (!sonData?.son) {
        console.warn(`Aucun son configuré pour ${nomScientifique}`);
        return;
    }
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }
    try {
        window.currentAudio = new Audio(sonData.son);
        window.currentAudio.play().catch(e => {
            // suppression de l'alerte ; log uniquement
            console.warn("Erreur de lecture audio (probablement bloquée par navigateur):", e);
        });
    } catch (e) {
        console.error("Erreur playChant:", e);
    }
}

// --- effet "on parle" sur badges ---
function highlightEspeces(especeList) {
    // retire ancien état
    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
    // met en valeur ceux présents dans la liste
    especeList.forEach(espece => {
        const badge = document.querySelector(`.espece-badge[data-espece="${CSS.escape(espece)}"]`);
        if (badge) badge.classList.add('speaking');
    });
}

// --- CHARGEMENT DES OISEAUX ---
async function chargerTousLesOiseaux(codeDep) {
    setLoading(true);

    // liste des fichiers existants (pas 2023/2024)
    const fichiers = [
        "oiseaux_2012.csv","oiseaux_2013.csv","oiseaux_2014.csv","oiseaux_2015.csv",
        "oiseaux_2016.csv","oiseaux_2017.csv","oiseaux_2018.csv","oiseaux_2019.csv",
        "oiseaux_2020.csv","oiseaux_2021.csv","oiseaux_2022.csv"
    ];

    const promises = fichiers.map(fichier =>
        fetch(`donnees_concours/${fichier}`)
            .then(r => {
                if (!r.ok) {
                    console.warn("Fichier non trouvé:", fichier);
                    return "";
                }
                return r.text();
            })
            .then(txt => {
                if (!txt) return [];
                const lignes = txt.trim().split('\n');
                const anneeFile = parseInt(fichier.match(/\d{4}/)[0]);
                return lignes.slice(1).map(l => {
                    if (!l || !l.trim()) return null;
                    const cols = l.split(';').map(c => stripQuotes(c));
                    // on vérifie qu'on a au moins 11 colonnes sinon on ignore
                    if (cols.length < 11) return null;

                    // code commune (index 9 dans ton CSV)
                    let code = cols[9]?.toString().trim();
                    if (!code) return null;
                    code = code.padStart(5, '0');

                    // ne garder que le département demandé (prefixe)
                    if (!code.startsWith(codeDep.padStart(2, '0'))) return null;

                    return {
                        nomScientifique: cols[0],
                        nomVernaculaire: cols[1],
                        cdNom: cols[2],
                        espece: cols[3],
                        genre: cols[4],
                        famille: cols[5],
                        especeEvalueeLR: normaliserBooleen(cols[6]),
                        especeReglementee: normaliserBooleen(cols[7]),
                        dateObservation: cols[8],
                        codeinseecommune: code,
                        annee: parseInt(cols[10]) || anneeFile
                    };
                }).filter(Boolean);
            })
            .catch(err => {
                console.error("Erreur lecture CSV:", fichier, err);
                return [];
            })
    );

    const results = await Promise.all(promises);
    const merged = results.flat();
    window.oiseauxData = merged; // global
    windowOiseauxData = merged; // local référence
    console.log(`Données chargées pour le département ${codeDep}:`, merged.length);

    setLoading(false);
    return merged;
}

// --- CHARGEMENT DES COMMUNES ---
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
                layer.on('click', async (e) => {
                    // reset des ronds d'espèces à chaque clic département/commune si nécessaire
                    especesContainer.innerHTML = '';

                    const codeCommune = feature.properties.code.padStart(5, '0');
                    const oiseauxCommune = window.oiseauxData.filter(o => o.codeinseecommune === codeCommune);

                    // ouvre une popup leaflet classique (nom commune) au centre de la feature
                    try {
                        let latlng = null;
                        if (layer.getBounds) latlng = layer.getBounds().getCenter();
                        else if (layer.getLatLng) latlng = layer.getLatLng();
                        if (latlng) {
                            L.popup({ maxWidth: 250 })
                                .setLatLng(latlng)
                                .setContent(`<strong>${feature.properties.nom}</strong>`)
                                .openOn(map);
                        }
                    } catch (err) {
                        console.warn("Impossible d'ouvrir popup leaflet:", err);
                    }

                    // si son auto activé, joue les chants disponibles POUR LA COMMUNE
                    const especesAvecSon = [...new Set(oiseauxCommune.map(o => o.nomScientifique))]
                        .filter(nomScientifique => sonsEspeces[nomScientifique]);

                    if (window.soundAuto && especesAvecSon.length > 0) {
                        // on joue seulement le PREMIER pour éviter cacophonie, puis on highlight toutes les espèces présentes
                        playChant(especesAvecSon[0]);
                        highlightEspeces(especesAvecSon);
                        // précharge les autres éventuellement
                        especesAvecSon.forEach(n => sonsEspeces[n]?.son && preloadAudio(sonsEspeces[n].son));
                    } else {
                        // retire highlight si son auto désactivé
                        highlightEspeces([]);
                    }

                    // affiche la liste des espèces pour la commune (sans ouvrir la popup overlay)
                    afficherOiseaux(codeCommune, feature.properties.nom, oiseauxCommune);
                });
            }
        }).addTo(map);
    } catch (err) {
        console.error(`Erreur chargement communes:`, err);
    }
}

// --- AFFICHAGE DES ESPÈCES (badges) ---
function afficherOiseaux(codeCommune, nomCommune, oiseauxCommune) {
    especesContainer.innerHTML = '';

    if (!oiseauxCommune || oiseauxCommune.length === 0) {
        especesContainer.innerHTML = `<p style="text-align: center;">Aucun oiseau observé sur ${nomCommune}</p>`;
        return;
    }

    // Compte observations par espèce
    const especesCount = {};
    oiseauxCommune.forEach(o => {
        const espece = o.espece;
        especesCount[espece] = (especesCount[espece] || 0) + 1;
    });

    const especesTriees = Object.entries(especesCount).sort((a,b) => b[1]-a[1]);

    especesTriees.forEach(([espece, count]) => {
        const observation = oiseauxCommune.find(o => o.espece === espece);
        const nomScientifique = observation?.nomScientifique || "";

        const badge = document.createElement('div');
        badge.className = 'espece-badge';
        badge.setAttribute('data-espece', espece);

        const img = document.createElement('img');
        const nomImage = espece.replace(/ /g, '_').replace(/"/g, '');
        img.src = `photos/${nomImage}.jpg`;
        img.alt = espece;
        img.onerror = () => { img.src = `https://via.placeholder.com/60?text=${encodeURIComponent(espece.charAt(0))}`; };

        const countSpan = document.createElement('span');
        countSpan.className = 'espece-count';
        countSpan.textContent = count;

        badge.appendChild(img);
        badge.appendChild(countSpan);
        especesContainer.appendChild(badge);

        // clic sur le rond : affiche la popup overlay détaillée
        badge.onclick = () => {
            // récupère toutes les observations DEPARTEMENTALES pour cette espèce (pour calculer depuis quand)
            const observationsDepartement = window.oiseauxData.filter(o => o.espece === espece);
            afficherStatsEspece(espece, oiseauxCommune.filter(o => o.espece === espece), nomCommune, nomScientifique, observationsDepartement);
        };
    });
}

// --- AFFICHAGE DES STATISTIQUES (popup overlay) ---
// maintenant on reçoit aussi observationsDepartement pour calculer depuis quand
function afficherStatsEspece(espece, observationsCommune, nomCommune, nomScientifique, observationsDepartement = []) {
    // calcul du premier annee true DANS LE DEPARTEMENT pour chaque statut
    observationsDepartement.sort((a,b) => a.annee - b.annee);

    let premiereAnneeLR = null;
    let premiereAnneeReglementee = null;
    for (const o of observationsDepartement) {
        if (o.especeEvalueeLR && premiereAnneeLR === null) premiereAnneeLR = o.annee;
        if (o.especeReglementee && premiereAnneeReglementee === null) premiereAnneeReglementee = o.annee;
        if (premiereAnneeLR !== null && premiereAnneeReglementee !== null) break;
    }

    const texteLR = premiereAnneeLR ? `Oui (depuis ${premiereAnneeLR})` : `Non`;
    const texteReglementee = premiereAnneeReglementee ? `Oui (depuis ${premiereAnneeReglementee})` : `Non`;

    // stats observations par annee LOCAL (commune)
    const observationsParAnnee = {};
    (observationsCommune || []).forEach(o => {
        observationsParAnnee[o.annee] = (observationsParAnnee[o.annee] || 0) + 1;
    });

    // construction HTML : left = image + iframe, right = texte/stats (on remplace la liste par le graphique ECharts)
    let content = `
        <div style="position: relative;">
        <div id="popup-inner" style="display:flex; gap: 20px; width:100%;">
            <div class="popup-left">
                <img src="photos/${espece.replace(/ /g, '_').replace(/"/g, '')}.jpg"
                     alt="${espece}" class="popup-image"
                     onerror="this.src='https://via.placeholder.com/220?text=${encodeURIComponent(espece.charAt(0))}'">
    `;

    // iframe Xeno-canto (si existant)
    if (sonsEspeces[nomScientifique]?.iframe) {
        content += `
            <div class="popup-iframe">
                <iframe src="${sonsEspeces[nomScientifique].iframe}"
                        scrolling="no" frameborder="0"
                        width="100%" height="100%"></iframe>
            </div>
        `;
    }

    content += `</div>`; // ferme popup-left

    // droite (on ajoute le container ECharts)
    content += `
        <div class="popup-right">
            <h2 style="color: #5e8c61; margin-top: 0;">${observationsCommune[0]?.nomVernaculaire || nomScientifique}</h2>
            <p><strong>Nom scientifique:</strong> ${nomScientifique}</p>
            <!--<p><strong>Espèce Liste Rouge :</strong> ${texteLR}</p>-->
            <!--<p><strong>Espèce réglementée :</strong> ${texteReglementee}</p>-->
            <p style="margin-top:6px; margin-bottom:0px;"><strong>Évolution des observations à ${nomCommune} :</strong></p>
            <div id="echart-${nomScientifique.replace(/ /g,'_')}" style="width:100%;height:260px;"></div>
        </div>
    </div></div></div>`;
    popupContent.innerHTML = content;

    // stoppe le son en cours si popup ouverte
    if (window.currentAudio && !window.currentAudio.paused) {
        try {
            window.currentAudio.pause();
            window.currentAudio.currentTime = 0;
        } catch (e) {
            console.warn("Impossible d'arrêter l'audio :", e);
        }
    }
    
    // affiche overlay popup
    afficherPopup();

    // précharge son si existant
    if (sonsEspeces[nomScientifique]?.son) preloadAudio(sonsEspeces[nomScientifique].son);

    // === AJOUT 1 : graphique Apache ECharts (empilé, commune en couleur + autres départements en gris) ===
    setTimeout(() => {
        const chartDom = document.getElementById(`echart-${nomScientifique.replace(/ /g,'_')}`);
        if (!chartDom) return;

        const annees = Array.from({length: 11}, (_, i) => 2012 + i);
        const dataLocal = annees.map(a => observationsParAnnee[a] || 0);

        // liste des départements de ton Grand-Est (même ordre que ta source)
        const deps = ["08","10","51","52","54","55","57","67","68","88"];
        const currentDep = observationsDepartement[0]?.codeinseecommune?.substring(0,2) || "";
        const autresDeps = deps.filter(d => d !== currentDep);
        const series = [];

        // ajoute un dataset pour chaque autre département (gris dégradé)
        autresDeps.forEach((dep,i) => {
            const dataDep = annees.map(a =>
                observationsDepartement.filter(o => o.annee === a && o.codeinseecommune.startsWith(dep)).length
            );
            series.push({
                name: `Département ${dep}`,
                type: 'bar',
                stack: 'total',
                emphasis: { focus: 'series' },
                itemStyle: { color: `rgba(150,150,150,${0.12 + i*0.06})` },
                data: dataDep
            });
        });

        // dataset local (couleur)
        series.push({
            name: `Commune de ${nomCommune}`,
            type: 'bar',
            stack: 'total',
            emphasis: { focus: 'series' },
            itemStyle: { color: '#5e8c61' },
            data: dataLocal
        });

        const chart = echarts.init(chartDom);
        chart.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: params => {
                    let total = 0;
                    let str = `<strong>${params[0].axisValue}</strong><br>`;
                    params.forEach(p => {
                        if (p.value > 0) {
                            str += `<span style="display:inline-block;margin-right:5px;border-radius:3px;width:10px;height:10px;background:${p.color}"></span>
                                    ${p.seriesName}: <b>${p.value}</b><br>`;
                            total += p.value;
                        }
                    });
                    str += `<hr style="margin:2px 0;">Total : <b>${total}</b>`;
                    return str;
                }
            },
            legend: { show: false },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: annees, axisLabel: { color: '#333' } },
            yAxis: { type: 'value', name: "Nombre d'observations", axisLabel: { color: '#333' } },
            series,
            animationDuration: 700,
            animationEasing: 'cubicOut'
        });

        window.addEventListener('resize', () => chart.resize());
    }, 200);
    // === FIN AJOUT 1 ===
}

// --- Bouton son top-right ---
soundToggleBtn.addEventListener('click', () => {
    window.soundAuto = !window.soundAuto;
    soundToggleBtn.classList.toggle('off', !window.soundAuto);
    if (!window.soundAuto) {
        // stop audio et highlight
        if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio = null; }
        highlightEspeces([]);
    }
});

// --- CHARGEMENT DES DÉPARTEMENTS (initial) ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(response => response.json())
    .then(data => {
        const layerDep = L.geoJSON(data, {
            style: styleDep,
            onEachFeature: async (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString();

                    // --- STOPPE le son en cours et retire les highlights ---
                    if (window.currentAudio && !window.currentAudio.paused) {
                        try {
                            window.currentAudio.pause();
                            window.currentAudio.currentTime = 0;
                        } catch (e) {
                            console.warn("Impossible d'arrêter l'audio :", e);
                        }
                    }
                    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
                    especesContainer.innerHTML = '';

                    // --- CHARGE LES DONNÉES DU DÉPARTEMENT ---
                    setLoading(true);
                    await chargerTousLesOiseaux(codeDep);
                    await chargerCommunesParDep(codeDep);
                    setLoading(false);
                });
            }
        });

        layerDep.addTo(map);
    })
    .catch(err => console.error("Erreur chargement départements:", err));

// === AJOUT 2 : bouton "Choisir une espèce" et logique (placé dans DOMContentLoaded pour éviter soucis de portée) ===
const chooseSpeciesBtn = document.createElement('button');
chooseSpeciesBtn.id = 'choose-species';
chooseSpeciesBtn.textContent = '🕊️ Choisir une espèce';
chooseSpeciesBtn.title = 'Choisir une espèce';
chooseSpeciesBtn.style.position = 'absolute';
chooseSpeciesBtn.style.top = '15px';
chooseSpeciesBtn.style.right = '65px';
chooseSpeciesBtn.style.zIndex = '1000';
chooseSpeciesBtn.style.background = 'white';
chooseSpeciesBtn.style.border = '2px solid #5e8c61';
chooseSpeciesBtn.style.borderRadius = '10px';
chooseSpeciesBtn.style.padding = '6px 10px';
chooseSpeciesBtn.style.cursor = 'pointer';
chooseSpeciesBtn.style.transition = '0.2s';
chooseSpeciesBtn.onmouseover = () => { chooseSpeciesBtn.style.background = '#5e8c61'; chooseSpeciesBtn.style.color = 'white'; };
chooseSpeciesBtn.onmouseout = () => { chooseSpeciesBtn.style.background = 'white'; chooseSpeciesBtn.style.color = 'black'; };
document.body.appendChild(chooseSpeciesBtn);

chooseSpeciesBtn.addEventListener('click', () => {
    if (!window.oiseauxData.length) {
        // si aucune donnée chargée pour le moment, propose de cliquer sur un département
        alert("Clique d'abord sur un département pour charger les données !");
        return;
    }

    let html = `<h2 style="text-align:center;color:#5e8c61;">Choisissez l'espèce que vous voulez rencontrer</h2>`;
    html += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;max-height:60vh;overflow:auto;padding:6px;">`;
    const especes = [...new Set(window.oiseauxData.map(o => o.espece))];

    especes.forEach(e => {
        const obs = window.oiseauxData.find(o => o.espece === e);
        html += `
        <div class="espece-choice" data-espece="${e}" style="display:flex;flex-direction:column;align-items:center;width:80px;cursor:pointer;">
            <img src="photos/${e.replace(/ /g, '_')}.jpg" onerror="this.src='https://via.placeholder.com/70?text=${encodeURIComponent(e.charAt(0))}'"
                style="width:60px;height:60px;border-radius:50%;border:2px solid #5e8c61;object-fit:cover;margin-bottom:6px;">
            <span style="font-size:12px;text-align:center;">${obs?.nomVernaculaire || e}</span>
        </div>`;
    });
    html += `</div>`;
    popupContent.innerHTML = html;
    afficherPopup();

    document.querySelectorAll('.espece-choice').forEach(div => {
        div.addEventListener('click', () => {
            const especeChoisie = div.getAttribute('data-espece');
            const nomScientifique = window.oiseauxData.find(o => o.espece === especeChoisie)?.nomScientifique;
            fermerPopup();
            // joue le son (si disponible)
            if (nomScientifique) playChant(nomScientifique);
            // colore toutes les communes où l'espèce est présente (pour tous les départements chargés)
            colorerCommunesPourEspece(especeChoisie);
        });
    });
});

function colorerCommunesPourEspece(espece) {
    if (!window.layerCommunes) return;
    const communesAColorer = new Set(window.oiseauxData.filter(o => o.espece === espece).map(o => o.codeinseecommune));
    window.layerCommunes.eachLayer(layer => {
        const code = layer.feature.properties.code.padStart(5, '0');
        const estPresente = communesAColorer.has(code);
        layer.setStyle({
            fillColor: estPresente ? '#5e8c61' : 'white',
            fillOpacity: estPresente ? 0.5 : 0.05,
            color: estPresente ? '#3b5e3c' : '#aaa'
        });
    });
}
// === FIN AJOUT 2 ===

}); // fin DOMContentLoaded
