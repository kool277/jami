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

import React, { ReactElement } from "react";
import PropTypes from "prop-types";
import { ErrorMessage, Field } from "formik";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Input from "@mui/material/Input";

interface FormikFieldProps {
  startAdornment?: ReactElement;
  endAdornment?: ReactElement;
  placeholder?: string;
  required?: boolean;
  name: string;
  label: string;
  type?: string;
  autoComplete?: "on" | "off";
  handleChange?: (value: string) => void;
  onKeyUpError?: boolean;
  onKeyUpErrorMessage?: string;
}

const FormikField = (props: FormikFieldProps) => {
  return (
    <div className="FormikField">
      <FormControl size="medium" error={props.onKeyUpError} fullWidth>
        <InputLabel htmlFor={props.name} style={{ marginTop: "10px" }}>
          {props.onKeyUpError ? (
            props.onKeyUpErrorMessage
          ) : (
            <ErrorMessage name={props.name} />
          )}
        </InputLabel>
        <Field
          placeholder={props.placeholder}
          required={props.required}
          name={props.name}
          as={Input}
          startAdornment={props.startAdornment}
          endAdornment={props.endAdornment}
          label={props.label}
          fullWidth
          type={props.type}
          autoComplete={props.autoComplete}
          onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) =>
            props.handleChange?.(e.currentTarget.value)
          }
        />
      </FormControl>
    </div>
  );
};

FormikField.propTypes = {
  startAdornment: PropTypes.element,
  endAdornment: PropTypes.element,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string,
  autoComplete: PropTypes.oneOf(["on", "off"]),
  handleChange: PropTypes.func,
  onKeyUpError: PropTypes.bool,
  onKeyUpErrorMessage: PropTypes.string,
};

export default FormikField;
