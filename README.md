# Тоглоомын Тавцан

Монгол хэл дээрх онлайн ширээний/бодлогын тоглоомын вэбсайт ([playboard.gg](https://playboard.gg)-с санаа авсан). Next.js (App Router) + TypeScript + Tailwind CSS дээр бүтээгдсэн.

## Локал ажиллуулах

```bash
npm install
npm run dev
```

Дараа нь [http://localhost:3000](http://localhost:3000) хаягаар нээнэ.

## Supabase тохиргоо

Ирээдүйн онлайн олон тоглогч (playroom) болон зарын систем нь [Supabase](https://supabase.com) ашиглана (үнэгүй tier дээр ажиллана).

1. [supabase.com](https://supabase.com)-д шинэ төсөл үүсгэнэ.
2. `.env.example`-г хуулж `.env.local` нэрээр хадгална:
   ```bash
   cp .env.example .env.local
   ```
3. Project Settings → API хэсгээс `Project URL` болон `anon public` key-г аваад `.env.local`-д бичнэ:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Зарын хүснэгтийг үүсгэхийн тулд `supabase/migrations/0001_ads.sql`-г Supabase SQL Editor дээр ажиллуулна (эсвэл Supabase CLI ашиглаж болно: `supabase db push`).

> **Тэмдэглэл:** Supabase тохируулаагүй үед сайт хэвийн ажиллана — зарын байршилд зөвхөн placeholder ("house ad") харагдаж, онлайн олон тоглогчийн функц идэвхгүй хэвээр байна.

## Нууц зурвас (нэрээ нууцалсан зурвас)

`/zurvas` — хэрэглэгч нэр, нууц үгээр бүртгүүлж өөрийн линкийг (`/u/<нэр>`) авна. Линкээр орсон хэн ч нэвтрэхгүйгээр нэрээ нууцлан зурвас илгээнэ. Эзэмшигч `/zurvas/inbox` дээр зурвасуудаа уншиж, Story зураг (1080x1920) болгон хуваалцаж, устгаж, илгээгчийг блоклож чадна.

**Тохиргоо (production):**

1. `supabase/migrations/0002_zurvas.sql`-г Supabase SQL Editor дээр ажиллуулна.
2. Серверийн орчны хувьсагч нэмнэ (Vercel → Settings → Environment Variables):
   ```
   SUPABASE_SERVICE_ROLE_KEY=...   # Project Settings → API → service_role (нууц!)
   ZURVAS_SECRET=...               # openssl rand -base64 32
   ```

> Локал дээр Supabase тохируулаагүй бол өгөгдөл `.data/zurvas.json` файлд хадгалагдана (зөвхөн `npm run dev`). Production дээр Supabase заавал хэрэгтэй.

**Аюулгүй байдал:** зурвасын хүснэгтүүдэд зөвхөн сервер (service role) хандана, RLS-ээр public хандалт хаалттай. Илгээгчийн IP хадгалагдахгүй — зөвхөн HMAC хэш (давтамж хязгаарлах: 10 минутад 8 зурвас, блоклоход). Нууц үг scrypt-ээр хэшлэгдэнэ.

## Бэлэг (кофе)

`/u/<нэр>/gift` — илгээгч кофе бэлэглэнэ: нэрээ нууцлах эсвэл харуулахаа сонгож (нэвтэрсэн бол баталгаатай `@нэр`, үгүй бол өөрийн бичсэн нэр), QPay-ээр төгрөгөөр төлнө. Төлбөр баталгаажмагц хүлээн авагчийн inbox-д бэлэг QR кодтой гарч ирнэ. QR нь `/redeem/<код>` хаяг бөгөөд түнш кофе шопын ажилтан уншуулаад **түншийн кодоо** оруулж бэлгийг олгоно. Бэлэг төлөгдсөнөөс хойш **30 хоног** хүчинтэй, нэг л удаа ашиглагдана.

**Тохиргоо (production):**

1. `supabase/migrations/0003_zurvas_gifts.sql`-г ажиллуулна.
2. QPay-тэй мерчантын гэрээ хийж `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`, мөн `NEXT_PUBLIC_SITE_URL`-г тохируулна (`.env.example`-г үз).
3. Түнш кофе шопыг SQL-ээр нэмнэ (migration файлын төгсгөлд жишээ бий).
4. Үнийг `lib/zurvas/gifts.ts` дотор тохируулна (одоогийн 9,000₮ нь жишээ).

> Локал дээр QPay тохируулаагүй бол **туршилтын төлбөр** (mock) ажиллана — төлбөрийн дэлгэц дээр "Туршилтын төлбөр төлөх" товч гарна. Туршилтын түншийн код: `DEMO-COFFEE`. Production дээр mock бүрэн унтарна.

> ⚠️ QPay интеграц (`lib/zurvas/payments.ts`) нь QPay Merchant API v2-ийн дагуу бичигдсэн боловч **бодит QPay данстай туршаагүй** — эхлээд sandbox дээр шалгана уу. Банкны картын төлбөр хараахан хийгдээгүй (`PaymentProvider` интерфэйсээр нэмнэ).

## Одоогийн байдал

- ✅ Кофе бэлэглэх: QPay төлбөр (+ dev mock), 30 хоногийн QR код, түнш кофе шопын олголт

- ✅ Нууц зурвас: бүртгэл/нэвтрэлт, нийтийн линк, inbox, Story зураг, устгах/блоклох

- ✅ Нүүр хуудас, тоглоомын карт grid, зарын banner слот
- ✅ Хөндлөвч тоглоом (Tic-Tac-Toe) — локал 2 тоглогчийн горим, ялалт/тэнцлэлт илрүүлэлт
- ✅ Тоглоом дууссаны дараах үр дүнгийн дэлгэц + 1080x1920 (Instagram Story хэмжээтэй) хуваалцах зураг үүсгэгч (`next/og` ашигласан, `/api/result-image` эндпойнт)
- ✅ Зарын систем: Supabase `ads` хүснэгт (SQL migration), `<AdBanner />` компонент, impressions/clicks тооллого
- ✅ Supabase клиент (`lib/supabase.ts`) болон Realtime тоглоомын өрөөний stub (`lib/realtime.ts`)
- 🚧 Онлайн олон тоглогчийн горим (`/games/tic-tac-toe/room/[roomId]`) — зөвхөн "Тун удахгүй" placeholder, бодит логик хийгдээгүй

## Төслийн бүтэц

```
app/                    # App Router маршрутууд (хуудас бүр)
  api/result-image/     # Хуваалцах PNG зураг үүсгэгч (edge route, next/og)
  games/tic-tac-toe/    # Тоглоомын хуудас + онлайн өрөөний placeholder
components/             # Дахин ашиглагдах UI компонентууд
  games/                # Тоглоом тус бүрийн UI
  zurvas/, u/[username]/  # Нууц зурвас: нүүр + inbox, нийтийн илгээх хуудас
  api/zurvas/           # Нууц зурвасын API (signup, login, send, ...)
lib/zurvas/             # Нууц зурвасын сервер логик (store, auth) + клиент туслахууд
lib/                    # Supabase клиент, ads, realtime, resultImage helper-ууд
games/                  # Тоглоом тус бүрийн цэвэр логик (UI-гүй)
supabase/migrations/    # SQL migration файлууд
```

## Дараагийн алхмууд

1. **Онлайн олон тоглогч** — `lib/realtime.ts` дэх commented-out жишээг ашиглан Supabase Realtime сувгаар бодит цагийн тоглоом хэрэгжүүлэх (`rooms` хүснэгт, presence, broadcast moves).
2. **Илүү олон тоглоом нэмэх** — Шашки (checkers), Дөрөв дараалуулах (Connect Four), Шатар (Stockfish WASM ашиглан). `lib/games.ts`-д метадата нэмээд `/games/<id>` дор шинэ маршрут үүсгэхэд л хангалттай.
3. **Зарын admin хуудас** — `/admin/ads` дор зар нэмэх/засах/идэвхжүүлэх, статистик (impressions/clicks) харах энгийн удирдлагын интерфэйс (`lib/ads.ts` доторх TODO-г үзнэ үү).
4. **Үр дүнгийн зургийн дизайныг сайжруулах** — Илүү олон загвар, тоглоом бүрт өөр өнгө палитр, тоглогчийн avatar/нэр гэх мэт.
