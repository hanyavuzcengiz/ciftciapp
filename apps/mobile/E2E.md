# Mobile E2E (Maestro)

Bu klasor, mobil uygulama icin temel E2E smoke test altyapisini icerir.

## Kapsam

- Uygulama acilisi
- Splash goruntulenmesi
- Onboarding akisi
- Telefon giris ekranina ulasim
- Dev kisayolu ile giris ve tab bar dogrulamasi

## On kosullar

- Android emulator veya fiziksel Android cihaz acik olmali
- `apps/mobile` tarafinda uygulama kurulu olmali (`com.agromarket.app`)
- Maestro CLI kurulu olmali
- `smoke-otp-api.yaml` icin: API gateway ve user-service calisir olmali; mobil `EXPO_PUBLIC_API_URL` emulator/cihazdan erisilebilir IP olmali; user-service `NODE_ENV` **production olmamali** (sabit test OTP `123456` yalnizca non-production’da kabul edilir)

Ornek Maestro kurulum:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Calistirma

`apps/mobile` klasorunde:

```bash
pnpm run e2e:smoke
```

Hizli ikili (onboarding + dev ile tab bar, backend gerekmez):

```bash
pnpm run e2e:smoke:quick
```

Dev login + tab smoke:

```bash
pnpm run e2e:smoke:tabs-dev
```

OTP + API + profil kaydi + ana sekme (Maestro):

```bash
pnpm run e2e:smoke:otp-api
```

Profil adiminda `register-complete` icin bearer token gerekir; ag/API kesilirse `EXPO_PUBLIC_ENABLE_MOCK_DATA=true` iken uygulama yine de sekmelere gecebilir.

Akim sonunda **Ara**, **Ilan ver**, **Mesajlar** ve **Profil** sekmeleri gezilip ana ekrana donulerek temel navigasyon dogrulanir.

JUnit ciktisi ile:

```bash
pnpm run e2e:smoke:android
```

## Notlar

- Bu su an bir smoke iskeletidir; sonraki adimda OTP dogrulama, ilan olusturma ve mesajlasma akislari genisletilecek.
- CI entegrasyonunda `.maestro/results` artefakt olarak toplanmalidir.
