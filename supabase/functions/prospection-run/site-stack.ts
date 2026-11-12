// Technologies d'un site, repérées dans le HTML de sa page d'accueil.
// Mêmes marqueurs que la détection de l'application (src/lib/detectors/stack.ts).

import { publicPage } from '../_shared/public-page.ts'

const MARKERS: Record<string, (html: string) => boolean> = {
  nextjs: (html) => ['/_next/static/', '__NEXT_DATA__', 'self.__next_f'].some((marker) => html.includes(marker)),
  react: (html) => html.includes('data-reactroot') || /<script[^>]+src=["'][^"']*react-dom[^"']*["']/i.test(html),
  wordpress: (html) =>
    html.includes('wp-content') || html.includes('wp-includes') || /<meta\s+name=["']generator["']\s+content=["']WordPress/i.test(html),
  webflow: (html) => html.includes('data-wf-site') || html.includes('webflow.js'),
}

export async function fetchPublicPage(rawUrl: string) {
  try { return await publicPage(rawUrl) } catch { return null }
}

/**
 * Technologies détectées sur la page d'accueil, ou null si le site est injoignable.
 * finalUrl : l'adresse du site après redirections (celle à enregistrer) ;
 * html : la page, réutilisée pour y chercher le SIREN.
 */
export async function detectSiteStack(
  rawUrl: string
): Promise<{ finalUrl: string; detected: string[]; html: string } | null> {
  const page = await fetchPublicPage(rawUrl)
  if (!page) return null

  const detected = Object.entries(MARKERS)
    .filter(([, matches]) => matches(page.html))
    .map(([technology]) => technology)
  return { finalUrl: `${new URL(page.finalUrl).origin}/`, detected, html: page.html }
}
