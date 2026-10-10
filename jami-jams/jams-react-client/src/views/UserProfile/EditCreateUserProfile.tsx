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

import React, { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui/material components
import { makeStyles } from "@mui/styles";

// core components
import Grid from "@mui/material/Grid";
import GridItem from "components/Grid/GridItem";
import GridContainer from "components/Grid/GridContainer";
import Button from "components/CustomButtons/Button";
import Card from "components/Card/Card";
import CardAvatar from "components/Card/CardAvatar";
import CardHeader from "components/Card/CardHeader";
import CardBody from "components/Card/CardBody";
import CardFooter from "components/Card/CardFooter";
import InputAdornment from "@mui/material/InputAdornment";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Cropper from "react-easy-crop";
import getCroppedImg from "./cropImage";

import { hexToRgb, blackColor } from "assets/jss/material-dashboard-react";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import PhoneForwardedOutlinedIcon from "@mui/icons-material/PhoneForwardedOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import PersonIcon from "@mui/icons-material/Person";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import IconButton from "@mui/material/IconButton";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import FileCopyIcon from "@mui/icons-material/FileCopy";

import { CopyToClipboard } from "react-copy-to-clipboard";

import Resizer from "react-image-file-resizer";

import noProfilePicture from "assets/img/faces/no-profile-picture.png";

import axios from "axios";
import configApiCall from "../../api";
import {
  api_path_put_update_user_profile,
  api_path_post_create_user,
  api_path_post_create_user_profile,
  api_path_get_user_profile,
  api_path_get_ns_addr_from_name,
} from "../../globalUrls";

import dashboardStyle from "assets/jss/material-dashboard-react/views/dashboardStyle";

import FormikField from "components/FormikField/FormikField";
import { Formik } from "formik";
import * as Yup from "yup";

import LinearProgress from "@mui/material/LinearProgress";

import i18next from "i18next";

import generator from "generate-password-browser";
import { UserProfile } from "./DisplayUserProfile";
import { Theme } from "@mui/material";
import { Area } from "react-easy-crop";

const styles = (theme: Theme) => ({
  ...dashboardStyle,
  root: {
    flexGrow: 1,
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
    [theme.breakpoints.up("sm")]: {
      minHeight: "60vh",
      minWidth: "80vh",
    },
    width: "100%",
    maxHeight: "60vh",
    maxWidth: "80vh",
  },
  alignRight: {
    float: "right",
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "column",
      "& button": {
        width: "100%",
      },
    },
  },
  button: {
    margin: theme.spacing(1),
  },
  cropContainer: {
    position: "relative",
    width: "100%",
    height: 200,
    background: "#333",
    [theme.breakpoints.up("sm")]: {
      height: 400,
    },
  },
  cropButton: {
    flexShrink: 0,
    marginLeft: 16,
  },
  controls: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    [theme.breakpoints.up("sm")]: {
      flexDirection: "row",
      alignItems: "center",
    },
  },
  sliderContainer: {
    display: "flex",
    flex: "1",
    alignItems: "center",
  },
  sliderLabel: {
    [theme.breakpoints.down("sm")]: {
      minWidth: 65,
    },
  },
  slider: {
    padding: "22px 0px",
    marginLeft: "10px",
    marginRight: "10px",
    [theme.breakpoints.up("sm")]: {
      flexDirection: "row",
      alignItems: "center",
      margin: "0 16px",
    },
  },
  profileEditHeaderMobile: {
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  },
  profileEditAvatarMobile: {
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: 10,
    },
  },
  profileEditAvatarInputMobile: {
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
  },
});

const useStyles = makeStyles(styles as any);

interface UserProfileForm extends UserProfile {
  password?: string;
  confirmPassword?: string;
}

interface EditCreateUserProfileProps {
  createUser: boolean;
  username?: string;
  setDisplayUser?: React.Dispatch<React.SetStateAction<boolean>>;
}

const toBase64 = (file: File): Promise<string | undefined> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString());
    reader.onerror = reject;
  });

export default function EditCreateUserProfile(
  props: EditCreateUserProfileProps,
) {
  const classes = useStyles();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(true);
  const [userExists, setUserExists] = useState(false);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [profilePicture, setProfilePicture] = useState("");
  const [profilePicturePreview, setProfilePicturePreview] =
    useState(noProfilePicture);
  const [originalUploadedImage, setOriginalUploadedImage] = useState("");

  const [open, setOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const passwordGenerator = () => {
    return generator.generate({
      length: 10,
      uppercase: false,
      numbers: true,
      symbols: true,
    });
  };

  const intialyGeneratedPassword = passwordGenerator();

  const [initialValues, setInitialValues] = useState<UserProfileForm>({
    username: "",
    password: intialyGeneratedPassword,
    confirmPassword: intialyGeneratedPassword,
    firstName: "",
    lastName: "",
    email: "",
    profilePicture: "",
    organization: "",
    faxNumber: "",
    phoneNumber: "",
    phoneNumberExtension: "",
    mobileNumber: "",
    id: "",
  });

  useEffect(() => {
    if (!props.createUser) {
      setLoading(true);
      const timer = setInterval(() => {
        setProgress((oldProgress) => {
          if (oldProgress === 100) {
            return 0;
          }
          const diff = Math.random() * 10;
          return Math.min(oldProgress + diff, 100);
        });
      }, 500);
      setUserName(props.username || "");
      axios(
        configApiCall(
          api_path_get_user_profile + props.username,
          "GET",
          null,
          null,
        ),
      )
        .then((response) => {
          const user: UserProfile = response.data;
          const values: UserProfileForm = {
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture,
            organization: user.organization,
            faxNumber: user.faxNumber,
            phoneNumber: user.phoneNumber,
            phoneNumberExtension: user.phoneNumberExtension,
            mobileNumber: user.mobileNumber,
            id: user.id,
          };
          setInitialValues(values);
          setProfilePicture(user.profilePicture);
          if (user.profilePicture !== "") {
            setProfilePicturePreview(
              "data:image/png;base64, " + user.profilePicture,
            );
          } else {
            setProfilePicturePreview(noProfilePicture);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.log("Error fetching user : " + props.username + " " + error);
        });

      return () => {
        clearInterval(timer);
      };
    }
  }, [props.createUser, props.username]);

  const resizeFile = (file: Blob, outputFormat: string): Promise<string> =>
    new Promise((resolve) => {
      Resizer.imageFileResizer(
        file,
        512,
        512,
        "PNG",
        100,
        0,
        (uri) => {
          resolve(uri.toString());
        },
        outputFormat,
      );
    });

  const handleProfilePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files === null || files[0] === undefined) {
      console.error("No file attached!");
      return;
    }

    toBase64(files[0])
      .then(async (data) => {
        if (data === undefined) {
          console.error("Error converting file to base64");
          return;
        }

        const blob = await fetch(data).then((r) => r.blob());
        const imageBase64 = await resizeFile(blob, "base64");
        setProfilePicture(imageBase64);
        setProfilePicturePreview("data:image/png;base64, " + imageBase64);
        setOriginalUploadedImage(imageBase64);
        setOpen(true);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleCancelUpdate = () => {
    if (props.setDisplayUser) {
      props.setDisplayUser(true);
    }
  };

  const handleUserProfileCreation = (data: UserProfileForm) => {
    axios(configApiCall(api_path_post_create_user_profile, "POST", data, null))
      .then(() => {
        navigate(`/user/${data.username}`);
      })
      .catch((error) => {
        console.log("Error creating user profile: " + error);
      });
  };

  const handleCreateUser = (data: UserProfileForm) => {
    data.username = data.username.toLowerCase();
    const body = {
      username: data.username,
      password: data.password,
    };

    axios(configApiCall(api_path_post_create_user, "POST", body, null))
      .then(() => {
        handleUserProfileCreation(data);
      })
      .catch(() => {
        console.log(
          "Failed to create new user. This is either because the username is already in use on the public name server, or another unknown error has occurred. Please choose another one.",
        );
      });
  };

  const handleUserUpdate = () => {
    if (props.setDisplayUser) {
      props.setDisplayUser(true);
    }
  };

  const handleUpdateUser = (data: UserProfileForm) => {
    axios(configApiCall(api_path_put_update_user_profile, "PUT", data, null))
      .then(() => {
        handleUserUpdate();
      })
      .catch((error) => {
        console.log("Error updating user: " + error);
      });
  };

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    getCroppedImg(originalUploadedImage, croppedAreaPixels, rotation).then(
      (value) => {
        setProfilePicturePreview(value);
      },
    );
  };

  const handleClose = () => {
    setProfilePicturePreview(originalUploadedImage);
    setOpen(false);
  };

  const cropProfilePicture = () => {
    setProfilePicture(
      profilePicturePreview.replace("data:image/jpeg;base64,", ""),
    );
    setOpen(false);
  };

  const handleFormikSubmit = (values: UserProfileForm) => {
    values.profilePicture = profilePicture;
    if (props.createUser) {
      handleCreateUser(values);
    } else {
      handleUpdateUser(values);
    }
  };

  const handleMouseDownPassword = () => {
    setPasswordVisible(true);
  };
  const handleMouseUpPassword = () => {
    setPasswordVisible(false);
  };

  const checkUserExists = async (value: string) => {
    const data = {
      username: value,
    };

    const userExsits = await axios(
      configApiCall(
        api_path_get_ns_addr_from_name + data.username,
        "GET",
        null,
        null,
      ),
    )
      .then((response) => {
        if (response.status === 200) {
          return true;
        }
        return false;
      })
      .catch(() => {
        return false;
      });

    setUserExists(userExsits);
  };

  const EditCreateSchema = Yup.object().shape({
    username: Yup.string()
      .min(
        3,
        i18next.t("minimum_3_characters", "Minimum 3 characters!") as string,
      )
      .max(
        32,
        i18next.t("maximum_32_characters", "Maximum 32 characters!") as string,
      )
      .required(
        i18next.t("username_is_required", "Username is required!") as string,
      )
      .matches(
        /^[A-Za-z_][A-Za-z0-9_]*$/,
        i18next.t(
          "only_alphanumeric_characters",
          "Only alphanumeric characters!",
        ),
      ),
    password: props.createUser
      ? Yup.string().required(
          i18next.t("password_is_required", "Password is required!") as string,
        )
      : Yup.string().nullable(),
    confirmPassword: props.createUser
      ? Yup.string().oneOf(
          [Yup.ref("password"), undefined],
          i18next.t("password_must_match", "Passwords must match") as string,
        )
      : Yup.string().nullable(),
    firstName: Yup.string().min(
      2,
      i18next.t(
        "first_name_is_too_short",
        "First name is too short!",
      ) as string,
    ),
    lastName: Yup.string().min(
      2,
      i18next.t("last_name_is_too_short", "Last Name is too short!") as string,
    ),
    email: Yup.string().email(
      i18next.t("invalid_email", "Invalid email!") as string,
    ),
    profilePicture: Yup.string(),
    organization: Yup.string().min(
      2,
      i18next.t(
        "organization_name_too_short",
        "Organization name is too short!",
      ),
    ),
    faxNumber: Yup.string().matches(
      /^(\+\d{1,2}\s?)?1?-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      i18next.t("fax_not_valid", "Fax number not valid!") as string,
    ),
    phoneNumber: Yup.string().matches(
      /^(\+\d{1,2}\s?)?1?-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      i18next.t("phone_not_valid", "Phone number not valid!") as string,
    ),
    phoneNumberExtension: Yup.number().positive().integer(),
    mobileNumber: Yup.string().matches(
      /^(\+\d{1,2}\s?)?1?-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      i18next.t("mobile_not_valid", "Mobile number not valid!") as string,
    ),
  });

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle id="alert-dialog-title">
          {i18next.t("crop_image", "Crop image") as string}
        </DialogTitle>
        <DialogContent>
          <div className={classes.cropContainer}>
            <Cropper
              image={originalUploadedImage}
              cropSize={{ width: 300, height: 300 }}
              crop={crop}
              rotation={rotation}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className={classes.controls}>
            <div className={classes.sliderContainer}>
              <Typography
                variant="overline"
                classes={{ root: classes.sliderLabel }}
              >
                {i18next.t("zoom", "Zoom") as string}
              </Typography>
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                className={classes.slider}
                onChange={(e, zoom: any) => setZoom(zoom)}
              />
            </div>
            <div className={classes.sliderContainer}>
              <Typography
                variant="overline"
                classes={{ root: classes.sliderLabel }}
              >
                {i18next.t("rotation", "Rotation") as string}
              </Typography>
              <Slider
                value={rotation}
                min={0}
                max={360}
                step={1}
                aria-labelledby="Rotation"
                className={classes.slider}
                onChange={(e, rotation: any) => setRotation(rotation)}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={cropProfilePicture} color="info" autoFocus>
            {i18next.t("validate", "Validate") as string}
          </Button>
        </DialogActions>
      </Dialog>
      <div className={classes.loading}>
        {loading && <LinearProgress variant="determinate" value={progress} />}
      </div>
      {!loading && (
        <GridContainer>
          <GridItem xs={12} sm={12} md={8}>
            <Formik
              initialValues={initialValues}
              onSubmit={handleFormikSubmit}
              validationSchema={EditCreateSchema}
            >
              {({ isValid, dirty, handleSubmit, setFieldValue, values }) => (
                <form onSubmit={handleSubmit}>
                  <Card profile>
                    <CardHeader
                      color="info"
                      stats
                      icon
                      className={classes.profileEditHeaderMobile}
                    >
                      <p className={classes.cardCategory}>
                        {props.createUser
                          ? (i18next.t(
                              "create_new_profile",
                              "Create new profile",
                            ) as string)
                          : (i18next.t(
                              "edit_profile",
                              "Edit profile",
                            ) as string)}
                      </p>
                      {props.createUser ? (
                        ""
                      ) : (
                        <h3 className={classes.cardTitle}>{userName}</h3>
                      )}
                    </CardHeader>
                    <CardBody profile>
                      <CardAvatar
                        editProfile
                        className={classes.profileEditAvatarMobile}
                      >
                        <img
                          src={profilePicturePreview}
                          alt="..."
                          className={classes.editProfilePicture}
                          onClick={() => {
                            const pictureChange = document.getElementById(
                              "change-profile-picture",
                            );
                            pictureChange?.click();
                          }}
                        />
                      </CardAvatar>
                      <div className={classes.root}>
                        <Grid container spacing={5}>
                          <Grid
                            className={classes.profileEditAvatarInputMobile}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 12,
                            }}
                          >
                            <input
                              accept="image/*"
                              className={classes.input}
                              id="icon-button-file"
                              type="file"
                              onChange={handleProfilePictureChange}
                            />
                            <label htmlFor="icon-button-file">
                              <IconButton
                                id="change-profile-picture"
                                aria-label="upload picture"
                                component="span"
                                size="large"
                              >
                                <PhotoCamera />
                              </IconButton>{" "}
                              {
                                i18next.t(
                                  "change_profile_image",
                                  "Change profile image",
                                ) as string
                              }
                            </label>
                          </Grid>
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            >
                              <FormikField
                                name="username"
                                label={
                                  i18next.t("username", "Username") as string
                                }
                                placeholder={
                                  i18next.t("username", "Username") as string
                                }
                                startAdornment={
                                  <InputAdornment position="start">
                                    <AccountCircleIcon />
                                  </InputAdornment>
                                }
                                endAdornment={
                                  values.username ===
                                  "" ? undefined : userExists ? (
                                    <CancelIcon style={{ color: "#cc0000" }} />
                                  ) : (
                                    <CheckCircleIcon
                                      style={{ color: "#99cc00" }}
                                    />
                                  )
                                }
                                required
                                autoComplete="off"
                                handleChange={checkUserExists}
                                onKeyUpError={userExists}
                                onKeyUpErrorMessage={i18next.t(
                                  "username_already_taken",
                                  "Username already taken",
                                )}
                              />
                            </Grid>
                          )}
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            ></Grid>
                          )}
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            >
                              <FormikField
                                type={passwordVisible ? "text" : "password"}
                                name="password"
                                label={
                                  i18next.t("password", "Password") as string
                                }
                                placeholder={
                                  i18next.t("password", "Password") as string
                                }
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
                                required
                                autoComplete="off"
                                handleChange={() => {}}
                                onKeyUpError={false}
                                onKeyUpErrorMessage=""
                              />
                            </Grid>
                          )}
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            >
                              <FormikField
                                type={passwordVisible ? "text" : "password"}
                                name="confirmPassword"
                                label={i18next.t(
                                  "confirm_password",
                                  "Confirm password",
                                )}
                                placeholder={i18next.t(
                                  "confirm_password",
                                  "Confirm password",
                                )}
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
                                required
                                autoComplete="off"
                                handleChange={() => {}}
                                onKeyUpError={false}
                                onKeyUpErrorMessage=""
                              />
                            </Grid>
                          )}
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            ></Grid>
                          )}
                          {props.createUser && (
                            <Grid
                              size={{
                                xs: 12,
                                sm: 12,
                                md: 6,
                              }}
                            >
                              <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                className={classes.button}
                                startIcon={<RefreshIcon />}
                                onClick={() => {
                                  const newGeneratedPassword =
                                    passwordGenerator();
                                  setFieldValue(
                                    "password",
                                    newGeneratedPassword,
                                    false,
                                  );
                                  setFieldValue(
                                    "confirmPassword",
                                    newGeneratedPassword,
                                    false,
                                  );
                                  setCopied(false);
                                  setGenerated(true);
                                }}
                              >
                                {i18next.t("generate", "Generate") as string}
                              </Button>
                              {values.password && (
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
                                    {
                                      i18next.t(
                                        "copy_to_clipboard",
                                        "Copy to clipboard",
                                      ) as string
                                    }
                                  </Button>
                                </CopyToClipboard>
                              )}
                              {copied ? (
                                <span style={{ marginLeft: "10px" }}>
                                  {i18next.t("copied", "Copied") as string}
                                </span>
                              ) : null}
                              {generated ? (
                                <span style={{ marginLeft: "10px" }}>
                                  {
                                    i18next.t(
                                      "generated",
                                      "Generated",
                                    ) as string
                                  }
                                </span>
                              ) : null}
                            </Grid>
                          )}
                          <Grid
                            sx={{ alignContent: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="firstName"
                              label={
                                i18next.t("first_name", "First name") as string
                              }
                              placeholder={i18next.t(
                                "first_name",
                                "First name",
                              )}
                              startAdornment={
                                <InputAdornment position="start">
                                  <PersonIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignContent: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="lastName"
                              label={
                                i18next.t("last_name", "Last name") as string
                              }
                              placeholder={
                                i18next.t("last_name", "Last name") as string
                              }
                              startAdornment={
                                <InputAdornment position="start">
                                  <PersonOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="email"
                              label={i18next.t("email", "Email") as string}
                              placeholder={
                                i18next.t("email", "Email") as string
                              }
                              startAdornment={
                                <InputAdornment position="start">
                                  <AlternateEmailOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="organization"
                              label={
                                i18next.t(
                                  "organization",
                                  "Organization",
                                ) as string
                              }
                              placeholder={i18next.t(
                                "organization",
                                "Organization",
                              )}
                              startAdornment={
                                <InputAdornment position="start">
                                  <BusinessCenterOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="faxNumber"
                              label={
                                i18next.t("fax_number", "Fax number") as string
                              }
                              placeholder={i18next.t(
                                "fax_number",
                                "Fax number",
                              )}
                              startAdornment={
                                <InputAdornment position="start">
                                  <LocalPrintshopOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="phoneNumber"
                              label={
                                i18next.t(
                                  "phone_number",
                                  "Phone number",
                                ) as string
                              }
                              placeholder={i18next.t(
                                "phone_number",
                                "Phone number",
                              )}
                              startAdornment={
                                <InputAdornment position="start">
                                  <PhoneInTalkOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="phoneNumberExtension"
                              label={
                                i18next.t("extension", "Extension") as string
                              }
                              placeholder={
                                i18next.t("extension", "Extension") as string
                              }
                              startAdornment={
                                <InputAdornment position="start">
                                  <PhoneForwardedOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                          <Grid
                            sx={{ alignSelf: "center" }}
                            size={{
                              xs: 12,
                              sm: 12,
                              md: 6,
                            }}
                          >
                            <FormikField
                              name="mobileNumber"
                              label={i18next.t("mobile", "Mobile") as string}
                              placeholder={
                                i18next.t("mobile", "Mobile") as string
                              }
                              startAdornment={
                                <InputAdornment position="start">
                                  <SmartphoneOutlinedIcon />
                                </InputAdornment>
                              }
                              handleChange={() => {}}
                              onKeyUpError={false}
                              onKeyUpErrorMessage=""
                            />
                          </Grid>
                        </Grid>
                      </div>
                    </CardBody>
                    <CardFooter className={classes.alignRight}>
                      {!props.createUser && (
                        <Button color="info" onClick={handleCancelUpdate}>
                          {i18next.t("cancel", "Cancel") as string}
                        </Button>
                      )}
                      {props.createUser ? (
                        <Button
                          type="submit"
                          disabled={!isValid || !dirty || userExists}
                          color="info"
                        >
                          {
                            i18next.t(
                              "create_profile",
                              "Create Profile",
                            ) as string
                          }
                        </Button>
                      ) : (
                        <Button type="submit" disabled={!isValid} color="info">
                          {i18next.t("save_profile", "Save Profile") as string}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </form>
              )}
            </Formik>
          </GridItem>
        </GridContainer>
      )}
    </div>
  );
}
