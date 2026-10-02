import GuidelinesPage from "@/legacy/components/GuidelinesPage";

export function GuidelinesReference({ initialItemId = null }: { initialItemId?: string | null }) {
  return <GuidelinesPage initialItemId={initialItemId || undefined} />;
}
