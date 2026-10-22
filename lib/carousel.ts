import mediaMap from './media-map.json'
import { works } from './works'

// The home slideshow: a curated sequence of full-resolution photographs.

// Which project each slideshow image comes from, matched through the media bucket
// (the same photograph is stored once and used by both).
const storedAs = (path: string) => (mediaMap as Record<string, string>)[path]?.replace(/__[0-9a-f]{8}(?=\.)/, '')
const worksByImage = new Map(works.flatMap((work) => work.images.map((image) => [storedAs(image.src), work] as const)))
export const carouselWork = (src: string) => worksByImage.get(storedAs(src))

// Same curated 52-image sequence, mapped to the full-resolution migration files.
export const carouselImages = [
  '/carousel-hires/003.jpg', '/carousel-hires/004.jpg', '/carousel-hires/005.jpg',
  '/carousel-hires/006.jpg',
  '/carousel-hires/007.jpg', '/carousel-hires/008.jpg', '/carousel-hires/009.jpg',
  '/carousel-hires/010.jpg', '/carousel-hires/011.jpg', '/carousel-hires/012.jpg',
  '/carousel-hires/013.jpg', '/carousel-hires/014.jpg', '/carousel-hires/015.jpg',
  '/carousel-hires/016.png', '/carousel-hires/017.png', '/carousel-hires/018.png',
  '/carousel-hires/019.jpg', '/carousel-hires/020.jpg', '/carousel-hires/021.png',
  '/carousel-hires/022.png', '/carousel-hires/023.png', '/carousel-hires/024.jpg',
  '/carousel-hires/025.jpg', '/carousel-hires/026.jpg', '/carousel-hires/027.jpg',
  '/carousel-hires/028.jpg', '/carousel-hires/029.jpg', '/carousel-hires/030.jpg',
  '/carousel-hires/031.jpg', '/carousel-hires/032.jpg', '/carousel-hires/033.jpg',
  '/carousel-hires/034.jpg', '/carousel-hires/035.jpeg', '/carousel-hires/036.jpg',
  '/carousel-hires/037.jpg', '/carousel-hires/038.jpg', '/carousel-hires/039.jpg',
  '/carousel-hires/040.jpg', '/carousel-hires/041.jpg', '/carousel-hires/042.jpg',
  '/carousel-hires/043.jpg', '/carousel-hires/044.jpg', '/carousel-hires/045.jpg',
  '/carousel-hires/046.jpg', '/carousel-hires/047.jpg', '/carousel-hires/048.jpg',
  '/carousel-hires/049.jpeg', '/carousel-hires/050.jpeg', '/carousel-hires/051.png',
  '/carousel-hires/052.png',
] as const
