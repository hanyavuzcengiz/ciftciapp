# UI/UX Backlog (Issue Checklist)

Bu dokuman, arayuz olgunlugunu hizli sekilde artirmak icin oncelikli is listesini GitHub issue checklist formatinda tutar.

## P0 - Kritik (hemen)

### 1) Payment flow UX netlestirme
- [ ] Odeme bekleniyor / basarili / basarisiz / iade ekran durumlari tek dilde standardize edilsin.
- [ ] Basarisiz odemede kullaniciya acik, eylem odakli hata metni verilsin.
- [ ] Durum ekranlarinda birincil CTA (Tekrar dene / Ana sayfaya don) net olsun.
- [ ] Basarili odeme sonrasi yonlendirme (ilan, siparis, mesaj) tutarli olsun.

**Definition of Done**
- [ ] Tum durum ekranlari tasarim ve metin acisindan birbiriyle tutarli.
- [ ] En az 3 hata senaryosu manuel QA ile dogrulandi.

### 2) Ilan olusturma adimli akis iyilestirme
- [ ] Adimlarin ustunde kalici ilerleme gostergesi olsun.
- [ ] Her adimda zorunlu alanlar net isaretlensin.
- [ ] Alan bazli dogrulama hatalari "neyi nasil duzeltecegini" aciklasin.
- [ ] Medya yukleme ve fiyat girisinde bos/hata durumlari netlestirilsin.

**Definition of Done**
- [ ] Kullanici adimlar arasinda kaybolmadan akis sonuna gelebiliyor.
- [ ] En az 1 tam happy-path ve 2 hata-path manuel test edildi.

### 3) Search/filter geri bildirimini guclendirme
- [ ] Uygulanan filtrelerin gorunur "aktif filtre" ozeti olsun.
- [ ] Filtre temizleme tek adimda calissin ve hemen geri bildirim versin.
- [ ] Empty-state ekrani yonlendirici CTA icerisin.

**Definition of Done**
- [ ] Filtre ac/kapat ve temizle aksiyonlari tutarli calisiyor.
- [ ] Empty-state metin/CTA UX onayindan gecti.

## P1 - Yuksek (kisa vade)

### 4) Bildirim deneyimi polish
- [ ] Bildirim tiplerine gore ikon/renk dili standardize edilsin.
- [ ] Okundu/okunmadi durumu görsel olarak belirginlestirilsin.
- [ ] Bildirimden acilan deep-link hedefleri kontrol edilsin.

### 5) Mesajlasma okunabilirlik
- [ ] Sohbet listesinde son mesaj, zaman ve okunmamis badge hiyerarsisi net olsun.
- [ ] Konusma ekraninda sistem mesajlari ve teklif mesajlari ayrissin.

### 6) A11y hizli gecis
- [ ] Kontrast oranlari temel WCAG seviyesinde kontrol edilsin.
- [ ] Dokunma alanlari (touch target) kritik butonlarda yeterli olsun.
- [ ] Odak/focus gorunurlugu web ekranlarda dogrulansin.

## P2 - Orta vade

### 7) Tasarim sistemi hardening
- [ ] Buton/input/card/notice/skeleton varyantlari tek kaynakta dokumante edilsin.
- [ ] Tekrar eden stil farklari component seviyesine cekilsin.

### 8) Mikro-etkilesim standardi
- [ ] Loading gecisleri ve animasyon sureleri bir standarda baglansin.
- [ ] Success/error toast davranisi ekranlar arasi uyumlulastirilsin.

## Onerilen Iki Gunluk Uygulama Sirasi

### Gun 1
- [ ] Payment flow UX netlestirme
- [ ] Ilan olusturma adimli akis iyilestirme

### Gun 2
- [ ] Search/filter geri bildirim
- [ ] Bildirim + mesajlasma polish
- [ ] A11y hizli gecis

## Takip Metrikleri
- [ ] Task tamamlama orani (step-drop analizi)
- [ ] Form terk orani (ilan olusturma)
- [ ] Odeme basari / tekrar deneme orani
- [ ] Empty-state sonrasi aksiyon orani
