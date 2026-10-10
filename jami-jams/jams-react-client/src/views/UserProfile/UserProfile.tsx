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
// core components
import Devices from "components/Devices/Devices";

import PropTypes from "prop-types";
import AppBar from "@mui/material/AppBar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import EditCreateUserProfile from "./EditCreateUserProfile";

import Contacts from "views/Contacts/Contacts";

import DisplayUserProfile from "./DisplayUserProfile";

import i18next from "i18next";

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(value: number, index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
    style: { color: index === value ? "inherit" : "#ffffff80" },
  };
}

interface UserProfileProps {
  username: string;
}

export default function UserProfile(props: UserProfileProps) {
  const navigate = useNavigate();

  const [value, setValue] = useState<number>(0);
  const [displayUser, setDisplayUser] = useState(true);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  useEffect(() => {
    if (props.username === "null") {
      navigate("/");
    }
  }, [navigate, props.username]);

  return (
    <div>
      <AppBar position="static" color="primary">
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="user profile tabs"
          textColor="secondary"
          indicatorColor="secondary"
        >
          <Tab
            label={i18next.t("profile", "Profile") as string}
            {...a11yProps(value, 0)}
          />
          <Tab
            label={i18next.t("devices", "Devices") as string}
            {...a11yProps(value, 1)}
          />
          <Tab
            label={i18next.t("contacts", "contacts") as string}
            {...a11yProps(value, 2)}
          />
        </Tabs>
      </AppBar>
      <TabPanel value={value} index={0}>
        {displayUser ? (
          <DisplayUserProfile
            username={props.username}
            setDisplayUser={setDisplayUser}
          />
        ) : (
          <EditCreateUserProfile
            username={props.username}
            createUser={false}
            setDisplayUser={setDisplayUser}
          />
        )}
      </TabPanel>
      <TabPanel value={value} index={1}>
        <Devices username={props.username} />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Contacts username={props.username} setValue={setValue} />
      </TabPanel>
    </div>
  );
}
