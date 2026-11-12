// Lecteur commun à la fiche entreprise et aux fonctions de Sophie.
import { Buffer } from 'node:buffer'
import { env } from 'node:process'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import robotsParser from 'robots-parser'

const agent = 'Filonea-StackDetector'
const maxHtml = 2 * 1024 * 1024
const maxRobots = 512 * 1024
const timeoutMs = 8000

export class PublicPageError extends Error {
  readonly status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export function publicAddress(address: string) {
  if (!ipaddr.isValid(address)) return false
  const ip = ipaddr.parse(address)
  if (ip.range() !== 'unicast') return false
  return ip instanceof ipaddr.IPv4 || ip.match(ipaddr.IPv6.parse('2000::'), 3)
}

function validate(url: URL) {
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const blocked = (env.SITE_AUDIT_BLOCKED_DOMAINS ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
  if (blocked.some(domain => host === domain || host.endsWith('.' + domain))) {
    throw new PublicPageError('Ce domaine exclut la lecture automatisée.', 403)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !url.hostname.includes('.') || isIP(url.hostname) || url.hostname.startsWith('[')) {
    throw new PublicPageError('Un domaine public HTTP ou HTTPS est requis.', 400)
  }
}

function read(url: URL, max: number, signal: AbortSignal) {
  validate(url)
  // Le socket utilise uniquement l'adresse numérique contrôlée. Le nom d'origine
  // reste celui du certificat TLS (SNI) et de l'en-tête Host.
  return new Promise<{ status: number; location?: string; type: string; text: string }>((resolve, reject) => {
    const onAbort = () => reject(new PublicPageError('Délai de lecture du site dépassé.'))
    signal.throwIfAborted()
    signal.addEventListener('abort', onAbort, { once: true })
    lookup(url.hostname, { all: true }).then(addresses => {
      signal.throwIfAborted()
      if (!addresses.length || !addresses.every(a => publicAddress(a.address))) {
        throw new PublicPageError('Adresse de site non autorisée.', 403)
      }
      const target = addresses.find(a => a.family === 4) ?? addresses[0]!
      const transport = url.protocol === 'https:' ? https : http
      const request = transport.get({
        hostname: target.address, servername: url.hostname, agent: false,
        path: url.pathname + url.search, signal,
        headers: { Host: url.host, 'User-Agent': agent + '/1.0 (+https://filonea.fr)', 'Accept-Encoding': 'identity' },
      }, async response => {
        try {
          const status = response.statusCode ?? 0
          const chunks: Buffer[] = []
          let size = 0
          if (status === 200) {
            if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
              throw new PublicPageError('Encodage de page non pris en charge.')
            }
            for await (const chunk of response) {
              size += chunk.length
              if (size > max) throw new PublicPageError('La page dépasse la taille de lecture autorisée.')
              chunks.push(chunk)
            }
          }
          resolve({ status, location: response.headers.location, type: response.headers['content-type'] ?? '', text: Buffer.concat(chunks).toString('utf8') })
        } catch (error) { reject(error) }
        finally { response.destroy() }
      })
      request.on('error', reject)
    }).catch(reject)
  })
}

// Cache borné par instance, limité aux règles publiques. Aucune page HTML conservée.
type RobotsPolicy = {
  isAllowed(url: string, userAgent: string): boolean | undefined
  getCrawlDelay(userAgent: string): number | undefined
}
// Le paquet CommonJS exporte cette fonction directement sous Node et Deno.
const parseRobots = robotsParser as unknown as (url: string, text: string) => RobotsPolicy
const policies = new Map<string, { rules: RobotsPolicy; until: number }>()

export async function publicPage(raw: string) {
  const signal = AbortSignal.timeout(timeoutMs)
  let url: URL
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw) }
  catch { throw new PublicPageError('Adresse du site invalide.', 400) }
  const domain = url.hostname.replace(/^www\./, '')
  for (let hop = 0; hop <= 3; hop++) {
    validate(url)
    const cached = policies.get(url.origin)
    let policy = cached && cached.until > Date.now() ? cached.rules : null
    if (!policy) {
      const robots = new URL('/robots.txt', url)
      let target = robots
      let rule = await read(target, maxRobots, signal)
      for (let redirects = 0; redirects < 3 && [301, 302, 303, 307, 308].includes(rule.status) && rule.location; redirects++) {
        target = new URL(rule.location, target)
        rule = await read(target, maxRobots, signal)
      }
      if (![200, 404, 410].includes(rule.status)) throw new PublicPageError('Les règles de lecture du site sont indisponibles.', 403)
      policy = parseRobots(robots.href, rule.text)
      if (policies.size >= 32) {
        const oldest = policies.keys().next().value
        if (oldest) policies.delete(oldest)
      }
      policies.set(url.origin, { rules: policy, until: Date.now() + 600_000 })
    }
    if (policy.isAllowed(url.href, agent) !== true || (policy.getCrawlDelay(agent) ?? 0) > 0) {
      throw new PublicPageError('Les règles du site limitent cette lecture.', 403)
    }
    const response = await read(url, maxHtml, signal)
    if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
      url = new URL(response.location, url)
      if (url.hostname.replace(/^www\./, '') !== domain) {
        throw new PublicPageError('Le site redirige vers un autre domaine. Vérifiez le site officiel de la fiche.', 403)
      }
      continue
    }
    if (response.status !== 200 || !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.type)) {
      throw new PublicPageError('Aucune page HTML accessible à cette adresse.')
    }
    url.hash = ''
    return { finalUrl: url.toString(), html: response.text }
  }
  throw new PublicPageError('Trop de redirections.')
}
