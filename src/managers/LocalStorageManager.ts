import { ExtensionContext, Memento } from "vscode";

export class LocalStorageManager {

  private static instance: LocalStorageManager;
  private storage: Memento;

  constructor(ctx: ExtensionContext) {
    this.storage = ctx.globalState;
  }

  static getInstance(ctx: ExtensionContext): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager(ctx);
    }
    return LocalStorageManager.instance;
  }

  static getCachedStorageManager(): LocalStorageManager {
    return LocalStorageManager.instance;
  }

  public getValue<T>(key : string) : string {
    return this.storage.get<string>(key,'');
  }

  public setValue<T>(key : string, value : string) {
    this.storage.update(key, value);
  }

  public deleteValue(key: string) {
    this.storage.update(key, undefined);
  }

  public clearDupStorageKeys() {
    const keys = this.storage.keys();
    if (keys?.length) {
      keys.forEach(key => {
        if (key?.includes('$ct_event_')) {
          this.deleteValue(key)
        }
      });
    }
  }

  public clearStorage() {
    const keys = this.storage.keys();
    if (keys?.length) {
      for (let i = 0; i < keys.length; i++) {
        this.deleteValue(keys[i])
      }
    }
  }
}
