import { makeRouteHandler } from '@keystatic/next/route-handler'
import config, { editorEnabled } from '../../../../keystatic.config'

const handler = makeRouteHandler({ config })
const disabled = () => new Response('Not found', { status: 404 })

export const GET = editorEnabled ? handler.GET : disabled
export const POST = editorEnabled ? handler.POST : disabled
