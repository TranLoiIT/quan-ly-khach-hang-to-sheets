import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Bảng điều khiển",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return <DashboardClient user={user} />;
}
