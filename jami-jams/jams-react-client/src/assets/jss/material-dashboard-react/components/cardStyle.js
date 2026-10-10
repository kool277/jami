import {
  blackColor,
  whiteColor,
  hexToRgb,
} from "assets/jss/material-dashboard-react.js";

const cardStyle = {
  card: {
    border: "0",
    marginBottom: "30px",
    marginTop: "30px",
    borderRadius: "6px",
    color: "rgba(" + hexToRgb(blackColor) + ", 0.87)",
    background: whiteColor,
    width: "100%",
    boxShadow: "0 1px 4px 0 rgba(" + hexToRgb(blackColor) + ", 0.14)",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: "0",
    wordWrap: "break-word",
    fontSize: ".875rem",
    justifyContent: "space-between",
    "& ul": {
      "list-style": "none",
      padding: 0,
      "& li": {
        display: "flex",
        alignItems: "center",
      },
    },
    "&:hover": {
      boxShadow: "0 1px 4px 0 rgba(" + hexToRgb(blackColor) + ", 0.54)",
    },
    "& a": {
      color: blackColor,
    },
  },
  cardPlain: {
    background: "transparent",
    boxShadow: "none",
  },
  cardProfile: {
    marginTop: "50px",
    textAlign: "left",
    height: "calc(100% - 4em)",
  },
  cardChart: {
    "& p": {
      marginTop: "0px",
      paddingTop: "0px",
    },
  },
};

export default cardStyle;
