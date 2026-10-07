import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Filonea, l’outil de prospection des freelances'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const fontDir = join(process.cwd(), 'src/assets/fonts')

/** Image affichée quand un lien vers Filonea est partagé (LinkedIn, Slack, messageries…) */
export default async function Image() {
  const [sora, inter] = await Promise.all([
    readFile(join(fontDir, 'sora-latin-700-normal.woff')),
    readFile(join(fontDir, 'inter-latin-400-normal.woff')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          color: '#241614',
          fontFamily: 'Inter',
          background: 'radial-gradient(90% 120% at 100% 0%, #f2ab9c 0%, #fbe6e1 38%, #fdfaf7 75%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#c9432f" />
            <path d="M11.5 23.5V8.5h4.5M11.5 15.5h3.5" fill="none" stroke="#fdfaf7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22.3" cy="8.5" r="2.8" fill="#fbd3bf" />
          </svg>
          <div style={{ display: 'flex', fontFamily: 'Sora', fontSize: 44, fontWeight: 700, letterSpacing: -2 }}>filonea</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Sora', fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.1 }}>
            <span>Trouvez les entreprises</span>
            <span>qui ont besoin de vous,</span>
            <span style={{ color: '#c9432f' }}>au bon moment.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 32, marginTop: 28, color: '#6d5a55' }}>
            L’outil de prospection des freelances
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Sora', data: sora, style: 'normal', weight: 700 },
        { name: 'Inter', data: inter, style: 'normal', weight: 400 },
      ],
    }
  )
}
