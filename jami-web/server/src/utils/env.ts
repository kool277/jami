/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { join, resolve } from 'node:path'

import * as dotenv from 'dotenv'
import envPaths from 'env-paths'

const paths = envPaths('jami-web', { suffix: '' })

/**
 * The Jami Web data directory, where the .env file, admin/account configuration
 * and uploads are stored. Defaults to the platform application data directory
 * and can be overridden with the JAMI_WEB_DATA_DIR environment variable.
 */
export const dataDir = process.env.JAMI_WEB_DATA_DIR ? resolve(process.env.JAMI_WEB_DATA_DIR) : paths.data

export const defaultEnvPath = join(dataDir, '.env')

export function loadEnv(): void {
  dotenv.config()
  dotenv.config({ path: process.env.JAMI_WEB_ENV_FILE ? resolve(process.env.JAMI_WEB_ENV_FILE) : defaultEnvPath })
}
