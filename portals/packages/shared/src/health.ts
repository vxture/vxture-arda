import { NextResponse } from "next/server";

// Shared liveness handler for every portal's /api/health route. As a workspace
// package it resolves the hoisted node_modules and CAN import next/react.
// No external dependencies keeps the endpoint green as long as the server is serving.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
