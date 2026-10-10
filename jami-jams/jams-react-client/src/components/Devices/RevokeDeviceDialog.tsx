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

import { FC } from "react";
import i18next from "i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";

interface RevokeDeviceDialogProps {
  openRevoke: boolean;
  handleClose: () => void;
  handleDeviceRevoke: () => void;
}

const RevokeDeviceDialog: FC<RevokeDeviceDialogProps> = ({
  openRevoke,
  handleClose,
  handleDeviceRevoke,
}) => {
  return (
    <Dialog
      open={openRevoke}
      onClose={handleClose}
      aria-labelledby="form-dialog-title"
    >
      <DialogTitle id="form-revoke-dialog-title">
        {i18next.t("revoke_device", "Revoke Device") as string}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {
            i18next.t(
              "do_you_want_to_revoke_the_device",
              "Do you want to revoke the device?",
            ) as string
          }
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {i18next.t("cancel", "Cancel") as string}
        </Button>
        <Button onClick={handleDeviceRevoke} color="primary">
          {i18next.t("confirm_revoke", "Confirm Revoke") as string}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RevokeDeviceDialog;
