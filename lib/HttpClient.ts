import axios from "axios";

import { api_endpoint } from "./Constants";

import { logIt } from "./Util";

// build the axios api base url
const beApi = axios.create({
    baseURL: `${api_endpoint}`
});

const spotifyApi = axios.create({});

export async function spotifyApiPut(api, payload, accessToken) {
    if (api.indexOf("https://api.spotify.com") === -1) {
        api = "https://api.spotify.com" + api;
    }
    spotifyApi.defaults.headers.common[
        "Authorization"
    ] = `Bearer ${accessToken}`;
    return await spotifyApi.put(api, payload).catch(err => {
        logIt(`error posting data for ${api}, message: ${err.message}`);
        return err;
    });
}

/**
 * Response returns a paylod with the following...
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
export async function softwareGet(api, jwt, additionHeaders = null) {
    if (jwt) {
        beApi.defaults.headers.common["Authorization"] = jwt;
    }

    if (additionHeaders) {
        beApi.defaults.headers.common = {
            ...beApi.defaults.headers.common,
            ...additionHeaders
        };
    }

    return await beApi.get(api).catch(err => {
        logIt(`error fetching data for ${api}, message: ${err.message}`);
        return err;
    });
}

/**
 * perform a put request
 */
export async function softwarePut(api, payload, jwt) {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common["Authorization"] = jwt;

    return await beApi
        .put(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            logIt(`error posting data for ${api}, message: ${err.message}`);
            return err;
        });
}

/**
 * perform a post request
 */
export async function softwarePost(api, payload, jwt) {
    // POST the kpm to the PluginManager
    beApi.defaults.headers.common["Authorization"] = jwt;
    return beApi
        .post(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            logIt(`error posting data for ${api}, message: ${err.message}`);
            return err;
        });
}

/**
 * perform a delete request
 */
export async function softwareDelete(api, jwt) {
    beApi.defaults.headers.common["Authorization"] = jwt;
    return beApi
        .delete(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            logIt(
                `error with delete request for ${api}, message: ${err.message}`
            );
            return err;
        });
}

/**
 * Check if the spotify response has an expired token
 * {"error": {"status": 401, "message": "The access token expired"}}
 */
export function hasTokenExpired(resp) {
    // when a token expires, we'll get the following error data
    // err.response.status === 401
    // err.response.statusText = "Unauthorized"
    if (
        resp &&
        resp.response &&
        resp.response.status &&
        resp.response.status === 401
    ) {
        return true;
    }
    return false;
}

/**
 * check if the reponse is ok or not
 * axios always sends the following
 * status:200
 * statusText:"OK"
 * 
    code:"ENOTFOUND"
    config:Object {adapter: , transformRequest: Object, transformResponse: Object, …}
    errno:"ENOTFOUND"
    host:"api.spotify.com"
    hostname:"api.spotify.com"
    message:"getaddrinfo ENOTFOUND api.spotify.com api.spotify.com:443"
    port:443
 */
export function isResponseOk(resp) {
    let status = getResponseStatus(resp);
    if (status && resp && status < 300) {
        return true;
    }
    return false;
}

/**
 * get the response http status code
 * axios always sends the following
 * status:200
 * statusText:"OK"
 */
function getResponseStatus(resp) {
    let status = null;
    if (resp && resp.status) {
        status = resp.status;
    } else if (resp && resp.response && resp.response.status) {
        status = resp.response.status;
    }
    return status;
}
