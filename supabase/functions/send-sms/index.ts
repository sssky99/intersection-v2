import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type SendSmsHookPayload = {
  user?: {
    phone?: string | null;
  };
  sms?: {
    otp?: string | null;
  };
};

const solapiEndpoint = "https://api.solapi.com/messages/v4/send-many/detail";
const textEncoder = new TextEncoder();

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function hookError(message: string, status = 400) {
  return json({ error: { http_code: status, message } }, status);
}

function koreanMobileNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const localNumber = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;

  if (!/^01(?:0\d{8}|[16789]\d{7,8})$/.test(localNumber)) {
    return null;
  }

  return localNumber;
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(message),
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function solapiAuthorization(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = randomHex(16);
  const signature = await hmacSha256Hex(apiSecret, `${date}${salt}`);

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return hookError("Method not allowed.", 405);
  }

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const solapiApiKey = Deno.env.get("SOLAPI_API_KEY");
  const solapiApiSecret = Deno.env.get("SOLAPI_API_SECRET");
  const senderNumber = Deno.env.get("SOLAPI_SENDER_NUMBER");

  if (!hookSecret || !solapiApiKey || !solapiApiSecret || !senderNumber) {
    console.error("Send SMS hook is missing required server configuration.");
    return hookError("SMS delivery is not configured.", 500);
  }

  const rawBody = await request.text();
  let payload: SendSmsHookPayload;

  try {
    const webhook = new Webhook(hookSecret.replace(/^v1,whsec_/, ""));
    payload = webhook.verify(
      rawBody,
      Object.fromEntries(request.headers),
    ) as SendSmsHookPayload;
  } catch {
    return hookError("Invalid hook signature.", 401);
  }

  const recipient = payload.user?.phone
    ? koreanMobileNumber(payload.user.phone)
    : null;
  const otp = payload.sms?.otp?.trim() ?? "";

  if (!recipient || !/^\d{6}$/.test(otp)) {
    return hookError("Invalid SMS authentication payload.");
  }

  const authorization = await solapiAuthorization(solapiApiKey, solapiApiSecret);
  const response = await fetch(solapiEndpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      messages: [
        {
          to: recipient,
          from: senderNumber.replace(/\D/g, ""),
          text: `[교집합] 인증번호는 ${otp}입니다.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    let providerCode: string | undefined;
    try {
      const providerError = await response.json() as { errorCode?: string };
      providerCode = providerError.errorCode;
    } catch {
      // Avoid logging provider bodies because they can contain message details.
    }

    console.error("SOLAPI authentication SMS request failed.", {
      status: response.status,
      providerCode,
    });
    return hookError("SMS delivery failed.", 502);
  }

  return json({}, 200);
});
