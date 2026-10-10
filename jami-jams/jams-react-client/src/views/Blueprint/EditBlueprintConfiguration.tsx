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

import React, { useContext, useState } from "react";
import clsx from "clsx";

// @mui/material components
import { makeStyles } from "@mui/styles";
import InputLabel from "@mui/material/InputLabel";

// core components
import Grid from "@mui/material/Grid";
import GridItem from "components/Grid/GridItem";
import GridContainer from "components/Grid/GridContainer";
import Card from "components/Card/Card";
import CardHeader from "components/Card/CardHeader";
import CardIcon from "components/Card/CardIcon";
import CardBody from "components/Card/CardBody";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Input from "@mui/material/Input";
import InputAdornment from "@mui/material/InputAdornment";

import Radio, { RadioProps } from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Switch from "@mui/material/Switch";

import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import IconButton from "@mui/material/IconButton";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";

import i18next from "i18next";

import dashboardStyle from "assets/jss/material-dashboard-react/views/dashboardStyle";
import { hexToRgb, blackColor } from "assets/jss/material-dashboard-react";

import { BlueprintSnackbar } from "components/Snackbar/BlueprintSnackbar";
import CustomPopupState from "components/CustomPopupState/CustomPopupState";

import { PolicyDataContext } from "./PolicyDataContext";

const styles = () => ({
  ...dashboardStyle,
  root: {
    flexGrow: 1,
  },
  radioRoot: {
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  icon: {
    borderRadius: "50%",
    width: 16,
    height: 16,
    boxShadow:
      "inset 0 0 0 1px rgba(16,22,26,.2), inset 0 -1px 0 rgba(16,22,26,.1)",
    backgroundColor: "#f5f8fa",
    backgroundImage:
      "linear-gradient(180deg,hsla(0,0%,100%,.8),hsla(0,0%,100%,0))",
    "$root.Mui-focusVisible &": {
      outline: "2px auto rgba(19,124,189,.6)",
      outlineOffset: 2,
    },
    "input:hover ~ &": {
      backgroundColor: "#ebf1f5",
    },
    "input:disabled ~ &": {
      boxShadow: "none",
      background: "rgba(206,217,224,.5)",
    },
  },
  checkedIcon: {
    backgroundColor: "#137cbd",
    backgroundImage:
      "linear-gradient(180deg,hsla(0,0%,100%,.1),hsla(0,0%,100%,0))",
    "&:before": {
      display: "block",
      width: 16,
      height: 16,
      backgroundImage: "radial-gradient(#fff,#fff 28%,transparent 32%)",
      content: '""',
    },
    "input:hover ~ &": {
      backgroundColor: "#106ba3",
    },
  },
  cardCategoryWhite: {
    color: "rgba(255,255,255,.62)",
    margin: "0",
    fontSize: "14px",
    marginTop: "0",
    marginBottom: "0",
  },
  cardTitleWhite: {
    color: "#FFFFFF",
    marginTop: "0px",
    minHeight: "auto",
    fontWeight: "300",
    fontFamily: "'Ubuntu'",
    marginBottom: "3px",
    textDecoration: "none",
  },
  input: {
    display: "none",
  },
  profileAsBackground: {
    backgroundSize: "100% 100%",
    width: "80px",
    height: "80px",
  },
  centerIconMiddle: {
    position: "relative",
    top: "20px",
    left: "15px",
  },
  editProfilePicture: {
    borderRadius: "50%",
    width: "200px",
    height: "200px",
    boxShadow:
      "0 6px 8px -12px rgba(" +
      hexToRgb(blackColor) +
      ", 0.56), 0 4px 25px 0px rgba(" +
      hexToRgb(blackColor) +
      ", 0.12), 0 8px 10px -5px rgba(" +
      hexToRgb(blackColor) +
      ", 0.2)",
  },
  dialogPaper: {
    minHeight: "60vh",
    maxHeight: "60vh",
    minWidth: "80vh",
    maxWidth: "80vh",
  },
  marginTop: {
    marginTop: "15px",
  },
});

const useStyles = makeStyles(styles as any);

// Inspired by blueprintjs
const StyledRadio = (props: RadioProps) => {
  const classes = useStyles();

  return (
    <Radio
      className={classes.radioRoot}
      disableRipple
      color="default"
      checkedIcon={<span className={clsx(classes.icon, classes.checkedIcon)} />}
      icon={<span className={classes.icon} />}
      {...props}
    />
  );
};

interface EditBlueprintConfigurationProps {
  blueprintName: string;
}

export default function EditBlueprintConfiguration(
  props: EditBlueprintConfigurationProps,
) {
  const classes = useStyles();
  const { policyData, updatePolicyData, snackbar, setSnackbar } =
    useContext(PolicyDataContext);

  const {
    upnpEnabled,

    selectedTurnOption,
    turnServer,
    turnServerUserName,

    selectedDHTProxyOption,
    proxyServer,
    dhtProxyListUrl,
  } = policyData;

  const [turnPasswordVisible, setTurnPasswordVisible] = useState(false);

  const handleTurnChangedOption = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updatePolicyData("selectedTurnOption", event.target.value);
  };

  const handleDHTProxyChangedOption = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updatePolicyData("selectedDHTProxyOption", event.target.value);
  };

  const handleMouseDownPassword = () => {
    setTurnPasswordVisible(true);
  };

  const handleMouseUpPassword = () => {
    setTurnPasswordVisible(false);
  };

  return (
    <div>
      <BlueprintSnackbar snackbar={snackbar} setSnackbar={setSnackbar} />
      <GridContainer>
        <GridItem xs={12} sm={12} md={6}>
          <Card profile>
            <CardHeader color="info" stats icon>
              <CardIcon color="info">
                <BuildOutlinedIcon />
              </CardIcon>
              <p className={classes.cardCategory}>
                {i18next.t("configuration", "Configuration") as string}
              </p>
              <h3 className={classes.cardTitle}>{props.blueprintName}</h3>
            </CardHeader>
            <CardBody profile>
              <div className={classes.root}>
                <Grid container spacing={2}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 12,
                      md: 12,
                    }}
                  >
                    <FormLabel component="legend">
                      UPnP{" "}
                      <CustomPopupState
                        message={i18next.t(
                          "upnp_custom_popup",
                          "UPnP allows Jami to automatically open network ports to establish peer-to-peer communications.",
                        )}
                      />
                    </FormLabel>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={upnpEnabled}
                          color="primary"
                          onChange={(e) => {
                            updatePolicyData("upnpEnabled", e.target.checked);
                          }}
                          name="upnpEnabled"
                          slotProps={{
                            input: { "aria-label": "secondary checkbox" },
                          }}
                        />
                      }
                      label={i18next.t("enable_upnp", "Enable UPnP") as string}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 12,
                      md: 12,
                    }}
                  >
                    <FormControl component="fieldset">
                      <FormLabel component="legend">
                        TURN{" "}
                        <CustomPopupState
                          message={i18next.t(
                            "turn_server_configuration_popup",
                            "Configure a TURN server to establish a connection when peer-to-peer communication is not possible",
                          )}
                        />
                      </FormLabel>
                      <RadioGroup
                        value={selectedTurnOption}
                        aria-label="turn option"
                        name="customized-radios"
                        onChange={handleTurnChangedOption}
                      >
                        <FormControlLabel
                          value="defaultTurn"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "use_jami_default_turn_configuration",
                              "Use default TURN configuration",
                            ) as string
                          }
                        />
                        <FormControlLabel
                          value="customTurn"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "use_a_custom_turn_configuration",
                              "Use a custom TURN configuration",
                            ) as string
                          }
                        />
                        <FormGroup
                          row
                          style={{
                            display:
                              selectedTurnOption === "customTurn"
                                ? "block"
                                : "none",
                          }}
                        >
                          <FormControl className={classes.marginTop}>
                            <InputLabel htmlFor="turnServer">
                              {
                                i18next.t(
                                  "turn_server_address",
                                  "TURN Server address",
                                ) as string
                              }
                            </InputLabel>
                            <Input
                              id="turnServer"
                              placeholder={turnServer}
                              startAdornment={
                                <InputAdornment position="start">
                                  <DnsOutlinedIcon />
                                </InputAdornment>
                              }
                              onChange={(e) => {
                                updatePolicyData("turnServer", e.target.value);
                              }}
                            />
                          </FormControl>
                        </FormGroup>
                        <FormGroup
                          row
                          style={{
                            display:
                              selectedTurnOption === "customTurn"
                                ? "block"
                                : "none",
                          }}
                        >
                          <FormControl className={classes.marginTop}>
                            <InputLabel htmlFor="turnServerUserName">
                              {
                                i18next.t(
                                  "turn_server_username",
                                  "TURN server username",
                                ) as string
                              }
                            </InputLabel>
                            <Input
                              id="turnServerUserName"
                              placeholder={turnServerUserName}
                              startAdornment={
                                <InputAdornment position="start">
                                  <AccountCircleIcon />
                                </InputAdornment>
                              }
                              onChange={(e) => {
                                updatePolicyData(
                                  "turnServerUserName",
                                  e.target.value,
                                );
                              }}
                            />
                          </FormControl>
                        </FormGroup>
                        <FormGroup
                          row
                          style={{
                            display:
                              selectedTurnOption === "customTurn"
                                ? "block"
                                : "none",
                          }}
                        >
                          <FormControl className={classes.marginTop}>
                            <InputLabel htmlFor="turnServerPassword">
                              {
                                i18next.t(
                                  "turn_server_password",
                                  "TURN server password",
                                ) as string
                              }
                            </InputLabel>
                            <Input
                              id="turnServerPassword"
                              placeholder="****"
                              type={turnPasswordVisible ? "text" : "password"}
                              startAdornment={
                                <InputAdornment position="start">
                                  <VpnKeyOutlinedIcon />
                                </InputAdornment>
                              }
                              endAdornment={
                                <IconButton
                                  aria-label="toggle password visibility"
                                  onMouseDown={handleMouseDownPassword}
                                  onMouseUp={handleMouseUpPassword}
                                  size="large"
                                >
                                  {turnPasswordVisible ? (
                                    <VisibilityIcon />
                                  ) : (
                                    <VisibilityOffIcon />
                                  )}
                                </IconButton>
                              }
                              onChange={(e) => {
                                updatePolicyData(
                                  "turnServerPassword",
                                  e.target.value,
                                );
                              }}
                            />
                          </FormControl>
                        </FormGroup>
                        <FormControlLabel
                          value="disabledTurn"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "disable_turn_configuration",
                              "Disable TURN configuration",
                            ) as string
                          }
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 12,
                      md: 4,
                    }}
                  ></Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 12,
                      md: 12,
                    }}
                  >
                    <FormControl component="fieldset">
                      <FormLabel component="legend">
                        DHT Proxy{" "}
                        <CustomPopupState
                          message={i18next.t(
                            "dht_configuration_popup",
                            "Configure the DHT proxy server used by this account",
                          )}
                        />
                      </FormLabel>
                      <RadioGroup
                        value={selectedDHTProxyOption}
                        aria-label="dht proxy option"
                        name="customized-radios"
                        onChange={handleDHTProxyChangedOption}
                      >
                        <FormControlLabel
                          value="defaultDHTProxy"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "use_jami_default_dht_proxy_configuration",
                              "Use Jami default DHT Proxy configuration",
                            ) as string
                          }
                        />
                        <FormControlLabel
                          value="customDHTProxy"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "use_a_custom_dht_proxy_configuration",
                              "Use a custom DHT Proxy configuration",
                            ) as string
                          }
                        />
                        <FormGroup row>
                          <FormControl
                            className={classes.marginTop}
                            style={{
                              display:
                                selectedDHTProxyOption === "customDHTProxy"
                                  ? "block"
                                  : "none",
                            }}
                          >
                            <InputLabel htmlFor="proxyServer">
                              {
                                i18next.t(
                                  "dht_proxy_server_name",
                                  "DHT proxy server name",
                                ) as string
                              }
                            </InputLabel>
                            <Input
                              id="proxyServer"
                              placeholder={proxyServer}
                              startAdornment={
                                <InputAdornment position="start">
                                  <LanguageOutlinedIcon />
                                </InputAdornment>
                              }
                              onChange={(e) => {
                                updatePolicyData("proxyServer", e.target.value);
                              }}
                            />
                          </FormControl>
                        </FormGroup>
                        <FormGroup row>
                          <FormControl
                            className={classes.marginTop}
                            style={{
                              display:
                                selectedDHTProxyOption === "customDHTProxy"
                                  ? "block"
                                  : "none",
                            }}
                          >
                            <InputLabel htmlFor="dhtProxyListUrl">
                              {
                                i18next.t(
                                  "dht_proxy_list_url",
                                  "DHT proxy List URL",
                                ) as string
                              }
                            </InputLabel>
                            <Input
                              id="proxyServer"
                              placeholder={dhtProxyListUrl}
                              startAdornment={
                                <InputAdornment position="start">
                                  <LanguageOutlinedIcon />
                                </InputAdornment>
                              }
                              onChange={(e) => {
                                updatePolicyData(
                                  "dhtProxyListUrl",
                                  e.target.value,
                                );
                              }}
                            />
                          </FormControl>
                        </FormGroup>
                        <FormControlLabel
                          value="disabledDHTProxy"
                          control={<StyledRadio />}
                          label={
                            i18next.t(
                              "disable_dht_proxy_configuration",
                              "Disable DHT Proxy configuration",
                            ) as string
                          }
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 12,
                      md: 4,
                    }}
                  ></Grid>
                </Grid>
              </div>
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </div>
  );
}
