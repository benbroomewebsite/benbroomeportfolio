import { ImageResponse } from 'next/og'

export const alt = 'Ben Broome — Curator, writer and organiser'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 56, background: '#eeeeeb', color: '#111', fontFamily: 'Arial, sans-serif', fontSize: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ background: '#fff', padding: '2px 5px' }}>Ben Broome</span>
        <span style={{ marginTop: 8, background: '#fff', padding: '2px 5px', fontSize: 28 }}>Curator, writer and organiser</span>
      </div>
    </div>, size,
  )
}
