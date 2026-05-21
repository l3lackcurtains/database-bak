let authConfiguredViaDb = false;

export function isAuthConfiguredViaDb() {
  return authConfiguredViaDb;
}

export function setAuthConfiguredViaDb(value: boolean) {
  authConfiguredViaDb = value;
}
