import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env" });

const usersDb = process.env.DATABASE_URL?.trim();
const listingsDb = process.env.LISTING_DATABASE_URL?.trim() || usersDb;

if (!usersDb || !listingsDb) {
  console.error("DATABASE_URL veya LISTING_DATABASE_URL eksik.");
  process.exit(1);
}

const USERS = [
  { phone: "+905301110001", name: "Ahmet Yilmaz - Ciftci" },
  { phone: "+905301110002", name: "Mehmet Kara - Uretici" },
  { phone: "+905301110003", name: "Ayse Demir - Tohumcu" },
  { phone: "+905301110004", name: "Fatma Sahin - Kooperatif" },
  { phone: "+905301110005", name: "Ali Can - Zirai Girisimci" },
  { phone: "+905301110006", name: "Huseyin Akin - Traktorcu" }
];

const LISTINGS = [
  ["2022 Case IH Traktor", "145 HP, bakimlari tam, 2.150 saat calisma.", "sell", 2450000, "TL", "+905301110001"],
  ["Sertifikali Ekmeklik Bugday Tohumu", "TSE belgeli, yuksek cimlenme oranli.", "sell", 17.5, "kg", "+905301110003"],
  ["Organik Buyukbas Hayvan Gubresi", "Laboratuvar analizli, yanmis ciftlik gubresi.", "sell", 4200, "ton", "+905301110002"],
  ["Drone ile Ilaclama Hizmeti", "Saatlik profesyonel tarla ilaclama.", "service", 1350, "saat", "+905301110004"],
  ["New Holland TD110", "2021 model, klimali kabin.", "sell", 1980000, "TL", "+905301110006"],
  ["Azotlu Gubre 46", "Toplu alimda iskonto vardir.", "sell", 16800, "ton", "+905301110005"],
  ["Sut Yem Karmasi", "Besi performansini artiran rasyon.", "sell", 13.2, "kg", "+905301110002"],
  ["Pamuk Tohumu Sertifikali", "Yuksek verim, hastaliga dayanikli.", "sell", 29.9, "kg", "+905301110003"],
  ["Silaj Balya Hizmeti", "Adet bazli paket fiyat.", "service", 115, "adet", "+905301110004"],
  ["Tarla Surum Kiralama", "Donum bazli traktor + operator.", "rent", 780, "hektar", "+905301110006"],
  ["Mibzer Kiralik", "Gunluk kiralama, bakimli ekipman.", "rent", 2200, "TL", "+905301110001"],
  ["Damla Sulama Seti", "1000 metre set, filtre dahil.", "sell", 28500, "TL", "+905301110005"],
  ["Aycicek Tohumu Hibrit", "Yaglik aycicek icin premium seri.", "sell", 31.5, "kg", "+905301110003"],
  ["Fasulye Tohumu", "Sertifikali ve paketli.", "sell", 45, "kg", "+905301110003"],
  ["Sivi Organik Gubre", "Yaprak uygulamasina uygun.", "sell", 950, "adet", "+905301110002"],
  ["Besi Danasi 12 Aylik", "Saglik raporlu toplu satis.", "sell", 33800, "adet", "+905301110002"],
  ["Sulama Motopompu", "Temiz, az kullanilmis.", "sell", 18750, "TL", "+905301110006"],
  ["Mini Yukleyici Hizmeti", "Saatlik is makinasi destegi.", "service", 900, "saat", "+905301110004"],
  ["Arpa Tohumu", "2026 sezonu icin hazir.", "sell", 16.8, "kg", "+905301110003"],
  ["Kompost Organik Karisim", "Sebze-sera uygulamalarina uygun.", "sell", 3900, "ton", "+905301110005"]
];

const usersClient = new pg.Client({ connectionString: usersDb });
const listingsClient = new pg.Client({ connectionString: listingsDb });

await usersClient.connect();
await listingsClient.connect();

try {
  for (const u of USERS) {
    await usersClient.query(
      `INSERT INTO users (phone_number, full_name, user_type, verification_status, rating_avg, rating_count)
       VALUES ($1, $2, 'farmer', 'id_verified', 4.8, 120)
       ON CONFLICT (phone_number)
       DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'id_verified', rating_avg = 4.8, rating_count = 120`,
      [u.phone, u.name]
    );
  }

  for (const [title, description, listingType, price, priceUnit, phone] of LISTINGS) {
    const author = await usersClient.query("SELECT id FROM users WHERE phone_number = $1 LIMIT 1", [phone]);
    const authorUuid = author.rows[0]?.id ?? null;
    await listingsClient.query(
      `INSERT INTO listings_app (user_id, author_uuid, title, description, listing_type, price, price_unit, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT DO NOTHING`,
      [phone, authorUuid, title, description, listingType, price, priceUnit]
    );
  }

  console.log("Canli simulasyon seed tamamlandi: 20 ilan + dogrulanmis profiller.");
} finally {
  await usersClient.end();
  await listingsClient.end();
}
