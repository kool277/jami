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

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// @mui/material components
import { makeStyles } from "@mui/styles";
// core components
import GridItem from "components/Grid/GridItem";
import GridContainer from "components/Grid/GridContainer";
import Button from "components/CustomButtons/Button";
import Card from "components/Card/Card";
import CardBody from "components/Card/CardBody";
import CardFooter from "components/Card/CardFooter";
import CustomInput from "components/CustomInput/CustomInput";

import IconButton from "@mui/material/IconButton";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Search from "@mui/icons-material/Search";

import axios from "axios";
import configApiCall from "api";
import auth from "auth";
import {
  api_path_get_list_group,
  api_path_delete_group,
  api_path_get_group_members,
} from "globalUrls";

import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import i18next from "i18next";

import CreateGroupDialog from "./CreateGroupDialog";
import {
  AllInboxOutlined,
  InfoOutlined,
  PersonOutlined,
} from "@mui/icons-material";

const styles = {
  cardCategoryWhite: {
    color: "rgba(255,255,255,.62)",
    margin: "0",
    fontSize: "14px",
    marginTop: "0",
    marginBottom: "0",
  },
  cardTitleWhite: {
    color: "#FFFFFF",
    marginTop: "0px",
    minHeight: "auto",
    fontWeight: "300",
    fontFamily: "'Ubuntu'",
    marginBottom: "3px",
    textDecoration: "none",
  },
  cardTitle: {
    marginTop: "0px",
    height: "2em",
  },
  deleteIcon: {
    float: "right",
  },
  search: {
    width: "90%",
    maxWidth: "500px",
  },
  loading: {
    width: "100%",
  },
  groupsNotFound: {
    marginLeft: "10px",
    display: "flex",
    alignItems: "center",
  },
  inputBottomMargin: {
    marginBottom: "1rem",
  },
};

export interface Group {
  id: number;
  name: string;
  groupMembersLength: number;
  blueprint: string;
}

const useStyles = makeStyles(styles as any);

export default function Groups() {
  const classes = useStyles();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [zeroGroup, setZeroGroup] = useState(false);
  const [searchValue, setSearchValue] = useState<string>("");

  const [openCreate, setOpenCreate] = useState(false);

  const [removedGroup, setRemovedGroup] = useState({
    id: 0,
    name: "groupeName",
  });
  const [openRemoveDialog, setOpenRemoveDialog] = useState(false);

  const handleRemoveGroup = (group: Group) => {
    setRemovedGroup(group);
    setOpenRemoveDialog(true);
  };

  const removeGroup = () => {
    axios(
      configApiCall(
        api_path_delete_group + removedGroup.id,
        "DELETE",
        null,
        null,
      ),
    )
      .then(() => {
        console.log(removedGroup.name + "deleted successfully.");
        setOpenRemoveDialog(false);
      })
      .catch((error) => {
        console.log(
          "An error occurred while attempting to delete " +
            removedGroup.name +
            ": " +
            error,
        );
        setOpenRemoveDialog(false);
      });

    navigate("/groups");
  };

  useEffect(() => {
    axios(configApiCall(api_path_get_list_group, "GET", null, null))
      .then((response) => {
        const allGroups = response.data;

        allGroups.forEach((group: Group) => {
          axios(
            configApiCall(
              api_path_get_group_members + group.id,
              "GET",
              null,
              null,
            ),
          )
            .then((response) => {
              group["groupMembersLength"] = response.data.length;
            })
            .catch((error) => {
              if (error.response && error.response.status === 401) {
                auth.authenticated = false;
                navigate("/");
              } else {
                console.error(
                  "An error occurrd while fetching group members: " + error,
                );
              }
            });
        });
        setGroups(allGroups);
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else if (error.response && error.response.status === 404) {
          setZeroGroup(true);
        } else {
          console.error("An error occurred while fetching groups: " + error);
        }
      });
    return;
  }, [openCreate, openRemoveDialog, navigate]);

  if (!auth.hasAdminScope()) {
    return (
      <div>
        <h4>
          {
            i18next.t(
              "you_are_not_allowed_to_access_this_section",
              "You are not allowed to access this section. Please contact your system adminstrator.",
            ) as string
          }
        </h4>
      </div>
    );
  } else {
    return (
      <div>
        <CreateGroupDialog
          openCreate={openCreate}
          setOpenCreate={setOpenCreate}
          classes={classes}
        />
        <Dialog
          open={openRemoveDialog}
          onClose={() => setOpenRemoveDialog(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {i18next.t("remove_group", "Remove group") as string}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {
                i18next.t(
                  "do_you_want_to_delete_the_group",
                  "Do you want to delete the group?",
                ) as string
              }{" "}
              <strong>&nbsp;{removedGroup.name}</strong> ?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenRemoveDialog(false)} color="primary">
              {i18next.t("cancel", "Cancel") as string}
            </Button>
            <Button onClick={removeGroup} color="info" autoFocus>
              {i18next.t("remove", "Remove") as string}
            </Button>
          </DialogActions>
        </Dialog>
        <GridContainer>
          <GridItem xs={12} sm={12} md={12}>
            {
              <Button
                variant="contained"
                color="primary"
                href="#contained-buttons"
                onClick={() => setOpenCreate(true)}
              >
                <AddCircleOutlinedIcon />{" "}
                {i18next.t("create_group", "Create group") as string}
              </Button>
            }
            <div className={classes.searchWrapper}>
              {!zeroGroup && (
                <CustomInput
                  formControlProps={{
                    className: classes.margin + " " + classes.search,
                  }}
                  inputProps={{
                    placeholder: i18next.t("search_groups", "Search groups"),
                    inputProps: {
                      "aria-label": i18next.t(
                        "search_groups",
                        "Search groups",
                      ) as string,
                    },
                    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
                      setSearchValue((e.target as HTMLInputElement).value),
                  }}
                />
              )}
              {!zeroGroup && <Search />}
            </div>
          </GridItem>
          {zeroGroup ? (
            <div className={classes.groupsNotFound}>
              <InfoOutlined />{" "}
              <p style={{ marginLeft: "10px" }}>
                {i18next.t("no_groups_found", "No groups Found") as string}
              </p>
            </div>
          ) : (
            groups
              .filter((group: Group) => {
                if (searchValue === "") {
                  return group;
                } else {
                  return group.name
                    .toLowerCase()
                    .includes(searchValue.toLowerCase());
                }
              })
              .map((group: Group) => (
                <GridItem xs={12} sm={6} md={3} lg={2} xl={2} key={group.name}>
                  <Card profile>
                    <Link to={`/group/${group.id}`}>
                      <CardBody profile>
                        <h3 className={classes.cardTitle}>{group.name}</h3>
                        <ul style={{ fontSize: "12px" }}>
                          <li>
                            <PersonOutlined style={{ marginRight: "10px" }} />
                            <strong style={{ marginRight: "5px" }}>
                              {group.groupMembersLength}
                            </strong>
                            {i18next.t("users", "Users") as string}
                          </li>
                          <li>
                            <AllInboxOutlined style={{ marginRight: "10px" }} />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <strong style={{ marginRight: "5px" }}>
                                {i18next.t("blueprint", "Blueprint") as string}
                              </strong>
                              {group.blueprint}
                            </div>
                          </li>
                        </ul>
                      </CardBody>
                    </Link>
                    <CardFooter>
                      <IconButton
                        color="primary"
                        onClick={() => {
                          handleRemoveGroup(group);
                        }}
                        size="large"
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </CardFooter>
                  </Card>
                </GridItem>
              ))
          )}
        </GridContainer>
      </div>
    );
  }
}
