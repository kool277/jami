/*
 * Copyright (C) 2020-2024 by Savoir-faire Linux
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import axios from "axios";

import configApiCall from "../../api";
import {
  api_path_get_ns_name_from_addr,
  api_path_get_user_profile,
} from "../../globalUrls";
import {
  DEFAULT_UI_CUSTOMIZATION,
  PolicyData,
  UiCustomization,
} from "./policyData.constants";

const getModerators = async (defaultModerators: string) => {
  const moderators = [];
  const ids = defaultModerators.split("/").filter((id) => id !== "");

  for (const id of ids) {
    const usernameResponse = await axios(
      configApiCall(api_path_get_ns_name_from_addr + id, "GET", null, null),
    );
    const username = usernameResponse.data.name;

    const userProfileResponse = await axios(
      configApiCall(api_path_get_user_profile + username, "GET", null, null),
    );
    userProfileResponse.data["id"] = id;
    moderators.push(userProfileResponse.data);
  }

  return moderators;
};

const setPermissionsSettings = async (policyData: PolicyData) => {
  if (policyData.defaultModerators !== undefined) {
    policyData.blueprintModerators = await getModerators(
      policyData.defaultModerators,
    );
  }
  delete policyData.defaultModerators;

  return policyData;
};

const setConfigurationSettings = (policyData: PolicyData) => {
  const { turnEnabled, proxyEnabled } = policyData;

  if (turnEnabled === true) {
    policyData.selectedTurnOption = "customTurn";
  } else if (turnEnabled === false) {
    policyData.selectedTurnOption = "disabledTurn";
  } else {
    policyData.selectedTurnOption = "defaultTurn";
  }
  delete policyData.turnEnabled;

  if (proxyEnabled === true) {
    policyData.selectedDHTProxyOption = "customDHTProxy";
  } else if (proxyEnabled === false) {
    policyData.selectedDHTProxyOption = "disabledDHTProxy";
  } else {
    policyData.selectedDHTProxyOption = "defaultDHTProxy";
  }
  delete policyData.proxyEnabled;

  return policyData;
};

const convertArgbToRgba = (argb: string) => {
  if (argb.length === 7) {
    return argb;
  }
  if (argb.length !== 9) {
    throw new Error(`Invalid argb value: "${argb}}"`);
  }

  return "#" + argb.substr(3, 6) + argb.substr(1, 2);
};

const setCustomizationSettings = (
  uiCustomization: string | UiCustomization,
) => {
  if (!uiCustomization || typeof uiCustomization !== "string") {
    return uiCustomization;
  }
  // If we reach this point, it means that the uiCustomization is enabled
  let ParsedUiCustomization: UiCustomization = DEFAULT_UI_CUSTOMIZATION;
  const result = JSON.parse(uiCustomization);
  ParsedUiCustomization.isCustomizationEnabled =
    result.isCustomizationEnabled !== undefined
      ? result.isCustomizationEnabled
      : true;
  ParsedUiCustomization.hasTitle = result.title !== "";
  ParsedUiCustomization.title = result.title;
  ParsedUiCustomization.hasDescription = result.description !== "";
  ParsedUiCustomization.description = result.description;
  ParsedUiCustomization.hasTips = result.areTipsEnabled;

  if (result.backgroundType === "default") {
    ParsedUiCustomization.hasBackground = false;
  } else if (result.backgroundType === "color") {
    ParsedUiCustomization.hasBackground = true;
    ParsedUiCustomization.backgroundColor = result.backgroundColorOrUrl;
  } else if (result.backgroundType === "image") {
    ParsedUiCustomization.hasBackground = true;
    ParsedUiCustomization.backgroundUrl = result.backgroundColorOrUrl;
  }

  ParsedUiCustomization.tipBoxAndIdColor = result.tipBoxAndIdColor
    ? convertArgbToRgba(result.tipBoxAndIdColor)
    : DEFAULT_UI_CUSTOMIZATION.tipBoxAndIdColor;

  ParsedUiCustomization.hasMainBoxColor = result.mainBoxColor !== undefined;
  ParsedUiCustomization.mainBoxColor = result.mainBoxColor
    ? convertArgbToRgba(result.mainBoxColor)
    : DEFAULT_UI_CUSTOMIZATION.mainBoxColor;

  // Get the name of the file from the url
  ParsedUiCustomization.hasLogo = result.logoUrl !== "";
  ParsedUiCustomization.logoUrl = result.logoUrl;
  ParsedUiCustomization.logoSize =
    result.logoSize || DEFAULT_UI_CUSTOMIZATION.logoSize;

  return ParsedUiCustomization;
};

export const parsePolicyData = async (data: string): Promise<PolicyData> => {
  let policyData = JSON.parse(data);
  policyData = await setPermissionsSettings(policyData);
  policyData = setConfigurationSettings(policyData);
  policyData.uiCustomization = setCustomizationSettings(
    policyData.uiCustomization,
  );

  return policyData as PolicyData;
};
