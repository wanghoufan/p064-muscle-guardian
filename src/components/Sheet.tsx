import React from 'react';
import { Modal, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * 底部弹层：点遮罩关闭。
 * 内容用 ScrollView 承载：设置项会越加越多，面板限高 88% 时必须能滚动，
 * 否则底部的「关闭」会被裁到屏幕外点不到（真机实测踩过）。
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  panel: {
    position: 'relative',
    zIndex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    maxHeight: '88%',
  },
  scroll: { maxHeight: '100%' },
  scrollContent: { paddingBottom: 20 },
});
