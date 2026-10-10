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

import { useEffect, useState } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";
import Container from "@mui/material/Container";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import Paper from "@mui/material/Paper";

import logo from "assets/img/jams_logo_no_gnu_package.svg";

import CustomizedSteppers from "components/CustomizedSteppers/CustomizedSteppers";
import CreateAdmin from "components/CreateAdmin/CreateAdmin";
import CaSetup from "components/CaSetup/CaSetup";
import IdentityManagement from "components/IdentityManagement/IdentityManagement";
import ServerParameters from "components/ServerParameters/ServerParameters";

import LanguagePicker from "../components/LanguagePicker/LanguagePicker";
import { Theme } from "@mui/material";

function Alert(props: AlertProps) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

function Copyright() {
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {"Copyright © "}
      {new Date().getFullYear() + " "}
      <Link color="primary" href="https://savoirfairelinux.com">
        Savoir-faire Linux Inc.
      </Link>
    </Typography>
  );
}

const useStyles = makeStyles((theme: Theme) => ({
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
  paper: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    [theme.breakpoints.up(700)]: {
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(6),
      padding: theme.spacing(3),
    },
  },
  logo: {
    width: "25em",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  },
}));

interface SignUpProps {
  step: number;
}

export default function SignUp(props: SignUpProps) {
  const classes = useStyles();
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Test");

  useEffect(() => {
    //request the server to check for the step to return
  });

  function returnStep() {
    if (props.step === 0) {
      return (
        <CreateAdmin setError={setError} setErrorMessage={setErrorMessage} />
      );
    } else if (props.step === 1) {
      return <CaSetup setError={setError} setErrorMessage={setErrorMessage} />;
    } else if (props.step === 2) {
      return (
        <IdentityManagement
          setError={setError}
          setErrorMessage={setErrorMessage}
        />
      );
    } else if (props.step === 3) {
      return (
        <ServerParameters
          setError={setError}
          setErrorMessage={setErrorMessage}
        />
      );
    }
  }
  return (
    <Container component="main" maxWidth="sm">
      <Paper className={classes.paper}>
        <CssBaseline />
        <img src={logo} className={classes.logo} alt="Logo Jami" />
        <CustomizedSteppers step={props.step} />
        {error && errorMessage && (
          <Alert severity="error">{errorMessage.toString()}</Alert>
        )}
        {returnStep()}

        <Box sx={{ mt: 8 }}>
          <Copyright />
        </Box>
        <Box sx={{ mt: 8, justifyContent: "center" }}>
          <LanguagePicker navigationTarget={"/"} />
        </Box>
      </Paper>
    </Container>
  );
}
