# İlanYaz (deneme sürümü)

Emlakçılar için ilan metni asistanı. Bu sürüm bir denemedir.

## Yapı

- `web/`: Uygulamanın kendisi. Bootstrap ile yazılmış web sitesi.
- `App.tsx`: Android uygulaması. Yalnızca yayındaki siteyi bir WebView içinde gösterir;
  kopyalama, dış bağlantılar ve geri tuşu için küçük bir köprü içerir.

Site güncellenince uygulama da güncellenir, yeni APK gerekmez. Yeni APK yalnızca
`App.tsx` ya da `app.json` değiştiğinde gerekir.

## Deneme sürümünün sınırları

- Metinler yapay zekâdan değil, `web/index.html` içindeki şablonlardan üretilir.
- Giriş ve ödeme yoktur; kalan hak sayacı yalnızca o cihazda tutulur.

## Yayın

- Web sitesi: `web/` altındaki her değişiklikte GitHub Actions siteyi GitHub Pages'e
  yükler. Adres: https://apacaci.github.io/emlak/
  (Bir kez depo ayarlarında Settings → Pages → Source: "GitHub Actions" seçilmelidir.)
- APK: `web/` dışındaki her değişiklikte GitHub Actions bir APK derler ve depo
  sayfasındaki "Releases" bölümüne ekler.

## Bilgisayarda çalıştırma

```bash
npm install
npx expo start
```
