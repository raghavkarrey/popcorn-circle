import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ visible, title, body, confirmLabel, onConfirm, onCancel }: Props) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Dismiss" style={styles.dismiss} onPress={onCancel} />
        <View style={styles.card}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="muted" style={styles.body}>
            {body}
          </AppText>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
              <AppText variant="body">Keep</AppText>
            </Pressable>
            <View style={styles.confirm}>
              <PrimaryButton label={confirmLabel} tone="danger" onPress={onConfirm} testID="confirm-remove" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    zIndex: 2,
    position: 'relative',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  body: {
    marginTop: 8,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancel: {
    minHeight: 52,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    flex: 1,
  },
});
