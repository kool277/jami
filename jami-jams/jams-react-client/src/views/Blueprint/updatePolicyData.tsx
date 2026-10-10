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
import i18next from "i18next";

import configApiCall from "api";
import { api_path_blueprints } from "globalUrls";
import { debounce } from "lodash";
import {
  DEFAULT_UI_CUSTOMIZATION,
  PolicyData,
  ServerPolicyData,
  createDefaultServerPolicyData,
} from "./policyData.constants";
import { Dispatch, SetStateAction } from "react";
import { SnackbarProps } from "./PolicyDataContext";
import { ServerUiCustomization } from "./ServerUiCustomization";

const updatePerms = (
  data: PolicyData,
  serverPolicyData: ServerPolicyData,
): ServerPolicyData => {
  serverPolicyData.videoEnabled = data.videoEnabled;
  serverPolicyData.publicInCalls = data.publicInCalls;
  serverPolicyData.autoAnswer = data.autoAnswer;
  serverPolicyData.peerDiscovery = data.peerDiscovery;
  serverPolicyData.accountDiscovery = data.accountDiscovery;
  serverPolicyData.accountPublish = data.accountPublish;
  serverPolicyData.allowLookup = data.allowLookup;
  serverPolicyData.rendezVous = data.rendezVous;
  serverPolicyData.defaultModerators =
    data.blueprintModerators?.map((moderator) => moderator.id).join("/") ?? "";

  return serverPolicyData;
};

const updateConfig = (
  data: PolicyData,
  serverPolicyData: ServerPolicyData,
): ServerPolicyData => {
  const { selectedTurnOption, selectedDHTProxyOption } = data;
  serverPolicyData.upnpEnabled = data.upnpEnabled;
  // if undefined, it means we want the default values
  if (selectedTurnOption !== "customTurn") {
    delete serverPolicyData.turnServer;
    delete serverPolicyData.turnServerUserName;
    delete serverPolicyData.turnServerPassword;
  }

  if (selectedDHTProxyOption !== "customDHTProxy") {
    delete serverPolicyData.proxyServer;
    delete serverPolicyData.dhtProxyListUrl;
  }

  if (selectedTurnOption === "customTurn") {
    serverPolicyData.turnEnabled = true;
    serverPolicyData.turnServer = data.turnServer;
    serverPolicyData.turnServerUserName = data.turnServerUserName;
    serverPolicyData.turnServerPassword = data.turnServerPassword;
  } else if (selectedTurnOption === "disabledTurn") {
    serverPolicyData.turnEnabled = false;
  } else {
    delete serverPolicyData.turnEnabled;
  }

  if (selectedDHTProxyOption === "customDHTProxy") {
    serverPolicyData.proxyEnabled = true;
    serverPolicyData.proxyServer = data.proxyServer;
    serverPolicyData.dhtProxyListUrl = data.dhtProxyListUrl;
  } else if (selectedDHTProxyOption === "disabledDHTProxy") {
    serverPolicyData.proxyEnabled = false;
  } else {
    delete serverPolicyData.proxyEnabled;
  }

  return serverPolicyData;
};

const convertRgbaToArgb = (rgba: string) => {
  if (rgba.length === 7) {
    return rgba;
  }
  if (rgba.length !== 9) {
    throw new Error(`Invalid rgba value: "${rgba}}"`);
  }

  return "#" + rgba.substring(7, 9) + rgba.substring(1, 7);
};

const updateUiCustomization = (
  data: PolicyData,
  serverPolicyData: ServerPolicyData,
): ServerPolicyData => {
  const {
    hasTitle,
    title,
    hasDescription,
    description,
    hasTips,

    hasBackground,
    backgroundColor,
    backgroundUrl,

    tipBoxAndIdColor,
    hasMainBoxColor,
    mainBoxColor,

    hasLogo,
    logoUrl,
    logoSize,
  } = data.uiCustomization;

  if (data.uiCustomization.isCustomizationEnabled === false) {
    serverPolicyData.uiCustomization = data.uiCustomization;
    return serverPolicyData;
  }

  const ui: ServerUiCustomization = {
    title: hasTitle ? title : "",
    description: hasDescription ? description : "",
    areTipsEnabled: hasTips,
    backgroundType: "default",
    tipBoxAndIdColor:
      tipBoxAndIdColor !== DEFAULT_UI_CUSTOMIZATION.tipBoxAndIdColor
        ? convertRgbaToArgb(tipBoxAndIdColor)
        : undefined,
    mainBoxColor:
      hasMainBoxColor && mainBoxColor
        ? convertRgbaToArgb(mainBoxColor)
        : undefined,
    logoUrl: hasLogo ? logoUrl : "",
    logoSize:
      logoSize !== DEFAULT_UI_CUSTOMIZATION.logoSize
        ? logoSize
        : DEFAULT_UI_CUSTOMIZATION.logoSize,
  };

  if (hasBackground === false) {
    ui.backgroundType = "default";
  } else if (backgroundUrl) {
    ui.backgroundType = "image";
    ui.backgroundColorOrUrl = backgroundUrl;
  } else if (backgroundColor !== "") {
    ui.backgroundType = "color";
    ui.backgroundColorOrUrl = backgroundColor || "#ffffff";
  }

  serverPolicyData.uiCustomization = JSON.stringify(ui);

  return serverPolicyData;
};

const sendPutRequest = (
  blueprintName: string,
  data: ServerPolicyData,
  setSnackbar: (snackbar: SnackbarProps) => void,
) => {
  axios(
    configApiCall(
      api_path_blueprints + "?name=" + blueprintName,
      "PUT",
      data,
      null,
    ),
  )
    .then(() => {
      const message = i18next.t(
        "blueprint_permissions_updated_successfully",
        "Blueprint permissions updated successfully.",
      );
      setSnackbar({
        open: true,
        severity: "success",
        message,
      });
    })
    .catch((error) => {
      const msg = i18next.t(
        "error_updating_blueprint_permissions",
        "Error occurred while updating blueprint permissions.",
      );
      setSnackbar({
        open: true,
        severity: "error",
        message: `${msg} ${error}!`,
      });
    });
};

const debouncedSendPutRequest = debounce(sendPutRequest, 200, {
  trailing: true,
});

export const _updatePolicyData = (
  blueprintName: string,
  policyData: PolicyData,
  setPolicyData: Dispatch<SetStateAction<PolicyData>>,
  field: string,
  value: any,
  setSnackbar: (snackbar: SnackbarProps) => void,
) => {
  setPolicyData((state) => ({ ...state, [field]: value }));
  let data: any = { ...policyData, [field]: value };
  let serverPolicyData: ServerPolicyData = createDefaultServerPolicyData();
  serverPolicyData = updatePerms(data, serverPolicyData);
  serverPolicyData = updateConfig(data, serverPolicyData);

  serverPolicyData = updateUiCustomization(data, serverPolicyData);
  debouncedSendPutRequest(blueprintName, serverPolicyData, setSnackbar);
};
