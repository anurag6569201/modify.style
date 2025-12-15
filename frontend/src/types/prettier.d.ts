declare module "prettier/standalone" {
  export function format(
    source: string,
    options: Record<string, unknown>
  ): string;
}

declare module "prettier/plugins/postcss" {
  const plugin: unknown;
  export default plugin;
}

