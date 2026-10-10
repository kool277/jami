import { hexToRgb, blackColor } from "assets/jss/material-dashboard-react.js";

const cardAvatarStyle = {
  cardAvatar: {
    "&$cardAvatarProfile img": {
      width: "100%",
      height: "auto",
    },
  },
  cardAvatarProfile: {
    maxWidth: "80px",
    maxHeight: "80px",
    margin: "-50px 0 0",
    borderRadius: "50%",
    overflow: "hidden",
    padding: "0",
    boxShadow:
      "0 6px 8px -12px rgba(" +
      hexToRgb(blackColor) +
      ", 0.56), 0 4px 25px 0px rgba(" +
      hexToRgb(blackColor) +
      ", 0.12), 0 8px 10px -5px rgba(" +
      hexToRgb(blackColor) +
      ", 0.2)",
    "&$cardAvatarPlain": {
      marginTop: "0",
    },
  },
  cardAvatarDisplayProfile: {
    margin: "-50px 10px 0",
  },
  cardAvatarEditProfile: {
    margin: "-50px 10px 0",
  },
  cardAvatarPlain: {},
};

export default cardAvatarStyle;
