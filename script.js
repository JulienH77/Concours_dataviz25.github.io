// ============================
//   INITIALISATION DE LA CARTE
// ============================
const map = L.map("map").setView([48.7, 6.2], 7);

L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// ============================
//   GESTION DU CHARGEMENT
// ============================
const loadingScreen = document.getElementById("loading-screen");
loadingScreen.style.display = "flex";

window.addEventListener("load", () => {
  loadingScreen.style.display = "none";
});

// ============================
//   DONNÉES DES ESPÈCES (exemple test)
// ============================
const sonsEspeces = {
  "Canard colvert": "https://xeno-canto.org/1047850/embed?simple=1",
  "Pigeon ramier": "https://xeno-canto.org/1047851/embed?simple=1"
};

// Exemple d’espèces (à remplacer par ton vrai CSV ou GeoJSON)
const especes = [
  {
    nomvernaculaire: "Canard colvert",
    nomscientifiqueref: "Anas platyrhynchos",
    genre: "Anas",
    famille: "Anatidae",
    especeevalueelr: true,
    especereglementee: false,
    image: "IMG/canard.jpg"
  },
  {
    nomvernaculaire: "Pigeon ramier",
    nomscientifiqueref: "Columba palumbus",
    genre: "Columba",
    famille: "Columbidae",
    especeevalueelr: false,
    especereglementee: false,
    image: "IMG/pigeon.jpg"
  }
];

// ============================
//   AFFICHAGE DES RONDS D’ESPÈCES
// ============================
const container = document.getElementById("especes-container");

especes.forEach((data, index) => {
  const badge = document.createElement("div");
  badge.classList.add("espece-badge");

  const img = document.createElement("img");
  img.src = data.image;
  img.alt = data.nomvernaculaire;

  badge.appendChild(img);
  badge.addEventListener("click", () => ouvrirPopup(data));
  container.appendChild(badge);
});

// ============================
//   POPUP ESPÈCE
// ============================
function ouvrirPopup(data) {
  const popupOverlay = document.getElementById("popup-overlay");
  const popupStats = document.getElementById("popup-stats");
  const popupContent = document.getElementById("popup-content");

  const audioURL = sonsEspeces[data.nomvernaculaire] || null;

  // Contenu de la popup
  let popupHTML = `
    <div class="popup-left">
      <img src="${data.image}" alt="${data.nomvernaculaire}" class="popup-image">
  `;

  // Ajout du lecteur audio sous la photo
  if (audioURL) {
    popupHTML += `
      <iframe src="${audioURL}&autoplay=1" width="100%" height="120" frameborder="0" scrolling="no"></iframe>
    `;
  }

  popupHTML += `
    </div>
    <div class="popup-right">
      <h2>${data.nomvernaculaire}</h2>
      <p><i>${data.nomscientifiqueref}</i></p>
      <p><strong>Genre :</strong> ${data.genre}</p>
      <p><strong>Famille :</strong> ${data.famille}</p>
      <p><strong>Espèce Liste Rouge :</strong> ${data.especeevalueelr ? "✅ Oui" : "❌ Non"}</p>
      <p><strong>Espèce réglementée :</strong> ${data.especereglementee ? "✅ Oui" : "❌ Non"}</p>
    </div>
  `;

  popupContent.innerHTML = popupHTML;

  popupOverlay.style.display = "block";
  popupStats.style.display = "flex";
}

function fermerPopup() {
  document.getElementById("popup-overlay").style.display = "none";
  document.getElementById("popup-stats").style.display = "none";
  document.getElementById("popup-content").innerHTML = "";
}

// ============================
//   POPUPS DES COMMUNES
// ============================

// Exemple de données de communes
const communesGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        nom_commune: "Nancy",
        total_recensements: 42,
        recensements_par_annee: { 2021: 10, 2022: 12, 2023: 20 }
      },
      geometry: { type: "Point", coordinates: [6.1844, 48.6921] }
    },
    {
      type: "Feature",
      properties: {
        nom_commune: "Reims",
        total_recensements: 31,
        recensements_par_annee: { 2021: 8, 2022: 9, 2023: 14 }
      },
      geometry: { type: "Point", coordinates: [4.0317, 49.2583] }
    }
  ]
};

function styleCommune(feature) {
  return {
    radius: 6,
    fillColor: "#8b6f47",
    color: "#5e8c61",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  };
}

function onEachCommune(feature, layer) {
  const props = feature.properties;
  let contenu = `<div class="popup-commune">
    <h3>${props.nom_commune}</h3>
    <p><strong>Total :</strong> ${props.total_recensements}</p>
    <ul>`;
  for (const [annee, nb] of Object.entries(props.recensements_par_annee)) {
    contenu += `<li>${annee} : ${nb}</li>`;
  }
  contenu += `</ul></div>`;

  layer.bindPopup(contenu, { className: "popup-champetre" });
}

L.geoJSON(communesGeoJSON, {
  pointToLayer: (f, latlng) => L.circleMarker(latlng, styleCommune(f)),
  onEachFeature: onEachCommune
}).addTo(map);
