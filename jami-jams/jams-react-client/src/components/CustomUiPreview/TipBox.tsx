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

import tipLightBulbImage from "assets/img/tip_light_bulb.svg";
import { luma } from "./luma";

const styles = {
  root: {
    maxWidth: "115px",
    margin: "5px",
    flexBasis: "100%",
    backgroundColor: (props: { color: string; fontColor: string }) =>
      props.color,
    padding: "0px 5px 5px 5px",
    borderRadius: "3px",
  },
  img: {
    verticalAlign: "middle",
  },
  title: {
    verticalAlign: "middle",
    fontSize: "8px",
    marginLeft: "0.5rem",
    color: (props: { color: string; fontColor: string }) => props.fontColor,
  },
  text: {
    fontSize: "6px",
    margin: 0,
    color: (props: { color: string; fontColor: string }) => props.fontColor,
  },
};

const useStyles = makeStyles(styles as any);

interface TipBoxProps {
  color: string;
  text: string;
}

export const TipBox: FC<TipBoxProps> = ({ color, text }) => {
  const fontColor = luma(color) ? "#ffffff" : "#000000";

  const classes = useStyles({ color, fontColor });

  return (
    <div className={classes.root}>
      <img src={tipLightBulbImage} alt="light bulb" className={classes.img} />
      <span className={classes.title}>Tips</span>
      <p className={classes.text}>{text}</p>
    </div>
  );
};
