"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProjectWorkloadRoute() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}?tab=workload`);
    }
  }, [projectId, router]);

  return null;
}
