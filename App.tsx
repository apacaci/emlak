import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

import { C } from './src/theme';
import { buildListing, ListingForm, Tone } from './src/generate';

type Screen = 'home' | 'form' | 'draft' | 'share' | 'plans' | 'account';

type Destination = {
  id: string;
  name: string;
  hint: string;
  kind: 'social' | 'site';
  url?: string;
};

const DESTINATIONS: Destination[] = [
  { id: 'instagram', name: 'Instagram', hint: 'Fotoğraf aktarılır, açıklama panoya kopyalanır', kind: 'social' },
  { id: 'whatsapp', name: 'WhatsApp', hint: 'Kişiye, gruba ya da durumuna gönder', kind: 'social' },
  { id: 'facebook', name: 'Facebook', hint: 'Sayfanda ya da gruplarda paylaş', kind: 'social' },
  { id: 'sahibinden', name: 'sahibinden.com', hint: 'Açıklama kopyalanır, site açılır', kind: 'site', url: 'https://www.sahibinden.com' },
  { id: 'hepsiemlak', name: 'Hepsiemlak', hint: 'Açıklama kopyalanır, site açılır', kind: 'site', url: 'https://www.hepsiemlak.com' },
  { id: 'emlakjet', name: 'Emlakjet', hint: 'Açıklama kopyalanır, site açılır', kind: 'site', url: 'https://www.emlakjet.com' },
];

function splitDraft(text: string): { title: string; body: string } {
  const lines = text.split('\n');
  const title = (lines[0] ?? '').trim();
  const body = lines.slice(1).join('\n').trim();
  return { title, body };
}

const MONTHLY_QUOTA = 150;
const MAX_PHOTOS = 10;

const EMPTY_FORM: ListingForm = {
  type: 'Satılık',
  location: '',
  rooms: '',
  size: '',
  price: '',
  features: '',
  tone: 'Samimi',
};

export default function App() {
  const [stack, setStack] = useState<Screen[]>(['home']);
  const [form, setForm] = useState<ListingForm>(EMPTY_FORM);
  const [photos, setPhotos] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [used, setUsed] = useState(0);
  const [pending, setPending] = useState<Destination | null>(null);
  const [plan, setPlan] = useState<'yillik' | 'aylik'>('yillik');

  const screen = stack[stack.length - 1];
  const go = useCallback((s: Screen) => setStack((prev) => [...prev, s]), []);
  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);
  const goRoot = useCallback((s: Screen) => setStack(s === 'home' ? ['home'] : ['home', s]), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pending) {
        setPending(null);
        return true;
      }
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pending, back]);

  const remaining = MONTHLY_QUOTA - used;

  const addFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kamera izni gerekli', 'Fotoğraf çekmek için ayarlardan kamera iznini açmalısın.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) {
      setPhotos((p) => [...p, ...res.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const addFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!res.canceled) {
      setPhotos((p) => [...p, ...res.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (uri: string) => setPhotos((p) => p.filter((x) => x !== uri));

  const generate = () => {
    if (!form.location.trim() || !form.rooms.trim() || !form.size.trim()) {
      Alert.alert('Eksik bilgi', 'Konum, oda sayısı ve metrekare alanlarını doldurmalısın.');
      return;
    }
    if (remaining <= 0) {
      go('plans');
      return;
    }
    setDraft(buildListing(form));
    setUsed((u) => u + 1);
    setEditing(false);
    go('draft');
  };

  const regenerate = () => {
    if (remaining <= 0) {
      go('plans');
      return;
    }
    setDraft(buildListing(form, used));
    setUsed((u) => u + 1);
    setEditing(false);
  };

  const copyDraft = async () => {
    await Clipboard.setStringAsync(draft);
    Alert.alert('Kopyalandı', 'Metin panoya kopyalandı.');
  };

  const copyField = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Kopyalandı', `${label} panoya kopyalandı.`);
  };

  const parts = splitDraft(draft);

  const send = async (dest: Destination) => {
    setPending(null);
    try {
      if (dest.kind === 'site' && dest.url) {
        await Clipboard.setStringAsync(parts.body || draft);
        await Linking.openURL(dest.url);
        return;
      }
      await Clipboard.setStringAsync(draft);
      if (photos.length > 0 && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(photos[0], { dialogTitle: dest.name + ' ile paylaş' });
      } else {
        await Share.share({ message: draft });
      }
    } catch {
      Alert.alert('Gönderilemedi', 'Bir sorun oluştu. Metin panoya kopyalandı, elle yapıştırabilirsin.');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />

        {screen === 'home' && (
          <View style={s.flex}>
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.brand}>İlanYaz · deneme sürümü</Text>
              <Text style={s.h1}>Bugün ne yazalım?</Text>

              <Text style={s.section}>HAZIR İŞLER</Text>
              <TaskRow icon="home-outline" title="İlan metni yaz" sub="Satılık ya da kiralık, sahibinden'e hazır" onPress={() => go('form')} />
              <TaskRow icon="logo-instagram" title="Instagram gönderisi" sub="Yakında" disabled />
              <TaskRow icon="chatbubble-outline" title="Müşteriye takip mesajı" sub="Yakında" disabled />
              <TaskRow icon="trending-down-outline" title="Fiyat düşüşü duyurusu" sub="Yakında" disabled />

              <Text style={s.section}>ŞABLONLARIM</Text>
              <View style={s.emptyBox}>
                <Text style={s.muted}>Kendi şablonlarını kaydetme özelliği sonraki sürümde gelecek.</Text>
              </View>
            </ScrollView>
            <TabBar active="home" onHome={() => goRoot('home')} onAccount={() => goRoot('account')} />
          </View>
        )}

        {screen === 'form' && (
          <View style={s.flex}>
            <Header title="İlan metni yaz" onBack={back} />
            <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
              <View style={s.segment}>
                {(['Satılık', 'Kiralık'] as const).map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: form.type === t }}
                    onPress={() => setForm({ ...form, type: t })}
                    style={[s.segmentItem, form.type === t && s.segmentItemOn]}
                  >
                    <Text style={[s.segmentText, form.type === t && s.segmentTextOn]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Konum" value={form.location} placeholder="Örn. Kadıköy, Moda" onChange={(v) => setForm({ ...form, location: v })} />
              <View style={s.row}>
                <View style={s.flex}>
                  <Field label="Oda sayısı" value={form.rooms} placeholder="3+1" onChange={(v) => setForm({ ...form, rooms: v })} />
                </View>
                <View style={s.flex}>
                  <Field label="Metrekare" value={form.size} placeholder="135" numeric onChange={(v) => setForm({ ...form, size: v })} />
                </View>
              </View>
              <Field label="Fiyat (isteğe bağlı)" value={form.price} placeholder="Örn. 8.500.000 TL" onChange={(v) => setForm({ ...form, price: v })} />
              <Field
                label="Öne çıkan özellikler (virgülle ayır)"
                value={form.features}
                placeholder="Sahile yakın, güney cephe, asansörlü"
                multiline
                onChange={(v) => setForm({ ...form, features: v })}
              />

              <Text style={s.label}>Fotoğraflar ({photos.length})</Text>
              <PhotoStrip photos={photos} onCamera={addFromCamera} onGallery={addFromGallery} onRemove={removePhoto} />

              <Text style={s.label}>Üslup</Text>
              <View style={s.row}>
                {(['Kurumsal', 'Samimi', 'Kısa ve net'] as Tone[]).map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: form.tone === t }}
                    onPress={() => setForm({ ...form, tone: t })}
                    style={[s.pill, form.tone === t && s.pillOn]}
                  >
                    <Text style={[s.pillText, form.tone === t && s.pillTextOn]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <PrimaryButton label="Metni oluştur" onPress={generate} />
              <Text style={s.note}>Bu işlem 1 metin hakkını kullanır</Text>
            </ScrollView>
          </View>
        )}

        {screen === 'draft' && (
          <View style={s.flex}>
            <Header title="Taslağın hazır" onBack={back} />
            <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
              <Text style={s.muted}>
                {form.type} · {form.location} · {form.rooms} · {form.size} m² · {form.tone}
              </Text>
              <PhotoStrip photos={photos} onCamera={addFromCamera} onGallery={addFromGallery} onRemove={removePhoto} />

              <View style={s.card}>
                {editing ? (
                  <TextInput
                    accessibilityLabel="Taslak metin"
                    style={s.draftInput}
                    multiline
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                  />
                ) : (
                  <Text style={s.draftText}>{draft}</Text>
                )}
                <Pressable accessibilityRole="button" onPress={() => setEditing((e) => !e)} style={s.linkBtn}>
                  <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={18} color={C.accent} />
                  <Text style={s.linkText}>{editing ? 'Düzenlemeyi bitir' : 'Metni düzenle'}</Text>
                </Pressable>
              </View>

              <Text style={s.demoNote}>Deneme sürümü: bu metin yapay zekâdan değil, hazır şablondan üretildi.</Text>

              <View style={s.card}>
                <Text style={s.cardTitle}>İlan sitesi için alan alan kopyala</Text>
                <Text style={s.muted}>İlan formundaki her kutuya ayrı ayrı yapıştırabilirsin.</Text>
                <CopyRow label="Başlık" value={parts.title} onCopy={() => copyField('Başlık', parts.title)} />
                <CopyRow label="Açıklama" value={parts.body} onCopy={() => copyField('Açıklama', parts.body)} />
                {form.price.trim().length > 0 && (
                  <CopyRow label="Fiyat" value={form.price.trim()} onCopy={() => copyField('Fiyat', form.price.trim())} />
                )}
              </View>

              <PrimaryButton label="Paylaş veya gönder" icon="share-outline" onPress={() => go('share')} />
              <View style={s.row}>
                <SecondaryButton label="Kopyala" icon="copy-outline" onPress={copyDraft} />
                <SecondaryButton label="Yeniden yaz" icon="refresh" onPress={regenerate} />
              </View>
            </ScrollView>
          </View>
        )}

        {screen === 'share' && (
          <View style={s.flex}>
            <Header title="Nereye gönderelim?" onBack={back} />
            <ScrollView contentContainerStyle={s.pad}>
              <View style={[s.card, s.previewRow]}>
                {photos.length > 0 ? (
                  <Image source={{ uri: photos[0] }} style={s.previewThumb} accessibilityLabel="Kapak fotoğrafı" />
                ) : (
                  <View style={[s.previewThumb, s.thumbEmpty]}>
                    <Ionicons name="image-outline" size={22} color={C.muted} />
                  </View>
                )}
                <View style={s.flex}>
                  <Text style={s.previewTitle} numberOfLines={1}>
                    {draft.split('\n')[0]}
                  </Text>
                  <Text style={s.muted}>Taslak metin · {photos.length} fotoğraf</Text>
                </View>
              </View>

              <Text style={s.section}>SOSYAL MEDYA</Text>
              {DESTINATIONS.filter((d) => d.kind === 'social').map((d) => (
                <DestRow key={d.id} dest={d} onPress={() => setPending(d)} />
              ))}
              <Text style={s.section}>İLAN SİTELERİ</Text>
              {DESTINATIONS.filter((d) => d.kind === 'site').map((d) => (
                <DestRow key={d.id} dest={d} onPress={() => setPending(d)} />
              ))}
              <Text style={s.note}>Hiçbir şey sen onaylamadan gönderilmez.</Text>
            </ScrollView>
          </View>
        )}

        {screen === 'plans' && (
          <View style={s.flex}>
            <Header title="Planlar" onBack={back} />
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.h1}>Yazmaya devam et</Text>
              <Text style={s.body}>Her ay 150 metin hakkı, kendi şablonların ve yapay zekâyla yeni şablonlar.</Text>
              <PlanCard name="Yıllık" badge="%33 tasarruf" note="Ayda 3,33 $ · yılda bir ödeme" price="39,99 $" selected={plan === 'yillik'} onPress={() => setPlan('yillik')} />
              <PlanCard name="Aylık" note="Her ay ödeme" price="4,99 $" selected={plan === 'aylik'} onPress={() => setPlan('aylik')} />
              <PrimaryButton
                label={plan === 'yillik' ? 'Yıllık planla devam et' : 'Aylık planla devam et'}
                onPress={() => Alert.alert('Deneme sürümü', 'Ödeme bu sürümde çalışmıyor. Bu ekran yalnızca görünüm içindir.')}
              />
              <Text style={s.note}>Deneme sürümünde ödeme alınmaz.</Text>
            </ScrollView>
          </View>
        )}

        {screen === 'account' && (
          <View style={s.flex}>
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.h1}>Hesap</Text>
              <View style={s.card}>
                <View style={s.between}>
                  <Text style={s.cardTitle}>Bu ayki hakkın</Text>
                  <Text style={s.muted}>
                    {remaining} / {MONTHLY_QUOTA} metin
                  </Text>
                </View>
                <View style={s.barBg} accessibilityLabel={`${MONTHLY_QUOTA} metin hakkından ${remaining} tanesi duruyor`}>
                  <View style={[s.barFill, { width: `${(remaining / MONTHLY_QUOTA) * 100}%` }]} />
                </View>
                <Text style={s.muted}>Deneme sürümünde sayaç uygulama kapanınca sıfırlanır.</Text>
              </View>
              <View style={[s.card, s.between]}>
                <View>
                  <Text style={s.cardTitle}>Plan</Text>
                  <Text style={s.muted}>Deneme sürümü</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => go('plans')} style={s.linkBtn}>
                  <Text style={s.linkText}>Planları gör</Text>
                </Pressable>
              </View>
            </ScrollView>
            <TabBar active="account" onHome={() => goRoot('home')} onAccount={() => goRoot('account')} />
          </View>
        )}

        <Modal visible={pending !== null} transparent animationType="slide" onRequestClose={() => setPending(null)}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.grabber} />
              <Text style={s.sheetTitle}>{pending?.name} için gönderilsin mi?</Text>
              <Text style={s.body}>
                {pending?.kind === 'site'
                  ? 'Açıklama metni panoya kopyalanacak ve site açılacak. Başlık ve fiyat için uygulamaya dönüp taslak ekranındaki kopyala düğmelerini kullanabilirsin.'
                  : photos.length > 0
                    ? 'Kapak fotoğrafı paylaşım menüsüne aktarılacak, metin panoya kopyalanacak. Açıklama alanına yapıştırman yeterli.'
                    : 'Metin paylaşım menüsüne aktarılacak ve panoya kopyalanacak.'}
              </Text>
              <View style={s.sheetPreview}>
                {photos.length > 0 && (
                  <View style={s.row}>
                    {photos.slice(0, 4).map((uri) => (
                      <Image key={uri} source={{ uri }} style={s.thumb} accessibilityLabel="Gönderilecek fotoğraf" />
                    ))}
                  </View>
                )}
                <Text style={s.draftText} numberOfLines={3}>
                  {draft}
                </Text>
              </View>
              <PrimaryButton label="Evet, gönder" onPress={() => pending && send(pending)} />
              <SecondaryButton label="Vazgeç" onPress={() => setPending(null)} wide />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={onBack} style={s.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={C.ink} />
      </Pressable>
      <Text style={s.h2}>{title}</Text>
    </View>
  );
}

function TaskRow(props: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[s.taskRow, props.disabled && s.dim]}
    >
      <View style={s.taskIcon}>
        <Ionicons name={props.icon} size={20} color={C.accent} />
      </View>
      <View style={s.flex}>
        <Text style={s.cardTitle}>{props.title}</Text>
        <Text style={s.muted}>{props.sub}</Text>
      </View>
      {!props.disabled && <Ionicons name="chevron-forward" size={18} color={C.muted} />}
    </Pressable>
  );
}

function DestRow({ dest, onPress }: { dest: Destination; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.taskRow}>
      <View style={[s.destBadge, dest.kind === 'site' && s.destBadgeSite]}>
        <Text style={s.destLetter}>{dest.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={s.flex}>
        <Text style={s.cardTitle}>{dest.name}</Text>
        <Text style={s.muted}>{dest.hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </Pressable>
  );
}

function Field(props: { label: string; value: string; placeholder?: string; onChange: (v: string) => void; multiline?: boolean; numeric?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        style={[s.input, props.multiline && s.inputMulti]}
        value={props.value}
        placeholder={props.placeholder}
        placeholderTextColor={C.placeholder}
        onChangeText={props.onChange}
        multiline={props.multiline}
        keyboardType={props.numeric ? 'number-pad' : 'default'}
      />
    </View>
  );
}

function PhotoStrip(props: { photos: string[]; onCamera: () => void; onGallery: () => void; onRemove: (uri: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fotoğraf çek" onPress={props.onCamera} style={s.addPhoto}>
        <Ionicons name="camera-outline" size={20} color={C.accent} />
        <Text style={s.addPhotoText}>Çek</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Galeriden fotoğraf ekle" onPress={props.onGallery} style={s.addPhoto}>
        <Ionicons name="images-outline" size={20} color={C.accent} />
        <Text style={s.addPhotoText}>Galeri</Text>
      </Pressable>
      {props.photos.map((uri, i) => (
        <View key={uri}>
          <Image source={{ uri }} style={s.thumb} accessibilityLabel={`Fotoğraf ${i + 1}`} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1} kaldır`} onPress={() => props.onRemove(uri)} style={s.removePhoto} hitSlop={12}>
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function CopyRow(props: { label: string; value: string; onCopy: () => void }) {
  return (
    <View style={s.copyRow}>
      <View style={s.flex}>
        <Text style={s.label}>{props.label}</Text>
        <Text style={s.copyValue} numberOfLines={2}>
          {props.value || 'Boş'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.label} kopyala`}
        disabled={!props.value}
        onPress={props.onCopy}
        style={({ pressed }) => [s.copyBtn, pressed && s.pressed, !props.value && s.dim]}
      >
        <Ionicons name="copy-outline" size={18} color={C.accent} />
        <Text style={s.linkText}>Kopyala</Text>
      </Pressable>
    </View>
  );
}

function PrimaryButton(props: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
      {props.icon && <Ionicons name={props.icon} size={20} color="#FFFFFF" />}
      <Text style={s.primaryText}>{props.label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; wide?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={({ pressed }) => [s.secondary, !props.wide && s.flex, pressed && s.pressed]}>
      {props.icon && <Ionicons name={props.icon} size={18} color={C.ink} />}
      <Text style={s.secondaryText}>{props.label}</Text>
    </Pressable>
  );
}

function PlanCard(props: { name: string; badge?: string; note: string; price: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[s.plan, props.selected && s.planOn]}
    >
      <View style={[s.radio, props.selected && s.radioOn]}>{props.selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View>
      <View style={s.flex}>
        <View style={s.planNameRow}>
          <Text style={s.cardTitle}>{props.name}</Text>
          {props.badge && <Text style={s.badge}>{props.badge}</Text>}
        </View>
        <Text style={s.muted}>{props.note}</Text>
      </View>
      <Text style={s.price}>{props.price}</Text>
    </Pressable>
  );
}

function TabBar(props: { active: 'home' | 'account'; onHome: () => void; onAccount: () => void }) {
  return (
    <View style={s.tabBar}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: props.active === 'home' }} onPress={props.onHome} style={s.tab}>
        <Ionicons name={props.active === 'home' ? 'home' : 'home-outline'} size={22} color={props.active === 'home' ? C.accent : C.muted} />
        <Text style={[s.tabText, props.active === 'home' && s.tabTextOn]}>Ana sayfa</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: props.active === 'account' }} onPress={props.onAccount} style={s.tab}>
        <Ionicons name={props.active === 'account' ? 'person' : 'person-outline'} size={22} color={props.active === 'account' ? C.accent : C.muted} />
        <Text style={[s.tabText, props.active === 'account' && s.tabTextOn]}>Hesap</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ground },
  flex: { flex: 1 },
  pad: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  brand: { fontSize: 14, color: C.muted },
  h1: { fontSize: 28, fontWeight: '700', color: C.ink },
  h2: { fontSize: 22, fontWeight: '700', color: C.ink },
  body: { fontSize: 15, lineHeight: 22, color: C.muted },
  section: { fontSize: 13, fontWeight: '600', color: C.muted, letterSpacing: 0.5, marginTop: 8 },
  muted: { fontSize: 13, color: C.muted },
  note: { fontSize: 12, color: C.muted, textAlign: 'center' },
  demoNote: { fontSize: 12, color: C.muted },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  dim: { opacity: 0.55 },
  taskIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  destBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  destBadgeSite: { borderRadius: 10, backgroundColor: C.chip },
  destLetter: { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong, borderRadius: 14, padding: 14 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  segment: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentItemOn: { backgroundColor: C.card, borderColor: C.borderStrong },
  segmentText: { fontSize: 15, color: C.muted },
  segmentTextOn: { color: C.ink, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: C.muted },
  input: {
    minHeight: 48, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: C.ink,
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top' },
  strip: { gap: 8, paddingVertical: 2 },
  addPhoto: {
    width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accent,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addPhotoText: { fontSize: 11, fontWeight: '600', color: C.accent },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.chip },
  removePhoto: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(20,32,27,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  pill: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pillOn: { backgroundColor: C.accent, borderColor: C.accent },
  pillText: { fontSize: 14, color: C.ink },
  pillTextOn: { color: '#FFFFFF', fontWeight: '600' },
  primary: { height: 54, borderRadius: 14, backgroundColor: C.accent, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondary: { height: 48, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderStrong, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: C.ink },
  pressed: { opacity: 0.8 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  copyValue: { fontSize: 14, lineHeight: 20, color: C.ink },
  copyBtn: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.accent, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  linkText: { fontSize: 14, fontWeight: '600', color: C.accent },
  draftText: { fontSize: 15, lineHeight: 23, color: C.ink },
  draftInput: { fontSize: 15, lineHeight: 23, color: C.ink, minHeight: 200, textAlignVertical: 'top', padding: 0 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  previewThumb: { width: 52, height: 52, borderRadius: 10 },
  thumbEmpty: { backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 16, padding: 16 },
  planOn: { borderWidth: 2, borderColor: C.accent },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.radio, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: C.accent, borderColor: C.accent },
  badge: { fontSize: 12, fontWeight: '600', color: C.accentDark, backgroundColor: C.tint, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  price: { fontSize: 18, fontWeight: '700', color: C.ink },
  barBg: { height: 8, borderRadius: 4, backgroundColor: C.tint },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.accent },
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 6 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabText: { fontSize: 12, color: C.muted },
  tabTextOn: { color: C.accent, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,32,27,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 14 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: 'center' },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: C.ink },
  sheetPreview: { backgroundColor: C.ground, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 10 },
});
