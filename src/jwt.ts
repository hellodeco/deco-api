import jwt from 'jsonwebtoken'
import type { User } from './resolvers/resolvers'
import { getSecretFromEnvVarOrFile } from './utils'

const jwtPublicKey = getSecretFromEnvVarOrFile({
  envVarName: 'JWT_PUBLIC_KEY',
  fileName: 'userfront-public-key.crt',
});

export async function verifyJWT(token: string): Promise<User | null> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      // process.env.JWT_PUBLIC_KEY,
      jwtPublicKey,
      (err: jwt.VerifyErrors, auth: jwt.JwtPayload) => {
        if (err) {
          console.log('verifyJWT', err);
          return reject(err)
        }

        return resolve({ userfrontID: auth?.userUuid })
      },
    )
  })
}
