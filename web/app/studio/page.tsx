import { Director } from "@/components/director/Director";

export const metadata = { title: "Studio" };

type Search = { project?: string; idea?: string; video?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { project, idea, video } = await searchParams;
  const id = (v?: string) => (v && /^[a-z0-9]{1,40}$/i.test(v) ? v : undefined);
  // A new key per target gives each video a fresh studio.
  return <Director key={`${project}-${idea}-${video}`} projectId={id(project)} ideaId={id(idea)} videoId={id(video)} />;
}
