import { window } from "vscode";
import { showTacoTimeStatus } from "./Util";
import { NOT_NOW_LABEL, YES_LABEL } from "./Constants";
import { showMenuOptions } from "./MenuManager";

let tacoTimeMap = {
    count: 0,
    activated: false
};

// 11am
const lunchHour = 11;
// 5pm
const dinnerHour = 17;
// past 30 minutes after the hour
const minutesOfHour = 30;
// max number of tacos displayed :)
const maxTacos = 15;

let grubWindow = null;

export function showTacoTime() {
    if (tacoTimeMap.count > 0) {
        return;
    }
    renderTacoTimeMessage(1);
}

function renderTacoTimeMessage(count) {
    count = count === undefined || count === null ? 1 : count;

    let tacos = "";
    for (let i = 0; i < count; i++) {
        tacos += "🌮 ";
    }

    let d = new Date();
    let hourOfDay = d.getHours();

    let tacoMsg = "Software " + tacos;

    showTacoTimeStatus(tacoMsg, "Is It Taco Time?");
    if (count === 3) {
        count = 1;
    } else {
        count++;
    }

    if (hourOfDay === lunchHour) {
        if (tacoTimeMap.count >= maxTacos) {
            showTacoTimeStatus("Software 🌮", "Is it taco time?");
            return;
        }
        tacoTimeMap.count += 1;
    } else {
        if (tacoTimeMap.count >= maxTacos) {
            showTacoTimeStatus("Software 🌮", "Is it taco time?");
            return;
        }
        tacoTimeMap.count += 1;
    }

    setTimeout(() => {
        renderTacoTimeMessage(count);
    }, 2000);
}

export function fetchTacoChoices() {
    if (tacoTimeMap.activated) {
        showTacoQuickPick();
    } else {
        tacoTimeMap.count = maxTacos;
        tacoTimeMap.activated = true;
        if (!grubWindow) {
            /**
             * Grubhub, Doordash, UberEats
             * others we can show..
                Postmates, Delivery.com, Yelp Eat 24, Foodler
            */
            grubWindow = window
                .showInformationMessage(
                    "Would you like to order tacos now?",
                    ...[NOT_NOW_LABEL, YES_LABEL]
                )
                .then(async selection => {
                    grubWindow = null;
                    if (selection === YES_LABEL) {
                        // open the input options box
                        showTacoQuickPick();
                    } else {
                        // show the full menu
                        showMenuOptions();
                    }
                });
        }
    }
}

export function isTacoTime() {
    let d = new Date();

    let hour = d.getHours();
    let minutes = d.getMinutes();
    // 0 = sun, 6 = sat
    let day = d.getDay();

    let isWeekday = day >= 0 && day <= 5 ? true : false;
    let isLunchOrDinner =
        hour === lunchHour || hour === dinnerHour ? true : false;
    let isPastMinutesThreshold = minutes >= minutesOfHour ? true : false;

    // as long as it's a weekday and the hour is 11 or 5 and
    // it's past 30 minutes after the hour it's taco time
    if (isWeekday && isLunchOrDinner && isPastMinutesThreshold) {
        return true;
    } else {
        // clear the map altogether
        resetTacoTimeMap();
    }
    return false;
}

export async function showTacoQuickPick() {
    showMenuOptions();
}

function resetTacoTimeMap() {
    tacoTimeMap = {
        count: 0,
        activated: false
    };
}
