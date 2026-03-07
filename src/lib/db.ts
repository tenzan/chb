export function getDB(locals: App.Locals): D1Database {
  return locals.runtime.env.DB;
}

export function getEnv(locals: App.Locals) {
  return locals.runtime.env;
}
