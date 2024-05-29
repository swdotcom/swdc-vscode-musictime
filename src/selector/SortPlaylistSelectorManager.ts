import { showQuickPick } from "../MenuManager";

export async function showSortPlaylistMenu() {
  const items = getSortItems();
  const menuOptions = {
    items,
    placeholder: "Sort by",
  };

  const pick = await showQuickPick(menuOptions);
  if (pick && pick.label) {
    return pick.label;
  }
  return null;
}

function getSortItems() {
  const items = [
    {
      label: "Sort A-Z",
      command: "musictime.sortAlphabetically",
    },
    {
      label: "Sort by latest",
      command: "musictime.sortToOriginal",
    },
  ];

  return items;
}
