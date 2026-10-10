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
import Grid, { GridProps } from "@mui/material/Grid";
import { FC, ReactNode } from "react";

const styles = {
  grid: {
    // margin: "0 -15px !important",
    width: "unset",
  },
};

const useStyles = makeStyles(styles as any);

interface GridContainerProps extends GridProps {
  children: ReactNode;
}

const GridContainer: FC<GridContainerProps> = (props) => {
  const classes = useStyles();
  const { children, ...rest } = props;
  return (
    <Grid container {...rest} className={classes.grid}>
      {children}
    </Grid>
  );
};

export default GridContainer;
