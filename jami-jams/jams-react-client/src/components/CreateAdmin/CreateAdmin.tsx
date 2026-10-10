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
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";

import axios, { AxiosResponse } from "axios";
import configApiCall from "../../api";
import { api_path_post_install_admin } from "../../globalUrls";

import auth from "../../auth";

import i18next from "i18next";
import { Theme } from "@mui/material";

const useStyles = makeStyles((theme: Theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
  },
  form: {
    width: "100%", // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

interface CreateAdminProps {
  setError: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

export default function CreateAdmin(props: CreateAdminProps) {
  const classes = useStyles();
  const navigate = useNavigate();

  /**
   * Formik Validation Fields
   */
  const formik = useFormik({
    initialValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
    validationSchema: Yup.object({
      username: Yup.string()
        .max(
          60,
          i18next.t(
            "must_be_60_characters_or_less",
            "Must be 60 characters or less",
          ),
        )
        .required(
          i18next.t("username_is_required", "Username is required!") as string,
        ),
      password: Yup.string()
        .max(
          50,
          i18next.t(
            "must_be_50_characters_or_less",
            "Must be 50 characters or less",
          ),
        )
        .required("Password is required"),
      confirmPassword: Yup.string()
        .oneOf(
          [Yup.ref("password"), undefined],
          i18next.t("password_must_match", "Passwords must match") as string,
        )
        .max(
          50,
          i18next.t(
            "must_be_50_characters_or_less",
            "Must be 50 characters or less",
          ),
        )
        .required(
          i18next.t(
            "password_confirmation_required",
            "Password confirmation is required.",
          ),
        ),
    }),

    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  interface AdminSubmitValues {
    username: string;
    password: string;
    confirmPassword: string;
  }

  interface ApiResponseData {
    access_token: string; // Assuming access_token is a string
  }

  function createAdminCallBackHandler(
    response: AxiosResponse<ApiResponseData>,
  ) {
    auth.setJWT(response.data["access_token"]);
    auth.admin = true;
    auth.authenticated = true;
    auth.uri = "start";
    navigate("/");
  }

  function handleSubmit(values: AdminSubmitValues) {
    //e.preventDefault();
    const jsonData = {
      username: values.username,
      password: values.password,
    };
    axios(configApiCall(api_path_post_install_admin, "PUT", jsonData, null))
      .then((response: AxiosResponse<ApiResponseData>) => {
        createAdminCallBackHandler(response);
      })
      .catch((error) => {
        props.setErrorMessage(error);
        props.setError(true);
      });
  }

  return (
    <form className={classes.form} noValidate onSubmit={formik.handleSubmit}>
      <Typography variant="h5" gutterBottom color="primary">
        {
          i18next.t(
            "create_administrator",
            "Create administrator account",
          ) as string
        }
      </Typography>
      <Grid container spacing={3}>
        <Grid size={12}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label={i18next.t("username", "Username") as string}
            autoComplete="email"
            autoFocus
            {...formik.getFieldProps("username")}
          />
          {formik.touched.username && formik.errors.username ? (
            <span>{formik.errors.username}</span>
          ) : null}
        </Grid>
        <Grid size={6}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            label={i18next.t("password", "Password") as string}
            type="password"
            id="password"
            autoComplete="current-password"
            {...formik.getFieldProps("password")}
          />
          {formik.touched.password && formik.errors.password ? (
            <span>{formik.errors.password}</span>
          ) : null}
        </Grid>

        <Grid size={6}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            label={i18next.t("confirm_password", "Confirm password") as string}
            type="password"
            id="confirmPassword"
            autoComplete="current-password"
            {...formik.getFieldProps("confirmPassword")}
          />
          {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
            <span>{formik.errors.confirmPassword}</span>
          ) : null}
        </Grid>
      </Grid>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        className={classes.submit}
      >
        {i18next.t("continue", "Continue") as string}
      </Button>
    </form>
  );
}
