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
import CustomInput from "components/CustomInput/CustomInput";
import Button from "components/CustomButtons/Button";
import IconButton from "@mui/material/IconButton";
import Card from "components/Card/Card";
import CardBody from "components/Card/CardBody";
import CardFooter from "components/Card/CardFooter";

import Search from "@mui/icons-material/Search";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

import axios from "axios";
import configApiCall from "api";
import auth from "auth";
import { api_path_blueprints } from "globalUrls";

import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";

import LinearProgress from "@mui/material/LinearProgress";

import headerLinksStyle from "assets/jss/material-dashboard-react/components/headerLinksStyle";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import i18next from "i18next";
import CreateBlueprintDialog from "./CreateBlueprintDialog";
import {
  GroupOutlined,
  InfoOutlined,
  PersonOutlined,
} from "@mui/icons-material";

export interface Blueprint {
  name: string;
  policyData: string;
}

const styles = {
  ...headerLinksStyle,
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
  blueprintsNotFound: {
    marginLeft: "10px",
    display: "flex",
    alignItems: "center",
  },
};

const useStyles = makeStyles(styles as any);

export default function Blueprints() {
  const classes = useStyles();
  const navigate = useNavigate();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [zeroBlueprint, setZeroBlueprint] = useState(false);
  const [searchValue, setSearchValue] = useState<string>("");

  const [open, setOpen] = useState(false);

  const [removedBlueprint, setRemovedBlueprint] = useState("");
  const [openRemoveDialog, setOpenRemoveDialog] = useState(false);

  useEffect(() => {
    axios(configApiCall(api_path_blueprints + "?name=*", "GET", null, null))
      .then((response) => {
        const allBluePrints = response.data;
        if (allBluePrints.length === 0) setZeroBlueprint(true);
        else setZeroBlueprint(false);
        setBlueprints(allBluePrints);
      })
      .catch((error) => {
        setBlueprints([]);
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/");
        } else {
          console.log("Error getting blueprints: " + error);
        }
      });
    return;
  }, [navigate, open, openRemoveDialog]);

  const handleRemoveBlueprint = (blueprintRemovedName: string) => {
    setRemovedBlueprint(blueprintRemovedName);
    setOpenRemoveDialog(true);
  };

  const removeBlueprint = () => {
    axios(
      configApiCall(
        api_path_blueprints + "?name=" + removedBlueprint,
        "DELETE",
        { queryString: removedBlueprint },
        null,
      ),
    )
      .then(() => {
        console.log(removedBlueprint + "created successfully.");
        setOpenRemoveDialog(false);
      })
      .catch((error) => {
        console.log(
          "An error occurred while attempting to create " +
            removedBlueprint +
            ": " +
            error,
        );
        setOpenRemoveDialog(false);
      });
    navigate("/blueprints");
  };

  return (
    <div>
      <CreateBlueprintDialog open={open} setOpen={setOpen} />
      <Dialog
        open={openRemoveDialog}
        onClose={() => setOpenRemoveDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {i18next.t("delete_blueprint", "Delete blueprint") as string}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {
              i18next.t(
                "do_you_want_to_delete_the_blueprint",
                "Do you want to delete the blueprint?",
              ) as string
            }
            <strong>&nbsp;{removedBlueprint}</strong> ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemoveDialog(false)} color="primary">
            {i18next.t("cancel", "Cancel") as string}
          </Button>
          <Button onClick={removeBlueprint} color="info" autoFocus>
            {i18next.t("remove", "Remove") as string}
          </Button>
        </DialogActions>
      </Dialog>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Button
            variant="contained"
            color="primary"
            href="#contained-buttons"
            onClick={() => setOpen(true)}
          >
            <AddCircleOutlinedIcon />{" "}
            {i18next.t("create_blueprint", "Create blueprint") as string}
          </Button>
          <div className={classes.searchWrapper}>
            {!zeroBlueprint && (
              <CustomInput
                formControlProps={{
                  className: classes.margin + " " + classes.search,
                }}
                inputProps={{
                  placeholder: i18next.t(
                    "search_blueprints",
                    "Search blueprints",
                  ),
                  inputProps: {
                    "aria-label": i18next.t(
                      "search_blueprints",
                      "Search blueprints",
                    ),
                  },
                  onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
                    setSearchValue((e.target as HTMLInputElement).value),
                }}
              />
            )}
            {!zeroBlueprint && <Search />}
          </div>
        </GridItem>
        {zeroBlueprint ? (
          <div className={classes.blueprintsNotFound}>
            <InfoOutlined />
            <p style={{ marginLeft: "10px" }}>
              {
                i18next.t(
                  "no_blueprints_found",
                  "No blueprints found",
                ) as string
              }
            </p>
          </div>
        ) : (
          blueprints
            .filter((blueprint: Blueprint) => {
              if (searchValue === "") {
                return blueprint;
              } else {
                return blueprint.name
                  .toLowerCase()
                  .includes(searchValue.toLowerCase());
              }
            })
            .map((blueprint: Blueprint) => (
              <GridItem
                xs={12}
                sm={6}
                md={3}
                lg={2}
                xl={2}
                key={blueprint.name}
              >
                <Card profile>
                  <Link to={`/blueprint/${blueprint.name}`}>
                    <CardBody profile>
                      <h3 className={classes.cardTitle}>
                        {blueprint.name
                          ? blueprint.name
                          : (i18next.t(
                              "no_blueprint_name",
                              "No blueprint name",
                            ) as string)}
                      </h3>
                      <ul style={{ fontSize: "12px" }}>
                        <li>
                          {JSON.parse(blueprint.policyData).rendezVous ===
                          true ? (
                            <React.Fragment>
                              <GroupOutlined style={{ marginRight: "10px" }} />
                              {i18next.t("rendezvous", "Rendezvous") as string}
                            </React.Fragment>
                          ) : (
                            <React.Fragment>
                              <PersonOutlined style={{ marginRight: "10px" }} />
                              {i18next.t("standalone", "Standalone") as string}
                            </React.Fragment>
                          )}
                        </li>
                      </ul>
                    </CardBody>
                  </Link>
                  <CardFooter>
                    <IconButton
                      color="primary"
                      onClick={() => {
                        handleRemoveBlueprint(blueprint.name);
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
