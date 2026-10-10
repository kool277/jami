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

import i18next from "i18next";

import { ADFormValues } from "./IdentityManagement";
import { FormikErrors, FormikTouched } from "formik";

interface AdStorageFormProps {
  isSSL: string;
  handleIsSSLChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  values: ADFormValues;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  touched: FormikTouched<ADFormValues>;
  errors: FormikErrors<ADFormValues>;
}

export default function AdStorageForm(props: AdStorageFormProps) {
  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          {
            i18next.t(
              "active_directory_server_informations",
              "Active Directory server information",
            ) as string
          }
        </Typography>
      </Grid>
      <Grid size={6}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="port"
          label={i18next.t("port", "Port") as string}
          name="port"
          autoComplete="port"
          value={props.values.port}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.port && props.touched.port && props.errors.port
          }
        />
      </Grid>
      <Grid size={6}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="host"
          label={i18next.t("host", "Host") as string}
          name="host"
          autoComplete="host"
          value={props.values.host}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.host && props.touched.host && props.errors.host
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
          label={i18next.t("admin_username", "Admin username") as string}
          name="adadminusername"
          autoComplete="adminusername"
          value={props.values.adadminusername}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.adadminusername &&
            props.touched.adadminusername &&
            props.errors.adadminusername
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
          name="adpassword"
          autoComplete="password"
          type="password"
          value={props.values.adpassword}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.adpassword &&
            props.touched.adpassword &&
            props.errors.adpassword
          }
        />
      </Grid>
      <Grid size={12}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="domainname"
          label={i18next.t("domain_name", "Domain Name") as string}
          name="domainname"
          autoComplete="domainname"
          value={props.values.domainname}
          onChange={props.handleChange}
          onBlur={props.handleBlur}
          helperText={
            props.errors.domainname &&
            props.touched.domainname &&
            props.errors.domainname
          }
        />
      </Grid>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          Use SSL
        </Typography>
        <RadioGroup
          row
          aria-label="isSSL"
          name="isSSL"
          value={props.isSSL}
          onChange={props.handleIsSSLChange}
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
    </Grid>
  );
}
