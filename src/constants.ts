function getPort() {
  const defaultPort = 4000
  const overridePort = process.env.PORT &&
    Number(process.env.PORT) 

  return overridePort || defaultPort
}

export const PORT = getPort()
