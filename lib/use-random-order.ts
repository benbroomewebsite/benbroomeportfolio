'use client'

import { useLayoutEffect, useState } from 'react'

// Shuffle after hydration, once per visit. Never mutate the editor's saved order.
export function useRandomOrder<T>(items: readonly T[], enabled = true): readonly T[] {
  const [order, setOrder] = useState(items)
  useLayoutEffect(() => {
    if (!enabled || new URLSearchParams(window.location.search).has('edit')) {
      setOrder(items)
      return
    }
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
    }
    setOrder(shuffled)
  }, [items, enabled])
  return enabled ? order : items
}
