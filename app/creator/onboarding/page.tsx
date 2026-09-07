import { redirect } from "next/navigation";

export default function CreatorOnboardingRoute() {
  redirect("/creator?mode=onboarding");
}

