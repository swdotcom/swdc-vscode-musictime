import { api_endpoint } from './Constants';
import { getOs } from './managers/DeviceManager';
import { handleAuthenticatedPluginUser } from './message_handlers/authenticated_plugin_user';
import { handleIntegrationConnectionSocketEvent } from './message_handlers/integration_connection';
import { getItem, getMusicTimePluginId, getOffsetSeconds, getPluginName, getPluginUuid, getVersion, logIt } from './Util';

const WebSocket = require("ws");

const scheme = api_endpoint.includes('https') ? 'wss://' : 'ws://';
const host = api_endpoint.split('//')[1];
const websockets_url = `${scheme}${host}/websockets`;

const ONE_MINUTE = 1000 * 60;
const LONG_ERROR_DELAY = ONE_MINUTE * 5;
let retryTimeout: any | undefined;
let pingTimeout: any | undefined;
let pingInterval: number = ONE_MINUTE;

let ws: any | undefined
let alive: boolean = false;

export function websocketAlive() {
  return alive;
}

// dispose of the websocket and any timeouts that are waiting
export function clearWebsocketClient() {
	clearWebsocketsClient();
	clearPingTimeout();
	clearRetryTimeout();
}

export function clearPingTimeout() {
	if (pingTimeout) {
    clearTimeout(pingTimeout);
    pingTimeout = undefined;
  }
}

export function clearRetryTimeout() {
	if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = undefined;
  }
}

export function clearWebsocketsClient() {
  if (ws) {
		ws.close(1000, 're-initializing websocket');
		ws = null;
	}
}

export function initializeWebsockets() {
  clearWebsocketClient();

	ws = new WebSocket(websockets_url, {
		headers: {
			Authorization: getItem("jwt"),
			"X-SWDC-Plugin-Name": getPluginName(),
			"X-SWDC-Plugin-Id": getMusicTimePluginId(),
			"X-SWDC-Plugin-Version": getVersion(),
			"X-SWDC-Plugin-OS": getOs(),
			"X-SWDC-Plugin-TZ": Intl.DateTimeFormat().resolvedOptions().timeZone,
			"X-SWDC-Plugin-Offset": getOffsetSeconds() / 60,
			"X-SWDC-Plugin-UUID": getPluginUuid(),
		},
		perMessageDeflate: false
	});

	ws.on('open', function open() {
		logIt("Websockets connection open");
	});

	ws.on('message', function message(data) {
		alive = true;
		handleIncomingMessage(data);
	});

	ws.on("ping", heartbeat);

	ws.on("close", function close(code, reason) {
		logIt(`Websockets closed`, true);
		if (code !== 1000) {
      retryConnection();
    }
	});

	ws.on("error", function error(e) {
		logIt(`Error connecting to websockets server: ${e.message}`);
		retryConnection(LONG_ERROR_DELAY);
	});

	ws.on('unexpected-response', function unexpectedResponse(request: any, response: any) {
    logIt(`Unexpected websockets response: ${response.statusCode}`);

    if (response.statusCode === 426) {
      logIt('Websockets request had invalid headers. Are you behind a proxy?');
    } else if (response.statusCode >= 500) {
      retryConnection();
    }
  });

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
			}
		} catch (e: any) {
			logIt(`Unable to handle incoming websockets message: ${e.message}`);
		}
	};

	function retryConnection(delay: any = getDelay()) {
		alive = false;

		if (retryTimeout) {
			return;
		}

		retryTimeout = setTimeout(() => {
			initializeWebsockets();
		}, delay);
	};

	function heartbeat(buf) {
    try {
      // convert the buffer to the json payload containing the server timeout
      const data = JSON.parse(buf.toString());
      if (data?.timeout) {
        // add a 1 minute buffer to the millisconds timeout the server provides
        pingInterval = data.timeout;
      }
    } catch (e) {
			pingInterval = ONE_MINUTE;
      logIt(`Unable to handle incoming websockets heartbeat: ${e.message}`);
    }

		clearPingTimeout();

		pingTimeout = setTimeout(() => {
      if (ws) {
        ws.terminate();
      }
    }, pingInterval);
  }

	// delay between 30 and 59 seconds
	function getDelay() {
		return Math.floor(getRandomNumberWithinRange(30, 59) * 1000);
	}

	function getRandomNumberWithinRange(min: number, max: number) {
		return Math.floor(Math.random() * (max - min) + min);
	}
}
