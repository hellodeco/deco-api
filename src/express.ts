import express from 'express';

export const app = express()

app.get('/oauth/notion', (req, res) => {
  res.send('hello!')
})

app.get('/oauth/notion/callback', (req, res) => {
  res.send('hello!')
})
