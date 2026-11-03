import { useTranslation } from '@hangyul/i18n';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Image as ImageIcon, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '../components/AppText';
import { ListGroup, ListItem } from '../components/List';
import { Sheet } from '../components/Patterns';
import { theme } from '../theme';

/** A picked file in the shape `api.documents.upload` / multipart fetch accept on React Native. */
export interface PickedFile { uri: string; name: string; type: string; size?: number | null }
export type PickSource = 'camera' | 'library' | 'files';

const MAX_BYTES = 15 * 1024 * 1024;
const extFromMime = (m: string) => (m.includes('pdf') ? 'pdf' : m.includes('png') ? 'png' : m.includes('webp') ? 'webp' : 'jpg');

/**
 * Native file picking: camera (document photo), photo library or files (PDF).
 * Returns null when the user cancels or denies permission; throws only on real errors.
 */
export async function pickFile(source: PickSource): Promise<PickedFile | null> {
  if (source === 'files') {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf', size: a.size ?? null };
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: false, exif: false };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const type = a.mimeType ?? 'image/jpeg';
  return { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.${extFromMime(type)}`, type, size: a.fileSize ?? null };
}

export function isTooLarge(f: PickedFile) {
  return !!f.size && f.size > MAX_BYTES;
}

/** Bottom sheet: camera / photos / files, with the privacy promise stated where the decision is made. */
export function UploadSheet({ visible, title, onClose, onPicked, allowCamera = true }: {
  visible: boolean; title: string; onClose: () => void; onPicked: (f: PickedFile) => void; allowCamera?: boolean;
}) {
  const { t } = useTranslation('mobile');
  const [error, setError] = useState<string | null>(null);
  const choose = async (src: PickSource) => {
    setError(null);
    try {
      const f = await pickFile(src);
      if (!f) return;
      if (isTooLarge(f)) { setError(t('v3.upload.tooLarge')); return; }
      onClose();
      onPicked(f);
    } catch (e) {
      setError((e as Error).message || t('v3.upload.failed'));
    }
  };
  return (
    <Sheet visible={visible} title={title} onClose={onClose} closeLabel={t('common:actions.cancel')}>
      <ListGroup>
        {allowCamera ? <ListItem icon={Camera} title={t('v3.upload.camera')} subtitle={t('v3.upload.cameraHint')} onPress={() => void choose('camera')} /> : null}
        <ListItem icon={ImageIcon} title={t('v3.upload.library')} onPress={() => void choose('library')} />
        <ListItem icon={FileText} title={t('v3.upload.files')} subtitle={t('v3.upload.filesHint')} onPress={() => void choose('files')} />
      </ListGroup>
      {error ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Lock size={14} color={theme.color.textTertiary} style={{ marginTop: 2 }} />
        <AppText variant="caption" style={{ flex: 1 }}>{t('v3.upload.privacy')}</AppText>
      </View>
    </Sheet>
  );
}
