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

import { FC, createRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import classNames from "classnames";

// @mui/material components
import { makeStyles } from "@mui/styles";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Icon from "@mui/material/Icon";
import Snackbar from "@mui/material/Snackbar";

import ExitToAppOutlinedIcon from "@mui/icons-material/ExitToAppOutlined";
import UpdateIcon from "@mui/icons-material/Update";

import styles from "assets/jss/material-dashboard-react/components/sidebarStyle";

import auth from "auth";

import i18next from "i18next";
import { Route } from "layouts/BaseLayout";

const useStyles = makeStyles(styles as any);

interface SidebarProps {
  updating: boolean;
  snackbarMessage: string;
  rtlActive: boolean;
  handleQuery: () => void;
  setOpenUpdate: (open: boolean) => void;
  open: boolean;
  handleDrawerToggle: () => void;
  color: string;
  logo: string;
  image: string;
  routes: Route[];
}

const Sidebar: FC<SidebarProps> = (props) => {
  const classes = useStyles();
  const mainPanel = createRef();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleCloseProfile = () => {
    auth.logout(() => {
      navigate("/");
    });
  };

  useEffect(() => {
    if (auth.isUpdateAvailable() && auth.hasAdminScope()) setOpen(true);
  }, [mainPanel]);

  // verifies if routeName is the one active (in browser input)
  function activeRoute(routeName: string) {
    return window.location.href.indexOf(routeName) > -1 ? true : false;
  }
  const { color, logo, image, routes } = props;

  const brand = (
    <Link to={"/"}>
      <img src={logo} alt="logo" className={classes.img} />
    </Link>
  );

  const links = (
    <List className={classes.list}>
      <ListItem className={classes.itemLink}>{brand}</ListItem>
      <div className={classes.itemLinkSeparator}>
        <hr />
      </div>
      {routes.map((prop, key) => {
        if (prop.admin && !auth.hasAdminScope()) return null;
        if (!prop.admin && auth.hasAdminScope() && prop.path === "/user/admin")
          return null;

        const listItemClasses = classNames({
          [" " + classes[color]]: activeRoute(prop.layout + prop.path),
        });
        const whiteFontClasses = classNames({
          [" " + classes.whiteFont]: activeRoute(prop.layout + prop.path),
        });

        return (
          <div className={classes.wrapper} key={key}>
            {props.updating && (
              <Snackbar
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                open={open}
                message={props.snackbarMessage}
                key={"bottomright"}
              ></Snackbar>
            )}

            <Link to={`${prop.path}`}>
              <ListItemButton className={classes.itemLink + listItemClasses}>
                {typeof prop.icon === "string" ? (
                  <Icon
                    className={classNames(classes.itemIcon, whiteFontClasses, {
                      [classes.itemIconRTL]: props.rtlActive,
                    })}
                  >
                    {prop.icon}
                  </Icon>
                ) : (
                  <prop.icon
                    className={classNames(classes.itemIcon, whiteFontClasses, {
                      [classes.itemIconRTL]: props.rtlActive,
                    })}
                  />
                )}
                <ListItemText
                  primary={prop.name}
                  className={classNames(classes.itemText, whiteFontClasses, {
                    [classes.itemTextRTL]: props.rtlActive,
                  })}
                  disableTypography={true}
                />
              </ListItemButton>
            </Link>
          </div>
        );
      })}
    </List>
  );

  const bottomLinks = (
    <List className={classes.bottomlist}>
      {open && (
        <ListItemButton
          className={classes.itemLink}
          onClick={() => {
            props.handleQuery();
            props.setOpenUpdate(true);
          }}
        >
          <Icon
            className={classNames(classes.itemIcon, {
              [classes.itemIconRTL]: false,
            })}
          >
            <UpdateIcon />
          </Icon>
          <ListItemText
            primary="Update now"
            className={classNames(classes.itemText, {
              [classes.itemTextRTL]: false,
            })}
            disableTypography={true}
          />
        </ListItemButton>
      )}

      <ListItemButton className={classes.itemLink} onClick={handleCloseProfile}>
        <Icon
          className={classNames(classes.itemIcon, {
            [classes.itemIconRTL]: false,
          })}
        >
          <ExitToAppOutlinedIcon />
        </Icon>
        <ListItemText
          primary={i18next.t("Logout", "Logout") as string}
          className={classNames(classes.itemText, {
            [classes.itemTextRTL]: false,
          })}
          disableTypography={true}
        />
      </ListItemButton>
    </List>
  );

  return (
    <div>
      <Box sx={{ display: { md: "none" } }}>
        <Drawer
          variant="temporary"
          anchor={props.rtlActive ? "left" : "right"}
          open={props.open}
          classes={{
            paper: classNames(classes.drawerPaper, {
              [classes.drawerPaperRTL]: props.rtlActive,
            }),
          }}
          onClose={props.handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
        >
          <div className={classes.sidebarWrapper}>
            {links}
            {bottomLinks}
          </div>
          {image !== undefined ? (
            <div
              className={classes.background}
              style={{ backgroundImage: "url(" + image + ")" }}
            />
          ) : null}
        </Drawer>
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Drawer
          anchor={props.rtlActive ? "right" : "left"}
          variant="permanent"
          open
          classes={{
            paper: classNames(classes.drawerPaper, {
              [classes.drawerPaperRTL]: props.rtlActive,
            }),
          }}
        >
          <div className={classes.sidebarWrapper}>{links}</div>
          <div className={classes.sidebarWrapper}>{bottomLinks}</div>
          {image !== undefined ? (
            <div
              className={classes.background}
              style={{ backgroundImage: "url(" + image + ")" }}
            />
          ) : null}
        </Drawer>
      </Box>
    </div>
  );
};

export default Sidebar;
