/**
 * Après une mise en ligne, une page gardée par le service worker (réseau lent au lancement,
 * hors-ligne) peut réclamer des fichiers JS ou CSS de l'ancienne version, qui n'existent plus :
 * l'app resterait sur un écran blanc. Ce script, exécuté avant tout le reste, le détecte, oublie
 * les pages gardées et recharge une fois (au plus toutes les 30 s, pour ne jamais boucler).
 * `window.__recoverApp()` sert aussi à l'écran d'erreur.
 */
export const CHUNK_RECOVERY_PATTERN = /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module/;

export const CHUNK_RECOVERY_SCRIPT = `(function(){
var KEY="pommelia-recovered-at";
function recover(){
  try{var last=Number(sessionStorage.getItem(KEY))||0;if(Date.now()-last<30000)return false;sessionStorage.setItem(KEY,String(Date.now()));}catch(e){}
  var reload=function(){location.reload();};
  if(window.caches)caches.delete("app-pages").then(reload,reload);else reload();
  return true;
}
window.__recoverApp=recover;
window.addEventListener("error",function(e){var t=e.target;var url=t&&(t.src||t.href);if(typeof url==="string"&&url.indexOf("/_next/static/")!==-1)recover();},true);
window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(${CHUNK_RECOVERY_PATTERN}.test(String(r&&(r.name+" "+r.message))))recover();});
})();`;
