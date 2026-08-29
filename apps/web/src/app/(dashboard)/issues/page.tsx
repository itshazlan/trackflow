"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IssuesGlobalRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-tasks");
  }, [router]);

  return null;
}
