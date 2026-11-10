// Deneme sürümü: metin yapay zekâdan değil, bu şablonlardan üretilir.
// Gerçek sürümde bu dosyanın yerini sunucudaki yapay zekâ çağrısı alacak.

export type Tone = 'Kurumsal' | 'Samimi' | 'Kısa ve net';

export type ListingForm = {
  type: 'Satılık' | 'Kiralık';
  location: string;
  rooms: string;
  size: string;
  price: string;
  features: string;
  tone: Tone;
};

function capitalize(text: string): string {
  const t = text.trim();
  return t ? t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1) : t;
}

function splitFeatures(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((f) => capitalize(f))
    .filter((f) => f.length > 0);
}

const OPENINGS: Record<Tone, string[]> = {
  Kurumsal: [
    '{loc} bölgesinde yer alan {size} m² {rooms} dairemiz {typeLower} olarak portföyümüze eklenmiştir.',
    '{loc} konumunda, {size} m² kullanım alanına sahip {rooms} daire {typeLower} olarak sunulmaktadır.',
  ],
  Samimi: [
    '{loc} bölgesinde, içine girer girmez "burası" diyeceğiniz {size} m² {rooms} dairemiz {typeLower}.',
    '{loc} tarafında ev bakanlara güzel haber: {size} m² {rooms} dairemiz {typeLower}.',
  ],
  'Kısa ve net': ['{loc}, {rooms}, {size} m², {typeLower} daire.', '{typeUpper} {rooms} daire. {loc}, {size} m².'],
};

const CLOSINGS: Record<Tone, string[]> = {
  Kurumsal: [
    'Detaylı bilgi ve randevu için ofisimizle iletişime geçebilirsiniz.',
    'Yerinde görmek için randevu talebinizi bekliyoruz.',
  ],
  Samimi: [
    'Yerinde görmek için bizi arayın, size uygun bir saatte randevu oluşturalım.',
    'Fotoğraflar güzel ama yerinde görmek bambaşka. Arayın, birlikte gezelim.',
  ],
  'Kısa ve net': ['Bilgi ve randevu için arayın.', 'Randevu için arayın.'],
};

export function buildListing(form: ListingForm, variant = 0): string {
  const loc = form.location.trim();
  const rooms = form.rooms.trim();
  const size = form.size.trim();
  const price = form.price.trim();
  const features = splitFeatures(form.features);

  const fill = (template: string) =>
    template
      .replace('{loc}', loc)
      .replace('{rooms}', rooms)
      .replace('{size}', size)
      .replace('{typeLower}', form.type.toLocaleLowerCase('tr-TR'))
      .replace('{typeUpper}', form.type);

  const openings = OPENINGS[form.tone];
  const closings = CLOSINGS[form.tone];
  const opening = fill(openings[variant % openings.length]);
  const closing = closings[variant % closings.length];

  const title = `${loc} ${form.type.toLocaleLowerCase('tr-TR')} ${rooms} daire, ${size} m²`;
  const lines: string[] = [capitalize(title), '', opening];

  if (features.length > 0) {
    lines.push('');
    for (const f of features) lines.push(`• ${f}`);
  }
  if (price) {
    lines.push('', `Fiyat: ${price}`);
  }
  lines.push('', closing);
  return lines.join('\n');
}
