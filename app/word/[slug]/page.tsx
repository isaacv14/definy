import type { Metadata } from "next";
import WordPageClient from "@/components/word-display";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = `${slug} - Meaning, Synonyms & Examples | Definy`;
  const description = `Learn the meaning of "${slug}" with simple definitions, example sentences, and synonyms. Perfect for English learners at A2-B1 level.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function WordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WordPageClient slug={slug} />;
}
