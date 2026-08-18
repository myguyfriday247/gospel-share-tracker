// ==========================================
// ADMIN PORTAL - section chooser
// ==========================================
//
// This file previously held all three tools inline and had grown to ~790 lines: the people
// table with its edit/delete dialogs, the CSV exporter, and the CSV importer, plus their
// combined state. Each now lives in its own component under components/admin/ and owns its
// own state and error surface; this page only decides which one is showing.

"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileSpreadsheet, Upload } from "lucide-react";
import { PortalPeople } from "@/components/admin/PortalPeople";
import { PortalExport } from "@/components/admin/PortalExport";
import { PortalImport } from "@/components/admin/PortalImport";

type ActiveSection = "people" | "export" | "import";

const SECTIONS: {
  key: ActiveSection;
  title: string;
  description: string;
  icon: typeof Users;
  iconClass: string;
  activeClass: string;
}[] = [
  {
    key: "people",
    title: "People on Mission",
    description:
      "View and manage all people records and user accounts. Link users to people, promote to admin, and manage access.",
    icon: Users,
    iconClass: "text-blue-600",
    activeClass: "ring-2 ring-blue-500 bg-blue-50",
  },
  {
    key: "export",
    title: "Export Data",
    description:
      "Export people and entries to CSV for analysis. Download all data or filter by date range.",
    icon: FileSpreadsheet,
    iconClass: "text-green-600",
    activeClass: "ring-2 ring-green-500 bg-green-50",
  },
  {
    key: "import",
    title: "Import Data",
    description:
      "Import people and entries from CSV files. Preview data before importing and handle errors gracefully.",
    icon: Upload,
    iconClass: "text-purple-600",
    activeClass: "ring-2 ring-purple-500 bg-purple-50",
  },
];

export default function AdminPortalPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("people");
  // Bumped after an import so the people list picks up newly created rows.
  const [peopleReloadSignal, setPeopleReloadSignal] = useState(0);

  return (
    <>
      <Header currentPage="portal" />

      <div className="container mx-auto py-6 px-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {SECTIONS.map(({ key, title, description, icon: Icon, iconClass, activeClass }) => (
            <Card
              key={key}
              className={`cursor-pointer transition-colors h-full ${
                activeSection === key ? activeClass : "hover:bg-gray-50"
              }`}
              onClick={() => setActiveSection(key)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Icon className={`h-6 w-6 ${iconClass}`} /> {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600">
                <p>{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeSection === "people" && <PortalPeople reloadSignal={peopleReloadSignal} />}
        {activeSection === "export" && <PortalExport />}
        {activeSection === "import" && (
          <PortalImport onImported={() => setPeopleReloadSignal((n) => n + 1)} />
        )}
      </div>
    </>
  );
}
