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
  ChangeEvent,
  KeyboardEvent,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
// @mui/material components
import { makeStyles } from "@mui/styles";
import { Pagination } from "@mui/material";
// core components
import GridItem from "components/Grid/GridItem";
import GridContainer from "components/Grid/GridContainer";
import CustomInput from "components/CustomInput/CustomInput";
import Button from "components/CustomButtons/Button";
import Card from "components/Card/Card";

import CardAvatar from "components/Card/CardAvatar";
import CardBody from "components/Card/CardBody";

import Search from "@mui/icons-material/Search";
import { Checkbox, FormControlLabel, Chip } from "@mui/material";
import axios from "axios";
import configApiCall from "api";
import auth from "auth";
import { api_path_get_user_directory_search } from "globalUrls";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import jami from "assets/img/faces/jami.png";
import noProfilePicture from "assets/img/faces/no-profile-picture.png";
import headerLinksStyle from "assets/jss/material-dashboard-react/components/headerLinksStyle";
import { debounce } from "lodash";

import i18next from "i18next";
import { UserProfile } from "views/UserProfile/DisplayUserProfile";
import { BusinessCenterOutlined, InfoOutlined } from "@mui/icons-material";

const styles = {
  ...headerLinksStyle,
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
  usersNotFound: {
    marginLeft: "10px",
    display: "flex",
    alignItems: "center",
  },
  cardBodyContent: {
    wordWrap: "break-word",
    fontSize: "12px",
  },
  link: {
    "&:hover": {
      color: "unset",
    },
  },
};
const useStyles = makeStyles(styles as any);
const label = i18next.t("revoked", "Revoked") as string;
export default function Users() {
  const classes = useStyles();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [noUsersFound, setNoUsersFound] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [hideRevokedUsers, setHideRevokedUsers] = useState(true);

  const [searchValue, setSearchValue] = useState("");

  const [selectedPage, setSelectedPage] = useState(1);

  const [numberPages, setNumberPages] = useState(1);
  useEffect(() => {
    axios(
      configApiCall(
        api_path_get_user_directory_search,
        "GET",
        { queryString: "*", page: "1" },
        null,
      ),
    )
      .then((response) => {
        setUsers(response.data.profiles);
        setNumberPages(response.data.numPages);
        if (response.data.profiles.length === 0) {
          setNoUsersFound(true);
        } else {
          setNoUsersFound(false);
        }
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else {
          console.error("Error getting users: " + error);
        }
      });
  }, [navigate]);

  const searchUsers = (value: string, page = 1) => {
    setSelectedPage(page);
    axios(
      configApiCall(
        api_path_get_user_directory_search,
        "GET",
        { queryString: value ? value : "*", page: page },
        null,
      ),
    )
      .then((response) => {
        setUsers(response.data.profiles);
        setNumberPages(response.data.numPages);
        setNoMatchFound(response.data.profiles.length === 0);
        setNoUsersFound(false);
        if (value.length === 0) {
          setNoMatchFound(false);
          // This is the case were the search value is empty but there is still no users found
          if (response.data.profiles.length === 0) {
            setNoUsersFound(true);
          }
        }
      })
      .catch((error) => {
        setUsers([]);
        if (error.response && error.response.status === 401) {
          auth.authenticated = false;
          navigate("/signin");
        } else {
          console.error("Error getting users: " + error);
        }
      });
  };
  const initSearchUsers = useCallback(
    debounce((value) => searchUsers(value), 500),
    [],
  );
  const handleSearchUsers = (e: KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setSearchValue(target.value);
    initSearchUsers(target.value);
  };

  const handleChangePage = (e: ChangeEvent<unknown>, page: number) => {
    searchUsers(searchValue, page);
  };
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          {auth.isLocalDirectory() && auth.hasAdminScope() && (
            <Link to={"/createuser"} className={classes.link}>
              <Button variant="contained" color="primary">
                <AddCircleOutlinedIcon />{" "}
                {i18next.t("create_user", "Create user") as string}
              </Button>
            </Link>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={hideRevokedUsers}
                onChange={() => setHideRevokedUsers(!hideRevokedUsers)}
                slotProps={{ input: { "aria-label": "primary checkbox" } }}
                color="primary"
              />
            }
            style={
              auth.isLocalDirectory() && auth.hasAdminScope()
                ? { marginLeft: "1rem" }
                : { marginLeft: "-8px" }
            }
            label={
              i18next.t("hide_revoked_users", "Hide revoked users") as string
            }
          />

          <GridContainer>
            <GridItem xs={12} sm={12} md={6}>
              <CustomInput
                formControlProps={{
                  className: classes.margin + " " + classes.search,
                }}
                inputProps={{
                  placeholder: i18next.t("search_users", "Search users"),
                  inputProps: {
                    "aria-label": i18next.t(
                      "search_users",
                      "Search users",
                    ) as string,
                  },
                  onKeyUp: handleSearchUsers,
                }}
              />
              <Search />
            </GridItem>
            <GridItem xs={12} sm={12} md={6}>
              {numberPages > 1 && !noMatchFound && (
                <Pagination
                  count={numberPages}
                  page={selectedPage}
                  onChange={handleChangePage}
                />
              )}
            </GridItem>
          </GridContainer>

          {noUsersFound && (
            <div className={classes.usersNotFound}>
              <InfoOutlined />

              <p style={{ marginLeft: "10px" }}>
                {i18next.t("no_users_found", "No users found") as string}
              </p>
            </div>
          )}
        </GridItem>
        {!noMatchFound &&
          users
            .sort(function (a, b) {
              if (a.username < b.username) {
                return -1;
              }
              if (a.username > b.username) {
                return 1;
              }
              return 0;
            })
            .filter((user) => !hideRevokedUsers || !user.revoked)
            .map((user) => (
              <GridItem xs={12} sm={6} md={3} lg={2} xl={2} key={user.username}>
                <Card profile>
                  <Link
                    to={`/user/${user.username}`}
                    style={{ height: "100%" }}
                  >
                    <CardBody profile>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <CardAvatar profile>
                          <img
                            src={
                              user.profilePicture
                                ? "data:image/png;base64, " +
                                  user.profilePicture
                                : noProfilePicture
                            }
                            alt="..."
                          />
                        </CardAvatar>
                        {user.revoked && (
                          <Chip
                            label={i18next.t("revoked", "Revoked") as string}
                            variant="filled"
                            clickable={false}
                          />
                        )}
                      </div>
                      <GridContainer
                        container
                        sx={{
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          alignItems: "flex-start",
                        }}
                      >
                        <GridItem style={{ minHeight: "50px" }}>
                          <h4 className={classes.cardTitle}>
                            {`${user.firstName ?? ""} ${user.lastName ?? ""}`}
                          </h4>
                        </GridItem>
                        <GridItem>
                          <ul className={classes.cardBodyContent}>
                            <li>
                              <img
                                src={jami}
                                width="20px"
                                alt="Jami"
                                style={{
                                  minWidth: "20px",
                                  marginRight: "10px",
                                }}
                              />{" "}
                              {user.username}
                            </li>
                            <li>
                              {user.organization && (
                                <BusinessCenterOutlined
                                  fontSize="small"
                                  style={{ marginRight: "10px" }}
                                />
                              )}{" "}
                              {user.organization}
                            </li>
                          </ul>
                        </GridItem>
                      </GridContainer>
                    </CardBody>
                  </Link>
                </Card>
              </GridItem>
            ))}
        {noMatchFound && (
          <div className={classes.usersNotFound}>
            <InfoOutlined />

            <p style={{ marginLeft: "10px" }}>
              {
                i18next.t(
                  "no_users_found_matching",
                  "No users found matching search value!",
                ) as string
              }
            </p>
          </div>
        )}
      </GridContainer>
    </div>
  );
}
