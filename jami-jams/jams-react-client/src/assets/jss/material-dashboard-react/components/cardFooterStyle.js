import { grayColor } from "assets/jss/material-dashboard-react.js";

const cardFooterStyle = (theme) => ({
  cardFooter: {
    padding: "0",
    margin: "0 10px 10px 10px",
    borderRadius: "0",
    justifyContent: "end",
    // alignItems: "center",
    display: "flex",
    backgroundColor: "transparent",
    border: "0",
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "column",
      "& div": {
        display: "flex",
        flexDirection: "column",
        "& button": {
          width: "100%",
        },
      },
    },
  },
  cardFooterProfile: {
    marginTop: "-15px",
  },
  cardFooterPlain: {
    paddingLeft: "5px",
    paddingRight: "5px",
    backgroundColor: "transparent",
  },
  cardFooterStats: {
    borderTop: "1px solid " + grayColor[10],
    marginTop: "20px",
    "& svg": {
      position: "relative",
      top: "4px",
      marginRight: "3px",
      marginLeft: "3px",
      width: "16px",
      height: "16px",
    },
    "& .fab,& .fas,& .far,& .fal,& .material-icons": {
      fontSize: "16px",
      position: "relative",
      top: "4px",
      marginRight: "3px",
      marginLeft: "3px",
    },
  },
  cardFooterChart: {
    borderTop: "1px solid " + grayColor[10],
  },
});

export default cardFooterStyle;
