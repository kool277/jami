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

import React from "react";
import Checkbox from "@mui/material/Checkbox";
import Switch from "@mui/material/Switch";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Box, Button, Divider, Slider, TextField } from "@mui/material";

import Typography from "@mui/material/Typography";
import CustomImgDropZone from "components/CustomImgDropZone/CustomImgDropZone";

import i18next from "i18next";
import ColorPickerPopup from "./ColorPickerPopup";
import {
  DEFAULT_UI_CUSTOMIZATION,
  UiCustomization,
} from "./policyData.constants";

/* eslint-disable no-unused-vars */
interface IsCustomizationEnabledFormProps {
  isCustomizationEnabled: boolean;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const IsCustomizationEnabledForm: React.FC<IsCustomizationEnabledFormProps> = ({
  isCustomizationEnabled,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={isCustomizationEnabled}
            color="primary"
            onChange={(e) => {
              handleUpdateUi("isCustomizationEnabled", e.target.checked);
            }}
            name="isCustomizationEnabled"
          />
        }
        label={
          i18next.t(
            "is_customization_enabled",
            "Enable customization",
          ) as string
        }
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface HasTitleFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const HasTitleForm: React.FC<HasTitleFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Checkbox
            checked={uiCustomization.hasTitle}
            color="primary"
            onChange={(e) => {
              handleUpdateUi("hasTitle", e.target.checked);
            }}
            name="hasTitle"
          />
        }
        label={i18next.t("welcome_has_title", "Title") as string}
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface TitleFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const TitleForm: React.FC<TitleFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  if (!uiCustomization.hasTitle) {
    return null;
  }

  return (
    <FormGroup row>
      <span>
        {
          i18next.t(
            "instruction_title",
            "Use Jami title or personalize it (max 40 characters)",
          ) as string
        }
      </span>
      <TextField
        id="title"
        placeholder={i18next.t("welcome_title", "Welcome to Jami") as string}
        value={uiCustomization.title}
        onChange={(e) => {
          handleUpdateUi("title", e.target.value);
        }}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 40 } }}
        variant="standard"
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface HasDescriptionFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const HasDescriptionForm: React.FC<HasDescriptionFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Checkbox
            checked={uiCustomization.hasDescription}
            color="primary"
            name="hasDescription"
            onChange={(e) => {
              handleUpdateUi("hasDescription", e.target.checked);
            }}
          />
        }
        label={i18next.t("welcome_has_description", "Description") as string}
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface DescriptionFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const DescriptionForm: React.FC<DescriptionFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      {uiCustomization.hasDescription && (
        <>
          <span>
            {
              i18next.t(
                "instruction_description",
                "Use Jami description or personalize it (max 100 characters)",
              ) as string
            }
          </span>
          <TextField
            id="description"
            placeholder={
              i18next.t(
                "welcome_Description",
                "Here is your Jami identifier, don't hesitate to share it in order to be contacted more easily!",
              ) as string
            }
            value={uiCustomization.description}
            onChange={(e) => {
              handleUpdateUi("description", e.target.value);
            }}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 100 } }}
            variant="standard"
          />
        </>
      )}
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface HasTipsFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const HasTipsForm: React.FC<HasTipsFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Checkbox
            checked={uiCustomization.hasTips}
            color="primary"
            onChange={(e) => {
              handleUpdateUi("hasTips", e.target.checked);
            }}
            name="hasTips"
          />
        }
        label={i18next.t("welcome_has_Tips", "Enable Tips display") as string}
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface HasBackgroundCustomFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const HasBackgroundCustomForm: React.FC<HasBackgroundCustomFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Checkbox
            checked={uiCustomization.hasBackground}
            color="primary"
            onChange={(e) => {
              handleUpdateUi("hasBackground", e.target.checked);
            }}
            name="hasBackground"
          />
        }
        label={
          i18next.t("welcome_has_BackgroundCustom", "Background") as string
        }
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface CustomBackgroundFormProps {
  uiCustomization: UiCustomization;
  handleColorChange: (color: string) => void;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
  handleImgDrop: (acceptedFiles: any[], imgType: string) => void;
  bgFile: string | undefined;
}
/* eslint-enable no-unused-vars */

const CustomBackgroundForm: React.FC<CustomBackgroundFormProps> = ({
  uiCustomization,
  handleColorChange,
  handleUpdateUi,
  handleImgDrop,
  bgFile,
}) => {
  return (
    <>
      <span>
        {
          i18next.t(
            "instruction_background",
            "Choose a background color or a background image",
          ) as string
        }
      </span>
      <FormGroup
        row
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "left",
          flexDirection: "row",
          padding: "10px 0",
        }}
      >
        <ColorPickerPopup
          color={uiCustomization.backgroundColor}
          onChange={(color) => {
            handleColorChange(color);
            handleUpdateUi("backgroundColor", color);
          }}
        />

        <div style={{ padding: "0 20px" }}>
          <Typography>{i18next.t("or", "or") as string}</Typography>
        </div>

        <div style={{ padding: "0 20px" }}>
          <CustomImgDropZone
            onDrop={(files) => {
              handleImgDrop(files, "background");
            }}
            label={i18next
              .t("upload_an_image", "Upload an image")
              .toUpperCase()}
            file={bgFile}
            handleDelete={(e) => {
              handleUpdateUi("backgroundUrl", "");
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        </div>
      </FormGroup>
    </>
  );
};

/* eslint-disable no-unused-vars */
interface TipBoxAndIdColorFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const TipBoxAndIdColorForm: React.FC<TipBoxAndIdColorFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <>
      <span>
        {i18next.t("tip_box_id_color", "Tip Box and Jami ID color") as string}
      </span>
      <ColorPickerPopup
        hasAlphaChannel
        color={uiCustomization.tipBoxAndIdColor}
        onChange={(color) => {
          handleUpdateUi("tipBoxAndIdColor", color);
        }}
      />
    </>
  );
};

/* eslint-disable no-unused-vars */
interface MainBoxColorFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const MainBoxColorForm: React.FC<MainBoxColorFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <>
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              checked={uiCustomization.hasMainBoxColor}
              color="primary"
              onChange={(e) => {
                handleUpdateUi("hasMainBoxColor", e.target.checked);
              }}
              name="hasMainBoxColor"
            />
          }
          label={
            i18next.t(
              "enable_main_box",
              "Add a box behind the title, description and Jami ID",
            ) as string
          }
        />
      </FormGroup>
      {uiCustomization.hasMainBoxColor && (
        <>
          <span>{i18next.t("main_box_color", "Box color") as string}</span>
          <ColorPickerPopup
            hasAlphaChannel
            color={uiCustomization.mainBoxColor}
            onChange={(color) => {
              handleUpdateUi("mainBoxColor", color);
            }}
          />
        </>
      )}
    </>
  );
};

/* eslint-disable no-unused-vars */
interface HasLogoFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const HasLogoForm: React.FC<HasLogoFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Checkbox
            checked={uiCustomization.hasLogo}
            color="primary"
            onChange={(e) => {
              handleUpdateUi("hasLogo", e.target.checked);
            }}
            name="hasLogo"
          />
        }
        label={i18next.t("welcome_has_Logo", "Logotype") as string}
      />
    </FormGroup>
  );
};

/* eslint-disable no-unused-vars */
interface LogoFormProps {
  handleImgDrop: (acceptedFiles: any[], imgType: string) => void;
  handleDeleteLogo: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => void;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
  logoFile: string | undefined;
}
/* eslint-enable no-unused-vars */

const LogoForm: React.FC<LogoFormProps> = ({
  handleImgDrop,
  handleDeleteLogo,
  handleUpdateUi,
  logoFile,
}) => {
  return (
    <>
      <span>
        {
          i18next.t(
            "instruction_logo",
            "Use Jami logotype or upload a logotype",
          ) as string
        }
      </span>

      <FormGroup row style={{ padding: "10px 0" }}>
        <CustomImgDropZone
          onDrop={(files) => handleImgDrop(files, "logo")}
          label={i18next
            .t("upload_a_logotype", "Upload a logotype")
            .toUpperCase()}
          file={logoFile}
          handleDelete={(e) => {
            handleDeleteLogo(e);
            handleUpdateUi("logoUrl", null);
          }}
        />
      </FormGroup>
    </>
  );
};

/* eslint-disable no-unused-vars */
interface LogoSizeFormProps {
  uiCustomization: UiCustomization;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
}
/* eslint-enable no-unused-vars */

const LogoSizeForm: React.FC<LogoSizeFormProps> = ({
  uiCustomization,
  handleUpdateUi,
}) => {
  return (
    <Box sx={{ width: "200px" }}>
      <span>{i18next.t("logo_size", "Size") as string}</span>
      <Slider
        size="small"
        min={10}
        max={100}
        valueLabelDisplay="auto"
        value={uiCustomization.logoSize}
        onChange={(e, value) => {
          handleUpdateUi("logoSize", value);
        }}
        sx={{ marginLeft: "1rem" }}
      />
    </Box>
  );
};

/* eslint-disable no-unused-vars */
interface EditBlueprintUiFormProps {
  uiCustomization: UiCustomization;
  setUiCustomization: (ui: UiCustomization) => void;
  handleUpdateUi: (field: string | UiCustomization, value?: any) => void;
  handleImgDrop: (acceptedFiles: any[], imgType: string) => void;
}
/* eslint-enable no-unused-vars */

const EditBlueprintUiForm: React.FC<EditBlueprintUiFormProps> = ({
  uiCustomization,
  setUiCustomization,
  handleUpdateUi,
  handleImgDrop,
}) => {
  const { isCustomizationEnabled } = uiCustomization;

  const bgFile = uiCustomization.backgroundUrl?.split("/").pop();
  const logoFile = uiCustomization.logoUrl?.split("/").pop();

  const handleDeleteLogo = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    setUiCustomization({
      ...uiCustomization,
      logoUrl: "",
    });
    e.stopPropagation();
  };

  const handleColorChange = (color: string) => {
    setUiCustomization({
      ...uiCustomization,
      backgroundColor: color,
      backgroundUrl: "",
    });
  };

  return (
    <>
      <IsCustomizationEnabledForm
        isCustomizationEnabled={isCustomizationEnabled}
        handleUpdateUi={handleUpdateUi}
      />

      {isCustomizationEnabled && (
        <>
          <HasTitleForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          <TitleForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          <HasDescriptionForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          <DescriptionForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          <HasTipsForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />

          <Divider style={{ margin: "10px 0" }} />

          <HasBackgroundCustomForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          {uiCustomization.hasBackground && (
            <CustomBackgroundForm
              uiCustomization={uiCustomization}
              handleColorChange={handleColorChange}
              handleUpdateUi={handleUpdateUi}
              handleImgDrop={handleImgDrop}
              bgFile={bgFile}
            />
          )}
          <TipBoxAndIdColorForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />

          <MainBoxColorForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />

          <Divider style={{ margin: "10px 0" }} />

          <HasLogoForm
            uiCustomization={uiCustomization}
            handleUpdateUi={handleUpdateUi}
          />
          {uiCustomization.hasLogo && (
            <>
              <LogoForm
                handleImgDrop={handleImgDrop}
                handleDeleteLogo={handleDeleteLogo}
                handleUpdateUi={handleUpdateUi}
                logoFile={logoFile}
              />
              <LogoSizeForm
                uiCustomization={uiCustomization}
                handleUpdateUi={handleUpdateUi}
              />
            </>
          )}

          <Button
            variant="outlined"
            onClick={() => {
              handleUpdateUi({
                ...DEFAULT_UI_CUSTOMIZATION,
                isCustomizationEnabled: true,
              });
            }}
          >
            {i18next.t("default_settings", "Default settings").toUpperCase()}
          </Button>
        </>
      )}
    </>
  );
};

export default EditBlueprintUiForm;
