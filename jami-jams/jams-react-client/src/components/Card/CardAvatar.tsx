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
import classNames from "classnames";
// nodejs library to set properties for components
import PropTypes from "prop-types";
// @mui/material components
import { makeStyles } from "@mui/styles";
// @mui/icons-material
// core components

import styles from "assets/jss/material-dashboard-react/components/cardAvatarStyle";

const useStyles = makeStyles(styles as any);

interface CardAvatarProps {
  children: React.ReactNode;
  className?: string;
  plain?: boolean;
  profile?: boolean;
  displayProfile?: boolean;
  editProfile?: boolean;
}

export default function CardAvatar(props: CardAvatarProps) {
  const classes = useStyles();
  const {
    children,
    className,
    plain,
    profile,
    displayProfile,
    editProfile,
    ...rest
  } = props;
  const cardAvatarClasses = classNames({
    [classes.cardAvatar]: true,
    [classes.cardAvatarProfile]: profile,
    [classes.cardAvatarDisplayProfile]: displayProfile,
    [classes.cardAvatarEditProfile]: editProfile,
    [classes.cardAvatarPlain]: plain,
    ...(className ? { [className]: true } : {}),
  });
  return (
    <div className={cardAvatarClasses} {...rest}>
      {children}
    </div>
  );
}

CardAvatar.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  profile: PropTypes.bool,
  displayProfile: PropTypes.bool,
  editProfile: PropTypes.bool,
  plain: PropTypes.bool,
};
