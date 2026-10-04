# Portfolio date audit

Researched 3 October 2026.

44 imported project records lacked a month. 25 now have sourced month or day
precision; 19 still need confirmation. Evidence URLs and qualifications for each
added date are stored in [date-research.json](../scripts/import-data/date-research.json).

The Press filter contains publication directory links, rather than dated project
records, and is excluded from these totals.

The index shows month/year; project pages show the day when supported. Exhibition
records use their public opening, performances use their event date, and composite
performance records use the programme month. Year-only records follow dated
records within their year. Photo processing dates and article publication dates
are not substituted for event dates.

## Dates added

| Project | Date |
| --- | --- |
| Ladji Diaby, Lafayette Anticipations | 1 April 2026 |
| Nihaal Faizal, The Magic Pencil | 4 October 2025 |
| Klein & The Twins, Crystal Palace Bowl | 12 October 2025 |
| Show Me The Body, Southwark Park | 14 August 2025 |
| After Pheidias, Galerie Derouillon | 8 March 2025 |
| Racheal Crowther, Gebrauchsmusik | 24 January 2025 |
| David L. Johnson, The Shop at Sadie Coles HQ | 10 August 2024 |
| Claudia Comte, Home Sweet Home | April 2024 |
| Gala Prudent, Numeroventi | 11 November 2023 |
| Jesús Hilario-Reyes, Waywardly In Low Tide | 28 July 2023 |
| Stéphanie Brossard, Notre Dame Des Laves | 28 July 2023 |
| Christelle Oyiri, HYPERFATE | 12 May 2023 |
| Lenard Giller, Revisions | 28 April 2023 |
| Real Corporeal, Gladstone | 10 September 2022 |
| Chassol, Gladstone | 24 September 2022 |
| Slauson Malone, Gladstone | 26 September 2022 |
| Drawing A Blank exhibition, Parasol Unit | 17 February 2022 |
| Drawing A Blank opening performances, Parasol Unit | 17 February 2022 |
| Slauson Malone, London | 23 February 2022 |
| Drawing A Blank exhibition, Paris | September 2020 |
| Drawing A Blank performance programme, Paris | September 2020 |
| Drawing A Blank exhibition, London | 9 May 2019 |
| Drawing A Blank performance programme, London | May 2019 |
| Drawing A Blank exhibition, New York | 14 June 2018 |
| Drawing A Blank performance programme, New York | June 2018 |

Examples of primary evidence include the [Lafayette exhibition listing](https://www.lafayetteanticipations.com/en/exposition/ladji-diaby),
[Derouillon exhibition listing](https://derouillon.com/exhibitions/ben-broome-galerie-derouillon),
[original Magic Pencil press release](https://www.benbroome.co.uk/s/nihaal-faizal-the-magic-pencil-press-release.pdf)
and [Numeroventi programme](https://numeroventi.it/Fall-Residency-Program).
The [first-hand Parasol Unit report](https://novembre.global/magazine/drawing-a-blank-seen-and-told-by-octavia-buergel)
explicitly dates its opening programme and Slauson Malone's London performance.

## Dates Ben still needs to confirm

| Project | Current year | What is missing |
| --- | --- | --- |
| Cyprien Gaillard, Camden WC | 2026 | Opening month; the original release is undated. |
| Artist Membership Project | 2025 | Launch month. July is an approximate inference from later coverage. |
| Rat Section, Victoria Embankment Bandstand | 2025 | Performance month/day. |
| SUUTOO, Ruskin Park Bandstand | 2025 | Performance month/day. |
| Slauson Malone 1, Ruskin Park Bandstand | 2025 | Performance month/day. |
| Charlie Osbourne, Myatt's Fields Bandstand | 2025 | Performance month/day. |
| Daria Blum, Myatt's Fields Bandstand | 2025 | Performance month/day. |
| Eartheater / Onyx Collective, Gladstone | 2022 | Individual performance date within the September–October programme. |
| Gabber Eleganza, Gladstone | 2022 | Individual performance date. |
| Jesus Hilario Reyes, Gladstone | 2022 | Individual performance date. |
| J Words / John Glacier, Gladstone | 2022 | Individual performance date. |
| TYGAPAW, Gladstone | 2022 | Individual performance date. |
| Keiyaa, Gladstone | 2022 | Individual performance date. |
| Laraaja, Gladstone | 2022 | Individual performance date and displayed name spelling. |
| Aspen Kincaid, Late City Final | 2020 | Exhibition month. |
| Chassol Paris legacy page | Imported as 2019 | Event identity, city, year and month: source title says Chassol Paris, imported row says Drawing A Blank/London. |
| Space Afrika legacy page | Imported as 2018 | Event identity, venue, year and month: source title says Space Afrika, imported row says Drawing A Blank/New York. Some image filenames resemble the 2022 Gladstone rolls. |
| 2022 Artist Grant recipients | 2022 | Award announcement month. Application opening is a different date. |
| 2021 Artist Grant recipients | 2021 | Award announcement month. |

The [original grant programme page](https://www.benbroome.co.uk/artist-grant)
dates the 2022 application window to 4–18 May. This is not used to date the
recipient announcement. The membership launch candidate is an inference from
[October coverage](https://www.theguardian.com/artanddesign/2025/oct/20/clandestine-guerrilla-scheme-letting-skint-artists-mass-share-gallery-membership-cards),
so it is also left unapplied.

## Corrections and source conflicts

- The performance programme containing Onyx Collective, Pretty Sick, Fatima,
  Sporting Life, Slauson Malone and Gully Type was imported as Parasol Unit/2022.
  The [contemporary listing](https://10magazine.com/drawing-a-blank-exhibition-ben-broome-london-soho/)
  and [curator interview](https://system-magazine.com/editorial/system-selects/ben-broome-drawing-a-blank-art-exhibition-interview)
  identify London in May 2019, so its year and venue label are corrected. The
  original page title also had a conflicting 2018 year. Its URL is retained.
- The actual Parasol Unit opening record names Christelle Oyiri, Chassol,
  Obongjayar and Lewis Ofman. The dated first-hand report distinguishes it from
  London 2019, so this previously hidden performance record is restored.
- Claudia Comte sources distinguish a 10 April preview from an 11 April public
  opening. April 2024 is retained without selecting a day.
- The [Frieze event listing](https://www.frieze.com/event/curated-ben-broome-stephanie-brossard-notre-dame-des-laves-jesus-hilario-reyes-waywardly-low)
  and original release place Waywardly In Low Tide in July 2023; an October
  caption in a later brochure conflicts. The dated event evidence is used.
- Real Corporeal's opening-night report mentions 9 September, while the gallery
  lists public exhibition dates from 10 September. The public opening is used.
- Gala Prudent's residency started in October; the exhibition opened on
  11 November. The exhibition record uses November.
- Eight original exhibition releases are attached to their proper projects.
  Labelled gallery and press links are restored from the original project pages;
  unlabelled links to neighbouring listings are excluded.

## Maintaining the dates

Update `scripts/import-data/date-research.json` with the event date, evidence URL and qualification.
Use `YYYY-MM` when only the month is supported, or `YYYY-MM-DD` when a day is
explicit. These corrections survive rebuilding the imported `content/works/`.
Confirm the two ambiguous performance identities before changing their titles
or years.
