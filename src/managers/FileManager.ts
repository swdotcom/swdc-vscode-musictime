const fileIt = require("file-it");

export function getFileDataAsJson(file) {
  let data = fileIt.readJsonFileSync(file);
  return data;
}

export async function storeJsonData(fileName, data) {
  fileIt.writeJsonFileSync(fileName, data);
}
