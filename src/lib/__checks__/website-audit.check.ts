import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicAddress, publicPage } from '../../../supabase/functions/_shared/public-page.ts'

test('seules les adresses de destination unicast publiques sont utilisables', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.0.1', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::', '30::1', 'invalid']) {
    assert.equal(publicAddress(ip), false, ip)
  }
  assert.equal(publicAddress('1.1.1.1'), true)
  assert.equal(publicAddress('2606:4700:4700::1111'), true)
})

test('les domaines déclarés exclus, leurs sous-domaines et les URL hors périmètre sont refusés avant la lecture', async () => {
  const previous = process.env.SITE_AUDIT_BLOCKED_DOMAINS
  process.env.SITE_AUDIT_BLOCKED_DOMAINS = 'example.org'
  try {
    for (const url of ['https://example.org', 'https://www.example.org', 'file:///document', 'http://localhost']) {
      await assert.rejects(publicPage(url), { status: url.includes('example.org') ? 403 : 400 })
    }
  } finally {
    if (previous === undefined) delete process.env.SITE_AUDIT_BLOCKED_DOMAINS
    else process.env.SITE_AUDIT_BLOCKED_DOMAINS = previous
  }
})

test('robots.txt est consulté avant la page et un refus interrompt la lecture', async t => {
  const { default: dns } = await import('node:dns/promises')
  const { default: https } = await import('node:https')
  const { syncBuiltinESMExports } = await import('node:module')
  const { Readable } = await import('node:stream')
  const { EventEmitter } = await import('node:events')
  const paths: string[] = []
  const lookup = t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  syncBuiltinESMExports()
  t.mock.method(https, 'get', (options, callback) => {
    paths.push(options.path)
    assert.equal(options.hostname, '1.1.1.1')
    assert.equal(options.servername, 'example.com')
    const response = Object.assign(Readable.from([Buffer.from('User-agent: *\nDisallow: /restricted')]), {
      statusCode: 200, headers: { 'content-type': 'text/plain' },
    })
    callback(response)
    return new EventEmitter()
  })
  try {
    await assert.rejects(publicPage('https://example.com/restricted'), { status: 403 })
    assert.deepEqual(paths, ['/robots.txt'])
  } finally {
    lookup.mock.restore()
    syncBuiltinESMExports()
  }
})
