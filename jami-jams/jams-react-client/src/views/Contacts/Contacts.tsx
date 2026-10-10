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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// @mui/material components
import { makeStyles } from "@mui/styles";
// core components
import GridItem from "components/Grid/GridItem";
import GridContainer from "components/Grid/GridContainer";
import CustomInput from "components/CustomInput/CustomInput";
import Button from "components/CustomButtons/Button";
import Card from "components/Card/Card";
import CardAvatar from "components/Card/CardAvatar";
import CardBody from "components/Card/CardBody";
import CardFooter from "components/Card/CardFooter";

import SmsFailedIcon from "@mui/icons-material/SmsFailed";
import LaunchIcon from "@mui/icons-material/Launch";

import Search from "@mui/icons-material/Search";
import IconButton from "@mui/material/IconButton";

import axios from "axios";
import configApiCall from "api";
import auth from "auth";
import {
  api_path_get_auth_contacts,
  api_path_get_admin_contacts,
  api_path_delete_auth_contacts,
  api_path_delete_admin_contacts,
  api_path_get_ns_name_from_addr,
  api_path_get_user_profile,
  api_path_get_user_directory_search,
} from "globalUrls";

import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import jami from "assets/img/faces/jami.png";
import noProfilePicture from "assets/img/faces/no-profile-picture.png";

import headerLinksStyle from "assets/jss/material-dashboard-react/components/headerLinksStyle";
import TemporaryDrawer from "components/Drawer/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import i18next from "i18next";
import { Contact, ServerContact } from "../../types/Contact";
import { UserProfile } from "views/UserProfile/DisplayUserProfile";
import {
  BusinessCenterOutlined,
  InfoOutlined,
  QuestionAnswerOutlined,
} from "@mui/icons-material";

const styles = {
  ...headerLinksStyle,
  cardCategoryWhite: {
    color: "rgba(255,255,255,.62)",
    margin: "0",
    fontSize: "14px",
    marginTop: "0",
    marginBottom: "0",
  },
  cardBody: {
    marginTop: "0",
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
  deleteIcon: {
    float: "right",
  },
  search: {
    width: "90%",
    maxWidth: "500px",
  },
  loading: {
    width: "100%",
  },
  actionButtons: {
    height: "3em",
  },
  cardBodyContent: {
    wordWrap: "break-word",
    fontSize: "12px",
  },
  link: {
    position: "absolute",
    top: "10px",
    right: "10px",
  },
  contactsNotFound: {
    marginLeft: "10px",
    display: "flex",
    alignItems: "center",
  },
};

const useStyles = makeStyles(styles as any);

interface UsersProps {
  username: string;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}

export default function Users(props: UsersProps) {
  const classes = useStyles();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchValue, setSearchValue] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [removedContact, setRemovedContact] = useState("");
  const [removedContactName, setRemovedContactName] = useState<string>();
  const [open, setOpen] = useState(false);
  const [allowedToAdd, setAllowedToAdd] = useState(true);

  const searchContacts = (value?: string) => {
    axios(
      configApiCall(
        api_path_get_user_directory_search,
        "GET",
        { queryString: value ? value : "*" },
        null,
      ),
    )
      .then((response) => {
        const profiles: UserProfile[] = [];
        const profilesResults = response.data.profiles;
        profilesResults.forEach((profile: UserProfile) => {
          if (profile.username !== props.username) {
            let existingContact = false;
            contacts.forEach((contact) => {
              if (profile.username === contact.username) existingContact = true;
            });
            if (!existingContact) profiles.push(profile);
          }
        });
        setUsers(profiles);
      })
      .catch((error) => {
        setUsers([]);
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else if (error.response && error.response.status === 403) {
          setAllowedToAdd(false);
        } else {
          console.error("Error during API request on searchContacts: " + error);
        }
      });
  };

  const getAllContacts = () => {
    let request;

    if (auth.hasAdminScope()) {
      request = axios(
        configApiCall(
          api_path_get_admin_contacts + "?username=" + props.username,
          "GET",
          null,
          null,
        ),
      );
    } else {
      request = axios(
        configApiCall(api_path_get_auth_contacts, "GET", null, null),
      );
    }

    request
      .then((response) => {
        /*
          TODO: Include the username of the user of which we want to display contacts
          at the moment the admin sees his contacts in each user profile he visits
        */
        const originalContacts: Contact[] = response.data.filter(
          (contact: Contact) => contact.added > contact.removed,
        );
        for (const contact of originalContacts) {
          contact.display = "";
          axios(
            configApiCall(
              api_path_get_ns_name_from_addr + contact.uri,
              "GET",
              null,
              null,
            ),
          )
            .then((response) => {
              contact.username = response.data.name;
              axios(
                configApiCall(
                  api_path_get_user_profile + contact.username,
                  "GET",
                  null,
                  null,
                ),
              )
                .then((response) => {
                  contact.profilePicture = response.data.profilePicture;
                  contact.firstName = response.data.firstName;
                  contact.lastName = response.data.lastName;
                  contact.organization = response.data.organization;
                })
                .catch(() => {
                  // If this point is reached, it means we have a contact that no longer has a profile
                  // This can happen if the user is removed from the LDAP/AD server
                  originalContacts.splice(originalContacts.indexOf(contact), 1);
                });
            })
            .catch(() => {
              // If this point is reached, it means we have a contact that is no longer part of the name server
              originalContacts.splice(originalContacts.indexOf(contact), 1);
            });
        }
        setContacts(originalContacts);
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else {
          console.error("Error during API request on getAllContacts: " + error);
        }
      });
  };

  const addContactToUser = (contact: UserProfile) => {
    const data: ServerContact = {
      owner: props.username,
      uri: contact.id,
      displayName: `${contact.firstName} ${contact.lastName}`,
      added: 0,
      removed: 0,
      banned: false,
      confirmed: false,
      conversationId: "",
    };
    if (auth.hasAdminScope()) {
      axios(
        configApiCall(
          api_path_get_admin_contacts + "?username=" + props.username,
          "PUT",
          data,
          null,
        ),
      )
        .then(() => {
          getAllContacts();
          setOpenDrawer(false);
        })
        .catch((error) => {
          console.log("Error adding user: " + error);
          setOpenDrawer(false);
        });
    } else {
      axios(configApiCall(api_path_get_auth_contacts, "PUT", data, null))
        .then(() => {
          getAllContacts();
          setOpenDrawer(false);
        })
        .catch((error) => {
          console.log("Error adding user: " + error);
          setOpenDrawer(false);
        });
    }
  };

  useEffect(() => {
    setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 0;
        }
        const diff = Math.random() * 10;
        return Math.min(oldProgress + diff, 100);
      });
    }, 500);
    getAllContacts();
    searchContacts();
    return;
  }, [openDrawer]);

  const removeContact = () => {
    if (auth.hasAdminScope()) {
      axios(
        configApiCall(
          api_path_delete_admin_contacts +
            "?username=" +
            props.username +
            "&uri=" +
            removedContact.replace("jami://", ""),
          "DELETE",
          null,
          null,
        ),
      )
        .then(() => {
          setOpen(false);
          getAllContacts();
        })
        .catch((error) => {
          alert("Uri: " + removedContactName + " was not removed " + error);
        });
    } else {
      axios(
        configApiCall(
          api_path_delete_auth_contacts +
            "?uri=" +
            removedContact.replace("jami://", ""),
          "DELETE",
          null,
          null,
        ),
      )
        .then(() => {
          setOpen(false);
          getAllContacts();
        })
        .catch((error) => {
          alert("Uri: " + removedContactName + " was not removed " + error);
        });
    }
  };

  const handleRemoveContact = (uri: string, name: string) => {
    setRemovedContact(uri);
    setRemovedContactName(name);
    setOpen(true);
  };

  return (
    <div>
      <TemporaryDrawer
        openDrawer={openDrawer}
        setOpenDrawer={setOpenDrawer}
        direction="right"
        placeholder={i18next.t("add_contact", "Add contact…") as string}
        searchTargets={searchContacts}
        targets={users}
        existingTargets={contacts}
        addElementToTarget={addContactToUser}
        type="user"
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {i18next.t("remove_contact", "Remove contact") as string}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {
              i18next.t(
                "do_you_want_to_remove_the_contact",
                "Do you want to remove the contact?",
              ) as string
            }
            <strong>{" " + removedContactName + " "}</strong>
            {i18next.t("from", "from") as string}
            {" " + props.username + " "}
            {i18next.t("contacts", "contacts") as string}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="primary">
            {i18next.t("cancel", "Cancel") as string}
          </Button>
          <Button onClick={removeContact} color="info" autoFocus>
            {i18next.t("remove", "Remove") as string}
          </Button>
        </DialogActions>
      </Dialog>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <div className={classes.actionButtons}>
            {allowedToAdd && (
              <Button
                variant="contained"
                color="primary"
                href="#contained-buttons"
                onClick={() => {
                  setOpenDrawer(true);
                }}
              >
                <AddCircleOutlinedIcon />{" "}
                {i18next.t("add_a_contact", "Add contact") as string}
              </Button>
            )}
          </div>
          <div className={classes.searchWrapper}>
            <CustomInput
              formControlProps={{
                className: classes.margin + " " + classes.search,
              }}
              inputProps={{
                placeholder: i18next.t("search_contacts", "Search contacts"),
                inputProps: {
                  "aria-label": i18next.t(
                    "search_contacts",
                    "Search contacts",
                  ) as string,
                },
                onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
                  setSearchValue((e.target as HTMLInputElement).value),
              }}
            />
            <Search />
          </div>
        </GridItem>
        {contacts
          .filter((data: Contact) => {
            if (searchValue.length === 0) {
              return true;
            } else {
              if (
                typeof data.username !== "undefined" &&
                typeof data.firstName !== "undefined" &&
                typeof data.lastName !== "undefined" &&
                typeof data.uri !== "undefined"
              ) {
                return (
                  data.username
                    .toLowerCase()
                    .includes(searchValue.toLowerCase()) ||
                  data.firstName
                    .toLowerCase()
                    .includes(searchValue.toLowerCase()) ||
                  data.lastName
                    .toLowerCase()
                    .includes(searchValue.toLowerCase()) ||
                  data.uri.toLowerCase() === searchValue.toLowerCase()
                );
              } else {
                return false;
              }
            }
          })
          .map((contact) => (
            <GridItem
              xs={12}
              sm={6}
              md={3}
              lg={2}
              xl={2}
              key={contact.uri}
              style={{ display: contact.display }}
            >
              {contact.username && (
                <Card profile>
                  <CardBody profile className={classes.cardBody}>
                    <CardAvatar profile>
                      <img
                        src={
                          contact.profilePicture
                            ? "data:image/png;base64, " + contact.profilePicture
                            : noProfilePicture
                        }
                        alt="..."
                      />
                    </CardAvatar>
                    <a
                      className={classes.link}
                      href={`/user/${contact.username}`}
                    >
                      <IconButton color="primary" size="medium">
                        <LaunchIcon
                          fontSize="small"
                          style={{
                            color: "black",
                          }}
                        ></LaunchIcon>
                      </IconButton>
                    </a>
                    <h4 className={classes.cardTitle}>
                      {(contact.firstName || contact.lastName) &&
                        `${contact.firstName} ${contact.lastName}`}
                    </h4>
                    <ul className={classes.cardBodyContent}>
                      <li style={{ display: "block" }}>
                        {contact.username && (
                          <img
                            src={jami}
                            width="20"
                            alt="Jami"
                            style={{ marginRight: "10px" }}
                          />
                        )}
                        {contact.username && ` ${contact.username}`}
                      </li>
                      <li style={{ display: "block" }}>
                        {contact.organization && (
                          <BusinessCenterOutlined
                            fontSize="small"
                            style={{ marginRight: "10px" }}
                          />
                        )}
                        {contact.organization && ` ${contact.organization}`}
                      </li>
                      <li style={{ display: "block" }}>
                        {contact.conversationId === null ? (
                          <SmsFailedIcon
                            fontSize="small"
                            style={{ marginRight: "10px" }}
                          ></SmsFailedIcon>
                        ) : (
                          <QuestionAnswerOutlined
                            fontSize="small"
                            style={{ marginRight: "10px" }}
                          />
                        )}
                        {contact.conversationId === "null"
                          ? "No conversation id"
                          : `Conversation id: ${contact.conversationId}`}
                      </li>
                    </ul>
                  </CardBody>
                  <CardFooter>
                    <IconButton
                      color="primary"
                      onClick={() => {
                        handleRemoveContact(contact.uri, contact.username);
                      }}
                      size="medium"
                    >
                      <DeleteOutlinedIcon />
                    </IconButton>
                  </CardFooter>
                </Card>
              )}
            </GridItem>
          ))}
        {contacts.length === 0 && (
          <div className={classes.contactsNotFound}>
            <InfoOutlined />

            <p style={{ marginLeft: "10px" }}>
              {
                (props.username +
                  i18next.t("has_no_contacts", " has no contacts")) as string
              }
            </p>
          </div>
        )}
      </GridContainer>
    </div>
  );
}
