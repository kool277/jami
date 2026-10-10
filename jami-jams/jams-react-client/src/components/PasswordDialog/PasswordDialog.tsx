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

import { FC, useEffect, useState } from "react";
// @mui/material components
import { makeStyles } from "@mui/styles";
// core components

import Button from "components/CustomButtons/Button";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";

import Grid from "@mui/material/Grid";

import InputAdornment from "@mui/material/InputAdornment";

import { Formik } from "formik";
import FormikField from "components/FormikField/FormikField";
import * as Yup from "yup";

import axios from "axios";
import configApiCall from "api";
import { api_path_put_update_user } from "globalUrls";

import VpnKeyIcon from "@mui/icons-material/VpnKey";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import { Theme } from "@mui/material";

import { CopyToClipboard } from "react-copy-to-clipboard";

import generator from "generate-password-browser";

const styles = (theme: Theme) => ({
  root: {
    flexGrow: 1,
  },
  button: {
    margin: theme.spacing(1),
  },
  actionButtons: {
    display: "flex",
    justifyContent: "space-between",
  },
});

const useStyles = makeStyles(styles as any);

interface PasswordDialogProps {
  username: string;
  open: boolean;
  onClose: () => void;
}

const PasswordDialog: FC<PasswordDialogProps> = ({
  username,
  open,
  onClose,
}) => {
  const classes = useStyles();

  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const passwordGenerator = () => {
    return generator.generate({
      length: 10,
      uppercase: false,
      numbers: true,
      symbols: true,
    });
  };

  const changePassword = (values: { password: string }) => {
    const data = {
      username: username,
      password: values.password,
    };

    axios(configApiCall(api_path_put_update_user, "PUT", data, null))
      .then(onClose)
      .catch((error) => {
        console.log(
          "Updating user " + username + " password failed with error: " + error,
        );
      });
  };

  const passwordSchema = Yup.object().shape({
    password: Yup.string().required("Password is required"),
    passwordConfirmation: Yup.string().oneOf(
      [Yup.ref("password"), undefined],
      "Passwords must match",
    ),
  });

  const handleMouseDownPassword = () => {
    setPasswordVisible(true);
  };
  const handleMouseUpPassword = () => {
    setPasswordVisible(false);
  };

  const getStatus = () => {
    if (copied)
      return (
        <span
          style={{
            fontSize: "12px",
            marginRight: "10px",
            marginTop: "14px",
            color: "rgba(0, 0, 0, 0.54)",
          }}
        >
          Copied
        </span>
      );
    else if (generated) {
      return (
        <span
          style={{
            fontSize: "12px",
            marginRight: "10px",
            marginTop: "14px",
            color: "rgba(0, 0, 0, 0.54)",
          }}
        >
          Generated
        </span>
      );
    } else return "";
  };

  useEffect(() => {
    setCopied(false);
    setGenerated(false);
  }, []);

  return (
    <div>
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <Formik
          initialValues={{
            password: "",
            passwordConfirmation: "",
          }}
          validationSchema={passwordSchema}
          onSubmit={changePassword}
        >
          {({ isValid, dirty, handleSubmit, values, setFieldValue }) => (
            <form onSubmit={handleSubmit}>
              <DialogContent>
                <DialogContentText id="change-password-description">
                  Change <strong>{username}&apos;s</strong> password
                </DialogContentText>
                <FormikField
                  name="password"
                  label="Password"
                  placeholder="Password"
                  type={passwordVisible ? "text" : "password"}
                  startAdornment={
                    <InputAdornment position="start">
                      <VpnKeyIcon />
                    </InputAdornment>
                  }
                  endAdornment={
                    <div style={{ display: "flex" }}>
                      {getStatus()}
                      <IconButton
                        aria-label="toggle password visibility"
                        onMouseDown={handleMouseDownPassword}
                        onMouseUp={handleMouseUpPassword}
                        size="large"
                      >
                        {passwordVisible ? (
                          <VisibilityIcon />
                        ) : (
                          <VisibilityOffIcon />
                        )}
                      </IconButton>
                    </div>
                  }
                  handleChange={() => {}}
                  onKeyUpError={false}
                  onKeyUpErrorMessage=""
                />
                <FormikField
                  name="passwordConfirmation"
                  label="Confirm password"
                  placeholder="Confirm password"
                  type={passwordVisible ? "text" : "password"}
                  startAdornment={
                    <InputAdornment position="start">
                      <VpnKeyIcon />
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
                        <VisibilityIcon />
                      ) : (
                        <VisibilityOffIcon />
                      )}
                    </IconButton>
                  }
                  handleChange={() => {}}
                  onKeyUpError={false}
                  onKeyUpErrorMessage=""
                />
              </DialogContent>
              <DialogActions>
                <Grid>
                  <Grid>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      className={classes.button}
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        const newGeneratedPassword = passwordGenerator();
                        setFieldValue("password", newGeneratedPassword, false);
                        setFieldValue(
                          "passwordConfirmation",
                          newGeneratedPassword,
                          false,
                        );
                        setCopied(false);
                        setGenerated(true);
                      }}
                    >
                      {"Generate"}
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
                        color="primary"
                        size="large"
                        className={classes.button}
                        startIcon={<FileCopyIcon />}
                      >
                        Copy to clipboard
                      </Button>
                    </CopyToClipboard>
                  </Grid>
                  <Grid className={classes.actionButtons}>
                    <Button onClick={onClose} color="primary">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isValid && !dirty}
                      color="info"
                      autoFocus
                    >
                      Update password
                    </Button>
                  </Grid>
                </Grid>
              </DialogActions>
            </form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default PasswordDialog;
