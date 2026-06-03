import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../../../..");
const SERVER_ENTRY = resolve(REPO_ROOT, "apps/mcp/src/index.ts");
const SCENES_DIR = resolve(REPO_ROOT, "apps/hyperframe/templates/scenes");

const sceneTypeDirCount = (): number =>
  readdirSync(SCENES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).length;

const sample = (type: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(SCENES_DIR, type, "v1/sample.json"), "utf8"));

const minimalSpec = () => ({
  slug: "stdio-smoke",
  scenes: [
    { id: "hook", type: "hook", slots: sample("hook") },
    { id: "outro", type: "outro", slots: sample("outro") },
  ],
});

type RpcResponse = { id: number; result?: unknown; error?: unknown };

class StdioClient {
  private readonly proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private nextId = 1;

  constructor() {
    this.proc = Bun.spawn(["bun", "run", SERVER_ENTRY], {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    this.reader = this.proc.stdout.getReader();
  }

  private write(message: object): void {
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
    this.proc.stdin.flush();
  }

  notify(method: string, params?: object): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  async request(method: string, params?: object): Promise<RpcResponse> {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return this.readResponse(id);
  }

  private async readResponse(id: number): Promise<RpcResponse> {
    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) {
        const { value, done } = await this.reader.read();
        if (done) throw new Error("server stdout closed before responding");
        this.buffer += this.decoder.decode(value, { stream: true });
        continue;
      }
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;
      const message = JSON.parse(line) as RpcResponse & { id?: number };
      if (message.id === id) return message;
    }
  }

  async dispose(): Promise<void> {
    this.proc.kill();
    await this.proc.exited;
  }
}

const callTool = async (
  client: StdioClient,
  name: string,
  args: object,
): Promise<{ result: { content: { type: string; text: string }[]; isError?: boolean } }> =>
  (await client.request("tools/call", { name, arguments: args })) as never;

const decodeToolBody = (result: {
  content: { type: string; text: string }[];
}): Record<string, unknown> => {
  const content = result.content[0];
  return JSON.parse(content?.type === "text" ? content.text : "{}");
};

describe("stdio server smoke", () => {
  let client: StdioClient;

  beforeAll(async () => {
    client = new StdioClient();
    const init = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "stdio-smoke", version: "0" },
    });
    expect(init.error).toBeUndefined();
    client.notify("notifications/initialized");
  });

  afterAll(async () => {
    await client.dispose();
  });

  it("lists exactly the registered tools", async () => {
    const response = (await client.request("tools/list")) as RpcResponse & {
      result: { tools: { name: string }[] };
    };
    expect(response.error).toBeUndefined();
    const names = response.result.tools.map((t) => t.name);
    expect(names).toHaveLength(9);
    expect(names).toContain("list_scene_types");
    expect(names).toContain("validate_scene_spec");
    expect(names).toContain("assemble_episode");
  });

  it("list_scene_types matches the scene dirs on disk", async () => {
    const { result } = await callTool(client, "list_scene_types", {});
    const types = decodeToolBody(result) as unknown as { type: string }[];
    expect(types.length).toBe(sceneTypeDirCount());
  });

  it("validates a minimal inline spec built from hook + outro samples", async () => {
    const { result } = await callTool(client, "validate_scene_spec", { spec: minimalSpec() });
    expect(result.isError).toBeUndefined();
    const body = decodeToolBody(result);
    expect(body.ok).toBe(true);
    expect(body.errors).toEqual([]);
  });

  it("assembles the same spec to identical bytes (deterministic)", async () => {
    const spec = minimalSpec();
    const first = await callTool(client, "assemble_episode", { spec });
    const second = await callTool(client, "assemble_episode", { spec });
    expect(first.result.isError).toBeUndefined();
    expect(second.result.isError).toBeUndefined();

    const html1 = decodeToolBody(first.result).html as string;
    const html2 = decodeToolBody(second.result).html as string;
    expect(html1.length).toBeGreaterThan(0);

    const sha = (html: string) =>
      new Bun.CryptoHasher("sha256").update(html).digest("hex");
    expect(sha(html1)).toBe(sha(html2));
  });
});
