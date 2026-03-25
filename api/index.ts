// @ts-nocheck
export default async function handler(req, res) {
  const appModule = await import("../apps/api-server/src/app.js");
  return appModule.default(req, res);
}
