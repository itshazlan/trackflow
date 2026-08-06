"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProjectLiveStatusRoute() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  useEffect(() => {
    router.replace(`/reports/activity-ranking`);
  }, [router]);

  return null;
}
