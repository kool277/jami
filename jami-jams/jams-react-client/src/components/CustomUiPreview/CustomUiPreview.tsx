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

import { makeStyles } from "@mui/styles";

import backgroundImage from "assets/img/BG-ID_Jami.png";
import logoImage from "assets/img/favicon_jami.png";

import { TipBox } from "./TipBox";
import { JamiIdCard } from "./JamiIdCard";
import i18next from "i18next";
import { url_path, url_port } from "../../globalUrls";
import { luma } from "./luma";
import { UiCustomization } from "views/Blueprint/policyData.constants";

const styles = {
  root: {
    height: "350px",
    position: (props: CustomUiPreviewProps) =>
      props.isOldPreview ? "relative" : "absolute",
    left: 0,
    right: 0,
    margin: (props: CustomUiPreviewProps) =>
      props.isOldPreview ? "0 0" : "0 20px",
    transition: (props: CustomUiPreviewProps) =>
      props.isOldPreview ? "none" : "opacity 0.25s",
    opacity: (props: CustomUiPreviewProps) => props.opacity,
    zIndex: (props: CustomUiPreviewProps) => (props.isOldPreview ? "1" : "2"),
  },
  previewWindow: {
    left: "50%",
    top: "50%",
    width: "100%",
    height: "350px",

    borderRadius: "5px",
    backgroundColor: "white",
    boxShadow: "0px 3px 6px #0000005C",
  },
  welcomeScreen: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    height: "100%",
    borderRadius: "0px 5px 5px 0px",

    backgroundColor: (props: UiCustomization) => props.backgroundColor,
    backgroundImage: (props: UiCustomization) => `url(${props.backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  mainContent: {
    display: "flex",
    flexDirection: "column",
    // height: "100px",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  logo: {
    height: "40px",
    objectFit: "contain",
    scale: (props: UiCustomization) => props.logoSize / 100,
  },
  welcomeCard: {
    display: "flex",
    flexDirection: "column",
    // justifyContent: "center",
    alignItems: "center",
    borderRadius: "3px",
    backgroundColor: (props: UiCustomization) => props.mainBoxColor,
    padding: "10px",
    width: "50%",
    color: (props: UiCustomization) =>
      luma(props.mainBoxColor) ? "#ffffff" : "#000000",
  },
  title: {
    margin: 0,
    fontWeight: 500,
    fontSize: "10px",
  },
  description: {
    fontSize: "8px",
    textAlign: "center",
  },
  tipRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "0.5rem",
  },
};

const useStyles = makeStyles(styles as any);

interface CustomUiPreviewProps {
  isOldPreview?: boolean;
  opacity: number;
  uiCustomization: UiCustomization;
}

export const CustomUiPreview: FC<CustomUiPreviewProps> = ({
  isOldPreview,
  opacity,
  uiCustomization,
}) => {
  const {
    hasTitle,
    hasDescription,
    hasTips,
    hasBackground,
    tipBoxAndIdColor,
    hasMainBoxColor,
    hasLogo,
    logoSize,
  } = uiCustomization;
  let {
    title,
    description,
    backgroundColor,
    backgroundUrl,
    mainBoxColor,
    logoUrl,
  } = uiCustomization;

  if (!title) {
    title = i18next.t("welcome_title", "Welcome to Jami") as string;
  }
  if (!description) {
    description = i18next.t(
      "welcome_Description",
      "Here is your Jami identifier, don't hesitate to share it in order to be contacted more easily!",
    );
  }
  if (logoUrl) {
    logoUrl = `${url_path}:${url_port}/${logoUrl}`;
  } else {
    logoUrl = logoImage;
  }

  if (hasBackground === false) {
    backgroundColor = "";
    backgroundUrl = backgroundImage;
  } else if (backgroundUrl) {
    backgroundUrl = encodeURI(`${url_path}:${url_port}${backgroundUrl}`);
  }

  if (!hasMainBoxColor) {
    mainBoxColor = "";
  }

  const isCompactDisplay = !hasTitle && !hasDescription && !hasTips;

  const classes = useStyles({
    isOldPreview,
    opacity,
    backgroundColor,
    backgroundUrl,
    mainBoxColor,
    logoSize,
  });

  const tip1 = i18next.t(
    "preview_tip1",
    "Add a picture and a nickname to complete your profile",
  );
  const tip2 = i18next.t(
    "preview_tip2",
    "Why should I save my account?",
  ) as string;
  const tip3 = i18next.t("preview_tip3", "How to set shortcuts?") as string;

  return (
    <div className={classes.root}>
      <div className={classes.previewWindow}>
        <div className={classes.welcomeScreen}>
          <div className={classes.mainContent}>
            {hasLogo ? (
              <img src={logoUrl} alt="logo" className={classes.logo}></img>
            ) : null}
            <div className={classes.welcomeCard}>
              {hasTitle ? <h4 className={classes.title}>{title}</h4> : null}
              {hasDescription ? (
                <p className={classes.description}>{description}</p>
              ) : null}
              <JamiIdCard
                isCompactDisplay={isCompactDisplay}
                color={tipBoxAndIdColor}
              />
            </div>
          </div>
          {hasTips ? (
            <div className={classes.tipRow}>
              <TipBox text={tip1} color={tipBoxAndIdColor} />
              <TipBox text={tip2} color={tipBoxAndIdColor} />
              <TipBox text={tip3} color={tipBoxAndIdColor} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
