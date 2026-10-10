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

import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
} from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import i18next from "i18next";
import { ChangeEvent, Dispatch, FC, SetStateAction } from "react";
import * as Yup from "yup";
import { Device } from "./Devices";

interface EditDeviceDialogProps {
  openEdit: boolean;
  handleClose: () => void;
  selectedDevice: Device | undefined;
  setDisplayName: Dispatch<SetStateAction<string>>;
  handleUpdate: () => void;
}

const EditDeviceDialog: FC<EditDeviceDialogProps> = ({
  openEdit,
  handleClose,
  selectedDevice = { deviceId: "", displayName: "", revoked: false },
  setDisplayName,
  handleUpdate,
}) => {
  const validationSchema = Yup.object({
    displayName: Yup.string().required("Required"),
  });

  return (
    <Dialog
      open={openEdit}
      onClose={handleClose}
      aria-labelledby="form-dialog-title"
    >
      <DialogTitle id="form-edit-dialog-title">
        {
          i18next.t(
            "update_device_information",
            "Update Device Information",
          ) as string
        }
      </DialogTitle>
      <Formik
        initialValues={{
          displayName: selectedDevice?.displayName,
        }}
        onSubmit={handleUpdate}
        validationSchema={validationSchema}
      >
        {({ errors, touched }) => (
          <Form>
            <DialogContent>
              <Field name="displayName">
                {({ field }: FieldProps) => (
                  <div
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setDisplayName(event.target.value)
                    }
                  >
                    <TextField
                      autoFocus
                      margin="dense"
                      id="name"
                      label={
                        i18next.t(
                          "device_display_name",
                          "Device Display Name",
                        ) as string
                      }
                      fullWidth
                      helperText={
                        errors.displayName &&
                        touched.displayName &&
                        errors.displayName
                      }
                      {...field}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="primary">
                {i18next.t("cancel", "Cancel") as string}
              </Button>
              <Button type="submit" color="primary">
                {i18next.t("update", "Update") as string}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default EditDeviceDialog;
