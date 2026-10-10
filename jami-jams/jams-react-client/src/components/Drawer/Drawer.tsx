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

import React, { Fragment, FC, useCallback } from "react";
import clsx from "clsx";
import { debounce } from "lodash";
import { makeStyles } from "@mui/styles";

import {
  Drawer,
  List,
  Divider,
  ListItemButton,
  ListItemText,
  Avatar,
  Theme,
} from "@mui/material";

import CustomInput from "components/CustomInput/CustomInput";
import noProfilePicture from "assets/img/faces/no-profile-picture.png";

const useStyles = makeStyles((theme: Theme) => ({
  list: {
    width: "100%",
    [theme.breakpoints.up("xl")]: {
      width: "400px",
    },
  },
  fullList: {
    width: "100%",
    [theme.breakpoints.up("xl")]: {
      width: "400px",
    },
  },
  search: {
    width: "100%",
  },
  margin: {
    marginLeft: "5px",
    marginRight: "5px",
  },
}));

interface TemporaryDrawerProps {
  openDrawer: boolean;
  setOpenDrawer: (open: boolean) => void;
  type: "user" | "group";
  targets: any[];
  existingTargets: any[];
  addElementToTarget: (target: any) => void;
  searchTargets: (searchValue: string) => void;
  direction: "top" | "bottom" | "left" | "right";
  placeholder: string;
}

const TemporaryDrawer: FC<TemporaryDrawerProps> = ({
  openDrawer,
  setOpenDrawer,
  type,
  targets,
  existingTargets,
  addElementToTarget,
  searchTargets,
  direction,
  placeholder,
}) => {
  const classes = useStyles();

  const listUsers = () => (
    <List>
      {type === "user"
        ? targets &&
          targets
            .filter(
              (target) =>
                !existingTargets.some((t) => target.username === t.username),
            )
            .map((target) => (
              <ListItemButton
                key={target.username}
                onClick={() => {
                  addElementToTarget(target);
                  setOpenDrawer(false);
                }}
              >
                <Avatar
                  style={{ marginRight: "10px" }}
                  alt={target.username}
                  src={
                    target.profilePicture
                      ? "data:image/png;base64, " + target.profilePicture
                      : noProfilePicture
                  }
                />
                <ListItemText
                  primary={
                    target.username === ""
                      ? target.id
                      : target.firstName === "" || target.lastName === ""
                        ? target.username
                        : target.firstName + " " + target.lastName
                  }
                />
              </ListItemButton>
            ))
        : targets &&
          targets
            .filter(
              (target) => !existingTargets.some((t) => target.name === t.name),
            )
            .map((target) => (
              <ListItemButton
                key={target.name}
                onClick={() => {
                  addElementToTarget(target);
                  setOpenDrawer(false);
                }}
              >
                <ListItemText primary={target.name} />
              </ListItemButton>
            ))}
    </List>
  );

  const initSearchTargets = useCallback(debounce(searchTargets, 500), []);

  const handleSearchTargets = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const searchValue = (e.target as HTMLInputElement).value;
    initSearchTargets(searchValue);
  };

  return (
    <div>
      <Fragment key={direction}>
        <Drawer
          anchor="right"
          open={openDrawer}
          onClose={() => {
            setOpenDrawer(false);
          }}
        >
          <div
            className={clsx(classes.list, {
              [classes.fullList]: direction === "top" || direction === "bottom",
            })}
            role="presentation"
          >
            <div>
              <CustomInput
                formControlProps={{
                  className: classes.search,
                }}
                inputProps={{
                  placeholder: placeholder,
                  inputProps: {
                    "aria-label": placeholder,
                  },
                  onKeyUp: handleSearchTargets,
                }}
                inputClass={classes.margin}
              />
            </div>
            <Divider />
            {listUsers()}
          </div>
        </Drawer>
      </Fragment>
    </div>
  );
};

export default TemporaryDrawer;
