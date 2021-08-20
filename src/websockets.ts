import { websockets_url } from "./Constants";
import { getPluginId, getPluginName, getVersion, getOs, getOffsetSeconds } from "./Util";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";
import { getItem, getPluginUuid } from "./managers/FileManager";

const WebSocket = require("ws");

// The server should send its timeout to allow the client to adjust.
const ONE_MIN_MILLIS = 1000 * 60;
// Default of 30 minutes
const DEFAULT_PING_INTERVAL_MILLIS = ONE_MIN_MILLIS * 30;
let SERVER_PING_INTERVAL_MILLIS = DEFAULT_PING_INTERVAL_MILLIS + ONE_MIN_MILLIS;
let pingTimeout = undefined;
let retryTimeout = undefined;

export function initializeWebsockets() {
  const jwt = getItem("jwt");
  if (!jwt) {
    // try again later
    setTimeout(() => {
      initializeWebsockets();
    }, 1000 * 60 * 2);
    return;
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

  const ws = new WebSocket(websockets_url, options);

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
    console.debug("[MusicTime] websockets connection open");
  });

  ws.on("message", function incoming(data) {
    handleIncomingMessage(data);
  });

  ws.on("ping", heartbeat);

  ws.on("close", function close(code, reason) {
    console.debug("[MusicTime] websockets connection closed");
    // clear this client side timeout
    clearTimeout(pingTimeout);
    retryConnection();
  });

  ws.on("unexpected-response", function unexpectedResponse(request, response) {
    console.debug("[MusicTime] unexpected websockets response:", response.statusCode);

    if (response.statusCode === 426) {
      console.error("[MusicTime] websockets request had invalid headers. Are you behind a proxy?");
    } else {
      retryConnection();
    }
  });

  ws.on("error", function error(e) {
    console.error("[MusicTime] error connecting to websockets", e);
  });
}

function retryConnection() {
  console.debug("[MusicTime] retrying websockets connecting in 10 seconds");

  retryTimeout = setTimeout(() => {
    console.log("[MusicTime] attempting to reinitialize websockets connection");
    initializeWebsockets();
  }, 10000);
}

export function clearWebsocketConnectionRetryTimeout() {
  clearTimeout(retryTimeout);
  clearTimeout(pingTimeout);
}

const handleIncomingMessage = (data: any) => {
  try {
    const message = JSON.parse(data);

    console.info(`[MusicTime] received '${message.type}' websocket event`);

    switch (message.type) {
      case "info":
        console.info(`[MusicTime] ${message.body}`);
        break;
      case "authenticated_plugin_user":
        handleAuthenticatedPluginUser(message.body);
        break;
      case "user_integration_connection":
        handleIntegrationConnectionSocketEvent(message.body);
        break;
      default:
        console.warn("[MusicTime] received unhandled websocket message type", data);
    }
  } catch (e) {
    console.error("[MusicTime] Unable to handle incoming message", data);
  }
};
