import { notFound } from "next/navigation";
import { FriendsPreview } from "./FriendsPreview";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FriendsPreview ownerName="문하늘" initialFriends={[{
    id: "preview-jinhyun-2937",
    name: "이진현",
    met: "로컬 미리보기 · 친구 추가 완료",
    image: "https://hvyrhwhxbtsgrgodgzms.supabase.co/storage/v1/object/public/profile-photos/cf9d2d1a-c0ab-4c15-bd40-078519d34df9/1788866614740-file_0000000013bc81f59ddbdfaadf4c2a56.jpg",
  }]} />;
}
