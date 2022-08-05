import axios from "axios";
import { version, window } from 'vscode';
import { api_endpoint, app_endpoint } from "./Constants";

import {
    getPluginName,
    getMusicTimePluginId,
    getVersion,
    getOs,
    getOffsetSeconds,
    getEditorName,
    logIt,
    getItem,
    getPluginUuid,
} from "./Util";

// build the axios api base url
const beApi: any = axios.create({
    baseURL: `${api_endpoint}`,
});

const appApi: any = axios.create({
    baseURL: `${app_endpoint}`,
});

let headers: any | undefined;

beApi.defaults.headers.common = {...beApi.defaults.headers.common, ...headers};
appApi.defaults.headers.common = {...appApi.defaults.headers.common, ...headers};

export async function appGet(api: string, queryParams: any = {}) {
  updateOutgoingHeader();

  return await appApi.get(api, {params: queryParams}).catch((err: any) => {
    logIt(`error for GET ${api}, message: ${err.message}`);
    return err;
  });
}

export async function appPost(api: string, payload: any) {
  updateOutgoingHeader();

  return await appApi.post(api, payload).catch((err: any) => {
    logIt(`error for POST ${api}, message: ${err.message}`);
    return err;
  });
}

export async function softwareGet(api: string, queryParams = {}, override_token = null) {
  updateOutgoingHeader(override_token);

  return await beApi.get(api, {params: queryParams}).catch((err: any) => {
    logIt(`Error fetching data for ${api}, message: ${err.message}`);
    return err;
  });
}

export function isResponseOk(resp: any) {
  let status = getResponseStatus(resp);
  if (status && resp && status < 300) {
    return true;
  }
  return false;
}

function updateOutgoingHeader(override_token = null) {
  addPluginHeaderInfo();
  if (override_token) {
    appApi.defaults.headers.common['Authorization'] = override_token;
    beApi.defaults.headers.common['Authorization'] = override_token;
  } else {
    const token = getAuthorization();
    if (!override_token && token) {
      appApi.defaults.headers.common['Authorization'] = token;
      beApi.defaults.headers.common['Authorization'] = token;
    }
  }
  const isLightMode = window.activeColorTheme.kind === 1;
  appApi.defaults.headers.common['X-SWDC-Is-Light-Mode'] = isLightMode;
  beApi.defaults.headers.common['X-SWDC-Is-Light-Mode'] = isLightMode;
}

function addPluginHeaderInfo() {
  if (!headers) {
    headers = {
      'X-SWDC-Plugin-Name': getPluginName(),
      'X-SWDC-Plugin-Id': getMusicTimePluginId(),
      'X-SWDC-Plugin-Version': getVersion(),
      'X-SWDC-Plugin-OS': getOs(),
      'X-SWDC-Plugin-TZ': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'X-SWDC-Plugin-Offset': getOffsetSeconds() / 60,
      'X-SWDC-Plugin-UUID': getPluginUuid(),
      'X-SWDC-Plugin-Type': 'musictime',
      'X-SWDC-Plugin-Editor': getEditorName(),
      'X-SWDC-Plugin-Editor-Version': version
    };
    beApi.defaults.headers.common = {...beApi.defaults.headers.common, ...headers};
    appApi.defaults.headers.common = {...appApi.defaults.headers.common, ...headers};
  }
}

function getResponseStatus(resp: any) {
  let status = null;
  if (resp?.status) {
    status = resp.status;
  } else if (resp?.response && resp.response.status) {
    status = resp.response.status;
  } else if (resp?.code === 'ECONNABORTED') {
    status = 500;
  } else if (resp?.code === 'ECONNREFUSED') {
    status = 503;
  }
  return status;
}

function getAuthorization() {
  let token = getItem('jwt');
  if (token?.includes('JWT ')) {
    token = `Bearer ${token.substring('JWT '.length)}`;
  }
  return token;
}
