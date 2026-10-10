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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Formik } from "formik";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";
import Container from "@mui/material/Container";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import auth from "../auth";

import LanguagePicker from "../components/LanguagePicker/LanguagePicker";

import i18next from "i18next";

import logo from "assets/img/jams_logo_no_gnu_package.svg";
import * as Yup from "yup";
import { Theme } from "@mui/material";
function Alert(props: AlertProps) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

function Copyright() {
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {"Copyright © "}
      {new Date().getFullYear() + " "}
      <Link href="https://savoirfairelinux.com">
        Savoir-faire Linux Inc.
      </Link>{" "}
      {"."}
    </Typography>
  );
}

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

export default function SignIn() {
  /**
   * Formik Validation Fields
   */

  interface SignInFormValues {
    username: string;
    password: string;
  }
  const initialValues: SignInFormValues = { username: "", password: "" };

  const validationSchema = Yup.object().shape({
    username: Yup.string().required("Username is required."),
    password: Yup.mixed().required("Password is required."),
  });

  const classes = useStyles();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (auth.isAuthenticated() && auth.isInstalled()) {
      if (auth.hasAdminScope()) navigate("/users");
      else {
        if (auth.getUsername() !== null) {
          navigate(`/user/${auth.getUsername()}`);
        }
      }
    }
  });

  function handleSubmit(values: SignInFormValues) {
    const jsonData = {
      username: values.username,
      password: values.password,
    };
    auth.login(jsonData, () => {
      if (auth.authenticated) {
        auth.checkLastKnownStep(() => {
          auth.checkDirectoryType(() => {
            if (auth.isServerInstalled()) {
              if (auth.hasAdminScope()) navigate("/users");
              else {
                if (auth.getUsername() !== null) {
                  navigate(`/user/${auth.getUsername()}`);
                }
              }
            } else {
              navigate("/");
            }
          });
        });
      } else {
        setError(true);
        setErrorMessage(
          i18next.t(
            "login_failed",
            "Login failed. Check your credentials.",
          ) as string,
        );
      }
    });
  }

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <div className={classes.paper}>
        <img
          src={logo}
          style={{ maxWidth: "25em", paddingBottom: "20px" }}
          alt="logo"
        />
        <Typography component="h1" variant="h5">
          {i18next.t("sign_in", "Sign In") as string}
        </Typography>
        {error && <Alert severity="error">{errorMessage}</Alert>}
        <Formik
          validationSchema={validationSchema}
          initialValues={initialValues}
          onSubmit={(values) => {
            handleSubmit(values);
          }}
        >
          {(props) => {
            const {
              values,
              touched,
              errors,
              handleSubmit,
              handleChange,
              handleBlur,
            } = props;
            return (
              <form className={classes.form} noValidate onSubmit={handleSubmit}>
                <TextField
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  id="username"
                  label={i18next.t("username", "Username") as string}
                  name="username"
                  autoComplete="username"
                  autoFocus
                  value={values.username}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  helperText={
                    errors.username && touched.username && errors.username
                  }
                />
                <TextField
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label={i18next.t("password", "Password") as string}
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  helperText={
                    errors.password && touched.password && errors.password
                  }
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submit}
                >
                  {i18next.t("sign_in", "Sign In") as string}
                </Button>
              </form>
            );
          }}
        </Formik>
      </div>
      <Box sx={{ mt: 8 }}>
        <Copyright />
      </Box>
      <Box sx={{ mt: 8, justifyContent: "center" }}>
        <LanguagePicker navigationTarget={"/"} />
      </Box>
    </Container>
  );
}
