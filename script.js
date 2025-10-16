// === Variables globales ===
let map;
let layerDep;
let layerCommunes;
let oiseauxData = [];
let audio = new Audio();
let soundEnabled = false;

// === Initialisation de la carte ===
map = L.map('map').setView([48.2, 4.8], 8);
L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18,
}).addTo(map);

// === Popup ===
const popup = document.getElementById('popup');
const popupContent = document.querySelector('.popup-content');
const popupClose = document.querySelector('.popup-close');

function afficherPopup() {
    popup.classList.remove('hidden');
}
function fermerPopup() {
    popup.classList.add('hidden');
}
popupClose.addEventListener('click', fermerPopup);

// === Bouton son ===
const soundToggleBtn = document.getElementById('sound-toggle');
soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? '🔇' : '🔊';
});

// === Bouton choisir une espèce ===
const chooseBtn = document.getElementById('choose-species');
chooseBtn.addEventListener('click', () => {
    if (!oiseauxData || oiseauxData.length === 0) {
        alert("Clique d'abord sur un département pour charger les données !");
        return;
    }

    let html = `<h2 style="text-align:center;color:#5e8c61;">Choisissez l'espèce que vous voulez rencontrer</h2>`;
    html += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;">`;

    const especes = [...new Set(oiseauxData.map(o => o.espece))];
    especes.forEach(e => {
        const obs = oiseauxData.find(o => o.espece === e);
        html += `
        <div class="espece-choice" data-espece="${e}" style="display:flex;flex-direction:column;align-items:center;width:70px;cursor:pointer;">
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
            const nomScientifique = oiseauxData.find(o => o.espece === especeChoisie)?.nomScientifique;

            fermerPopup();
            highlightEspeces([especeChoisie]);
            playChant(nomScientifique);
            colorerCommunesPourEspece(especeChoisie);
        });
    });
});

// === Fonction pour jouer le chant d’un oiseau ===
function playChant(nomScientifique) {
    if (!soundEnabled || !nomScientifique) return;
    audio.pause();
    audio.src = `sons/${nomScientifique.replace(/ /g, '_')}.mp3`;
    audio.play().catch(() => console.warn("Son introuvable pour :", nomScientifique));
}

// === Chargement des données par département ===
function chargerDepartement(codeDep) {
    fetch(`data/${codeDep}.json`)
        .then(r => r.json())
        .then(data => {
            oiseauxData = data;
            afficherPopupDepartement(codeDep);
        })
        .catch(err => console.error("Erreur chargement département", err));
}

// === Popup d’un département ===
function afficherPopupDepartement(codeDep) {
    const nbEspeces = new Set(oiseauxData.map(o => o.espece)).size;
    popupContent.innerHTML = `
        <h2 style="text-align:center;">Département ${codeDep}</h2>
        <p style="text-align:center;">${nbEspeces} espèces observées</p>
        <button id="voir-details" style="margin:10px auto;display:block;">Voir les espèces</button>
    `;
    afficherPopup();

    document.getElementById('voir-details').addEventListener('click', () => {
        let html = `<h2 style="text-align:center;color:#5e8c61;">Espèces observées dans le ${codeDep}</h2>`;
        html += `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;">`;
        const especes = [...new Set(oiseauxData.map(o => o.espece))];
        especes.forEach(e => {
            const obs = oiseauxData.find(o => o.espece === e);
            html += `
            <div class="espece-badge" data-espece="${e}" style="display:flex;flex-direction:column;align-items:center;width:70px;cursor:pointer;">
                <img src="photos/${e.replace(/ /g, '_')}.jpg" onerror="this.src='https://via.placeholder.com/70?text=${encodeURIComponent(e.charAt(0))}'"
                    style="width:60px;height:60px;border-radius:50%;border:2px solid #5e8c61;object-fit:cover;">
                <span style="font-size:12px;text-align:center;">${obs.nomVernaculaire || e}</span>
            </div>`;
        });
        html += `</div>`;
        popupContent.innerHTML = html;

        document.querySelectorAll('.espece-badge').forEach(div => {
            div.addEventListener('click', () => {
                const especeChoisie = div.getAttribute('data-espece');
                const nomScientifique = oiseauxData.find(o => o.espece === especeChoisie)?.nomScientifique;
                afficherStatsEspece(nomScientifique, construireStatsParAnnee(especeChoisie), oiseauxData, 'Commune locale');
            });
        });
    });
}

// === Génère les stats par année ===
function construireStatsParAnnee(espece) {
    const stats = {};
    for (let annee = 2012; annee <= 2022; annee++) {
        stats[annee] = oiseauxData.filter(o => o.espece === espece && o.annee === annee).length;
    }
    return stats;
}

// === Affichage du graphique ECharts ===
function afficherStatsEspece(nomScientifique, observationsParAnnee, observationsDepartement, nomCommune) {
    let content = `
        <h2 style="text-align:center;">${nomScientifique}</h2>
        <p style="margin-top:6px;margin-bottom:0px;"><strong>Évolution des observations :</strong></p>
        <div id="echart-${nomScientifique.replace(/ /g, '_')}" style="width:100%;height:250px;"></div>
    `;

    popupContent.innerHTML = content;
    afficherPopup();

    setTimeout(() => {
        const chartDom = document.getElementById(`echart-${nomScientifique.replace(/ /g, '_')}`);
        if (!chartDom) return;

        const annees = Array.from({ length: 11 }, (_, i) => 2012 + i);
        const dataLocal = annees.map(a => observationsParAnnee[a] || 0);
        const deps = ["08","10","51","52","54","55","57","67","68","88"];
        const currentDep = observationsDepartement[0]?.codeinseecommune?.substring(0, 2) || "";
        const autresDeps = deps.filter(d => d !== currentDep);
        const series = [];

        autresDeps.forEach((dep, i) => {
            const dataDep = annees.map(a =>
                observationsDepartement.filter(o => o.annee === a && o.codeinseecommune.startsWith(dep)).length
            );
            series.push({
                name: `Département ${dep}`,
                type: 'bar',
                stack: 'total',
                emphasis: { focus: 'series' },
                itemStyle: { color: `rgba(120,120,120,${0.15 + i * 0.05})` },
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

        const myChart = echarts.init(chartDom);
        const option = {
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
            xAxis: { type: 'category', data: annees, axisLabel: { color: '#555' } },
            yAxis: { type: 'value', name: "Nombre d'observations", nameTextStyle: { color: '#555', fontWeight: 'bold' }, axisLabel: { color: '#555' } },
            series,
            animationDuration: 800,
            animationEasing: 'cubicOut'
        };
        myChart.setOption(option);
        window.addEventListener('resize', () => myChart.resize());
    }, 200);
}

// === Colore les communes où l’espèce est présente ===
function colorerCommunesPourEspece(espece) {
    if (!layerCommunes && !layerDep) return;
    const communesAColorer = new Set(
        oiseauxData.filter(o => o.espece === espece).map(o => o.codeinseecommune)
    );
    if (layerCommunes) {
        layerCommunes.eachLayer(layer => {
            const code = layer.feature.properties.code.padStart(5, '0');
            const estPresente = communesAColorer.has(code);
            layer.setStyle({
                fillColor: estPresente ? '#5e8c61' : 'white',
                fillOpacity: estPresente ? 0.5 : 0.05,
                color: estPresente ? '#3b5e3c' : '#aaa'
            });
        });
    }
}
