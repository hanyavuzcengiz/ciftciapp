# AgroMarket Monorepo

Türkiye tarım ve hayvancılık odaklı, mikroservis tabanlı mobil pazaryeri iskeleti (Clean Architecture + API Gateway).

## Monorepo yapısı

- `apps/mobile`: Expo SDK 51 + React Native 0.74 + Expo Router + Zustand + TanStack Query
- `apps/admin-panel`: Next.js 14 (ana sayfa + moderasyon sayfası)
- `services/*`: Mikroservisler (TypeScript)
- `packages/shared-types`, `shared-utils`, `ui-components`: Ortak kod
- `infra/*`: Kubernetes + Terraform iskeleti

## Servis portları (yerel)

| Servis | Port | Açıklama |
|--------|------|----------|
| api-gateway | 3000 | Tüm `/api/v1/*` trafiği |
| user-service | 3001 | Auth, kullanıcı, doğrulama, reviews |
| listing-service | 3002 | İlanlar |
| offer-service | 3003 | Teklifler |
| messaging-service | 3004 | Konuşma / mesaj |
| notification-service | 3005 | Bildirim kuyruğu |
| search-service | 3006 | Arama (`ELASTICSEARCH_URL` ile ES; yoksa `LISTING_SERVICE_URL` veya bellek) |
| payment-service | 3007 | Ödeme intent |
| admin-service | 3008 | Yönetim API (`x-admin-key`) |
| ai-service (Node) | 3009 | AI köprüsü + graceful degradation |
| ai-python (Docker) | 8010 | FastAPI (`docker compose` ile) |

## Ortam değişkenleri

Örnek: `.env.example` (JWT, `REDIS_URL`, `ELASTICSEARCH_URL`, `ADMIN_API_KEY`, `PYTHON_AI_URL`, `REQUEST_SIGNING_SECRET`, `CORS_ORIGINS`, `LISTING_SERVICE_URL`, …).

- `REDIS_URL` tanımlıysa refresh token rotasyonu Redis üzerinde saklanır; yoksa bellek içi store kullanılır.
- `CORS_ORIGINS`: virgülle ayrılmış origin listesi; `*` tüm originlere izin verir (yalnızca geliştirme). Varsayılan Expo + `http://localhost:8081`.
- `LISTING_SERVICE_URL`: `search-service` Elasticsearch kullanmıyorsa ilan verisini bu URL’den çeker (varsayılan `http://127.0.0.1:3002`).
- `PAYMENT_PROVIDER_MODE`: `mock` (default) veya `live`; `live` modda ilgili sağlayıcı için `PAYMENT_IYZICO_*` / `PAYMENT_STRIPE_*` değişkenleri birlikte verilmelidir.
- `LISTING_DATABASE_URL`: **listing-service** Prisma bağlantısı (genelde `DATABASE_URL` ile aynı veritabanı; tablolar `listings_app`, `listing_favorites`).
- **İlan migration sırası:** Önce `services/user-service/prisma/migrations/0001_init` ile `users` tablosu oluşmalı; sonra listing-service migrasyonları (`author_uuid` FK için). `ELASTICSEARCH_URL` tanılıysa yayınlanan ilanlar `listings` indeksine yazılır / pasif olunca silinir.
- **User-service + Postgres:** `DATABASE_URL` tanılıysa OTP doğrulaması `users` satırı oluşturur/günceller (`phone_verified`); `POST /api/v1/auth/register-complete` **Bearer JWT** ister ve ad / `user_type` yazar. `DATABASE_URL` yoksa auth yine çalışır, sadece kalıcı kullanıcı kaydı atlanır.
- **Profil API:** `GET/PUT /api/v1/users/me` (gateway üzerinden JWT + `x-user-id`) veritabanından `fullName`, `trustScore`, doğrulama durumu döner. `GET /api/v1/users/:id` herkese açık özet profil; `GET .../listings` aynı Postgres içindeki `listings_app` satırlarını (satıcı telefonu eşleşince) listeler — `listings_app` yoksa boş dizi.

## Hızlı başlangıç

```bash
pnpm install
docker compose up -d
# İlan servisi tabloları (Postgres ayağa kalktıktan sonra, yerel geliştirme):
# LISTING_DATABASE_URL=.env uyumlu olmalı
pnpm --filter @agromarket/listing-service db:migrate
pnpm dev
```

Tek tek servis çalıştırmak için: `pnpm --filter @agromarket/api-gateway dev` vb.

## CI / kalite

- `pnpm lint` — tsc tabanlı tip kontrolü (workspace geneli)
- `pnpm typecheck` — Turbo `typecheck` görevleri (CI’da da çalışır)
- `pnpm test` — Jest (`user-service`) + diğer paketlerde no-op test stub
- `pnpm build` — Turbo ile derleme
- `pnpm verify` — smoke check-list doğrulama + lint + typecheck + test + build

## Smoke / CI Smoke

- Yerelde smoke: `pnpm smoke:prod` (metin), `pnpm smoke:prod:json` (JSON), `pnpm smoke:prod:verbose`
- Sadece kontrol listesini doğrulama (ağsız): `pnpm smoke:validate-list`
- Opsiyonel metrics smoke profili: `SMOKE_CHECK_METRICS=1 pnpm smoke:prod:json`
- Gateway metrics endpoint'i opsiyoneldir: `GATEWAY_PROMETHEUS_METRICS=1` iken `GET /metrics` açılır
- CI workflow: `.github/workflows/ci-smoke.yml`
  - `workflow_dispatch` input `enable_metrics_smoke` (default `true`)
  - `workflow_dispatch` input `slow_check_warn_ms` (default `5000`)
  - `workflow_dispatch` input `fail_on_slow_checks` (default `false`) — aciksa threshold asiminda job fail olur
  - Job summary'de: profil bazlı OK/failed/check sayısı, ilk hatalar (`hint` ile), en yavaş 3 check ve latency warning satırı

## Git line endings

- Repo `.gitattributes` ile metin dosyalarini varsayilan olarak `LF` normalize eder.
- Windows script dosyalari (`.ps1`, `.bat`, `.cmd`) bilerek `CRLF` tutulur.
- Gorsel/PDF gibi binary dosyalar text donusumunden korunur.

## Docker

`docker-compose.yml`: PostgreSQL (PostGIS), Redis, MongoDB, Elasticsearch, RabbitMQ, Kafka (Zookeeper), **ai-python** (FastAPI, 8010 → 8000), isteğe bağlı **listing-service** (Prisma migrate + API, yalnızca `127.0.0.1:3002`).

Python AI: `services/ai-service/python` — `Dockerfile` + `requirements.txt`.

**Güvenlik:** `listing-service` portunu internete açmayın; üretimde yalnızca API Gateway veya mesh içinden erişilebilir olmalı. İstemci asla doğrudan 3002’ye güvenmemeli (JWT / `x-user-id` sadece gateway üretir). Docker’da port `127.0.0.1` ile kısıtlıdır.

## Mimari notlar

- API Gateway: auth rate limit, Bearer access JWT doğrulaması (`JWT_SECRET`, user-service ile aynı olmalı), geçerli tokenlarda `sub` → `x-user-id` ile downstream’e aktarımı, admin için `x-admin-key`, ödemeler için HMAC (`REQUEST_SIGNING_SECRET`). `/api/v1/listings` için **GET/HEAD/OPTIONS** herkese açık; **yazma ve diğer metodlar** JWT ister. **GET** `/api/v1/users/:userId`, `.../listings`, `.../reviews` ( `:userId !== me` ) için JWT istenmez — satıcı profili herkese açık.
- OpenAPI: `services/api-gateway/openapi/openapi.yaml`
- PostgreSQL: hedef şema için `services/user-service/prisma/migrations/0001_init/migration.sql` (users, çekirdek `listings` tablosu vb.). Çalışan **listing-service** verisi ayrıca `services/listing-service/prisma/migrations` altındaki **`listings_app`** tablolarında tutulur (JWT `sub` telefon = `user_id`).

## Üretim öncesi

Gerçek ortamda: token iptal listesi / JWKS, NVI/GİB entegrasyonları, ilan tablosunun ana şema (`listings` / kullanıcı UUID) ile hizalanması, Elasticsearch indeks yönetimi, Prometheus/Grafana ve düzgün E2E (Detox) / yük (k6) senaryoları eklenmelidir.

## Tasarım backlog

- UI/UX önceliklendirilmiş iş listesi: `docs/ui-ux-backlog.md`
