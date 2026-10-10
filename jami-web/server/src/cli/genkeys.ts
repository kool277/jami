/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { defaultEnvPath } from '../utils/env.js'
import { formatSigningKeyEnv, generateSigningKeyPairPem } from '../utils/signing-key-pem.js'

function hasEnvKeys(envPath: string): boolean {
  if (!existsSync(envPath)) return false
  const content = readFileSync(envPath, 'utf-8')
  return content.includes('PRIVATE_KEY=') && content.includes('PUBLIC_KEY=')
}

export async function genkeyCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web genkeys [options]

Generate Ed25519 JWT signing keys and append them to .env

Options:
  --force     Overwrite existing keys
  --env-file  Path to the .env file (default: ${defaultEnvPath})
  --help      Show this help message`)
    return
  }

  const force = args.includes('--force')
  const envFileIdx = args.indexOf('--env-file')
  const envPath = resolve(envFileIdx !== -1 && args[envFileIdx + 1] ? args[envFileIdx + 1] : defaultEnvPath)

  mkdirSync(dirname(envPath), { recursive: true })

  if (!force && hasEnvKeys(envPath)) {
    console.log('Public and private keys are already defined in', envPath)
    console.log('Use --force to regenerate them.')
    return
  }

  const keyPair = generateSigningKeyPairPem()

  // If forcing, we need to remove old keys and rewrite
  if (force && existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const filtered = content
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        return !trimmed.startsWith('PRIVATE_KEY=') && !trimmed.startsWith('PUBLIC_KEY=')
      })
      .join('\n')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(envPath, filtered.replace(/\n{3,}/g, '\n\n'))
  }

  appendFileSync(envPath, formatSigningKeyEnv(keyPair))
  console.log('JWT signing keys written to', envPath)
}
