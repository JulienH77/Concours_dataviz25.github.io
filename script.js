// --- INIT CARTE ET ÉLÉMENTS DOM ---
const map = L.map('map').setView([48.8021, 5.8844], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

map.on('click', () => {
    map.closePopup();
    if (typeof fermerPopup === 'function') fermerPopup();
    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
});

// DOM
const loadingScreen = document.getElementById('loading-screen');
const especesContainer = document.getElementById('especes-container');
const popupOverlay = document.getElementById('popup-overlay');
const popupStats = document.getElementById('popup-stats');
const popupContent = document.getElementById('popup-content');
const soundToggleBtn = document.getElementById('sound-toggle');

// === AJOUT 2 : bouton "Choisir une espèce" ===
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
chooseSpeciesBtn.onmouseover = () => chooseSpeciesBtn.style.background = '#5e8c61', chooseSpeciesBtn.style.color = 'white';
chooseSpeciesBtn.onmouseout = () => chooseSpeciesBtn.style.background = 'white', chooseSpeciesBtn.style.color = 'black';
document.body.appendChild(chooseSpeciesBtn);
// =================================================

let windowOiseauxData = [];
window.oiseauxData = [];
window.soundAuto = true;

// --- Styles leaflet ---
const styleDep = { color: "black", weight: 3, opacity: 0.8, fill: true, fillColor: "white", fillOpacity: 0.75 };
const styleCom = { color: "black", weight: 1, opacity: 0.5, fill: true, fillColor: "white", fillOpacity: 0.001 };

document.addEventListener('DOMContentLoaded', () => {

// --- sons mapping ---
const sonsEspeces = {
    "Turdus merula": {
        son: "https://xeno-canto.org/1047850/download",
        iframe: "https://xeno-canto.org/1047850/embed?simple=1"
    },
    "Passer domesticus": {
        son: "https://xeno-canto.org/1047609/download",
        iframe: "https://xeno-canto.org/1047609/embed?simple=1"
    }
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

popupOverlay.addEventListener('click', fermerPopup);
document.addEventListener('keydown', (e) => { if (e.key === "Escape") fermerPopup(); });

function stripQuotes(s) {
    if (s === undefined || s === null) return "";
    return s.toString().trim().replace(/^"|"$/g, "");
}
function normaliserBooleen(val) {
    if (val === undefined || val === null) return false;
    const v = stripQuotes(val).toString().toLowerCase();
    return v === "true" || v === "oui" || v === "1" || v === "x";
}

function preloadAudio(url) {
    try {
        const audio = new Audio();
        audio.src = url;
        audio.load();
    } catch (e) {
        console.warn("Préchargement audio impossible:", e);
    }
}

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
        window.currentAudio.play().catch(e => console.warn("Erreur audio:", e));
    } catch (e) {
        console.error("Erreur playChant:", e);
    }
}

function highlightEspeces(especeList) {
    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
    especeList.forEach(espece => {
        const badge = document.querySelector(`.espece-badge[data-espece="${CSS.escape(espece)}"]`);
        if (badge) badge.classList.add('speaking');
    });
}

// === CHARGEMENT DONNÉES / COMMUNES (inchangé) ===
// ... (tout ton code d’origine ici inchangé jusqu’à afficherStatsEspece) ...

// --- AFFICHAGE DES STATISTIQUES (popup overlay) ---
function afficherStatsEspece(espece, observationsCommune, nomCommune, nomScientifique, observationsDepartement = []) {
    observationsDepartement.sort((a,b) => a.annee - b.annee);

    const observationsParAnnee = {};
    (observationsCommune || []).forEach(o => {
        observationsParAnnee[o.annee] = (observationsParAnnee[o.annee] || 0) + 1;
    });

    let content = `
        <div style="position: relative;">
        <div id="popup-inner" style="display:flex; gap: 20px; width:100%;">
            <div class="popup-left">
                <img src="photos/${espece.replace(/ /g, '_').replace(/"/g, '')}.jpg"
                     alt="${espece}" class="popup-image"
                     onerror="this.src='https://via.placeholder.com/220?text=${encodeURIComponent(espece.charAt(0))}'">
    `;

    if (sonsEspeces[nomScientifique]?.iframe) {
        content += `
            <div class="popup-iframe">
                <iframe src="${sonsEspeces[nomScientifique].iframe}"
                        scrolling="no" frameborder="0"
                        width="100%" height="100%"></iframe>
            </div>`;
    }

    content += `</div><div class="popup-right">
        <h2 style="color: #5e8c61; margin-top: 0;">${observationsCommune[0]?.nomVernaculaire || nomScientifique}</h2>
        <p><strong>Nom scientifique:</strong> ${nomScientifique}</p>
        <p style="margin-top:6px; margin-bottom:0px;"><strong>Évolution des observations à ${nomCommune} :</strong></p>
        <div id="echart-${nomScientifique.replace(/ /g,'_')}" style="width:100%;height:260px;"></div>
    </div></div></div>`;
    
    popupContent.innerHTML = content;
    afficherPopup();

    // === AJOUT 1 : graphique Apache ECharts ===
    setTimeout(() => {
        const chartDom = document.getElementById(`echart-${nomScientifique.replace(/ /g,'_')}`);
        if (!chartDom) return;

        const annees = Array.from({length: 11}, (_, i) => 2012 + i);
        const dataLocal = annees.map(a => observationsParAnnee[a] || 0);

        const deps = ["08","10","51","52","54","55","57","67","68","88"];
        const currentDep = observationsDepartement[0]?.codeinseecommune?.substring(0,2) || "";
        const autresDeps = deps.filter(d => d !== currentDep);
        const series = [];

        autresDeps.forEach((dep,i) => {
            const dataDep = annees.map(a =>
                observationsDepartement.filter(o => o.annee === a && o.codeinseecommune.startsWith(dep)).length
            );
            series.push({
                name: `Département ${dep}`,
                type: 'bar',
                stack: 'total',
                emphasis: { focus: 'series' },
                itemStyle: { color: `rgba(150,150,150,${0.1 + i*0.05})` },
                data: dataDep
            });
        });

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
                            str += `<span style="display:inline-block;margin-right:5px;
                                    border-radius:3px;width:10px;height:10px;background:${p.color}"></span>
                                    ${p.seriesName}: <b>${p.value}</b><br>`;
                            total += p.value;
                        }
                    });
                    return str + `<hr style="margin:2px 0;">Total : <b>${total}</b>`;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: annees },
            yAxis: { type: 'value', name: "Nombre d'observations" },
            series
        });

        window.addEventListener('resize', () => chart.resize());
    }, 200);
    // === FIN AJOUT 1 ===
}

// === AJOUT 2 suite : logique du bouton “Choisir une espèce” ===
chooseSpeciesBtn.addEventListener('click', () => {
    if (!window.oiseauxData.length) {
        alert("Clique d'abord sur un département pour charger les données !");
        return;
    }

    let html = `<h2 style="text-align:center;color:#5e8c61;">Choisissez l'espèce que vous voulez rencontrer</h2>`;
    html += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;">`;
    const especes = [...new Set(window.oiseauxData.map(o => o.espece))];

    especes.forEach(e => {
        const obs = window.oiseauxData.find(o => o.espece === e);
        html += `
        <div class="espece-choice" data-espece="${e}" style="display:flex;flex-direction:column;align-items:center;width:80px;cursor:pointer;">
            <img src="photos/${e.replace(/ /g, '_')}.jpg" onerror="this.src='https://via.placeholder.com/70?text=${encodeURIComponent(e.charAt(0))}'"
                style="width:60px;height:60px;border-radius:50%;border:2px solid #5e8c61;object-fit:cover;">
            <span style="font-size:12px;text-align:center;">${obs.nomVernaculaire || e}</span>
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
            playChant(nomScientifique);
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

// --- Bouton son top-right ---
soundToggleBtn.addEventListener('click', () => {
    window.soundAuto = !window.soundAuto;
    soundToggleBtn.classList.toggle('off', !window.soundAuto);
    if (!window.soundAuto) {
        if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio = null; }
        highlightEspeces([]);
    }
});

// --- CHARGEMENT DES DÉPARTEMENTS ---
fetch("donnees_concours/departements-grand-est.geojson")
    .then(r => r.json())
    .then(data => {
        const layerDep = L.geoJSON(data, {
            style: styleDep,
            onEachFeature: async (feature, layer) => {
                layer.on('click', async () => {
                    const codeDep = feature.properties.code.toString();
                    if (window.currentAudio && !window.currentAudio.paused) {
                        try { window.currentAudio.pause(); window.currentAudio.currentTime = 0; } catch {}
                    }
                    document.querySelectorAll('.espece-badge.speaking').forEach(b => b.classList.remove('speaking'));
                    especesContainer.innerHTML = '';
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

});
