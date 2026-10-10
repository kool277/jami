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

import { forwardRef, createRef, FC, ForwardedRef } from "react";

import MuiAlert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Slide, { SlideProps } from "@mui/material/Slide";
import { SnackbarProps } from "views/Blueprint/PolicyDataContext";

// https://stackoverflow.com/a/67961603
const Alert = forwardRef(function Alert(
  props: any,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const SlideTransition = forwardRef(function SlideTransition(
  props: SlideProps,
  ref,
) {
  return <Slide ref={ref} {...props} direction="left" />;
});

interface BlueprintSnackbarProps {
  snackbar: SnackbarProps;
  setSnackbar: (snackbar: SnackbarProps) => void;
}

export const BlueprintSnackbar: FC<BlueprintSnackbarProps> = ({
  snackbar,
  setSnackbar,
}) => {
  const snackbarRef = createRef();

  const handleClose = () => {
    const newState = { ...snackbar, open: false };
    setSnackbar(newState);
  };

  return (
    <Snackbar
      ref={snackbarRef}
      slots={{ transition: SlideTransition }}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      open={snackbar.open}
      autoHideDuration={5000}
      onClose={handleClose}
      message={snackbar.message}
      key={"bottomright"}
    >
      <Alert onClose={handleClose} severity={snackbar.severity}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
};
