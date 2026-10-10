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
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";

import TextField from "@mui/material/TextField";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import CustomPopupState from "../CustomPopupState/CustomPopupState";

import i18next from "i18next";
import { LDAPFormValues } from "./IdentityManagement";
import { FormikErrors, FormikTouched } from "formik";

interface LdapStorageFormProps {
  useStartTLS: string;
  handleUseStartTLSChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  ldapFilter: {
    value: number;
    label: string;
  };
  ldapFiltersTypesItems: any;
  handleFilterIdChange: (event: SelectChangeEvent) => void;
  values: LDAPFormValues;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  touched: FormikTouched<LDAPFormValues>;
  errors: FormikErrors<LDAPFormValues>;
}

export default function LdapStorageForm(props: LdapStorageFormProps) {
  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          {
            i18next.t(
              "ldap_server_information",
              "LDAP Server informations",
            ) as string
          }
        </Typography>
      </Grid>
      <Grid size={12}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="servername"
          label={i18next.t("server_address", "Server address") as string}
          name="servername"
          autoComplete="servername"
          value={props.values.servername}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.servername &&
            props.touched.servername &&
            props.errors.servername
          }
        />
      </Grid>

      <Grid size={6}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="adminusername"
          label={
            i18next.t(
              "administrator_username",
              "Administrator username",
            ) as string
          }
          name="ldapadminusername"
          autoComplete="adminusername"
          value={props.values.ldapadminusername}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.ldapadminusername &&
            props.touched.ldapadminusername &&
            props.errors.ldapadminusername
          }
        />
      </Grid>
      <Grid size={6}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="password"
          label={i18next.t("password", "Password") as string}
          name="ldappassword"
          autoComplete="password"
          type="password"
          value={props.values.ldappassword}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.ldappassword &&
            props.touched.ldappassword &&
            props.errors.ldappassword
          }
        />
      </Grid>
      <Grid size={12}>
        <TextField
          variant="outlined"
          id="basedn"
          label={
            i18next.t(
              "base_dn_please_use_ldap_convention",
              "Base DN (Please use LDAP convention)",
            ) as string
          }
          name="basedn"
          autoComplete="basedn"
          required
          fullWidth
          value={props.values.basedn}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.basedn && props.touched.basedn && props.errors.basedn
          }
        />
      </Grid>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          Use Start TLS
        </Typography>
        <RadioGroup
          row
          aria-label="useStartTLS"
          name="useStartTLS"
          value={props.useStartTLS}
          onChange={props.handleUseStartTLSChange}
        >
          <FormControlLabel
            value="true"
            control={<Radio color="primary" />}
            label={i18next.t("yes", "Yes") as string}
          />
          <FormControlLabel
            value="false"
            control={<Radio color="default" />}
            label={i18next.t("no", "No") as string}
          />
        </RadioGroup>
      </Grid>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          Filter
          <CustomPopupState
            message={i18next.t(
              "field_ldap_structure_contains_username",
              "This is the field in your LDAP structure which contains the username.",
            )}
          />
        </Typography>
        <Select
          labelId="filter-ldap-select"
          fullWidth
          value={props.ldapFilter.value.toString()}
          onChange={props.handleFilterIdChange}
          variant="outlined"
        >
          {props.ldapFiltersTypesItems}
        </Select>
      </Grid>
    </Grid>
  );
}
