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

import { FC, useState } from "react";
import * as React from "react";

import AppBar from "@mui/material/AppBar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import EditBlueprintPermissions from "./EditBlueprintPermissions";
import EditBlueprintConfiguration from "./EditBlueprintConfiguration";
import EditBlueprintUi from "./EditBlueprintUi";
import { PolicyDataContextProvider } from "./PolicyDataContext";

import i18next from "i18next";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: FC<TabPanelProps> = ({ children, value, index, ...other }) => {
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
};

const a11yProps = (value: number, index: number) => {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
    style: { color: index === value ? "inherit" : "#ffffff80" },
  };
};

interface BlueprintProps {
  blueprintName: string;
}

export const Blueprint: FC<BlueprintProps> = ({ blueprintName }) => {
  const [openedTab, setOpenedTab] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setOpenedTab(newValue);
  };

  return (
    <div>
      <AppBar position="static" color="primary">
        <Tabs
          value={openedTab}
          onChange={handleChange}
          aria-label="blueprint tabs"
          textColor="secondary"
          indicatorColor="secondary"
        >
          <Tab
            label={i18next.t("permissions", "Permissions") as string}
            {...a11yProps(openedTab, 0)}
          />
          <Tab
            label={i18next.t("configuration", "Configuration") as string}
            {...a11yProps(openedTab, 1)}
          />
          <Tab
            label={i18next.t("customization", "Customization") as string}
            {...a11yProps(openedTab, 2)}
          />
        </Tabs>
      </AppBar>

      <PolicyDataContextProvider blueprintName={blueprintName}>
        <TabPanel value={openedTab} index={0}>
          <EditBlueprintPermissions blueprintName={blueprintName} />
        </TabPanel>
        <TabPanel value={openedTab} index={1}>
          <EditBlueprintConfiguration blueprintName={blueprintName} />
        </TabPanel>
        <TabPanel value={openedTab} index={2}>
          <EditBlueprintUi blueprintName={blueprintName} />
        </TabPanel>
      </PolicyDataContextProvider>
    </div>
  );
};
