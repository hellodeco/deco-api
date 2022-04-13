import express from 'express'
import type { Request, RequestHandler } from 'express'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import cors from 'cors'

export const app = express()

dotenv.config()

app.use(express.json())

const allowedOriginsStr = process.env.CORS_ALLOWED_ORIGINS || ''
const allowedOrigins = allowedOriginsStr.split(',')
const corsOpts = {
  origin: allowedOrigins,
}
app.use(cors(corsOpts))

/**
 * Health endpoint to ensure that the server is running as expected
 */
app.get('/healthz', async (req, res) => {
  res.status(200).json({ message: 'success' })
})

app.get('/oauth/notion', (req, res) => {
  console.log('oauthNotion fired dawg!')
  res.send('hello!')
})

app.get('/oauth/notion/callback', (req, res) => {
  res.send('hello!')
})
