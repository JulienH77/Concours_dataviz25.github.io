// =========================
// === VARIABLES GLOBALES ===
// =========================

window.soundAuto = true;        // active la lecture automatique
window.activeAudios = [];       // liste des sons actuellement en cours
window.sonsEspeces = {};        // { nomScientifique: { son: "url_du_son.mp3" } } à remplir ailleurs

// =========================
// === GESTION DES SONS ===
// =========================

/**
 * Stoppe tous les sons actuellement joués
 */
function stopAllSounds() {
    if (window.activeAudios.length > 0) {
        for (const a of window.activeAudios) {
            try {
                a.pause();
                a.currentTime = 0;
            } catch (e) {}
        }
        window.activeAudios = [];
    }
    highlightEspeces([]); // désactive les badges d'espèces
}

/**
 * Joue simultanément tous les sons associés à une liste d'espèces
 * @param {string[]} nomsScientifiques 
 */
function playChantsForSpeciesList(nomsScientifiques = []) {
    // stoppe les précédents
    stopAllSounds();

    if (!window.soundAuto || !nomsScientifiques || nomsScientifiques.length === 0) {
        return;
    }

    const newAudios = [];

    for (const nomSci of nomsScientifiques) {
        const sonData = window.sonsEspeces[nomSci];
        if (!sonData || !sonData.son) continue;

        try {
            // on crée un objet Audio neuf à chaque fois
            const audio = new Audio(sonData.son);
            audio.volume = 0.8;
            audio.preload = 'none';

            // on joue immédiatement (important : dans le même contexte de clic)
            audio.play()
                .then(() => console.log(`Lecture : ${nomSci}`))
                .catch(err => console.warn(`Lecture impossible (${nomSci}):`, err));

            newAudios.push(audio);
        } catch (e) {
            console.error(`Erreur audio pour ${nomSci}:`, e);
        }
    }

    // on stocke la nouvelle liste d'audios
    window.activeAudios = newAudios;

    // mise en évidence visuelle
    highlightEspeces(nomsScientifiques);
}

// =========================
// === INTERACTION CARTE ===
// =========================

// Exemple d’événement sur ta carte Leaflet (à adapter à ton code)
map.on('click', function (e) {
    // ici, tu récupères la liste des oiseaux pour la commune cliquée
    const especesAvecSon = getSpeciesForCommune(e.latlng);

    console.log("Commune cliquée, espèces :", especesAvecSon);

    if (window.soundAuto && especesAvecSon && especesAvecSon.length > 0) {
        playChantsForSpeciesList(especesAvecSon);
    } else {
        stopAllSounds();
    }
});

// =========================
// === OUTILS / EXEMPLES ===
// =========================

/**
 * Exemple : met en surbrillance les espèces qui chantent
 * (à adapter selon ton HTML)
 */
function highlightEspeces(liste) {
    const badges = document.querySelectorAll('.espece');
    badges.forEach(b => {
        const nom = b.dataset.nomSci;
        if (liste.includes(nom)) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

/**
 * Exemple : fonction pour obtenir les espèces d'une commune
 * (remplace par ton vrai code de récupération)
 */
function getSpeciesForCommune(latlng) {
    // Exemple bidon : à remplacer
    const random = Math.random();
    if (random < 0.3) return []; // pas d'oiseaux
    if (random < 0.6) return ['Erithacus rubecula', 'Parus major'];
    return ['Erithacus rubecula', 'Cyanistes caeruleus', 'Columba palumbus'];
}
