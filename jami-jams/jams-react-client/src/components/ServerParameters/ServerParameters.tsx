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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";
import { Formik } from "formik";

import CustomPopupState from "../CustomPopupState/CustomPopupState";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import * as tool from "../../tools";

import axios from "axios";
import configApiCall from "../../api";
import {
  api_path_post_install_server,
  backend_address,
} from "../../globalUrls";
import auth from "auth";
import * as Yup from "yup";

import i18next from "i18next";
import { Checkbox, FormControlLabel, Theme } from "@mui/material";

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

interface ServerParametersProps {
  setError: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

export default function ServerParameters({
  setError,
  setErrorMessage,
}: ServerParametersProps) {
  // Formik validation fields
  const initialValues = { domain: backend_address.origin, reverseProxy: false };
  const validationSchema = Yup.object().shape({
    domain: Yup.string().required(
      i18next.t("domain_is_required", "Domain is required.") as string,
    ),
  });

  type Settings = {
    domain: string;
    reverseProxy: boolean;
  };

  const certificateRevocationTypes = [
    { value: 300000, label: i18next.t("5_minutes", "5 minutes") as string },
    { value: 600000, label: i18next.t("10_minutes", "10 minutes") as string },
    { value: 900000, label: i18next.t("15_minutes", "15 minutes") as string },
    { value: 1800000, label: i18next.t("30_minutes", "30 minutes") as string },
    { value: 3600000, label: i18next.t("60_minutes", "60 minutes") as string },
  ];

  const deviceLifetimeTypes = [
    { value: 2629746000, label: i18next.t("1_month", "1 month") as string },
    { value: 7889238000, label: i18next.t("3_months", "3 months") as string },
    { value: 15778476000, label: i18next.t("6_months", "6 months") as string },
    { value: 31556952000, label: i18next.t("1_year", "1 year") as string },
  ];

  const userAccountLifetimeTypes = [
    { value: 31556952000, label: i18next.t("1_year", "1 year") as string },
    { value: 157784760000, label: i18next.t("5_years", "5 years") as string },
  ];

  const certificateRevocationTypesItems = tool.buildSelectMenuItems(
    certificateRevocationTypes,
  );
  const deviceLifetimeTypesItems =
    tool.buildSelectMenuItems(deviceLifetimeTypes);
  const userAccountLifetimeTypesItems = tool.buildSelectMenuItems(
    userAccountLifetimeTypes,
  );

  const classes = useStyles();
  const navigate = useNavigate();
  const [certificateRevocation, setCertificateRevocation] = useState(
    certificateRevocationTypes[0],
  );
  const [deviceLifetime, setDeviceLifetime] = useState(deviceLifetimeTypes[3]);
  const [userAccountLifetime, setUserAccountLifetime] = useState(
    userAccountLifetimeTypes[0],
  );
  const [userlifeDisabled, setUserlifeDisabled] = useState(false);

  useEffect(() => {
    if (deviceLifetime.value <= userAccountLifetime.value) {
      setUserlifeDisabled(false);
    } else {
      setUserlifeDisabled(true);
    }
  }, [deviceLifetime, userAccountLifetime]);

  function callBackServerParameters() {
    auth.installed = true;
    auth.authenticated = true;
    auth.admin = true;
    window.localStorage.setItem("scope", "true");
    auth.checkDirectoryType(() => {
      navigate("/users");
    });
  }

  function handleSubmit(values: Settings) {
    let jsonData = {};
    const re = new RegExp(
      /^http[s]?:\/\/[\w-]+(\.[\w-]+)*(:[0-9]+)?\/?(\/[.\w-]*)*$/,
    );
    const nohttpre = new RegExp(/^[\w-]+(\.[\w-]+)*(:[0-9]+)?\/?(\/[.\w-]*)*$/);

    if (values.domain.match(nohttpre))
      values.domain = window.location.protocol + "//" + values.domain;

    if (values.domain.match(re)) {
      jsonData = {
        serverDomain: values.domain,
        crlLifetime: certificateRevocation.value,
        deviceLifetime: deviceLifetime.value,
        userLifetime: userAccountLifetime.value,
        reverseProxy: values.reverseProxy,
        signingAlgorithm: "SHA512WITHRSA",
      };
      axios(configApiCall(api_path_post_install_server, "POST", jsonData, null))
        .then(() => {
          callBackServerParameters();
        })
        .catch((error) => {
          console.log("Error installing server parameters: " + error);
        });
    } else {
      setError(true);
      setErrorMessage(
        i18next.t(
          "please_enter_valid_cors_domain_url",
          "Please enter a valid CORS domain URL.",
        ),
      );
    }
  }

  const handleCertificateRevocationChange = (event: SelectChangeEvent) => {
    const selectedOption = tool.retrieveArrayElement(
      parseInt(event.target.value),
      certificateRevocationTypes,
    );
    if (selectedOption !== undefined) {
      setCertificateRevocation(selectedOption);
    }
  };

  const handleDeviceLifetimeChange = (event: SelectChangeEvent) => {
    const selectedOption = tool.retrieveArrayElement(
      parseInt(event.target.value),
      deviceLifetimeTypes,
    );
    if (selectedOption !== undefined) {
      setDeviceLifetime(selectedOption);
    }
  };

  const handleUserAccountLifetimeChange = (event: SelectChangeEvent) => {
    const selectedOption = tool.retrieveArrayElement(
      parseInt(event.target.value),
      userAccountLifetimeTypes,
    );
    if (selectedOption !== undefined) {
      setUserAccountLifetime(selectedOption);
    }
  };

  return (
    <Formik
      validationSchema={validationSchema}
      initialValues={initialValues}
      onSubmit={(values) => {
        handleSubmit(values);
      }}
    >
      {({
        values,
        touched,
        errors,
        handleSubmit,
        handleChange,
        handleBlur,
      }) => {
        return (
          <form className={classes.form} noValidate onSubmit={handleSubmit}>
            <Typography variant="h5" gutterBottom color="primary">
              {i18next.t("server_parameters", "Server Parameters") as string}
            </Typography>
            <Typography variant="body1" gutterBottom>
              {
                i18next.t(
                  "global_parameters_cover_general_configuration_of_servers_engine",
                  "The global parameters cover the general configuration of the server's engine.",
                ) as string
              }
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              {i18next.t("cors_domain_name", "CORS domain name") as string}
              <CustomPopupState
                message={i18next.t(
                  "set_domain_of_web_cleint_server_to_connect_to_hans_admin_dashboard_and_jami_accounts_also_to_set_client_crls_ocsps",
                  "Set the domain of the web client-server to connect to the JAMS admin dashboard and Jami accounts. It is also used to define where the clients should download CRLs and submit OCSP queries. In case you are running a proxied instance (i.e. JAMS behind IIS), please make sure to set this field correctly, otherwise devices will not be able to download CRLs or validate certificates.",
                )}
              />
            </Typography>
            <Typography variant="body1" gutterBottom>
              {
                i18next.t(
                  "domain_name_of_web_client_server",
                  "The domain name of your web client server.",
                ) as string
              }
            </Typography>
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              id="domain"
              label={i18next.t("domain", "Domain") as string}
              name="domain"
              autoComplete="domain"
              autoFocus
              value={values.domain}
              onChange={handleChange}
              onBlur={handleBlur}
              helperText={errors.domain && touched.domain && errors.domain}
            />
            <Typography variant="subtitle1" gutterBottom>
              {
                i18next.t(
                  "certificate_revocation_list_lifetime",
                  "Certificate Revocation List Lifetime",
                ) as string
              }
              <CustomPopupState
                message={i18next.t(
                  "set_liftetime_crl_list_certificates_revoked",
                  "Set the lifetime of the CRL which contains the list of the certificates that have been revoked before their scheduled expiration date.",
                )}
              />
            </Typography>
            <Select
              labelId="certificate-revocation-select-label"
              fullWidth
              value={certificateRevocation.value.toString()}
              onChange={handleCertificateRevocationChange}
              variant="outlined"
            >
              {certificateRevocationTypesItems}
            </Select>
            <Typography variant="subtitle1" gutterBottom>
              {i18next.t("device_lifetime", "Device lifetime") as string}
            </Typography>
            <Select
              labelId="device-lifetime-select-label"
              fullWidth
              value={deviceLifetime.value.toString()}
              onChange={handleDeviceLifetimeChange}
              variant="outlined"
            >
              {deviceLifetimeTypesItems}
            </Select>
            <Typography variant="subtitle1" gutterBottom>
              {
                i18next.t(
                  "user_account_lifetime",
                  "User account lifetime",
                ) as string
              }
            </Typography>
            <Select
              labelId="user-account-lifetime-select-label"
              fullWidth
              value={userAccountLifetime.value.toString()}
              onChange={handleUserAccountLifetimeChange}
              variant="outlined"
            >
              {userAccountLifetimeTypesItems}
            </Select>
            {userlifeDisabled ? (
              <span className="spanError">
                {
                  i18next.t(
                    "account_lifetime_should_be_bigger_to_device_lifetime",
                    "The account lifetime should be longer than the Device lifetime.",
                  ) as string
                }
              </span>
            ) : null}
            <Typography variant="subtitle1" gutterBottom>
              {i18next.t("reverse_proxy", "Reverse proxy") as string}
              <CustomPopupState
                message={i18next.t(
                  "set_whether_or_not_reverse_proxy",
                  "Set whether or not your JAMS installation uses a dedicated reverse proxy like Nginx.",
                )}
              />
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.reverseProxy}
                  id="reverseProxy"
                  onChange={handleChange}
                  slotProps={{ input: { "aria-label": "primary checkbox" } }}
                  color="primary"
                />
              }
              label={
                i18next.t("use_reverse_proxy", "Use a reverse proxy") as string
              }
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
            >
              {
                i18next.t(
                  "set_server_parameters",
                  "Set Server Parameters",
                ) as string
              }
            </Button>
          </form>
        );
      }}
    </Formik>
  );
}
