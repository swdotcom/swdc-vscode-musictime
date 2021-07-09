import { websockets_url } from "./Constants";
import { getPluginId, getPluginName, getVersion, getOs, getOffsetSeconds } from "./Util";
import { handleAuthenticatedPluginUser } from "./message_handlers/authenticated_plugin_user";
import { handleIntegrationConnectionSocketEvent } from "./message_handlers/integration_connection";
import { getItem, getPluginUuid } from "./managers/FileManager";

const WebSocket = require("ws");
let pingTimeout = undefined;
let retryTimeout = undefined;

// This is the server interval to ping this client. If the server
// interval changes, this interval should change with it to match.
const SERVER_PING_INTERVAL_MILLIS = 1000 * 60 * 2;

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

  function heartbeat() {
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
      this.terminate();
    }, SERVER_PING_INTERVAL_MILLIS + 5000);
  }

  const ws = new WebSocket(websockets_url, options);

  ws.on("open", function open() {
    console.debug("[MusicTime] websockets connection open");
    heartbeat();
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
