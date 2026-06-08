declare module '@tursodatabase/serverless' {
  export function connect(config: { url: string; authToken?: string }): any;
}
