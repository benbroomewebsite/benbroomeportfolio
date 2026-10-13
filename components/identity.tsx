import Link from 'next/link'

export function Identity({ className = '', tagline = true }: { className?: string; tagline?: boolean }) {
  return <header className={`identity ${className}`.trim()}>
    <Link href="/"><span>Ben Broome</span></Link>
    {tagline && <p><span>Curator</span><span>Writer</span><span>Artist</span></p>}
  </header>
}
