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

import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import i18next from "i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  InputAdornment,
  DialogActions,
  debounce,
  TextField,
} from "@mui/material";
import { AllInbox } from "@mui/icons-material";

import configApiCall from "api";
import { api_path_blueprints } from "globalUrls";

import Button from "components/CustomButtons/Button";
import {
  DEFAULT_UI_CUSTOMIZATION,
  ServerPolicyData,
} from "views/Blueprint/policyData.constants";

const getHelperText = (
  disableCreate: boolean,
  blueprintName: string,
  blueprintNameExists: boolean,
) => {
  if (disableCreate && blueprintName.length > 0 && blueprintNameExists) {
    return i18next.t(
      "blueprint_name_already_exists",
      "Blueprint name already exists!",
    );
  }
  if (disableCreate && blueprintName.length === 0) {
    return i18next.t(
      "blueprint_name_is_empty",
      "Blueprint name is empty",
    ) as string;
  }

  return "";
};

export default function CreateBlueprintDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();

  const [blueprintName, setBlueprintName] = useState("");
  const [blueprintNameExists, setBlueprintNameExists] = useState(false);
  const [disableCreate, setDisableCreate] = useState(true);

  const helperText = getHelperText(
    disableCreate,
    blueprintName,
    blueprintNameExists,
  );

  const handleClose = () => {
    setOpen(false);
  };

  const handleCheckBlueprintNameExists = (searchBlueprintNameValue: string) => {
    setDisableCreate(true);
    if (searchBlueprintNameValue.length === 0) {
      setDisableCreate(true);
      setBlueprintNameExists(false);
      return;
    }
    axios(
      configApiCall(
        api_path_blueprints + "?name=" + searchBlueprintNameValue,
        "GET",
        null,
        null,
      ),
    )
      .then(() => {
        setDisableCreate(true);
        setBlueprintNameExists(true);
      })
      .catch(() => {
        setDisableCreate(false);
        setBlueprintNameExists(false);
      });
  };

  const initCheckBlueprintNameExists = useCallback(
    debounce(
      (searchBlueprintNameValue) =>
        handleCheckBlueprintNameExists(searchBlueprintNameValue),
      500,
    ),
    [],
  );

  const handleCreateBlueprint = () => {
    const defaultPolicyData: ServerPolicyData = {
      videoEnabled: true,
      publicInCalls: false,
      allowCertFromContact: true,
      allowCertFromHistory: true,
      allowCertFromTrusted: true,
      autoAnswer: false,
      peerDiscovery: true,
      accountDiscovery: false,
      accountPublish: false,
      rendezVous: false,
      defaultModerators: "",
      upnpEnabled: true,
      allowLookup: true,
      uiCustomization: DEFAULT_UI_CUSTOMIZATION,
    };

    axios(
      configApiCall(
        api_path_blueprints + "?name=" + blueprintName,
        "POST",
        defaultPolicyData,
        null,
      ),
    )
      .then(() => {
        setOpen(false);
        setDisableCreate(true);
        console.log(blueprintName + "created successfully.");
      })
      .catch((error) => {
        setOpen(false);
        console.log(
          "An error occurred while attempting to create " +
            blueprintName +
            ": " +
            error,
        );
      });
    navigate(`/blueprint/${blueprintName}`);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {i18next.t("create_blueprint", "Create blueprint") as string}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          error={blueprintNameExists || disableCreate}
          margin="dense"
          id="blueprintName"
          label={i18next.t("blueprint_name", "Blueprint name") as string}
          helperText={helperText}
          type="text"
          variant="standard"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <AllInbox />
                </InputAdornment>
              ),
            },
          }}
          onChange={(e) => {
            setBlueprintName(e.target.value);
            initCheckBlueprintNameExists(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {i18next.t("cancel", "Cancel") as string}
        </Button>
        <Button
          onClick={handleCreateBlueprint}
          color="info"
          disabled={disableCreate}
        >
          {i18next.t("create_blueprint", "Create blueprint") as string}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
