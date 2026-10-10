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
import { makeStyles } from "@mui/styles";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";

const styles = {
  root: {
    position: "relative",
  },
  colorButtonStyle: {
    borderRadius: "50%",
    width: "20px",
    height: "20px",
    border: "1px solid grey",
    outline: "none",
    cursor: "pointer",
  },
  popover: {
    position: "absolute",
    left: "60px",
    bottom: 0,
    zIndex: "2",
  },
  cover: {
    position: "fixed",
    top: "0px",
    right: "0px",
    bottom: "0px",
    left: "0px",
    backgroundColor: "#00000040",
  },
};

const useStyles = makeStyles(styles as any);

interface ColorPickerPopupProps {
  hasAlphaChannel?: boolean;
  color: string;
  onChange: (color: string) => void;
}

const ColorPickerPopup: FC<ColorPickerPopupProps> = ({
  hasAlphaChannel,
  color,
  onChange,
}) => {
  const classes = useStyles();

  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const handleClickColor = () => {
    setDisplayColorPicker(!displayColorPicker);
  };

  const handleCloseColor = () => {
    setDisplayColorPicker(false);
  };

  return (
    <div className={classes.root}>
      <button
        style={{
          backgroundColor: color,
        }}
        className={classes.colorButtonStyle}
        onClick={() => {
          handleClickColor();
        }}
      />
      {displayColorPicker && (
        <div className={classes.popover}>
          <div className={classes.cover} onClick={handleCloseColor} />
          {hasAlphaChannel ? (
            <HexAlphaColorPicker color={color} onChange={onChange} />
          ) : (
            <HexColorPicker color={color} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
};

export default ColorPickerPopup;
