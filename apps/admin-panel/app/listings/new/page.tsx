import { ListingWizard } from "../../../components/listings/listing-wizard";

export default function NewListingPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">Ilan Ver</h1>
      <p className="text-sm text-slate-600">Facebook Marketplace tipi adim adim akis ile daha kaliteli ilan girisi.</p>
      <ListingWizard />
    </section>
  );
}
