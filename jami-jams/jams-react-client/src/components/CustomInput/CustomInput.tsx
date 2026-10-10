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

import React from "react";
import classNames from "classnames";
import PropTypes from "prop-types";
// @mui/material components
import { makeStyles } from "@mui/styles";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Input from "@mui/material/Input";
// @mui/icons-material
import Clear from "@mui/icons-material/Clear";
import Check from "@mui/icons-material/Check";
// core components
import styles from "assets/jss/material-dashboard-react/components/customInputStyle";

const useStyles = makeStyles(styles as any);

interface CustomInputProps {
  labelText?: React.ReactNode;
  labelProps?: object;
  id?: string;
  formControlProps?: {
    className?: string;
  };
  inputProps?: {
    placeholder?: string;
    inputProps?: {
      "aria-label": string;
    };
    onKeyUp?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  inputClass?: string;
  error?: boolean;
  success?: boolean;
}

export default function CustomInput(props: CustomInputProps) {
  const classes = useStyles();
  const {
    formControlProps,
    labelText,
    id,
    labelProps,
    inputProps,
    inputClass,
    error,
    success,
  } = props;

  const labelClasses = classNames({
    [" " + classes.labelRootError]: error,
    [" " + classes.labelRootSuccess]: success && !error,
  });
  const underlineClasses = classNames({
    [classes.underlineError]: error,
    [classes.underlineSuccess]: success && !error,
    [classes.underline]: true,
  });
  // Existing logic for applying classes based on labelText
  const marginTopClass = classNames({
    [classes.marginTop]: labelText === undefined,
  });

  const inputRootClass = classNames({
    [marginTopClass]: true,
    ...(inputClass ? { [inputClass]: true } : {}),
  });

  return (
    <FormControl
      {...formControlProps}
      className={formControlProps?.className + " " + classes.formControl}
    >
      {labelText !== undefined ? (
        <InputLabel
          className={classes.labelRoot + labelClasses}
          htmlFor={id}
          {...labelProps}
        >
          {labelText}
        </InputLabel>
      ) : null}
      <Input
        classes={{
          root: inputRootClass,
          disabled: classes.disabled,
          underline: underlineClasses,
        }}
        id={id}
        {...inputProps}
      />
      {error ? (
        <Clear className={classes.feedback + " " + classes.labelRootError} />
      ) : success ? (
        <Check className={classes.feedback + " " + classes.labelRootSuccess} />
      ) : null}
    </FormControl>
  );
}

CustomInput.propTypes = {
  labelText: PropTypes.node,
  labelProps: PropTypes.object,
  id: PropTypes.string,
  inputProps: PropTypes.object,
  formControlProps: PropTypes.object,
  error: PropTypes.bool,
  success: PropTypes.bool,
};
