import {
  defaultFont,
  container,
  primaryColor,
  grayColor,
} from "assets/jss/material-dashboard-react.js";

const footerStyle = {
  block: {
    color: "inherit",
    padding: "15px",
    textTransform: "uppercase",
    borderRadius: "3px",
    textDecoration: "none",
    position: "relative",
    display: "block",
    ...defaultFont,
    fontWeight: "500",
    fontSize: "12px",
  },
  left: {
    float: "left!important",
    display: "block",
  },
  right: {
    paddingTop: "10px",
    margin: "0",
    fontSize: "12px",
    float: "right!important",
  },
  footer: {
    bottom: "0",
    borderTop: "1px solid " + grayColor[11],
    padding: "10px 0",
    ...defaultFont,
  },
  container,
  a: {
    color: primaryColor,
    textDecoration: "none",
    backgroundColor: "transparent",
  },
  list: {
    marginBottom: "0",
    padding: "0",
    marginTop: "0",
  },
  inlineBlock: {
    display: "inline-block",
    padding: "0px",
    width: "auto",
  },
};
export default footerStyle;
