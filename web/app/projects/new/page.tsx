import { NewProject } from "@/components/app/NewProject";
import { SignedOutNotice } from "@/components/app/SignedOutNotice";

export const metadata = { title: "New project" };

export default function Page() {
  return (
    <SignedOutNotice>
      <NewProject />
    </SignedOutNotice>
  );
}
