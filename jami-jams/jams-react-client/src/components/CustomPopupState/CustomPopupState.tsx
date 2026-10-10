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

import Popover from "@mui/material/Popover";
import PopupState, { bindTrigger, bindPopover } from "material-ui-popup-state";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { InfoOutlined } from "@mui/icons-material";

interface CustomPopupStateProps {
  message: string;
}

export default function CustomPopupState(props: CustomPopupStateProps) {
  return (
    <IconButton size="large">
      <PopupState variant="popover" popupId="demo-popup-popover">
        {(popupState) => (
          <div>
            <InfoOutlined
              color="disabled"
              fontSize="small"
              {...bindTrigger(popupState)}
            />
            <Popover
              {...bindPopover(popupState)}
              anchorOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              transformOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
            >
              <Box sx={{ p: 1 }}>
                <Typography>{props.message}</Typography>
              </Box>
            </Popover>
          </div>
        )}
      </PopupState>
    </IconButton>
  );
}
