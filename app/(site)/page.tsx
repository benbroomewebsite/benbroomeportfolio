import { Portfolio } from '@/components/portfolio'
import { siteName, siteUrl } from '@/lib/site'

export default function Page() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl.href,
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, '\\u003c') }} />
    <Portfolio />
  </>
}
