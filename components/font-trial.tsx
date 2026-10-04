'use client'

import { useEffect } from 'react'

// Typeface trial: add ?font=msmincho, ?font=shippori or ?font=arial to any URL.
// The choice is remembered for the rest of the browser session.
const fonts = ['msmincho', 'shippori', 'arial']

export function FontTrial() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('font')
    if (requested && fonts.includes(requested)) window.sessionStorage.setItem('font-trial', requested)
    const font = window.sessionStorage.getItem('font-trial')
    if (font) document.documentElement.dataset.font = font
  }, [])
  return null
}
