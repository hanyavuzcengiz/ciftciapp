import { ProfilePortfolio } from "../../components/profile/profile-portfolio";

export default function ProfilePage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">Kurumsal Ciftci Portfolyosu</h1>
      <p className="text-sm text-slate-600">Guven rozetleri, satici karnesi, islem tablolari ve ilan istatistikleri.</p>
      <ProfilePortfolio />
    </section>
  );
}
