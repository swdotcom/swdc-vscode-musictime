import { websockets_url } from "./Constants";
import { getPluginId, getPluginName, getVersion, getOs, getOffsetSeconds } from "./Util";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";
import { getItem, getPluginUuid, logIt } from "./managers/FileManager";

const WebSocket = require("ws");

// The server should send its timeout to allow the client to adjust.
const ONE_MIN_MILLIS = 1000 * 60;
// Default of 30 minutes
const DEFAULT_PING_INTERVAL_MILLIS = ONE_MIN_MILLIS * 30;
let SERVER_PING_INTERVAL_MILLIS = DEFAULT_PING_INTERVAL_MILLIS + ONE_MIN_MILLIS;
let pingTimeout = undefined;
let retryTimeout = undefined;

const INITIAL_RECONNECT_DELAY: number = 12000;
const MAX_RECONNECT_DELAY: number = 25000;
// websocket reconnect delay
let currentReconnectDelay: number = INITIAL_RECONNECT_DELAY;

let ws: any | undefined = undefined;

export function initializeWebsockets() {
  if (!getItem("jwt")) {
    // try again later
    setTimeout(() => {
      initializeWebsockets();
    }, 1000 * 60);
    return;
  }

  logIt('initializing websocket connection');
  if (ws) {
    // 1000 indicates a normal closure, meaning that the purpose for
    // which the connection was established has been fulfilled
    ws.close(1000, 're-initializing websocket');
  }

  const options = {
    headers: {
      Authorization: getItem("jwt"),
      "X-SWDC-Plugin-Id": getPluginId(),
      "X-SWDC-Plugin-Name": getPluginName(),
      "X-SWDC-Plugin-Version": getVersion(),
      "X-SWDC-Plugin-OS": getOs(),
      "X-SWDC-Plugin-TZ": Intl.DateTimeFormat().resolvedOptions().timeZone,
      "X-SWDC-Plugin-Offset": getOffsetSeconds() / 60,
      "X-SWDC-Plugin-UUID": getPluginUuid(),
    },
  };

  ws = new WebSocket(websockets_url, options);

  function heartbeat(buf) {
    try {
      // convert the buffer to the json payload containing the server timeout
      const data = JSON.parse(buf.toString());
      if (data?.timeout) {
        // add a 1 minute buffer to the millisconds timeout the server provides
        const interval = data.timeout;
        if (interval > DEFAULT_PING_INTERVAL_MILLIS) {
          SERVER_PING_INTERVAL_MILLIS = interval + ONE_MIN_MILLIS;
        } else {
          SERVER_PING_INTERVAL_MILLIS = DEFAULT_PING_INTERVAL_MILLIS + ONE_MIN_MILLIS;
        }
      }
    } catch (e) {
      // defaults to the DEFAULT_PING_INTERVAL_MILLIS
      SERVER_PING_INTERVAL_MILLIS = DEFAULT_PING_INTERVAL_MILLIS + ONE_MIN_MILLIS;
    }

    if (pingTimeout) {
      // Received a ping from the server. Clear the timeout so
      // our client doesn't terminate the connection
      clearTimeout(pingTimeout);
    }

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    pingTimeout = setTimeout(() => {
      if (ws) {
        ws.terminate();
      }
    }, SERVER_PING_INTERVAL_MILLIS);
  }

  ws.on("open", function open() {
    // RESET reconnect delay
    currentReconnectDelay = INITIAL_RECONNECT_DELAY;
    logIt("websockets connection open");
  });

  ws.on("message", function incoming(data) {
    handleIncomingMessage(data);
  });

  ws.on("ping", heartbeat);

  ws.on("close", function close(code, reason) {
    if (code !== 1000) {
      // clear this client side timeout
      if (pingTimeout) {
        clearTimeout(pingTimeout);
      }
      retryConnection();
    }
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    logIt(`unexpected websockets response: ${response.statusCode}`);

    if (response.statusCode === 426) {
      console.error("websockets request had invalid headers. Are you behind a proxy?");
    } else {
      retryConnection();
    }
  });

  ws.on("error", function error(e) {
    console.error("error connecting to websockets", e);
  });
}

function retryConnection() {
  const delay: number = getDelay();

  if (currentReconnectDelay < MAX_RECONNECT_DELAY) {
    // multiply until we've reached the max reconnect
    currentReconnectDelay *= 2;
  } else {
    currentReconnectDelay = Math.min(currentReconnectDelay, MAX_RECONNECT_DELAY);
  }

  logIt(`retrying websocket connection in ${delay / 1000} second(s)`);

  retryTimeout = setTimeout(() => {
    initializeWebsockets();
  }, delay);
}

function getDelay() {
  let rand: number = getRandomNumberWithinRange(-5, 5);
  if (currentReconnectDelay < MAX_RECONNECT_DELAY) {
    // if less than the max reconnect delay then increment the delay
    rand = Math.random();
  }
  return currentReconnectDelay + Math.floor(rand * 1000);
}

function getRandomNumberWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

export function clearWebsocketConnectionRetryTimeout() {
  clearTimeout(retryTimeout);
  clearTimeout(pingTimeout);
}

const handleIncomingMessage = (data: any) => {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case "authenticated_plugin_user":
        handleAuthenticatedPluginUser(message.body);
        break;
      case "user_integration_connection":
        handleIntegrationConnectionSocketEvent(message.body);
        break;
      default:
        console.warn("received unhandled websocket message type", data);
    }
  } catch (e) {
    let dataStr: string = '';
      try {
        dataStr = JSON.stringify(data);
      } catch (e) {
        dataStr = data.toString();
      }
      logIt(`Unable to handle incoming message: ${dataStr}`);
  }
};
