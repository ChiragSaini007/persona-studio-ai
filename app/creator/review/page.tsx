import { redirect } from "next/navigation";

export default function CreatorReviewRoute() {
  redirect("/creator?mode=review");
}
