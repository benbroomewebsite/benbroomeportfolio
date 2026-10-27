import siteData from './generated/site.json'

// Keystatic omits empty optional fields when it saves. Do not infer the editor
// schema from the fields present in one particular version of the JSON file.
type SiteContent = {
  bio: string
  email: string
  instagram: string
  portrait?: string | null
  portraitAlt?: string | null
  portraitCredit?: string | null
}

const site: SiteContent = siteData

// Edited at /keystatic under Bio and contact.
export const aboutParagraphs = site.bio.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
export const contact = { email: site.email, instagram: site.instagram }
export const portrait = site.portrait ? { src: site.portrait, alt: site.portraitAlt || 'Ben Broome', credit: site.portraitCredit } : null
