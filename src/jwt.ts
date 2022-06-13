import jwt from 'jsonwebtoken'
import type { User } from './resolvers/resolvers'
import { JWT_PUBLIC_KEY } from './constants'

export async function verifyJWT(token: string): Promise<User | null> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      JWT_PUBLIC_KEY,
      (err: jwt.VerifyErrors, auth: jwt.JwtPayload) => {
        if (err) {
          return reject(err)
        }

        return resolve({ userfrontID: auth?.userUuid })
      },
    )
  })
}
