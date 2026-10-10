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

import classNames from "classnames";
import PropTypes from "prop-types";
// @mui/material components
import { makeStyles } from "@mui/styles";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
// @mui/icons-material
import Menu from "@mui/icons-material/Menu";
// core components
import Button from "components/CustomButtons/Button";

import styles from "assets/jss/material-dashboard-react/components/headerStyle";
import { Route } from "layouts/BaseLayout";

const useStyles = makeStyles(styles as any);

interface HeaderProps {
  // color: "primary" | "info" | "success" | "warning" | "danger";
  // rtlActive: boolean;
  handleDrawerToggle: () => void;
  routes: Route[];
}

export default function Header(props: HeaderProps) {
  const classes = useStyles();
  return (
    <AppBar className={classes.appBar}>
      <Toolbar className={classes.container}>
        <Box sx={{ display: { md: "none" } }}>
          <IconButton
            color="default"
            aria-label="open drawer"
            onClick={props.handleDrawerToggle}
            size="large"
          >
            <Menu />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = {
  color: PropTypes.oneOf(["primary", "info", "success", "warning", "danger"]),
  rtlActive: PropTypes.bool,
  handleDrawerToggle: PropTypes.func,
  routes: PropTypes.arrayOf(PropTypes.object),
};
