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
import {
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
} from "@mui/material";

import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import PhoneForwardedOutlinedIcon from "@mui/icons-material/PhoneForwardedOutlined";

import { UserProfile } from "./DisplayUserProfile";
import { PersonOutlineOutlined } from "@mui/icons-material";

interface UserProfileFieldsListProps {
  user: UserProfile;
}

const UserProfileFieldsList: FC<UserProfileFieldsListProps> = ({ user }) => {
  return (
    <Grid size={12}>
      <List dense={false}>
        {(user.firstName || user.lastName) && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PersonOutlineOutlined />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={`${user.firstName} ${user.lastName}`} />
          </ListItem>
        )}
        {user.phoneNumber && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PhoneInTalkOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.phoneNumber} />
          </ListItem>
        )}
        {user.organization && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <BusinessCenterOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.organization} />
          </ListItem>
        )}
      </List>

      <List dense={false}>
        {user.email && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <AlternateEmailOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.email} />
          </ListItem>
        )}
        {user.phoneNumberExtension && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <PhoneForwardedOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.phoneNumberExtension} />
          </ListItem>
        )}
        {user.mobileNumber && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <SmartphoneOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.mobileNumber} />
          </ListItem>
        )}
        {user.faxNumber && (
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <LocalPrintshopOutlinedIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={user.faxNumber} />
          </ListItem>
        )}
      </List>
    </Grid>
  );
};

export default UserProfileFieldsList;
