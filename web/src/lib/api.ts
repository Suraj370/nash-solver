import type { Algorithm, Benchmarks, Preset, SolveResponse } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly unreachable = false,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(`Cannot reach the solver API at ${API_URL}`, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* keep statusText */
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export type SolveParams = {
  A: number[][];
  B: number[][];
  algorithm: Algorithm;
  label: number;
};

export function solve(params: SolveParams, signal?: AbortSignal) {
  return request<SolveResponse>("/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, trace: true }),
    signal,
  });
}

export const getPresets = () => request<Record<string, Preset>>("/presets");
export const getBenchmarks = () => request<Benchmarks>("/benchmarks");
