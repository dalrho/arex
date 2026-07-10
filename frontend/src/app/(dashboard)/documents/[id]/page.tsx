import { redirect } from "next/navigation";

export default function DocumentDetailPage() {
  redirect("/documents");
  return null;
}
