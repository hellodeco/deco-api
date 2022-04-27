import { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const userSeeds = [
    {
      signup_email: 'ehlinger.matt@gmail.com',
      userfront_user_id: 'efd2954c-3493-4d3d-99ea-e25f82defd3f',
      full_name: 'Matt Ehlinger',
    },
    {
      signup_email: 'tylerhhal@gmail.com',
      userfront_user_id: '0e733601-1716-49a6-a287-12bb9c6942be',
      full_name: 'Tyler Halstead',
    },
  ]

  const promises = userSeeds.map(async (user) => {
    try {
      await knex('users').insert(user)
    } catch (err) {
      console.error(err)
    }
  })

  await Promise.all(promises)
}
