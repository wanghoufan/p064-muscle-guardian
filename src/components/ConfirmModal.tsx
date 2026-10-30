import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppButton } from './ui/AppButton';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ visible, title, message, confirmText, cancelText, onConfirm, onCancel }: Props) {
  const { colors, typography } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.mask, { backgroundColor: colors.overlay }]}>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, typography.section, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
          <View style={styles.row}>
            <AppButton title={cancelText} variant="ghost" onPress={onCancel} style={styles.btn} />
            <AppButton title={confirmText} variant="primary" onPress={onConfirm} style={styles.btn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 22 },
  title: { marginBottom: 6 },
  message: { fontSize: 19, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1 },
});
