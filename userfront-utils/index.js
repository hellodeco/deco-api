#!/usr/bin/env node
import fs from "fs"
import url from "url"
import path from "path"
import meow from "meow"
import Userfront from "@userfront/core"

/**
 * This is an esmodule which does not expose __dirname so we gotta "polyfill" it
 */
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

Userfront.init("wn95p6n5")

const JWT_FILE_NAME = "jwt.txt"

const helpText = `
  Utils for working with Userfront 🕵️
  After signing up or logging in, your new JWT token will be printed to stdout and written to disk in a file called "${JWT_FILE_NAME}"

  Usage 🚚
    $ node ./index.js <login|signup>

  Examples 🗿
    signup and generate a JWT
      $ node ./index.js signup --password 1234abcd! --email thomkins@hellodeco.co

    login and generate a JWT
      $ node ./index.js login --password 1234abcd! --email thomkins@hellodeco.co

  Options ❓
    --password, p (required) password to login or signup with
    --email,    e (required) email to login or signup with
`

async function main() {
  const cli = meow(helpText, {
    importMeta: import.meta,
    flags: {
      password: {
        type: "string",
        alias: "p",
        isRequired: true,
      },
      email: {
        type: "string",
        alias: "e",
        isRequired: true,
      },
    },
  })

  const { input, flags } = cli

  const [firstCmd] = input
  let jwt

  switch (firstCmd) {
    case "signup":
      jwt = await signup({ flags })
      break
    case "login":
      jwt = await login({ flags })
      break
    default:
      throw new Error("No command given")
  }

  // This log should remain since we want to print the JWT to std out for convenience
  console.log(jwt)

  refreshJWTOnDisk(jwt)
}

async function signup({ flags }) {
  const res = await Userfront.signup({
    method: "password",
    email: flags.email,
    password: flags.password,
  })
  return res.tokens.access.value
}

async function login({ flags }) {
  const res = await Userfront.login({
    method: "password",
    email: flags.email,
    password: flags.password,
  })
  return res.tokens.access.value
}

function getJWTFilePath() {
  return path.join(__dirname, JWT_FILE_NAME)
}

function cleanJWT() {
  const jwtPath = getJWTFilePath()
  if (fs.existsSync(jwtPath)) {
    fs.rmSync(jwtPath)
  }
}

function refreshJWTOnDisk(jwt) {
  cleanJWT()
  fs.writeFileSync(getJWTFilePath(), jwt)
}

main()
