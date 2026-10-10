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
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CustomPopupState from "../CustomPopupState/CustomPopupState";

import i18next from "i18next";

interface LocalStorageFormProps {
  nameServerChecked: boolean;
  handleNameServerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function LocalStorageForm(props: LocalStorageFormProps) {
  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="subtitle1" gutterBottom color="primary">
          {i18next.t("advanced_settings", "Advanced settings") as string}
        </Typography>
      </Grid>
      <Grid size={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={props.nameServerChecked}
              onChange={props.handleNameServerChange}
              slotProps={{ input: { "aria-label": "primary checkbox" } }}
              color="primary"
            />
          }
          label={
            i18next.t(
              "use_public_name_server",
              "Use public name server",
            ) as string
          }
        />
        <CustomPopupState
          message={i18next.t(
            "check_box_register_usernames_on_jami_public_name_server",
            "Check this box if you want to register your usernames on Jami's public name server.",
          )}
        />
      </Grid>
    </Grid>
  );
}
