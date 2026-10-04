import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { editorEnabled } from '../../keystatic.config'
import KeystaticApp from './keystatic'

export const metadata: Metadata = { title: 'Editor — Ben Broome', robots: { index: false, follow: false } }

export default function Layout() {
  if (!editorEnabled) notFound()
  return <html lang="en">
    <body><KeystaticApp /></body>
  </html>
}
