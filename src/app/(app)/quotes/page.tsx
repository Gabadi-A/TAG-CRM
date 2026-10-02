import { redirect } from "next/navigation";

// The Quotes tab has been merged into Opportunities — quotes now live on each
// opportunity. Keep this route so old links/bookmarks land on the combined view.
export default function QuotesPage() {
  redirect("/projects");
}
