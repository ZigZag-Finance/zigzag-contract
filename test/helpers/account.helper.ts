import * as Eos from 'eosjs';

export class EosPermission {
  constructor(public key: string, public name: string = PERMISSION_OWNER) {

  }
}

export class EosLink {
  constructor(public permission: string, public method: string) {

  }
}

export const PERMISSION_OWNER = 'owner';
export const PERMISSION_ACTIVE = 'active';

export class EosAccount {
  public permissions: EosPermission[] = [];
  public links: EosLink[] = [];
  public withCodeAccess: boolean = false;
  readonly nameValue: string;
  constructor(public name: string) {
    this.nameValue = Eos.modules.format.encodeName(this.name, false);
  }
  key(key: string, name?: string): EosAccount {
    if (name === undefined) {
      this.permissions.push(new EosPermission(key, PERMISSION_OWNER));
      this.permissions.push(new EosPermission(key, PERMISSION_ACTIVE));
    } else {
      this.permissions.push(new EosPermission(key, name));
    }
    return this;
  }
  link(permission: string, method: string): EosAccount {
    this.links.push(new EosLink(permission, method));
    return this;
  }
  addCodeAccess(): EosAccount {
    this.withCodeAccess = true;
    return this;
  }
  permissionByName(permissionName: string = PERMISSION_ACTIVE): EosPermission | undefined {
    for (let permission of this.permissions) {
      if (permission.name === permissionName) {
        return permission;
      }
    }
  }
  options(permissionName: string = PERMISSION_ACTIVE): object | undefined {
    const permission = this.permissionByName(permissionName);
    if (permission) {
      return {
        authorization: [`${this.name}@${permissionName}`],
        keyProvider: permission.key
      };
    }
  }
  publicKey(permissionName: string): string | undefined {
    const permission = this.permissionByName(permissionName);
    if (permission) {
      return Eos.modules.ecc.privateToPublic(permission.key);
    }
  }
  toCode(): string {
    return Eos.modules.format.encodeName(this.name, false);
  }
  authorization(permissionName: string = PERMISSION_ACTIVE) {
    const permission = this.permissionByName(permissionName);
    if (permission) {
      return [{
        actor: this.name,
        permission: permissionName,
      }];
    }
  }
  keyProvider(permissionName: string = PERMISSION_ACTIVE) {
    return () => {
      const permission = this.permissionByName(permissionName);
      return permission!.key;
    }
  }
}