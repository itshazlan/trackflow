"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function IssueRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      try {
        const res = await fetch(`/api/issues/${id}`);
        if (res.ok) {
          const issue = await res.json();
          if (issue?.projectId) {
            router.replace(`/projects/${issue.projectId}/issues/${issue.id}`);
            return;
          }
        }
        router.replace("/projects");
      } catch (err) {
        console.error("Gagal mendapatkan detail issue untuk redirect:", err);
        router.replace("/projects");
      }
    }
    redirect();
  }, [id, router]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
