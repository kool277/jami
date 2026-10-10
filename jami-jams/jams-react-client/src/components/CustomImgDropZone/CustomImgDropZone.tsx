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

import { FC, MouseEventHandler } from "react";
import { makeStyles } from "@mui/styles";
import Dropzone, { Accept } from "react-dropzone";
import UploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";

const useStyles = makeStyles({
  dropzoneStyle: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "#0000001A 0% 0% no-repeat padding-box",
    borderRadius: "5px",
    opacity: "1",
    outline: "none",
    transition: "border .24s ease-in-out",
    cursor: "pointer",
    border: "none",
    height: "10px",
    width: "max-content",
  },
  uploadIconStyle: {
    fontSize: "35px",
    marginBottom: "10px",
    marginRight: "10px",
  },
  deleteButton: {
    backgroundColor: "transparent",
    border: "none",
  },
});

interface CustomImgDropZoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Accept;
  maxFiles?: number;
  label: string;
  file: string | undefined;
  handleDelete: MouseEventHandler<HTMLButtonElement>;
}

const CustomImgDropZone: FC<CustomImgDropZoneProps> = ({
  onDrop,
  accept = { "image/*": [".png", ".jpeg", ".jpg", ".svg"] },
  maxFiles = 1,
  label,
  file,
  handleDelete,
  ...rest
}) => {
  const classes = useStyles();

  const handleDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onDrop(acceptedFiles);
    }
  };

  return (
    <Dropzone onDrop={handleDrop} accept={accept} maxFiles={maxFiles} {...rest}>
      {({ getRootProps, getInputProps }) => (
        <div {...getRootProps()} className={classes.dropzoneStyle}>
          <input {...getInputProps()} />
          <UploadIcon className={classes.uploadIconStyle} />
          {file ? (
            <>
              <span>{file}</span>
              <button onClick={handleDelete} className={classes.deleteButton}>
                <CloseIcon style={{ color: "red" }} />
              </button>
            </>
          ) : (
            <span>{label}</span>
          )}
        </div>
      )}
    </Dropzone>
  );
};

export default CustomImgDropZone;
