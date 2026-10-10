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

import { FC, ReactElement, createRef, useEffect, useState } from "react";
// creates a beautiful scrollbar
import PerfectScrollbar from "perfect-scrollbar";
import "perfect-scrollbar/css/perfect-scrollbar.css";
// @mui/material components
import { makeStyles } from "@mui/styles";
// core components
import Navbar from "components/Navbars/Navbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";

// @mui/icons-material
import {
  AccountCircleOutlined,
  AllInboxOutlined,
  GroupOutlined,
  PersonOutlineOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
// core components/views for Admin layout
import Users from "views/Users/Users";
import Groups from "views/Groups/Groups";
import Blueprints from "views/Blueprints/Blueprints";
import Settings from "views/Settings/Settings";
// core components/views for RTL layout

import styles from "assets/jss/material-dashboard-react/layouts/adminStyle";

import bgImage from "assets/img/sidebar-2.jpg";
import logo from "assets/img/jams_logo_white_no_gnu_package.svg";

import auth from "auth";
import configApiCall from "api";
import { api_path_get_start_update } from "globalUrls";

import axios from "axios";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import Button from "@mui/material/Button";

import i18next from "i18next";

let ps: PerfectScrollbar;

const useStyles = makeStyles(styles as any);

export interface Route {
  path: string;
  name: string;
  icon: FC<any>;
  component: FC<any>;
  layout: string;
  admin?: boolean;
}

interface AdminProps {
  component: ReactElement;
}

export default function Admin(props: AdminProps) {
  // styles
  const classes = useStyles();
  // ref to help us initialize PerfectScrollbar on windows devices
  const mainPanel = createRef<HTMLDivElement>();
  // states and functions
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [openUpdate, setOpenUpdate] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [messageYes, setMessageYes] = useState("");
  const [messageNo, setMessageNo] = useState("");
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const Routes: Route[] = [
    {
      path: `/user/${auth.getUsername()}`,
      name: i18next.t("myprofile", "My profile") as string,
      icon: AccountCircleOutlined,
      component: Users,
      layout: "/admin",
    },
    {
      path: "/users",
      name: i18next.t("users", "Users") as string,
      icon: PersonOutlineOutlined,
      component: Users,
      layout: "/admin",
    },
    {
      path: "/groups",
      name: i18next.t("groups", "Groups") as string,
      icon: GroupOutlined,
      component: Groups,
      layout: "/admin",
      admin: true,
    },
    {
      path: "/blueprints",
      name: i18next.t("blueprints", "Blueprints") as string,
      icon: AllInboxOutlined,
      component: Blueprints,
      layout: "/admin",
      admin: true,
    },
    {
      path: "/settings",
      name: i18next.t("settings", "Settings") as string,
      icon: SettingsOutlined,
      component: Settings,
      layout: "/admin",
      admin: true,
    },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  const resizeFunction = () => {
    if (window.innerWidth >= 960) {
      setMobileOpen(false);
    }
  };

  const handleQuery = () => {
    setQuery(true);
    if (auth.hasAdminScope()) {
      if (auth.isActivated()) {
        setDialogMessage(
          i18next.t(
            "new_version_jams_available",
            "A new version of JAMS is available. Do you want to update now?",
          ),
        );
        setMessageYes("Update Now");
        setMessageNo("Update Later");
      } else {
        setDialogMessage(
          i18next.t(
            "running_community_edition_jams",
            "JAMS Community Edition is running. Do you want to buy a JAMS subscription?",
          ),
        );
        setMessageYes("Yes, go to Jami Store");
        setMessageNo("No thanks");
      }
    } else {
      setDialogMessage(
        i18next.t(
          "you_are_not_allowed_to_access_this_section",
          "You are not allowed to access this section. Please contact your administrator to get administrator privileges.",
        ),
      );
    }
  };

  // initialize and destroy the PerfectScrollbar plugin
  useEffect(() => {
    auth.checkForUpdates(() => {
      auth.getUpdates(() => {
        if (auth.isUpdateAvailable()) {
          setOpen(true);
          setMessage(
            i18next.t(
              "an_update_is_available_for_jams",
              "An update is available for JAMS.",
            ),
          );
        }
      });
    });

    if (navigator.platform.indexOf("Win") > -1) {
      if (mainPanel.current !== null) {
        ps = new PerfectScrollbar(mainPanel.current, {
          suppressScrollX: true,
          suppressScrollY: false,
        });
      }
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("resize", resizeFunction);
    // Specify how to clean up after this effect:
    return function cleanup() {
      if (navigator.platform.indexOf("Win") > -1) {
        ps.destroy();
      }
      window.removeEventListener("resize", resizeFunction);
    };
  }, [openUpdate, mainPanel]);

  const handleCancel = () => {
    setOpenUpdate(false);
  };

  const handleUpdate = () => {
    setQuery(false);
    if (auth.isActivated()) {
      setSnackbarMessage(
        i18next.t(
          "shutting_down_after_jams_update_is_finished",
          "Shutting down after JAMS update is finished…",
        ),
      );
      axios(configApiCall(api_path_get_start_update, "POST", null, null))
        .then(() => {
          handleCancel();
          setUpdating(true);
        })
        .catch((error) => {
          setSnackbarMessage(
            i18next.t(
              "error_while_attempting_update_jams",
              "An error occurred while attempting to update JAMS:",
            ) + error,
          );
        });
    }
  };

  return (
    <div className={classes.wrapper}>
      <Dialog
        open={openUpdate}
        onClose={handleCancel}
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-revoke-dialog-title">Jams Update</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {dialogMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (auth.isActivated()) handleUpdate();
              else window.location.href = "https://jami.biz/";
            }}
            color="primary"
          >
            {messageYes}
          </Button>
          <Button onClick={handleCancel} color="primary">
            {messageNo}
          </Button>
        </DialogActions>
      </Dialog>
      <Sidebar
        routes={Routes}
        logo={logo}
        image={bgImage}
        handleDrawerToggle={handleDrawerToggle}
        open={mobileOpen}
        color="blue"
        handleQuery={handleQuery}
        updating={updating}
        snackbarMessage={snackbarMessage}
        setOpenUpdate={setOpenUpdate}
        rtlActive={false}
      />

      <div className={classes.mainPanel} ref={mainPanel}>
        <Navbar routes={Routes} handleDrawerToggle={handleDrawerToggle} />
        <div className={classes.map}>{props.component}</div>
        <Footer />
      </div>
    </div>
  );
}
