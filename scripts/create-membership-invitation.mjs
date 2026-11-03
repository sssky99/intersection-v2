// Run only after reviewing/applying the invitation migration to the intended database.
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [label, expiry, limitText] = process.argv.slice(2);
if (!label?.trim() || label.length > 120) throw new Error("사용법: node --env-file=.env.local scripts/create-membership-invitation.mjs '초대장 이름' [만료 ISO일시] [최대 지급 인원]");
if (expiry && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) throw new Error("만료일은 미래의 ISO 일시여야 합니다.");
const limit = limitText ? Number(limitText) : null;
if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error("최대 지급 인원은 양의 정수여야 합니다.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase 서버 설정이 필요합니다.");
const token = randomBytes(32).toString("base64url");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.from("membership_invitations").insert({
  label: label.trim(), token_hash: createHash("sha256").update(token).digest("hex"),
  expires_at: expiry ? new Date(expiry).toISOString() : null, max_redemptions: limit,
}).select("id").single();
if (error) throw new Error(`초대장 생성 실패: ${error.message}`);
console.log(`초대장 ID: ${data.id}`);
console.log(`초대 경로: /gift/${token}`);
console.log("실제 서비스 주소 뒤에 초대 경로를 붙여 공유하세요. 토큰은 다시 조회할 수 없습니다.");
