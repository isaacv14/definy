"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4">
      <main className="flex flex-col items-center text-center max-w-lg w-full">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
          Definy
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400 mb-8">
          Look up any English word — get a clear definition, synonyms, and
          example sentences. Perfect for learners.
        </p>

        <SearchForm />

        <p className="mt-8 text-sm text-zinc-400 dark:text-zinc-500">
          Try searching for{" "}
          <Link
            href="/word/discoverable"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            discoverable
          </Link>
          ,{" "}
          <Link
            href="/word/serendipity"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            serendipity
          </Link>
          , or{" "}
          <Link
            href="/word/ubiquitous"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ubiquitous
          </Link>
        </p>
      </main>
    </div>
  );
}

function SearchForm() {
  return (
    <form
      action="/word/discoverable"
      method="GET"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("q") as HTMLInputElement;
        const query = input.value.trim().toLowerCase();
        if (!query) return;
        const slug = query.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (!slug) return;
        window.location.href = `/word/${slug}`;
      }}
      className="w-full"
    >
      <div className="relative">
        <input
          type="text"
          name="q"
          placeholder='Search for a word... e.g. "discoverable"'
          className="w-full px-4 py-3 pr-28 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder-zinc-500"
          autoFocus
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          Search
        </button>
      </div>
    </form>
  );
}
