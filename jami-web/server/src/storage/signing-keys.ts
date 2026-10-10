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

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { generateKeyPair, importPKCS8, importSPKI, KeyLike } from 'jose'
import { Service } from 'typedi'

import { isElectronMode } from '../utils/electron.js'
import { defaultEnvPath } from '../utils/env.js'
import { formatSigningKeyEnv, generateSigningKeyPairPem } from '../utils/signing-key-pem.js'

@Service()
export class SigningKeys {
  privateKey!: KeyLike
  publicKey!: KeyLike

  async build() {
    let privatekey = process.env.PRIVATE_KEY
    let publicKey = process.env.PUBLIC_KEY

    if (privatekey === undefined || publicKey === undefined) {
      if (isElectronMode) {
        // Auto-generate keys in Electron mode
        const keyPair = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
        this.privateKey = keyPair.privateKey
        this.publicKey = keyPair.publicKey
        return this
      }
      if (privatekey === undefined && publicKey === undefined) {
        const keyPair = generateSigningKeyPairPem()
        mkdirSync(dirname(defaultEnvPath), { recursive: true })
        appendFileSync(defaultEnvPath, formatSigningKeyEnv(keyPair))
        privatekey = keyPair.privateKey
        publicKey = keyPair.publicKey
      } else {
        const missing = privatekey === undefined ? 'PRIVATE_KEY' : 'PUBLIC_KEY'
        throw new Error(
          `Incomplete JWT signing keys: ${missing} is missing while the other is set. ` +
            `Both PRIVATE_KEY and PUBLIC_KEY must be present. ` +
            `Regenerate a matching key pair with "jami-web genkeys --force" ` +
            `(this overwrites the existing key in ${defaultEnvPath}).`,
        )
      }
    }

    this.privateKey = await importPKCS8(privatekey, 'EdDSA')
    this.publicKey = await importSPKI(publicKey, 'EdDSA')

    return this
  }
}
