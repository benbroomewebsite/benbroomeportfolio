import Link from 'next/link'

export function Identity({ className = '', tagline = true }: { className?: string; tagline?: boolean }) {
  return <header className={`identity ${className}`.trim()}>
    <Link href="/"><strong>Ben Broome</strong></Link>
    {tagline && <p>: Curator, Writer, Artist</p>}
  </header>
}
