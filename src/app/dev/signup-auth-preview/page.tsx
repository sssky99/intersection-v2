import { notFound } from "next/navigation";
import { SignupAuthPreview } from "./SignupAuthPreview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SignupAuthPreview />;
}
