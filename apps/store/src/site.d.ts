declare module "#site" {
  const site: { fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> }
  export default site
}
