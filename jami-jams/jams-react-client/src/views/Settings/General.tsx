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

import { Dispatch, SetStateAction, useState } from "react";
import { Formik } from "formik";
import FormikField from "components/FormikField/FormikField";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";

import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import GridContainer from "components/Grid/GridContainer";
import Card from "components/Card/Card";
import CardHeader from "components/Card/CardHeader";
import CardBody from "components/Card/CardBody";

import axios from "axios";
import configApiCall from "../../api";
import { api_path_put_update_user } from "../../globalUrls";

import { CopyToClipboard } from "react-copy-to-clipboard";

import i18next from "i18next";

import LanguagePicker from "../../components/LanguagePicker/LanguagePicker";

import pjson from "../../../package.json";
import generator from "generate-password-browser";
import { Theme } from "@mui/material";
import {
  FileCopyOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
  VpnKeyOutlined,
} from "@mui/icons-material";

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
  button: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

interface GeneralProps {
  username: string;
  setError: Dispatch<SetStateAction<boolean>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setSeverity: Dispatch<SetStateAction<string>>;
}

export default function General(props: GeneralProps) {
  const classes = useStyles();

  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const changePassword = (values: { password: string }) => {
    const data = {
      username: props.username,
      password: values.password,
    };

    axios(configApiCall(api_path_put_update_user, "PUT", data, null))
      .then(() => {
        props.setSeverity("success");
        props.setErrorMessage(
          i18next.t(
            "admin_password_updated_successfully",
            "Administrator password updated successfully.",
          ),
        );
        props.setError(true);
      })
      .catch((error) => {
        props.setSeverity("error");
        props.setErrorMessage(
          (((i18next.t("updating_user", "Updating user ") as string) +
            props.username +
            i18next.t(
              "password_failed",
              " password failed with error: ",
            )) as string) + error,
        );
        props.setError(true);
      });
  };

  const passwordGenerator = () => {
    return generator.generate({
      length: 10,
      uppercase: false,
      numbers: true,
      symbols: true,
    });
  };

  /**
   * Formik Validation Fields
   */

  const passwordSchema = Yup.object().shape({
    password: Yup.string().required(
      i18next.t("password_is_required", "Password is required!") as string,
    ),
    confirmPassword: Yup.string()
      .oneOf(
        [Yup.ref("password")],
        i18next.t("password_must_match", "Passwords must match") as string,
      )
      .required(
        i18next.t("password_is_required", "Password is required!") as string,
      ),
  });

  const handleMouseDownPassword = () => {
    setPasswordVisible(true);
  };
  const handleMouseUpPassword = () => {
    setPasswordVisible(false);
  };

  return (
    <GridContainer>
      <Grid
        size={{
          xs: 12,
          sm: 12,
          md: 6,
        }}
      >
        <Card profile>
          <CardHeader color="info" stats icon></CardHeader>
          <CardBody profile>
            <Formik
              initialValues={{
                password: "",
                confirmPassword: "",
              }}
              validationSchema={passwordSchema}
              onSubmit={changePassword}
            >
              {({
                isValid,
                dirty,
                handleSubmit,
                values,
                setFieldValue,
                touched,
                errors,
              }) => (
                <form onSubmit={handleSubmit} className={classes.form}>
                  <Grid container spacing={2}>
                    <Grid
                      style={{ display: "flex" }}
                      size={{
                        lg: 6,
                      }}
                    >
                      <Typography component="p" gutterBottom color="primary">
                        {
                          i18next.t(
                            "change_language",
                            "Change language",
                          ) as string
                        }
                      </Typography>
                    </Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    >
                      <LanguagePicker navigationTarget={"/admin/settings"} />
                    </Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    >
                      <Typography component="p" gutterBottom color="primary">
                        {
                          i18next.t(
                            "enter_the_following_information_below_to_change_your_admin_password",
                            "Enter the following information to change your admin password.",
                          ) as string
                        }
                      </Typography>
                    </Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    >
                      <FormikField
                        name="password"
                        label={i18next.t("password", "Password") as string}
                        placeholder={
                          i18next.t("password", "Password") as string
                        }
                        type={passwordVisible ? "text" : "password"}
                        startAdornment={
                          <InputAdornment position="start">
                            <VpnKeyOutlined />
                          </InputAdornment>
                        }
                        endAdornment={
                          <IconButton
                            aria-label="toggle password visibility"
                            onMouseDown={handleMouseDownPassword}
                            onMouseUp={handleMouseUpPassword}
                            size="large"
                          >
                            {passwordVisible ? (
                              <VisibilityOutlined />
                            ) : (
                              <VisibilityOffOutlined />
                            )}
                          </IconButton>
                        }
                        handleChange={() => {}}
                        onKeyUpError={false}
                        onKeyUpErrorMessage=""
                      />

                      <FormikField
                        name="confirmPassword"
                        label={i18next.t(
                          "Confirm password",
                          "Confirm password",
                        )}
                        placeholder={i18next.t(
                          "Confirm password",
                          "Confirm password",
                        )}
                        type={passwordVisible ? "text" : "password"}
                        startAdornment={
                          <InputAdornment position="start">
                            <VpnKeyOutlined />
                          </InputAdornment>
                        }
                        endAdornment={
                          <IconButton
                            aria-label="toggle password visibility"
                            onMouseDown={handleMouseDownPassword}
                            onMouseUp={handleMouseUpPassword}
                            size="large"
                          >
                            {passwordVisible ? (
                              <VisibilityOutlined />
                            ) : (
                              <VisibilityOffOutlined />
                            )}
                          </IconButton>
                        }
                        handleChange={() => {}}
                        onKeyUpError={false}
                        onKeyUpErrorMessage=""
                      />

                      <Button
                        variant="contained"
                        size="large"
                        className={classes.button}
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                          const newGeneratedPassword = passwordGenerator();
                          setFieldValue(
                            "password",
                            newGeneratedPassword,
                            false,
                          );
                          setFieldValue(
                            "confirmPassword",
                            newGeneratedPassword,
                            false,
                          );
                          setCopied(false);
                          setGenerated(true);
                        }}
                      >
                        {i18next.t("generate", "Generate") as string}
                      </Button>
                      <CopyToClipboard
                        text={values.password}
                        onCopy={() => {
                          setCopied(true);
                          setGenerated(false);
                        }}
                      >
                        <Button
                          variant="contained"
                          size="large"
                          className={classes.button}
                          startIcon={<FileCopyOutlined />}
                        >
                          {
                            i18next.t(
                              "copy_to_clipboard",
                              "Copy to clipboard",
                            ) as string
                          }
                        </Button>
                      </CopyToClipboard>
                      {copied ? (
                        <span style={{ marginLeft: "10px" }}>
                          {i18next.t("copied", "Copied") as string}
                        </span>
                      ) : null}
                      {generated ? (
                        <span style={{ marginLeft: "10px" }}>
                          {i18next.t("generated", "Generated") as string}
                        </span>
                      ) : null}
                    </Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    ></Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    >
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={!isValid || !dirty}
                      >
                        {
                          i18next.t(
                            "change_admin_password",
                            "Change administrator password",
                          ) as string
                        }
                      </Button>
                    </Grid>
                    <Grid
                      size={{
                        lg: 6,
                      }}
                    >
                      Version {pjson.version.slice(0, 3)}
                    </Grid>
                  </Grid>
                </form>
              )}
            </Formik>
          </CardBody>
        </Card>
      </Grid>
    </GridContainer>
  );
}
