/** Standard C3 endpoint. Keep the legacy receiver during platform registration migration. */
import { POST as receiveWebhook } from "../../../provisioning/webhook/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = receiveWebhook;
