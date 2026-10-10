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

import { FC, ReactNode } from "react";
import classNames from "classnames";

import Button, { ButtonProps } from "@mui/material/Button";
import { makeStyles } from "@mui/styles";

import styles from "assets/jss/material-dashboard-react/components/buttonStyle";

const useStyles = makeStyles(styles as any);

interface RegularButtonProps extends ButtonProps {
  size?: "small" | "large";
  simple?: boolean;
  round?: boolean;
  disabled?: boolean;
  block?: boolean;
  link?: boolean;
  justIcon?: boolean;
  className?: string;
  children?: ReactNode;
}

const RegularButton: FC<RegularButtonProps> = (props) => {
  const classes = useStyles();
  const {
    color,
    round,
    children,
    disabled,
    simple,
    size,
    block,
    link,
    justIcon,
    className,
    ...rest
  } = props;
  const btnClasses = classNames({
    [classes.button]: true,
    ...(size ? { [classes[size]]: size } : {}),
    ...(color ? { [classes[color]]: color } : {}),
    [classes.round]: round,
    [classes.disabled]: disabled,
    [classes.simple]: simple,
    [classes.block]: block,
    [classes.link]: link,
    [classes.justIcon]: justIcon,
    ...(typeof className === "string" ? { [className]: className } : {}),
  });
  return (
    <Button {...rest} className={btnClasses}>
      {children}
    </Button>
  );
};

export default RegularButton;
