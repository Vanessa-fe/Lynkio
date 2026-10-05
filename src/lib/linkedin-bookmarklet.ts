/**
 * Bouton « + Lynkio » à glisser dans la barre de favoris (un « bookmarklet ») :
 * sur un profil LinkedIn, il lit ce qui est affiché (nom, titre du profil, adresse)
 * et ouvre « Ajouter une personne » pré-rempli dans Lynkio. Rien n'est enregistré
 * sans que l'utilisatrice vérifie et valide le formulaire.
 *
 * Profil par profil, au rythme d'une personne : c'est ce qui le distingue de
 * l'extraction en masse que LinkedIn interdit.
 *
 * Écrit en JavaScript simple, dans une chaîne : le code s'exécute tel quel sur la
 * page LinkedIn, sans passer par la compilation de Next.js (qui pourrait y ajouter
 * des fonctions utilitaires absentes de LinkedIn). Les sélecteurs de LinkedIn
 * changent : le nom a une solution de repli (titre de l'onglet), et tous les
 * champs restent modifiables dans le formulaire.
 *
 * Paramètres : o = adresse de Lynkio, h = adresse de la page (location.href).
 */
export const LINKEDIN_CAPTURE_SOURCE = String.raw`(function (o, h) {
  var u = h.split(/[?#]/)[0];
  if (!/linkedin\.com\/in\//.test(u)) {
    alert("Ouvrez d'abord le profil LinkedIn d'une personne (adresse en linkedin.com/in/...).");
    return;
  }
  var e = document.querySelector('main h1') || document.querySelector('h1');
  var n = ((e && e.textContent) || '').trim() || document.title.replace(/^\(\d+\)\s*/, '').split('|')[0];
  var p = n.trim().split(/\s+/);
  var f = p.shift() || '';
  var t = document.querySelector('main .text-body-medium');
  var hl = t ? t.innerText.trim() : '';
  var m = hl.match(/\s(?:chez|at|@)\s+(.+)$/i);
  var c = m ? m[1].split(/[|,·•]/)[0].trim() : '';
  var q = new URLSearchParams({
    firstName: f,
    lastName: p.join(' '),
    role: hl.slice(0, 200),
    company: c.slice(0, 200),
    linkedin: u,
    from: 'linkedin'
  });
  window.open(o + '/people/new?' + q.toString(), '_blank');
})`

/**
 * Lien du bookmarklet pour cette adresse de Lynkio (production, aperçu ou local).
 * Encodé : dans une adresse « javascript: », un « # » couperait le code.
 */
export function linkedinBookmarklet(origin: string): string {
  return `javascript:${encodeURIComponent(`${LINKEDIN_CAPTURE_SOURCE}(${JSON.stringify(origin)}, location.href);void 0`)}`
}
