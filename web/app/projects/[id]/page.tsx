import { ProjectPage } from "@/components/app/ProjectPage";
import { SignedOutNotice } from "@/components/app/SignedOutNotice";

export const metadata = { title: "Project" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SignedOutNotice>
      <ProjectPage id={id} />
    </SignedOutNotice>
  );
}
