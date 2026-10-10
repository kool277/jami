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

import React, { ChangeEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, FormikErrors, FormikTouched } from "formik";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { makeStyles } from "@mui/styles";
import Select, { SelectChangeEvent } from "@mui/material/Select";

import { buildSelectMenuItems } from "../../tools";

import axios from "axios";
import configApiCall from "../../api";
import { api_path_post_install_auth } from "../../globalUrls";

import LocalStorageForm from "./LocalStorageForm";
import LdapForm from "./LdapStorageForm";
import AdStorageForm from "./AdStorageForm";

import auth from "../../auth";
import * as Yup from "yup";

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

interface IdentityManagementProps {
  setError: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

export interface LDAPFormValues {
  servername: string;
  ldapadminusername: string;
  ldappassword: string;
  basedn: string;
}

export interface ADFormValues {
  port: string;
  host: string;
  adadminusername: string;
  adpassword: string;
  domainname: string;
}

export default function IdentityManagement(props: IdentityManagementProps) {
  /**
   * Formik Validation Fields
   */

  const initialValuesLDAPform: LDAPFormValues = {
    servername: "",
    ldapadminusername: "",
    ldappassword: "",
    basedn: "",
  };

  const initialValuesADform: ADFormValues = {
    port: "",
    host: "",
    adadminusername: "",
    adpassword: "",
    domainname: "",
  };

  const validationSchemaLDAPform = Yup.object().shape({
    servername: Yup.string().required(
      i18next.t("servername_is_required", "Server name is required.") as string,
    ),
    ldapadminusername: Yup.string().required(
      i18next.t("username_is_required", "Username is required!") as string,
    ),
    ldappassword: Yup.string().required(
      i18next.t("password_is_required", "Password is required!") as string,
    ),
    basedn: Yup.string().required(
      i18next.t(
        "domain_name_is_required",
        "Domain name is required.",
      ) as string,
    ),
  });

  const validationSchemaADform = Yup.object().shape({
    port: Yup.number()
      .typeError(
        i18next.t("port_must_be_a_number", "Port must be a number.") as string,
      )
      .positive(
        i18next.t("port_must_be_positive", "Port must be positive.") as string,
      )
      .integer(
        i18next.t(
          "port_must_be_an_integer",
          "Port must be an integer.",
        ) as string,
      )
      .required(
        i18next.t(
          "port_number_is_required",
          "Port number is required.",
        ) as string,
      ),
    host: Yup.string().required(
      i18next.t("host_is_required", "Host is required.") as string,
    ),
    adadminusername: Yup.string().required(
      i18next.t("username_is_required", "Username is required!") as string,
    ),
    domainname: Yup.string().required(
      i18next.t(
        "domain_name_is_required",
        "Domain name is required.",
      ) as string,
    ),
    adpassword: Yup.string().required(
      i18next.t("password_is_required", "Password is required!") as string,
    ),
  });

  const directoryTypes = [
    {
      value: 0,
      label: i18next.t("local_database", "Local Database") as string,
    },
    { value: 1, label: i18next.t("ldap_server", "LDAP Server") as string },
    {
      value: 2,
      label: i18next.t("active_directory", "Active Directory") as string,
    },
  ];

  const directoryTypesItems = buildSelectMenuItems(directoryTypes);

  const classes = useStyles();
  const navigate = useNavigate();
  const [directory, setDirectory] = useState(directoryTypes[0]);

  /**
   * Local storage Config
   */

  const [nameServerChecked, setNameServerChecked] = useState(false);

  /**
   * LDAP storage Config
   *
   */
  const ldapFiltersTypes = [{ value: 0, label: "UID" }];

  const ldapFiltersTypesItems = buildSelectMenuItems(ldapFiltersTypes);
  const [useStartTLS, setUseStartTLS] = useState("false");
  const [ldapFilter, setLdapFilter] = useState(ldapFiltersTypes[0]);

  const handleFilterIdChange = (event: SelectChangeEvent) => {
    setLdapFilter(ldapFiltersTypes[parseInt(event.target.value)]);
  };
  const handleUseStartTLSChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUseStartTLS(event.target.value);
  };

  const handleNameServerChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNameServerChecked(event.target.checked);
  };

  /**
   * Active Directory Storage Config
   */

  const [isSSL, setIsSSL] = useState("false");

  const handleIsSSLChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIsSSL(event.target.value);
  };

  interface AuthenticationSource {
    type: string;
    localAuthSettings: {
      publicNameServer: string;
      publicNames: boolean;
    };
    ldapSettings: {};
    activeDirectorySettings: {};
  }

  interface localSettings {
    publicNameServer: string;
    publicNames: boolean;
  }

  interface BaseSettings {
    host: string;
    username: string;
    password: string;
    // This will be overridden in the derived interfaces
    fieldMappings: BaseFieldMappings | ADFieldMappings;
  }

  interface LDAPSettings extends BaseSettings {
    useStartTLS?: boolean;
    baseDN?: string;
    usernameField?: string;
    fieldMappings: BaseFieldMappings;
  }

  interface ADSettings extends BaseSettings {
    isSSL?: boolean;
    port?: number;
    realm?: string;
    fieldMappings: ADFieldMappings;
  }

  type BaseFieldMappings = {
    givenName: string;
    sn: string;
    jpegPhoto: string;
    mail: string;
    telephoneNumber: string;
    mobile: string;
    facsimileTelephoneNumber: string;
    extensionName: string;
    o: string;
    uid: string;
  };

  interface ADFieldMappings extends BaseFieldMappings {
    sAMAccountName: string;
  }

  /**
   * Form handle submit and server call
   */

  function setLocalStorageData() {
    const authSource: AuthenticationSource = {
      type: "",
      localAuthSettings: {
        publicNameServer: "",
        publicNames: false,
      },
      ldapSettings: {},
      activeDirectorySettings: {},
    };
    const settings: localSettings = {
      publicNameServer: "https://ns.jami.net",
      publicNames: nameServerChecked,
    };

    authSource["type"] = "LOCAL";
    authSource["localAuthSettings"] = settings;
    return authSource;
  }

  function setLdapStorageData(values: LDAPFormValues) {
    const settings: LDAPSettings = {
      useStartTLS: useStartTLS === "true",
      host: values.servername,
      username: values.ldapadminusername,
      password: values.ldappassword,
      baseDN: values.basedn,
      usernameField: ldapFilter.label,
      fieldMappings: {
        givenName: "FirstName",
        sn: "LastName",
        jpegPhoto: "ProfilePicture",
        mail: "Email",
        telephoneNumber: "PhoneNumber",
        mobile: "MobileNumber",
        facsimileTelephoneNumber: "FaxNumber",
        extensionName: "PhoneNumberExtension",
        o: "Organization",
        uid: "Username",
      },
    };

    const authSource: AuthenticationSource = {
      type: "LDAP",
      localAuthSettings: {
        publicNameServer: "",
        publicNames: false,
      },
      ldapSettings: settings,
      activeDirectorySettings: {},
    };

    authSource["type"] = "LDAP";
    authSource["ldapSettings"] = settings;
    return authSource;
  }

  function setAdStorageData(values: ADFormValues) {
    const settings: ADSettings = {
      isSSL: isSSL === "true",
      host: values.host,
      port: parseInt(values.port, 10),
      realm: values.domainname,
      username: values.adadminusername,
      password: values.adpassword,
      fieldMappings: {
        sAMAccountName: "Username",
        givenName: "FirstName",
        sn: "LastName",
        jpegPhoto: "ProfilePicture",
        mail: "Email",
        telephoneNumber: "PhoneNumber",
        mobile: "MobileNumber",
        facsimileTelephoneNumber: "FaxNumber",
        extensionName: "PhoneNumberExtension",
        o: "Organization",
        uid: "Username",
      },
    };

    const authSource: AuthenticationSource = {
      type: "AD",
      localAuthSettings: {
        publicNameServer: "",
        publicNames: false,
      },
      ldapSettings: {},
      activeDirectorySettings: settings,
    };

    return authSource;
  }

  function callbackIdentityManagement() {
    auth.uri = "/api/install/settings";
    navigate("/");
  }

  function handleSubmit(values: LDAPFormValues | ADFormValues) {
    let data = {};
    if (directory.value === 1) {
      values = values as LDAPFormValues;
      data = setLdapStorageData(values);
    } else {
      values = values as ADFormValues;
      data = setAdStorageData(values);
    }
    axios(configApiCall(api_path_post_install_auth, "POST", data, null))
      .then(() => {
        callbackIdentityManagement();
      })
      .catch(() => {
        props.setErrorMessage(
          i18next.t(
            "information_appears_incorrect_connection_directory_failed",
            "The information provided appears to be incorrect, the connection to the directory has failed. Please check the information and credentials provided and try again.",
          ),
        );
        props.setError(true);
      });
  }

  function handleLocalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let data = {};
    data = setLocalStorageData();
    axios(configApiCall(api_path_post_install_auth, "POST", data, null))
      .then(() => {
        callbackIdentityManagement();
      })
      .catch(() => {
        props.setErrorMessage(
          i18next.t(
            "information_appears_incorrect_connection_directory_failed",
            "The information provided appears to be incorrect, the connection to the directory has failed. Please check the information and credentials provided and try again.",
          ),
        );
        props.setError(true);
      });
  }

  const handleChangeDirectoryType = (event: SelectChangeEvent<number>) => {
    const valueAsNumber = Number(event.target.value);
    const selectedDirectoryType = directoryTypes.find(
      (directoryType) => directoryType.value === valueAsNumber,
    );
    if (selectedDirectoryType) {
      setDirectory(selectedDirectoryType);
    }
  };

  function returnForm(
    values: LDAPFormValues | ADFormValues,
    touched: FormikTouched<LDAPFormValues | ADFormValues>,
    errors: FormikErrors<LDAPFormValues | ADFormValues>,
    handleChange: (e: React.ChangeEvent<any>) => void,
    handleBlur: (e: React.FocusEvent<any>) => void,
  ) {
    if (directory.value === 1) {
      values = values as LDAPFormValues;
      touched = touched as FormikTouched<LDAPFormValues>;
      errors = errors as FormikErrors<LDAPFormValues>;
      return (
        <LdapForm
          useStartTLS={useStartTLS}
          handleUseStartTLSChange={handleUseStartTLSChange}
          ldapFilter={ldapFilter}
          ldapFiltersTypesItems={ldapFiltersTypesItems}
          handleFilterIdChange={handleFilterIdChange}
          values={values}
          touched={touched}
          errors={errors}
          handleChange={handleChange}
          handleBlur={handleBlur}
        />
      );
    } else {
      values = values as ADFormValues;
      touched = touched as FormikTouched<ADFormValues>;
      errors = errors as FormikErrors<ADFormValues>;
      return (
        <AdStorageForm
          isSSL={isSSL}
          handleIsSSLChange={handleIsSSLChange}
          values={values}
          touched={touched}
          errors={errors}
          handleChange={handleChange}
          handleBlur={handleBlur}
        />
      );
    }
  }

  if (directory.value === 0) {
    return (
      <form className={classes.form} noValidate onSubmit={handleLocalSubmit}>
        <Typography variant="h5" gutterBottom color="primary">
          {i18next.t("identity_management", "Identity Management") as string}
        </Typography>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Typography variant="body1" gutterBottom>
              {
                i18next.t(
                  "select_type_of_user_directory",
                  "Select the type of user directory to be integrated with JAMS",
                ) as string
              }
            </Typography>
            <Select
              labelId="demo-simple-select-label"
              fullWidth
              value={directory.value}
              onChange={handleChangeDirectoryType}
              variant="outlined"
            >
              {directoryTypesItems}
            </Select>
          </Grid>
        </Grid>
        <LocalStorageForm
          nameServerChecked={nameServerChecked}
          handleNameServerChange={handleNameServerChange}
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
              "set_identity_parameters",
              "Set identity parameters",
            ) as string
          }
        </Button>
      </form>
    );
  } else if (directory.value === 1) {
    return (
      <Formik
        validationSchema={validationSchemaLDAPform}
        initialValues={initialValuesLDAPform}
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
              <Typography variant="h5" gutterBottom color="primary">
                {
                  i18next.t(
                    "identity_management",
                    "Identity Management",
                  ) as string
                }
              </Typography>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <Typography variant="body1" gutterBottom>
                    {
                      i18next.t(
                        "select_type_of_user_directory",
                        "Select the type of user directory to be integrated with JAMS",
                      ) as string
                    }
                  </Typography>
                  <Select
                    labelId="demo-simple-select-label"
                    fullWidth
                    value={directory.value}
                    onChange={handleChangeDirectoryType}
                    variant="outlined"
                  >
                    {directoryTypesItems}
                  </Select>
                </Grid>
              </Grid>
              {returnForm(values, touched, errors, handleChange, handleBlur)}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
              >
                {
                  i18next.t(
                    "set_identity_parameters",
                    "Set identity parameters",
                  ) as string
                }
              </Button>
            </form>
          );
        }}
      </Formik>
    );
  } else {
    return (
      <Formik
        validationSchema={validationSchemaADform}
        initialValues={initialValuesADform}
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
              <Typography variant="h5" gutterBottom color="primary">
                {
                  i18next.t(
                    "identity_management",
                    "Identity Management",
                  ) as string
                }
              </Typography>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <Typography variant="body1" gutterBottom>
                    {
                      i18next.t(
                        "select_type_of_user_directory",
                        "Select the type of user directory to be integrated with JAMS",
                      ) as string
                    }
                  </Typography>
                  <Select
                    labelId="demo-simple-select-label"
                    fullWidth
                    value={directory.value}
                    onChange={handleChangeDirectoryType}
                    variant="outlined"
                  >
                    {directoryTypesItems}
                  </Select>
                </Grid>
              </Grid>
              {returnForm(values, touched, errors, handleChange, handleBlur)}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
              >
                {
                  i18next.t(
                    "set_identity_parameters",
                    "Set identity parameters",
                  ) as string
                }
              </Button>
            </form>
          );
        }}
      </Formik>
    );
  }
}
