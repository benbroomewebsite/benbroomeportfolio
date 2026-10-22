import site from './generated/site.json'

// Edited at /keystatic under Bio and contact.
export const aboutParagraphs = site.bio.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
export const contact = { email: site.email, instagram: site.instagram }
export const portrait = site.portrait ? { src: site.portrait, alt: site.portraitAlt || 'Ben Broome', credit: site.portraitCredit } : null
