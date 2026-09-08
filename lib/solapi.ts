import { createHmac, randomBytes } from "node:crypto";

export function solapiAuthorization(key: string, secret: string, date = new Date().toISOString(), salt = randomBytes(16).toString("hex")) {
  const signature = createHmac("sha256", secret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function solapiConfigured() {
  return Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER_NUMBER);
}

async function solapiRequest(path: string, body?: object) {
  if (!solapiConfigured()) throw new Error("solapi-not-configured");
  const response = await fetch(`https://api.solapi.com${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: solapiAuthorization(process.env.SOLAPI_API_KEY!, process.env.SOLAPI_API_SECRET!),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`solapi-http-${response.status}`);
  return response.json();
}

export async function sendFriendSms(to: string, text: string, invitationId: string) {
  // Never retry this request automatically: a timeout may follow successful acceptance.
  const data = await solapiRequest("/messages/v4/send-many/detail", {
    messages: [{ to, from: process.env.SOLAPI_SENDER_NUMBER, text, type: "LMS", customFields: { invitationId } }],
    allowDuplicates: false, showMessageList: true,
  });
  const message = data.messageList?.[0];
  if (!message?.messageId || data.failedMessageList?.length) throw new Error("solapi-registration-unconfirmed");
  return { messageId: String(message.messageId), groupId: String(message.groupId ?? data.groupInfo?.groupId ?? "") };
}

export function friendSmsDelivered(message: { statusCode?: string; to?: string; from?: string }, phone: string, sender: string) {
  return message.statusCode === "4000" && message.to === phone && message.from === sender;
}

export async function readFriendSms(messageId: string) {
  const data = await solapiRequest(`/messages/v4/list?messageId=${encodeURIComponent(messageId)}&limit=1`);
  return data.messageList?.[messageId] as { statusCode?: string; to?: string; from?: string } | undefined;
}
