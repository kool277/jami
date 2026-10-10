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
import { adminConfigValuePair, conferenceResolutionValues, IAdminConfigState } from '@savoirfairelinux/jami-web-common'

export const isConfigValid = (config: any): config is Partial<IAdminConfigState> => {
  //This is to ensure the config is an object with only one property and the key is a valid config key
  const isValid =
    !!config &&
    typeof config === 'object' &&
    Object.keys(config).length >= 1 &&
    Object.keys(config).every((key) => key in adminConfigValuePair)
  //This is to check if the value for the key is of the correct type
  //Thus, the checks above must pass to proceed, since Object.keys() will give error in case of passing null to it
  if (isValid) {
    switch (Object.keys(config)[0]) {
      case 'localAuthEnabled':
        return typeof config['localAuthEnabled'] === adminConfigValuePair['localAuthEnabled']
      case 'jamsAuthEnabled':
        return typeof config['jamsAuthEnabled'] === adminConfigValuePair['jamsAuthEnabled']
      case 'guestAccessEnabled':
        return typeof config['guestAccessEnabled'] === adminConfigValuePair['guestAccessEnabled']
      case 'openIdAuthEnabled':
        return typeof config['openIdAuthEnabled'] === adminConfigValuePair['openIdAuthEnabled']
      case 'noLocalMediaEnabled':
        return typeof config['noLocalMediaEnabled'] === adminConfigValuePair['noLocalMediaEnabled']
      case 'conferenceResolution':
        return (
          typeof config['conferenceResolution'] === adminConfigValuePair['conferenceResolution'] &&
          conferenceResolutionValues.includes(config['conferenceResolution'])
        )
      case 'uploadPath':
        // TODO check if the upload path is unsecure
        return typeof config['uploadPath'] === adminConfigValuePair['uploadPath']
      default:
        return false
    }
  }

  return isValid
}
