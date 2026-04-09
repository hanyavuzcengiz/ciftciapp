# Security and Trust Blueprint

- OTP: 6 hane, 3 dk, auth limiter ile kisit.
- JWT: 15dk access, 30 gun refresh (rotation stublari mevcut).
- RBAC rolleri: `admin`, `moderator`, `verified_user`, `unverified_user`.
- KYC seviyeleri: Seviye 0/1/2 modeli user-service tarafinda genisletilebilir.
- Veri gizliligi: telefon maskeleme util'i ve mesaj sifreleme modeli.
- Guven skoru:
  `verification * 0.30 + rating * 0.25 + completion * 0.20 + response * 0.15 + age * 0.10`
