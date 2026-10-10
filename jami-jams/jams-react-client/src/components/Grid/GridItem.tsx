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
import * as React from "react";
import { makeStyles } from "@mui/styles";
import { Grid, GridProps } from "@mui/material";

const styles = {
  grid: {
    padding: "0 5px !important",
  },
};

const useStyles = makeStyles(styles as any);

interface GridItemProps extends GridProps {
  children: React.ReactNode;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

const GridItem: FC<GridItemProps> = ({
  children,
  xs,
  sm,
  md,
  lg,
  xl,
  ...rest
}) => {
  const classes = useStyles();
  // Translate legacy breakpoint props to the Grid v2 `size` prop
  const size: Record<string, number> = {};
  if (xs !== undefined) size.xs = xs;
  if (sm !== undefined) size.sm = sm;
  if (md !== undefined) size.md = md;
  if (lg !== undefined) size.lg = lg;
  if (xl !== undefined) size.xl = xl;
  return (
    <Grid
      {...(Object.keys(size).length > 0 ? { size } : {})}
      {...rest}
      className={classes.grid}
    >
      {children}
    </Grid>
  );
};

export default GridItem;
