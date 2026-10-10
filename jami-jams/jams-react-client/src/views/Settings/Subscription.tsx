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

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";

import GridContainer from "components/Grid/GridContainer";
import Card from "components/Card/Card";
import CardHeader from "components/Card/CardHeader";
import CardBody from "components/Card/CardBody";

import axios from "axios";
import configApiCall from "../../api";
import { api_path_post_configuration_register_license } from "../../globalUrls";

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

interface SubscriptionProps {
  setError: Dispatch<SetStateAction<boolean>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setSeverity: Dispatch<SetStateAction<string>>;
}

export default function Subscription(props: SubscriptionProps) {
  const classes = useStyles();
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    axios(
      configApiCall(
        api_path_post_configuration_register_license,
        "GET",
        null,
        null,
      ),
    )
      .then((response) => {
        if (response.data["activated"] === true) setActivated(true);
      })
      .catch((error) => {
        if (error.response && error.response.status === 500) {
          props.setErrorMessage(
            i18next.t(
              "an_error_occurred_while_fetching_license_information",
              "An error occurred while fetching license information!",
            ),
          );
          props.setSeverity("error");
          props.setError(true);
        } else {
          console.error(
            "An error occurred while fetching license information: " + error,
          );
        }
      });
  });

  /**
   * Formik Validation Fields
   */
  const formik = useFormik({
    initialValues: {
      subscriptionCode: "",
    },
    validationSchema: Yup.object({
      subscriptionCode: Yup.string().required(
        i18next.t(
          "subscription_code_is_required",
          "Subscription code is required.",
        ),
      ),
    }),

    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  function handleSubmit(values: { subscriptionCode: string }) {
    const jsonData = {
      base64License: values.subscriptionCode,
    };

    axios(
      configApiCall(
        api_path_post_configuration_register_license,
        "POST",
        jsonData,
        null,
      ),
    )
      .then(() => {
        props.setErrorMessage(
          i18next.t(
            "license_registered_successfully",
            "License registered successfully.",
          ),
        );
        props.setSeverity("success");
        props.setError(true);
      })
      .catch((error) => {
        if (error.response && error.response.status === 500) {
          props.setErrorMessage(
            i18next.t(
              "an_error_occurred_while_loading_license",
              "An error occurred while loading license!",
            ),
          );
          props.setSeverity("error");
          props.setError(true);
        } else {
          console.error(
            "An error occurred while registering license: " + error,
          );
        }
      });
  }

  if (!activated) {
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
              <form
                className={classes.form}
                noValidate
                onSubmit={formik.handleSubmit}
              >
                <Grid container spacing={3}>
                  <Grid
                    size={{
                      lg: 6,
                    }}
                  >
                    <Typography component="p" gutterBottom color="primary">
                      {
                        i18next.t(
                          "paste_your_jams_enterprise_subscription_code_received_from_jami",
                          "Paste your JAMS Enterprise subscription code received from the Jami store.",
                        ) as string
                      }
                    </Typography>
                  </Grid>
                  <Grid
                    size={{
                      lg: 6,
                    }}
                  >
                    <TextField
                      variant="outlined"
                      margin="normal"
                      required
                      fullWidth
                      id="subscriptionCode"
                      label={
                        i18next.t(
                          "subscription_code",
                          "Subscription Code",
                        ) as string
                      }
                      autoComplete="subscriptionCode"
                      autoFocus
                      {...formik.getFieldProps("subscriptionCode")}
                    />
                    {formik.touched.subscriptionCode &&
                    formik.errors.subscriptionCode ? (
                      <span>{formik.errors.subscriptionCode}</span>
                    ) : null}
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      color="primary"
                      className={classes.submit}
                    >
                      {i18next.t("register", "Register") as string}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardBody>
          </Card>
        </Grid>
      </GridContainer>
    );
  } else {
    return (
      <div>
        <p>
          {
            i18next.t(
              "your_license_is_already_activated",
              "Your subscription is already activated!",
            ) as string
          }
        </p>
      </div>
    );
  }
}
