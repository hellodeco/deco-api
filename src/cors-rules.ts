import cors from 'cors'
import { CORS_ALLOWED_ORIGINS } from './constants'

const allowedOriginsStr = CORS_ALLOWED_ORIGINS
const allowedOrigins = allowedOriginsStr.split(',')
const corsOpts = {
  origin: allowedOrigins,
}

export function makeCorsMiddleware() {
  return cors<cors.CorsRequest>(corsOpts)
}
