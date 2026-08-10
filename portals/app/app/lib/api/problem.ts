import { NextResponse } from "next/server";

/**
 * RFC 9457 problem+json error envelope for the external /api/v1 surface.
 *
 * Every non-2xx response from /api/v1 is a Problem. `code` is the stable
 * machine-readable snake_case identifier (the same vocabulary the legacy
 * service gateway used as `{ error }`); `type` is a non-resolvable identifier
 * URI derived from it (RFC 9457 permits non-dereferenceable types).
 */

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  [ext: string]: unknown;
}

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  410: "Gone",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

export function problem(
  status: number,
  code: string,
  detail?: string,
  extensions?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextResponse {
  const body: Problem = {
    type: `https://arda.vxture.com/problems/${code}`,
    title: TITLES[status] ?? "Error",
    status,
    code,
    ...(detail ? { detail } : {}),
    ...extensions,
  };
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/problem+json", ...headers },
  });
}
