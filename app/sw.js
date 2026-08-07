/* Service worker du carnet — cache l'app shell et les données du voyage
   pour l'usage hors-connexion sur le terrain (priorité n°1 du projet,
   voir README « Principes hérités d'Italie2026 »).

   Trois stratégies de cache, choisies selon ce qui doit rester frais :
   - App shell (index.html, illustrations.js) : stale-while-revalidate —
     réponse immédiate depuis le cache, mise à jour en tâche de fond pour
     que la prochaine visite ait la dernière version.
   - Polices Google Fonts : cache-first pur — un fichier de police ne
     change jamais une fois publié, inutile de revalider.
   - Données Supabase (GET /rest/v1/...) et météo (api.open-meteo.com) :
     network-first avec repli sur le cache — priorité à la fraîcheur
     (horaires, quiz, météo du jour) quand il y a du réseau, dernière
     version connue sinon. Seules les requêtes GET sont mises en cache :
     jamais les écritures (progression, auth). */

/* Bumper à chaque changement qui touche l'app shell (index.html,
   illustrations.js, manifest, icônes) : le navigateur ne détecte une
   mise à jour du service worker que si ce fichier change d'octet, et
   l'activate ci-dessous purge alors proprement tous les caches de
   l'ancienne version — c'est ce qui déclenche le rechargement
   automatique côté app/index.html (controllerchange). Un simple compteur
   suffit, aucune signification particulière au-delà de "différent du
   précédent". */
var VERSION = "v31";
var CACHE_SHELL = "carnet-shell-" + VERSION;
var CACHE_FONTS = "carnet-fonts-" + VERSION;
var CACHE_DATA = "carnet-data-" + VERSION;
var CACHES_ACTUELLES = [CACHE_SHELL, CACHE_FONTS, CACHE_DATA];

var FICHIERS_APP_SHELL = [
  "./",
  "index.html",
  "illustrations.js",
  "carnet-pdf/highlight-registry.js",
  "carnet-pdf/adaptateur.js",
  "carnet-pdf/client.js",
  "carnet-pdf/modele.js",
  "carnet-pdf/preparation.js",
  "carnet-pdf/preparation.css",
  "manifest.json",
  "icones/apple-touch-icon.png",
  "icones/favicon.png",
  "icones/icon-192.png",
  "icones/icon-512.png",
  "icones/icon-maskable-192.png",
  "icones/icon-maskable-512.png"
];

self.addEventListener("install", function(evenement){
  evenement.waitUntil(
    caches.open(CACHE_SHELL).then(function(cache){
      return cache.addAll(FICHIERS_APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(evenement){
  evenement.waitUntil(
    caches.keys().then(function(noms){
      return Promise.all(
        noms
          .filter(function(nom){ return CACHES_ACTUELLES.indexOf(nom) === -1; })
          .map(function(nom){ return caches.delete(nom); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

function estPoliceGoogle(url){
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

function estDonneeSupabase(url){
  return url.hostname.indexOf(".supabase.co") !== -1 && url.pathname.indexOf("/rest/v1/") === 0;
}

function estMeteo(url){
  return url.hostname === "api.open-meteo.com";
}

function reponseHorsLigne(){
  return new Response(
    "Contenu indisponible hors connexion pour le moment — ouvrez le carnet une première fois avec du réseau.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

/* Cache-first : sert le cache s'il existe, sinon va au réseau et met en
   cache la réponse au passage. Pour des ressources immuables (polices). */
function cacheFirst(requete, nomCache){
  return caches.open(nomCache).then(function(cache){
    return cache.match(requete).then(function(reponse){
      if(reponse) return reponse;
      return fetch(requete).then(function(reponseReseau){
        if(reponseReseau && reponseReseau.ok) cache.put(requete, reponseReseau.clone());
        return reponseReseau;
      });
    });
  });
}

/* Stale-while-revalidate : répond depuis le cache immédiatement si
   possible, tout en relançant une requête réseau qui rafraîchit le
   cache pour la prochaine fois. Pour l'app shell. */
function staleWhileRevalidate(requete, nomCache){
  return caches.open(nomCache).then(function(cache){
    return cache.match(requete).then(function(reponseCache){
      var misAJour = fetch(requete).then(function(reponseReseau){
        if(reponseReseau && reponseReseau.ok) cache.put(requete, reponseReseau.clone());
        return reponseReseau;
      }).catch(function(){ return reponseCache; });
      return reponseCache || misAJour;
    });
  });
}

/* Network-first : priorité au réseau (données à jour), repli sur le
   dernier contenu connu en cache si hors connexion. Pour Supabase. */
function networkFirst(requete, nomCache){
  return caches.open(nomCache).then(function(cache){
    return fetch(requete).then(function(reponseReseau){
      if(reponseReseau && reponseReseau.ok) cache.put(requete, reponseReseau.clone());
      return reponseReseau;
    }).catch(function(){
      return cache.match(requete).then(function(reponseCache){
        return reponseCache || reponseHorsLigne();
      });
    });
  });
}

self.addEventListener("fetch", function(evenement){
  var requete = evenement.request;
  if(requete.method !== "GET") return;

  var url = new URL(requete.url);

  if(url.origin === self.location.origin){
    var critique=/\/(?:sw\.js|index\.html|carnet-pdf\/(?:adaptateur|client|preparation)\.js)$/.test(url.pathname)||url.pathname.endsWith("/");
    evenement.respondWith(critique?networkFirst(requete,CACHE_SHELL):staleWhileRevalidate(requete, CACHE_SHELL));
    return;
  }

  if(estPoliceGoogle(url)){
    evenement.respondWith(cacheFirst(requete, CACHE_FONTS));
    return;
  }

  if(estDonneeSupabase(url) || estMeteo(url)){
    evenement.respondWith(networkFirst(requete, CACHE_DATA));
    return;
  }

  /* CDN supabase-js, etc. : réseau direct, sans mise en cache. */
});
