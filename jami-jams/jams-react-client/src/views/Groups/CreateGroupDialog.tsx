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

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  InputAdornment,
  DialogActions,
  TextField,
  ClassNameMap,
} from "@mui/material";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import axios from "axios";
import i18next from "i18next";
import { debounce } from "lodash";

import configApiCall from "api";
import {
  api_path_blueprints,
  api_path_get_list_group,
  api_path_post_create_group,
} from "globalUrls";
import { getBlueprintsOptions } from "./getBlueprintsOptions";
import auth from "auth";
import * as tool from "../../tools";
import Button from "components/CustomButtons/Button";
import { Group } from "./Groups";

const getHelperText = (
  disableCreate: boolean,
  groupName: string,
  groupNameExits: boolean,
) => {
  if (disableCreate && groupName.length > 0 && groupNameExits) {
    return i18next.t(
      "group_name_already_exists",
      "Group name already exists!",
    ) as string;
  }
  if (disableCreate && groupName.length === 0) {
    return i18next.t("group_name_is_empty", "Group name is empty") as string;
  }

  return "";
};

export default function CreateGroupDialog({
  openCreate,
  setOpenCreate,
  classes,
}: {
  openCreate: boolean;
  setOpenCreate: (value: boolean) => void;
  classes: ClassNameMap<string>;
}) {
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState("");
  const [groupNameExits, setGroupNameExits] = useState(false);
  const [disableCreate, setDisableCreate] = useState(true);

  const [blueprints, setBlueprints] = useState([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState({
    value: 0,
    label: "No blueprint",
  });

  const helperText = getHelperText(disableCreate, groupName, groupNameExits);

  const handleCheckGroupNameExists = (searchGroupNameValue: string) => {
    setDisableCreate(true);
    axios(
      configApiCall(
        api_path_get_list_group + "?groupName=" + searchGroupNameValue,
        "GET",
        null,
        null,
      ),
    )
      .then((response) => {
        const allGroups = response.data;
        setDisableCreate(false);
        setGroupNameExits(false);
        allGroups.forEach((group: Group) => {
          if (searchGroupNameValue === group.name) {
            setDisableCreate(true);
            setGroupNameExits(true);
          }
        });
      })
      .catch(() => {
        setDisableCreate(false);
        setGroupNameExits(false);
      });
  };

  const initCheckGroupNameExists = useCallback(
    debounce(
      (searchGroupNameValue) =>
        handleCheckGroupNameExists(searchGroupNameValue),
      500,
    ),
    [],
  );

  const handleCloseCreate = () => {
    setOpenCreate(false);
  };

  const handleCreateGroup = () => {
    let blueprintName = "";
    if (selectedBlueprint.label !== "No blueprint")
      blueprintName = selectedBlueprint.label;

    axios(
      configApiCall(
        api_path_post_create_group,
        "POST",
        { name: groupName, blueprintName },
        null,
      ),
    )
      .then((response) => {
        console.log(groupName + " created successfully.");
        setOpenCreate(false);
        navigate(`/group/${response.data.id}`);
      })
      .catch((error) => {
        alert("An error occurred while creating group: " + error);
        setOpenCreate(false);
      });
  };

  const blueprintsOptionsItems = tool.buildSelectMenuItems(
    getBlueprintsOptions(blueprints),
  );

  const handleBlueprintsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedBlueprint(
      getBlueprintsOptions(blueprints)[parseInt(e.target.value)],
    );
  };

  const getBlueprints = () => {
    axios(configApiCall(api_path_blueprints + "?name=*", "GET", null, null))
      .then((response) => {
        setBlueprints(response.data);
        setSelectedBlueprint(getBlueprintsOptions(response.data)[0]);
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else if (error.response && error.response.status === 500) {
          setBlueprints([]);
        } else {
          console.error("Error getting blueprints: " + error);
        }
      });
  };

  useEffect(() => {
    getBlueprints();
  }, []);

  return (
    <Dialog
      open={openCreate}
      onClose={handleCloseCreate}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {i18next.t("create_group", "Create group") as string}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 12,
              md: 12,
            }}
          >
            <TextField
              autoFocus
              error={groupNameExits}
              id="groupName"
              label={i18next.t("group_name", "Group name") as string}
              helperText={helperText}
              type="text"
              fullWidth
              variant="standard"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PeopleOutlinedIcon />
                    </InputAdornment>
                  ),
                },
              }}
              onChange={(e) => {
                setGroupName(e.target.value);
                initCheckGroupNameExists(e.target.value);
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 12,
              md: 12,
            }}
          >
            <TextField
              select
              fullWidth
              label={
                i18next.t("select_blueprint", "Select a blueprint") as string
              }
              value={selectedBlueprint.value}
              onChange={handleBlueprintsChange}
              disabled={blueprints.length === 0}
            >
              {blueprintsOptionsItems}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseCreate} color="primary">
          Cancel
        </Button>
        <Button
          onClick={handleCreateGroup}
          color="info"
          disabled={disableCreate}
          autoFocus
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
