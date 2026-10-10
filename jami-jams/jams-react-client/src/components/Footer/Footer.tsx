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

import { makeStyles } from "@mui/styles";
// core components
import styles from "assets/jss/material-dashboard-react/components/footerStyle";

import pjson from "../../../package.json";

const useStyles = makeStyles(styles as any);

export default function Footer() {
  const classes = useStyles();
  return (
    <footer className={classes.footer}>
      <div className={classes.container}>
        <p className={classes.right}>
          <span>
            JAMS Version {pjson.version.slice(0, 3)} - &copy;
            {new Date().getFullYear()}{" "}
            <a
              href="https://savoirfairelinux.com"
              target="_blank"
              rel="noopener noreferrer"
              className={classes.a}
            >
              Savoir-faire Linux Inc.
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}
