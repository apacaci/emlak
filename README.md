# İlanYaz (deneme sürümü)

Emlakçılar için ilan metni asistanı. Bu sürüm bir denemedir:

- İlan bilgilerini doldur, taslak metni al, düzenle.
- Kamerayla fotoğraf çek ya da galeriden ekle.
- Onay ekranından sonra paylaş menüsüyle gönder ya da metni kopyalayıp ilan sitesini aç.
- Metinler yapay zekâdan değil, `src/generate.ts` içindeki şablonlardan üretilir.
- Giriş ve ödeme yoktur; kalan hak sayacı uygulama kapanınca sıfırlanır.

## APK

`main` dalına her gönderimde GitHub Actions bir APK derler ve depo sayfasındaki
"Releases" bölümüne ekler.

## Bilgisayarda çalıştırma

```bash
npm install
npx expo start
```
