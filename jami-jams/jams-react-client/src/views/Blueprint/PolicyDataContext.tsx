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

import { FC, ReactNode, createContext, useEffect, useState } from "react";

import axios from "axios";

import configApiCall from "../../api";
import { api_path_blueprints } from "../../globalUrls";
import { parsePolicyData } from "./parsePolicyData";
import { _updatePolicyData } from "./updatePolicyData";
import { DEFAULT_POLICY_DATA, PolicyData } from "./policyData.constants";

export interface SnackbarProps {
  open: boolean;
  severity: "success" | "error";
  message: string;
}

interface PolicyDataProp {
  policyData: PolicyData;
  updatePolicyData: (field: string, value: any) => void;
  snackbar: SnackbarProps;
  setSnackbar: (snackbar: SnackbarProps) => void;
}

export const PolicyDataContext = createContext<PolicyDataProp>({
  policyData: DEFAULT_POLICY_DATA,
  updatePolicyData: () => {},
  snackbar: {
    open: false,
    severity: "success",
    message: "",
  },
  setSnackbar: () => {},
});

interface Props {
  blueprintName: string;
  children: ReactNode;
}

export const PolicyDataContextProvider: FC<Props> = ({
  blueprintName,
  children,
}) => {
  const [policyData, setPolicyData] = useState(DEFAULT_POLICY_DATA);
  const [snackbar, setSnackbar] = useState<SnackbarProps>({
    open: false,
    severity: "success",
    message: "",
  });

  useEffect(() => {
    axios(
      configApiCall(
        api_path_blueprints + "?name=" + blueprintName,
        "GET",
        null,
        null,
      ),
    )
      .then((response) => {
        return parsePolicyData(response.data.policyData);
      })
      .then((policyData) => {
        setPolicyData(policyData);
      })
      .catch((error) => {
        console.log("Error fetching blueprint permissions : " + error);
      });
  }, [blueprintName]);

  const updatePolicyData = (field: string, value: any) => {
    _updatePolicyData(
      blueprintName,
      policyData,
      setPolicyData,
      field,
      value,
      setSnackbar,
    );
  };

  return (
    <PolicyDataContext.Provider
      value={{ policyData, updatePolicyData, snackbar, setSnackbar }}
    >
      {children}
    </PolicyDataContext.Provider>
  );
};
