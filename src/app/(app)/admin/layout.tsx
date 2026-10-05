import { PageHeader } from "@/components/shared/page-header";
import { AdminTabs } from "./admin-tabs";

export const metadata = { title: "Admin Panel" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <PageHeader title="Configure the platform" description="Connect your data sources, manage who has access, review every change, and control how health scores recalculate." />
      <AdminTabs />
      {children}
    </>
  );
}
