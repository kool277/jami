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

import { FC } from "react";

import { makeStyles } from "@mui/styles";

import jamiIdImage from "assets/img/jami_id.svg";
import copySvg from "assets/img/BTN_Copy.svg";
import shareSvg from "assets/img/BTN_Share.svg";
import { luma } from "./luma";

const styles = {
  root: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: "20px",
    borderRadius: "5px",
  },
  main: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    width: "100px",
    height: "100%",
    borderRadius: "5px 0px 0px 5px",
    backgroundColor: (props: JamiIdCardProps) => props.color,
  },
  logo: {
    marginLeft: "5px",
    height: "12px",
  },
  nameplate: {
    flex: 2,
    textAlign: "center",
    fontSize: "12px",
    color: (props: JamiIdCardProps) =>
      luma(props.color) ? "#03B9E9" : "#005699",
  },
  icons: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "6px",
    padding: "0px 6px 0px 6px",
    height: "100%",
    marginLeft: "1px",
    borderRadius: "0px 5px 5px 0px",
    backgroundColor: (props: JamiIdCardProps) => props.color,
  },
  icon: {
    width: "6px",
    height: "6px",
  },
};

const useStyles = makeStyles(styles as any);

interface JamiIdCardProps {
  color: string;
  isCompactDisplay: boolean;
}

export const JamiIdCard: FC<JamiIdCardProps> = ({
  color,
  isCompactDisplay,
}) => {
  const classes = useStyles({ color, isCompactDisplay });

  return (
    <div className={classes.root}>
      <div className={classes.main}>
        <img className={classes.logo} src={jamiIdImage} alt="jami id" />
        <div className={classes.nameplate}>placeholder</div>
      </div>
      <div className={classes.icons}>
        <img src={copySvg} alt="copy" className={classes.icon} />
        <img src={shareSvg} alt="share" className={classes.icon} />
      </div>
    </div>
  );
};
