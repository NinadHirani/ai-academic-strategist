import { redirect } from "next/navigation";
import DebugPanelClient from "./DebugPanelClient";

export default function DebugPage() {
  if (process.env.NODE_ENV !== "development" && !process.env.NEXT_PUBLIC_DEBUG) {
    redirect("/");
  }

  return <DebugPanelClient />;
}
